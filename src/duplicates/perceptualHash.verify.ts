// perceptualHash.verify — Phase 3.4: dHash signing + duplicate grouping.
// Signatures are 64 bits over a 9×8 luma grid; grouping is union-find so a chain
// of near-identical re-cuts reports one group instead of losing members.
import assert from 'node:assert/strict';
import {
  DEFAULT_DUPLICATE_THRESHOLD,
  HASH_BITS,
  HASH_ROWS,
  SAMPLE_COLUMNS,
  differenceHash,
  groupDuplicates,
  hammingDistance,
  similarityOf,
} from './perceptualHash';

const SAMPLES = SAMPLE_COLUMNS * HASH_ROWS;
const flat = (value: number): number[] => Array.from({ length: SAMPLES }, () => value);

// ── Hashing ─────────────────────────────────────────────────────────────────

assert.equal(HASH_BITS, 64, 'a signature is 64 bits');
assert.equal(differenceHash(flat(128)), '0'.repeat(64), 'a flat frame has no gradients');
// A bit marks "brighter than the neighbour on the right", so a ramp that
// darkens left-to-right sets every bit and its reverse sets none.
assert.equal(
  differenceHash(Array.from({ length: SAMPLES }, (_, index) => SAMPLE_COLUMNS - 1 - (index % SAMPLE_COLUMNS))),
  '1'.repeat(64),
  'a left-to-right darkening ramp sets every bit',
);
assert.equal(
  differenceHash(Array.from({ length: SAMPLES }, (_, index) => index % SAMPLE_COLUMNS)),
  '0'.repeat(64),
  'a brightening ramp sets none',
);
assert.throws(() => differenceHash([1, 2, 3]), /needs 72 samples/, 'short grids are rejected');

// ── Distance / similarity ───────────────────────────────────────────────────

assert.equal(hammingDistance('0'.repeat(64), '0'.repeat(64)), 0);
assert.equal(hammingDistance('0'.repeat(64), '1'.repeat(64)), 64);
assert.equal(hammingDistance('0011', '0000'), 2);
assert.equal(similarityOf(0), 100);
assert.equal(similarityOf(64), 0);
assert.equal(similarityOf(16), 75);

// ── Grouping ────────────────────────────────────────────────────────────────

const ZERO = '0'.repeat(64);
const ONE = '1'.repeat(64);

const none = groupDuplicates([{ id: 'a', hash: ZERO }, { id: 'b', hash: ONE }]);
assert.deepEqual(none, [], 'unrelated frames are not grouped');

const pair = groupDuplicates([
  { id: 'a', hash: '0'.repeat(64) },
  { id: 'b', hash: `${'0'.repeat(60)}1111` },
  { id: 'c', hash: '1'.repeat(64) },
]);
assert.equal(pair.length, 1, 'only the close pair is grouped');
assert.deepEqual(pair[0]!.clips.sort(), ['a', 'b']);
assert.equal(pair[0]!.similarity, 93.8, 'similarity follows the worst distance');

// Transitive chain: a~b (2 bits), b~c (2 bits), a-c (4 bits) — all within the default threshold.
const chain = groupDuplicates([
  { id: 'a', hash: '0'.repeat(64) },
  { id: 'b', hash: `${'0'.repeat(62)}11` },
  { id: 'c', hash: `${'0'.repeat(60)}1111` },
  { id: 'd', hash: ONE },
]);
assert.equal(chain.length, 1, 'a chain of near-identical cuts is one group');
assert.deepEqual(chain[0]!.clips.sort(), ['a', 'b', 'c']);
assert.equal(chain[0]!.clips.includes('d'), false, 'the far clip stays out');

const strict = groupDuplicates([
  { id: 'a', hash: '0'.repeat(64) },
  { id: 'b', hash: `${'0'.repeat(62)}11` },
], 1);
assert.deepEqual(strict, [], 'a lower threshold splits the pair again');
assert.equal(DEFAULT_DUPLICATE_THRESHOLD, 6);

// Two independent groups sort by similarity (tightest first).
const twoGroups = groupDuplicates([
  { id: 'a1', hash: '0'.repeat(64) },
  { id: 'a2', hash: '0'.repeat(64) },
  { id: 'b1', hash: '1'.repeat(64) },
  { id: 'b2', hash: `${'1'.repeat(60)}0000` },
]);
assert.equal(twoGroups.length, 2);
assert.equal(twoGroups[0]!.similarity >= twoGroups[1]!.similarity, true, 'tightest group listed first');

console.log('perceptualHash.verify: dHash bits, Hamming distance and union-find grouping');
