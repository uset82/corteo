import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ladderFor } from './ladder.mjs';
import { probeLanes, readBrainState, writeBrainState } from './probe.mjs';

const key = 'private-test-key-never-stored';
const requests = [];
const server = createServer((req, res) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    const body = JSON.parse(data); requests.push(body);
    assert.equal(req.headers.authorization, `Bearer ${key}`);
    if (body.model === 'D') return;
    if (body.model === 'B' || body.model === 'E') { res.writeHead(body.model === 'B' ? 429 : 404); res.end(); return; }
    setTimeout(() => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: body.model === 'A'
        ? { content: 'listo' } : { content: '', reasoning_content: 'thinking' } }] }));
    }, body.model === 'A' ? 50 : 5);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const home = await mkdtemp(join(tmpdir(), 'brain-probe-'));
try {
  const probe = await probeLanes({ port: server.address().port, key, candidates: ['A', 'B', 'C', 'D', 'E'],
    timeoutMs: 300, pauseMs: 0 });
  assert.equal(requests.length, 5);
  assert.equal(requests[0].max_tokens, 16);
  assert.deepEqual([probe.A.ok, probe.A.status, probe.A.prose], [true, 200, true]);
  assert.deepEqual([probe.B.ok, probe.B.status], [false, 429]);
  assert.deepEqual([probe.C.ok, probe.C.prose], [true, false]);
  assert.equal(probe.D.error, 'timeout');
  assert.deepEqual([probe.E.ok, probe.E.status], [false, 404]);
  const brain = { candidates: ['A', 'B', 'C', 'D', 'E'], aliases: {
    'corteo-edit': { order: 'listed', lanes: ['A', 'B', 'C'] },
    'corteo-draft': { order: 'latency', needsProse: true },
    'corteo-fast': { order: 'latency' },
  } };
  assert.deepEqual(ladderFor('corteo-edit', brain, probe), ['A', 'C']);
  assert.deepEqual(ladderFor('corteo-draft', brain, probe), ['A']);
  assert.deepEqual(ladderFor('corteo-fast', brain, probe), ['C', 'A']);
  await writeBrainState(home, { probe });
  await writeBrainState(home, { updated: true });
  assert.equal((await readBrainState(home)).probe.A.ok, true);
  assert.equal((await stat(join(home, 'brain.json'))).mode & 0o777, 0o600);
  assert.ok(!(await readFile(join(home, 'brain.json'), 'utf8')).includes(key));
  console.log('probe.verify: ok');
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(home, { recursive: true, force: true });
}
