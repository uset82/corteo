import assert from 'node:assert/strict';
import { ladderFor } from './ladder.mjs';

const brain = { candidates: ['A', 'B', 'C', 'D', 'E'], aliases: {
  'corteo-edit': { order: 'listed', lanes: ['C', 'B', 'A'] },
  'corteo-draft': { order: 'latency', needsProse: true },
  'corteo-fast': { order: 'latency' },
} };
const probe = { A: { ok: true, prose: true, latencyMs: 50 }, B: { ok: false },
  C: { ok: true, prose: false, latencyMs: 10 } };
assert.deepEqual(ladderFor('corteo-edit', brain, probe), ['C', 'A']);
assert.deepEqual(ladderFor('corteo-draft', brain, probe), ['A']);
assert.deepEqual(ladderFor('corteo-fast', brain, probe), ['C', 'A']);
assert.deepEqual(ladderFor('corteo-fast', brain, null), []);
assert.throws(() => ladderFor('nope', brain, probe), /unknown alias nope: use corteo-edit, corteo-draft or corteo-fast/);
console.log('ladder.verify: ok');
