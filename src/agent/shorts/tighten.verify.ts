// Runnable contract check for the tighten preview (Plan 5, OP-06). Pure transcript math:
// no model, no editor, no network.
import assert from 'node:assert';
import { previewTighten } from './tighten';
import type { WordLike } from './types';

const words: WordLike[] = [
  { text: 'eh', start: 0, end: 250 },          // filler
  { text: 'hoy', start: 300, end: 600 },
  { text: 'os', start: 700, end: 800 },
  { text: 'este', start: 900, end: 1200 },     // filler
  { text: 'yo', start: 1300, end: 1450 },
  { text: 'yo', start: 1500, end: 1650 },      // repeated → false start
  { text: 'creo', start: 1700, end: 2000 },
  { text: 'o', start: 2100, end: 2150 },
  { text: 'sea', start: 2200, end: 2400 },     // "o sea" phrase
  { text: 'que', start: 2500, end: 2700 },
  { text: 'sí.', start: 3600, end: 3900 },     // 900 ms pause before it
];

const preview = previewTighten(words);
const texts = preview.fillers.map((hit) => hit.word);
assert.ok(texts.includes('eh'), 'a plain Spanish filler is found');
assert.ok(texts.includes('este'), 'a hesitation filler is found');
assert.ok(texts.includes('yo'), 'a repeated word is found as a false start');
assert.ok(texts.includes('o'), 'the first half of a two-word filler is found');
assert.deepStrictEqual(
  [...new Set(preview.fillers.map((hit) => hit.reason))].sort(),
  ['filler', 'phrase', 'repeated'],
  'each kind of hit is labelled',
);

assert.strictEqual(preview.pauses.length, 1, 'the 900 ms gap is reported');
assert.strictEqual(preview.pauses[0].gapMs, 900);
assert.strictEqual(preview.pauses[0].afterWordIndex, 9, 'the pause is anchored to the word before it');
assert.ok(preview.savedMs > 900, `the recovered time counts fillers plus the pause over the cap, got ${preview.savedMs}`);

// The cap is a report cap, not a silent truncation: `hidden` says how much was left out.
const capped = previewTighten(words, { limit: 2 });
assert.strictEqual(capped.fillers.length, 2);
assert.ok(capped.hidden >= 2, 'what is not shown is counted');

// Tighten options are honoured: a high pause cap finds nothing, an extra filler can be added.
assert.strictEqual(previewTighten(words, { minPauseMs: 5000 }).pauses.length, 0, 'no pause over 5 s exists');
const extra = previewTighten([{ text: 'chévere', start: 0, end: 200 }], { extraFillers: ['chévere'] });
assert.strictEqual(extra.fillers.length, 1, 'an extra filler word is matched');
assert.strictEqual(extra.fillers[0].reason, 'filler');

// Punctuation and case do not hide a filler.
const messy = previewTighten([{ text: 'Eh,', start: 0, end: 200 }, { text: 'bueno,', start: 300, end: 500 }]);
assert.strictEqual(messy.fillers.length, 2, 'punctuation and case are normalised');

assert.deepStrictEqual(previewTighten([]), { fillers: [], pauses: [], savedMs: 0, hidden: 0 }, 'empty transcript is safe');

console.log('shorts/tighten.verify: ok');
