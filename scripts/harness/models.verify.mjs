// Runs the model probe against a stub of the forward port: one model calls the
// tool across split chunks, one answers with text, one is rate limited.
// node scripts/harness/models.verify.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listModelIds, runModelReport } from './models.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const KEY = 'clave-de-prueba';
const scratch = await mkdtemp(join(tmpdir(), 'corteo-harness-models-'));
const seen = [];

const stub = createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${KEY}`) {
    res.writeHead(401);
    res.end('{"error":"missing or invalid API key"}');
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [{ id: 'split-good' }, { id: 'text-only' }, { id: 'busy' }],
    }));
    return;
  }
  if (req.method === 'POST' && req.url.startsWith('/v1/chat/completions')) {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const { model } = JSON.parse(raw);
      seen.push({ model, tools: JSON.parse(raw).tools });
      if (model === 'busy') {
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end('{"error":"quota exhausted"}');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (model === 'split-good') {
        res.write(': heartbeat\n\n');
        send({ choices: [{ delta: { reasoning_content: 'Pensando el corte.' } }] });
        setTimeout(() => {
          send({ choices: [{ delta: { reasoning_content: 'Ya sé qué herramienta usar.' } }] });
          send({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'split_', arguments: '{"itemId":' } }] } }] });
          setTimeout(() => {
            send({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'item', arguments: '"c1","atFrame":120}' } }] } }] });
            res.write('data: [DONE]\n\n');
            res.end();
          }, 10);
        }, 10);
        return;
      }
      send({ choices: [{ delta: { content: 'No puedo editar la línea de tiempo.' } }] });
      res.write('data: [DONE]\n\n');
      res.end();
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

try {
  await new Promise((done) => stub.listen(0, '127.0.0.1', done));
  const port = stub.address().port;
  const home = join(scratch, 'home');

  // ── discovery reads the plugin's model list ───────────────────────────────
  {
    const ids = await listModelIds({ port, key: KEY });
    assert.deepEqual(ids, ['split-good', 'text-only', 'busy']);
  }

  // ── the report tells a real tool call from text and from a 429 ────────────
  {
    const report = await runModelReport({
      root: repoRoot,
      home,
      port,
      key: KEY,
      only: ['split-good', 'text-only', 'busy'],
      pauseMs: 0,
      timeoutMs: 5000,
      log: () => {},
    });
    const byModel = Object.fromEntries(report.results.map((result) => [result.model, result]));

    assert.equal(byModel['split-good'].status, 200);
    assert.equal(byModel['split-good'].schemaAccepted, true);
    assert.equal(byModel['split-good'].toolCalled, true);
    assert.equal(byModel['split-good'].toolName, 'split_item', 'the name arrives split across chunks');
    assert.deepEqual(byModel['split-good'].arguments, { itemId: 'c1', atFrame: 120 });
    assert.equal(byModel['split-good'].argumentsValid, true);
    assert.equal(byModel['split-good'].correct, true);
    assert.ok(byModel['split-good'].firstByteMs !== null);
    assert.ok(byModel['split-good'].thinkingMs > 0, 'reasoning only counts as silent thinking');

    assert.equal(byModel['text-only'].toolCalled, false);
    assert.equal(byModel['text-only'].correct, false);
    assert.match(byModel['text-only'].excerpt, /No puedo editar/);

    assert.equal(byModel['busy'].status, 429);
    assert.equal(byModel['busy'].rateLimited, true);
    assert.equal(byModel['busy'].schemaAccepted, false);

    assert.deepEqual(report.topThree, ['split-good']);

    const json = JSON.parse(await readFile(report.jsonPath, 'utf8'));
    assert.deepEqual(json.topThree, ['split-good']);
    const md = await readFile(report.mdPath, 'utf8');
    assert.match(md, /split-good/);
    assert.match(md, /Pensamiento silencioso/);

    assert.equal(seen[0].tools.length, 5, 'five real editing schemas travel with every request');
    assert.equal(seen[0].tools[0].type, 'function');
    assert.equal(seen[0].tools[0].function.parameters.type, 'object');
  }

  // ── a happy model ranks above a combo only when it is faster ──────────────
  {
    const report = await runModelReport({
      root: repoRoot,
      home,
      port,
      key: KEY,
      only: ['split-good'],
      pauseMs: 0,
      timeoutMs: 5000,
      log: () => {},
    });
    assert.deepEqual(report.topThree, ['split-good']);
  }

  console.log('harness models verify passed (3 scenarios)');
} finally {
  await new Promise((done) => stub.close(done));
  const { rm } = await import('node:fs/promises');
  await rm(scratch, { recursive: true, force: true });
}
