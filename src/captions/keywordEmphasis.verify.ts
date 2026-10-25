// Runnable contract check for keyword emphasis (Plan 5, OP-08). Pure: which words are picked,
// what is deliberately left alone, and that writing the overrides merges instead of replacing.
import assert from 'node:assert';
import { emphasisOverrides, keywordCandidates } from './keywordEmphasis';
import type { TranscriptWord } from '../transcript/types';

const words: TranscriptWord[] = [
  { text: 'el', start: 0, end: 100 },
  { text: 'precio', start: 150, end: 500 },
  { text: 'sube', start: 550, end: 800 },
  { text: '300', start: 850, end: 1100 },
  { text: 'euros', start: 1150, end: 1400 },
  { text: 'Valeria', start: 1450, end: 1800 },
  { text: 'lo', start: 1850, end: 1950 },
  { text: 'dijo', start: 2000, end: 2300 },
  { text: 'INCREÍBLE', start: 2350, end: 2700 },
  { text: 'la', start: 2750, end: 2850 },
  { text: 'verdad', start: 2900, end: 3200 },
];

// ── 1) Numbers, names and shouted words, in reading order ─────────────────────────────
const picks = keywordCandidates(words);
assert.deepStrictEqual(picks.map((p) => p.index), [3, 5, 8], 'the price, the name and the shout');
assert.deepStrictEqual(picks.map((p) => p.reason), ['number', 'name', 'caps']);
assert.strictEqual(picks[1].word, 'Valeria');

// ── 2) What is deliberately left alone ────────────────────────────────────────────────
for (const dull of ['el', 'precio', 'sube', 'euros', 'lo', 'dijo', 'la', 'verdad']) {
  assert.ok(!picks.some((p) => p.word === dull), `"${dull}" is not emphasised`);
}
assert.deepStrictEqual(keywordCandidates([{ text: 'El', start: 0, end: 10 }]), [], 'a sentence-initial article is not a name');
assert.deepStrictEqual(keywordCandidates([{ text: 'A', start: 0, end: 10 }]), [], 'a single capital letter is not a shout');

// ── 3) The cap holds, and it is a cap rather than a filter ────────────────────────────
const many = Array.from({ length: 20 }, (_, i) => ({ text: `${i}`, start: i, end: i + 1 }));
assert.strictEqual(keywordCandidates(many).length, 8, 'eight by default');
assert.strictEqual(keywordCandidates(many, 3).length, 3, 'the cap is configurable');
assert.strictEqual(keywordCandidates(many, 999).length, 20, 'and it clamps to what exists');

// ── 4) Writing the overrides merges over what was already there ───────────────────────
const existing = { 5: { text: 'Valeria!' }, 7: { hidden: true } };
const merged = emphasisOverrides(existing, picks);
assert.deepStrictEqual(merged[5], { text: 'Valeria!', emphasis: true }, 'an existing override is extended, not replaced');
assert.deepStrictEqual(merged[7], { hidden: true }, 'unrelated overrides survive');
assert.deepStrictEqual(merged[3], { emphasis: true }, 'a new override is created');
assert.deepStrictEqual(existing, { 5: { text: 'Valeria!' }, 7: { hidden: true } }, 'the input map is not mutated');

assert.deepStrictEqual(keywordCandidates([]), [], 'empty transcript is safe');
assert.deepStrictEqual(emphasisOverrides(undefined, []), {}, 'no candidates, no overrides');

console.log('captions/keyword-emphasis.verify: ok');
