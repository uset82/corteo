import { spawn } from 'node:child_process';
import { openSync, closeSync, chmodSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installHarness } from './install.mjs';
import { runDoctor, findForwardPort } from './doctor.mjs';
import { forwardKeyFrom, homeFrom, httpGet, loadHarnessConfig, parseArgs, pathsFor } from './lib.mjs';
import { readBrainState } from './probe.mjs';
import { BRAIN_ALIASES } from './ladder.mjs';
import { linkEditor } from './editor-link.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

async function routerReady(port, key) {
  const response = await httpGet({ port, path: '/v1/models', headers: { Authorization: `Bearer ${key}` } });
  if (response.status !== 200) return false;
  try {
    const ids = JSON.parse(response.body).data.map((entry) => entry.id);
    return BRAIN_ALIASES.every((id) => ids.includes(id));
  } catch { return false; }
}

export async function bootBrain({ config, home, webPort, forwardPort, routerPort,
  editorUrl, noEditor = false, forwardTimeoutMs = 120000, env = process.env } = {}) {
  const paths = pathsFor(home, config);
  const web = Number(webPort ?? config.ports.web);
  const forward = Number(forwardPort ?? config.ports.forward);
  const router = Number(routerPort ?? config.brain.routerPort);
  const log = join(home, 'logs/brain.log');
  const result = { ok: false, step: 'install', home, webPort: web, forwardPort: null, routerPort: router,
    brainUrl: `http://127.0.0.1:${router}/v1`, aliases: BRAIN_ALIASES,
    editor: 'skipped', probe: null, log };
  let key = null;
  let startedPid = null;
  try {
    await installHarness({ root, home, env, step: () => {}, done: () => {} });
    result.step = 'start';
    const state = await readBrainState(home);
    key = await forwardKeyFrom(paths.pluginSettings);
    if (!(alive(state.pid) && key && await routerReady(state.routerPort, key))) {
      await mkdir(join(home, 'logs'), { recursive: true });
      const fd = openSync(log, 'a', 0o600);
      chmodSync(log, 0o600);
      try {
        const child = spawn(process.execPath, [join(root, 'scripts/harness/brain.mjs'), 'serve',
          '--home', home, '--web-port', String(web), '--forward-port', String(forward), '--router-port', String(router)],
        { detached: true, stdio: ['ignore', fd, fd], env });
        startedPid = child.pid ?? null;
        child.unref();
      } finally { closeSync(fd); }
    } else {
      result.routerPort = state.routerPort;
      result.brainUrl = `http://127.0.0.1:${state.routerPort}/v1`;
    }
    result.step = 'forward';
    const deadline = Date.now() + forwardTimeoutMs;
    let port = null;
    while (Date.now() < deadline) {
      key = await forwardKeyFrom(paths.pluginSettings);
      if (key) port = await findForwardPort({ start: forward, range: config.forwardPortRange ?? 10, key });
      if (port) break;
      await sleep(250);
    }
    if (!port || !key) throw new Error('forward port did not become ready');
    result.forwardPort = port;
    result.step = 'doctor';
    await runDoctor({ root, home, webPort: web, forwardPort: forward, env,
      showKey: false, log: () => {}, step: () => {}, done: () => {} });
    result.step = 'router';
    const routerDeadline = Date.now() + 60000;
    while (Date.now() < routerDeadline && !await routerReady(result.routerPort, key)) await sleep(250);
    if (!await routerReady(result.routerPort, key)) throw new Error('router did not become ready');
    result.step = 'editor';
    result.editor = noEditor ? 'skipped' : await linkEditor({ editorUrl, forwardKey: key, forwardPort: port });
    result.step = 'probe';
    let answer;
    try {
      answer = await fetch(`http://127.0.0.1:${result.routerPort}/v1/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'corteo-edit', max_tokens: 16,
          messages: [{ role: 'user', content: 'Responde solo: listo' }] }),
        signal: AbortSignal.timeout(config.brain.aliases['corteo-edit'].firstByteTimeoutMs + 5000),
      });
    } catch { throw new Error('router_down'); }
    if (!answer.ok) {
      let code = 'brain_unavailable';
      try { code = (await answer.json())?.error?.code ?? code; } catch { /* non-JSON error */ }
      throw new Error(code);
    }
    await answer.body?.cancel();
    result.probe = { alias: 'corteo-edit', lane: answer.headers.get('x-corteo-lane'),
      latencyMs: Number(answer.headers.get('x-corteo-latency-ms')) };
    result.ok = true;
    result.step = null;
  } catch (error) {
    if (startedPid && ['forward', 'doctor', 'router'].includes(result.step) && alive(startedPid)) {
      try { process.kill(startedPid, 'SIGTERM'); } catch { /* already stopped */ }
    }
    result.error = (error instanceof Error ? error.message : String(error)).replaceAll(key || '\0', '[redacted]');
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, flags } = parseArgs(process.argv.slice(2));
  try {
    const config = await loadHarnessConfig(root);
    const home = homeFrom(config, values);
    const output = await bootBrain({ config, home, webPort: values['web-port'], forwardPort: values['forward-port'],
      routerPort: values['router-port'], forwardTimeoutMs: Number(values['forward-timeout-ms'] ?? 120000),
      editorUrl: values['editor-url'] ?? `http://127.0.0.1:${process.env.CORTEO_PORT ?? '5199'}`,
      noEditor: flags.has('no-editor') });
    if (flags.has('json')) console.log(JSON.stringify(output));
    else console.log(output.ok ? `Cerebro listo: ${output.brainUrl}; editor: ${output.editor}` : `Cerebro: falló ${output.step}: ${output.error}`);
    if (!output.ok) process.exitCode = 1;
  } catch (error) {
    if (flags.has('json')) console.log(JSON.stringify({ ok: false, step: 'install', error: error.message }));
    else console.error(error.message);
    process.exitCode = 1;
  }
}
