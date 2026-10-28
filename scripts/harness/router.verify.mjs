import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { startBrainRouter } from './router.mjs';

const key = 'test-forward-key';
let mode = 'failover';
const calls = [];
const forward = createServer((req, res) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    const payload = JSON.parse(data);
    calls.push(payload.model);
    assert.equal(req.headers.authorization, `Bearer ${key}`);
    if (mode === 'timeout' && payload.model === 'A') return;
    if (mode === 'auth') { res.writeHead(401); res.end(); return; }
    if (mode === 'all429' || (mode === 'failover' && payload.model === 'A')) {
      res.writeHead(429); res.end(); return;
    }
    if (mode === 'sse') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"model":"B","choices":[]}\n\n');
      res.write('data: not-json\n\n');
      res.end('data: [DONE]\n\n');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: payload.model, choices: [{ message: { content: 'ok' } }] }));
  });
});
await new Promise((resolve) => forward.listen(0, '127.0.0.1', resolve));
const forwardPort = forward.address().port;
const brain = { candidates: ['A', 'B'], aliases: {
  'corteo-edit': { order: 'listed', lanes: ['A', 'B'], firstByteTimeoutMs: 200 },
  'corteo-draft': { order: 'latency', needsProse: true, firstByteTimeoutMs: 200 },
  'corteo-fast': { order: 'latency', firstByteTimeoutMs: 200 },
} };
let probe = { A: { ok: true, prose: true, latencyMs: 1 }, B: { ok: true, prose: true, latencyMs: 2 } };
const { server, port } = await startBrainRouter({ brain, getProbe: () => probe,
  forwardPort, forwardKey: key, port: 0 });
const base = `http://127.0.0.1:${port}`;
const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
const post = (model, extra = {}) => fetch(base + '/v1/chat/completions', {
  method: 'POST', headers, body: JSON.stringify({ model, messages: [], ...extra }),
});
try {
  assert.equal(server.address().address, '127.0.0.1');
  assert.equal((await fetch(base + '/v1/models')).status, 401);
  const models = await (await fetch(base + '/v1/models', { headers })).json();
  assert.deepEqual(models.data.map((model) => model.id), ['corteo-edit', 'corteo-draft', 'corteo-fast']);
  assert.equal(JSON.stringify(models).includes('"A"'), false);
  assert.equal((await post('nope')).status, 404);
  let response = await post('corteo-edit');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-corteo-lane'), 'B');
  assert.equal((await response.json()).model, 'corteo-edit');
  assert.deepEqual(calls.splice(0), ['A', 'B']);
  mode = 'timeout';
  response = await post('corteo-edit');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-corteo-lane'), 'B');
  assert.deepEqual(calls.splice(0), ['A', 'B']);
  mode = 'all429';
  response = await post('corteo-edit');
  const exhausted = await response.json();
  assert.equal(response.status, 503);
  assert.equal(exhausted.error.code, 'no_lane');
  assert.equal(exhausted.error.tried.length, 2);
  calls.length = 0;
  mode = 'auth';
  response = await post('corteo-edit');
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'forward_key_rejected');
  assert.deepEqual(calls.splice(0), ['A']);
  mode = 'sse';
  response = await post('corteo-edit', { stream: true });
  const stream = await response.text();
  assert.match(stream, /"model":"corteo-edit"/);
  assert.match(stream, /data: not-json/);
  assert.match(stream, /data: \[DONE\]/);
  probe = null;
  assert.equal((await (await post('corteo-edit')).json()).error.code, 'no_probe');
  probe = { A: { ok: false }, B: { ok: false } };
  assert.equal((await (await post('corteo-edit')).json()).error.code, 'no_lane');
  const source = await readFile(new URL('./router.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('0.0.0.0'));
  for (const line of source.split('\n').filter((line) => line.includes('.listen('))) assert.ok(line.includes("'127.0.0.1'"));
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  forward.closeAllConnections();
  await new Promise((resolve) => forward.close(resolve));
}
const closed = await startBrainRouter({ brain, getProbe: () => ({ A: { ok: true }, B: { ok: true } }),
  forwardPort, forwardKey: key, port: 0 });
try {
  const response = await fetch(`http://127.0.0.1:${closed.port}/v1/chat/completions`, {
    method: 'POST', headers, body: JSON.stringify({ model: 'corteo-edit', messages: [] }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'forward_down');
} finally {
  closed.server.closeAllConnections();
  await new Promise((resolve) => closed.server.close(resolve));
}
console.log('router.verify: ok');
