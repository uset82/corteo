// Asks every free model one question that needs a tool call, with five real
// editing schemas attached, and records what came back. The report stays in
// $DSH_HOME/reports: models, arguments and timing never enter the repo.
// node scripts/harness/models.mjs [--home <dir>] [--forward-port <n>] [--only a,b] [--timeout ms] [--pause ms]
import { request } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import {
  homeFrom, httpGet, loadHarnessConfig, parseArgs, pathsFor, readJson,
} from './lib.mjs';
import { findForwardPort } from './doctor.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const TOOL_NAMES = ['read_timeline', 'split_item', 'set_item_timing', 'move_item', 'edit_item'];
const EXPECTED = { name: 'split_item', args: { itemId: 'c1', atFrame: 120 } };
const SYSTEM = [
  'Eres un editor de video. La línea de tiempo tiene una pista V1 con un clip.',
  'clip c1: video, empieza en el fotograma 0, dura 300 fotogramas.',
  'Cuando la petición pida un cambio, llama a la herramienta adecuada. No respondas solo con texto.',
].join('\n');
const PROMPT = 'Corta el clip c1 en el fotograma 120.';

export async function loadToolSchemas(root) {
  const catalog = await readJson(join(root, 'assets/agent/openchatcut-tool-schemas.json'));
  if (!catalog?.edit) throw new Error('Falta assets/agent/openchatcut-tool-schemas.json: ejecuta npm run generate:server-tool-catalog.');
  return TOOL_NAMES.map((name) => {
    const tool = catalog.edit.find((entry) => entry.name === name);
    if (!tool) throw new Error(`El catálogo no trae ${name}.`);
    return { type: 'function', function: { name, description: tool.description, parameters: tool.input_schema } };
  });
}

export async function listModelIds({ port, key, probe = httpGet }) {
  const answer = await probe({ port, path: '/v1/models', headers: { Authorization: `Bearer ${key}` } });
  if (answer.status !== 200) throw new Error(`/v1/models contestó ${answer.status} en el puerto ${port}.`);
  const body = JSON.parse(answer.body);
  return (body.data ?? []).map((model) => model.id);
}

// One streaming call. Heartbeat comments (": ...") and silence are normal on the
// free lanes, so both are measured instead of treated as failures.
export function streamCompletion({ port, key, model, tools, timeoutMs = 120_000 }) {
  return new Promise((done) => {
    const startedAt = Date.now();
    const state = {
      status: 0, firstByteAt: null, firstTokenAt: null, reasoningFirstAt: null, reasoningLastAt: null,
      content: '', reasoning: '', toolCalls: [], error: null, errorText: '',
    };
    let settled = false;
    const finish = () => {
      if (settled) return null;
      settled = true;
      return {
        ...state,
        latencyMs: Date.now() - startedAt,
        firstByteMs: state.firstByteAt ? state.firstByteAt - startedAt : null,
        firstTokenMs: state.firstTokenAt ? state.firstTokenAt - startedAt : null,
        thinkingMs: state.reasoningFirstAt && state.reasoningLastAt
          ? state.reasoningLastAt - state.reasoningFirstAt
          : 0,
      };
    };
    const settle = () => done(finish());

    const body = JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: PROMPT }],
      tools,
      tool_choice: 'auto',
    });
    const req = request({
      host: '127.0.0.1',
      port,
      path: '/v1/chat/completions',
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      state.status = res.statusCode ?? 0;
      res.setEncoding('utf8');
      if (state.status !== 200) {
        res.on('data', (chunk) => { state.errorText = (state.errorText + chunk).slice(0, 4000); });
        res.on('end', settle);
        return;
      }
      let buffer = '';
      res.on('data', (chunk) => {
        const now = Date.now();
        if (!state.firstByteAt) state.firstByteAt = now;
        buffer += chunk;
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
          if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let json;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.reasoning_content) {
            state.reasoning += delta.reasoning_content;
            state.reasoningFirstAt ??= now;
            state.reasoningLastAt = now;
            state.firstTokenAt ??= now;
          }
          if (delta.content) {
            state.content += delta.content;
            state.firstTokenAt ??= now;
          }
          for (const call of delta.tool_calls ?? []) {
            const index = call.index ?? 0;
            state.toolCalls[index] ??= { id: '', name: '', arguments: '' };
            if (call.id) state.toolCalls[index].id = call.id;
            if (call.function?.name) state.toolCalls[index].name += call.function.name;
            if (call.function?.arguments) state.toolCalls[index].arguments += call.function.arguments;
            state.firstTokenAt ??= now;
          }
        }
      });
      res.on('end', settle);
    });
    req.on('timeout', () => {
      state.error = 'timeout';
      req.destroy();
    });
    req.on('error', (error) => {
      state.error ??= error.code ?? error.message;
      settle();
    });
    req.end(body);
  });
}

function compiledValidators(tools) {
  const ajv = new Ajv({ strict: false, allErrors: true });
  return new Map(tools.map((tool) => [tool.function.name, ajv.compile(tool.function.parameters)]));
}

export async function probeModel({ model, port, key, tools, validators, timeoutMs }) {
  const stream = await streamCompletion({ port, key, model, tools, timeoutMs });
  const call = stream.toolCalls[0] ?? null;
  let args = null;
  if (call?.arguments) {
    try {
      args = JSON.parse(call.arguments);
    } catch {
      args = null;
    }
  }
  const validate = call ? validators.get(call.name) : null;
  const argumentsValid = Boolean(args && validate && validate(args));
  const correct = Boolean(
    call?.name === EXPECTED.name
    && args?.itemId === EXPECTED.args.itemId
    && args?.atFrame === EXPECTED.args.atFrame,
  );
  const rateLimited = stream.status === 429;
  return {
    model,
    status: stream.status,
    schemaAccepted: stream.status === 200,
    rateLimited,
    toolCalled: Boolean(call?.name),
    toolName: call?.name ?? null,
    arguments: args,
    argumentsValid,
    correct,
    latencyMs: stream.latencyMs,
    firstByteMs: stream.firstByteMs,
    firstTokenMs: stream.firstTokenMs,
    thinkingMs: stream.thinkingMs,
    error: stream.error ?? (rateLimited ? '429 rate limit' : stream.status === 200 ? null : 'http error'),
    excerpt: (stream.content || stream.errorText).slice(0, 300),
  };
}

function markdown(report) {
  const rows = report.results.map((result) => [
    `\`${result.model}\``,
    result.schemaAccepted ? 'sí' : 'no',
    result.toolCalled ? `\`${result.toolName}\`` : 'no',
    result.argumentsValid ? 'sí' : 'no',
    result.correct ? 'sí' : 'no',
    `${result.latencyMs} ms`,
    result.firstByteMs === null ? '—' : `${result.firstByteMs} ms`,
    result.thinkingMs ? `${result.thinkingMs} ms` : '—',
    result.error ?? '',
  ].map((cell) => cell.replaceAll('|', '\\|')).join(' | '));
  return [
    `# Modelos que pueden editar (${report.generatedAt})`,
    '',
    `Puerto ${report.forwardPort}; mensaje: «${report.prompt}»`,
    '',
    '| Modelo | Esquema | Herramienta | Argumentos | Correcto | Latencia | Primer byte | Pensamiento silencioso | Notas |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row} |`),
    '',
  ].join('\n');
}

function ranking(results) {
  const passing = results.filter((result) => result.schemaAccepted && result.toolCalled && result.argumentsValid && result.correct);
  return passing.sort((a, b) => {
    const combo = Number(!a.model.startsWith('combo:')) - Number(!b.model.startsWith('combo:'));
    return combo || a.latencyMs - b.latencyMs;
  });
}

export async function runModelReport({
  root = repoRoot,
  home,
  port = 18899,
  key,
  only = [],
  timeoutMs = 120_000,
  pauseMs = 1500,
  probe = httpGet,
  log = console.log,
} = {}) {
  const tools = await loadToolSchemas(root);
  const validators = compiledValidators(tools);
  const models = only.length ? only : await listModelIds({ port, key, probe });
  const results = [];
  for (const model of models) {
    log(`• ${model}`);
    results.push(await probeModel({ model, port, key, tools, validators, timeoutMs }));
    if (pauseMs) await new Promise((done) => setTimeout(done, pauseMs));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    forwardPort: port,
    prompt: PROMPT,
    tools: TOOL_NAMES,
    results,
    topThree: ranking(results).slice(0, 3).map((result) => result.model),
  };
  const reportsDir = join(home, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const stamp = report.generatedAt.replaceAll(':', '-').replace(/\..*/, '');
  const jsonPath = join(reportsDir, `harness-models-${stamp}.json`);
  const mdPath = join(reportsDir, `harness-models-${stamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, markdown(report));
  log(`\n${results.length} modelos probados. Informe: ${jsonPath}`);
  log(report.topThree.length
    ? `Los tres que editan mejor: ${report.topThree.join(', ')}`
    : 'Ningún modelo completó el corte con una llamada de herramienta válida.');
  return { ...report, jsonPath, mdPath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs(process.argv.slice(2));
  const known = new Set(['home', 'forward-port', 'only', 'timeout', 'pause', 'key']);
  const unknown = Object.keys(values).filter((key) => !known.has(key));
  if (unknown.length) {
    console.error(`Argumentos desconocidos: ${unknown.map((key) => `--${key}`).join(', ')}`);
    process.exit(1);
  }
  try {
    const config = await loadHarnessConfig(repoRoot);
    const home = homeFrom(config, values);
    const settings = await readJson(pathsFor(home, config).pluginSettings);
    const key = values.key ?? settings?.forwardKey;
    if (!key) throw new Error('No hay clave de reenvío. Ejecuta npm run harness y npm run harness:doctor.');
    const port = values['forward-port']
      ? Number(values['forward-port'])
      : await findForwardPort({ start: config.ports.forward, range: config.forwardPortRange ?? 10, key });
    const report = await runModelReport({
      root: repoRoot,
      home,
      port: Number.isFinite(port) && port ? port : config.ports.forward,
      key,
      only: values.only ? values.only.split(',').map((id) => id.trim()).filter(Boolean) : [],
      timeoutMs: Number(values.timeout ?? 120_000),
      pauseMs: Number(values.pause ?? 1500),
    });
    if (!report.results.length) process.exitCode = 1;
  } catch (error) {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
  }
}
