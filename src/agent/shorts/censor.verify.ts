// Runnable contract check for profanity detection (Plan 5, OP-07). Pure token matching.
import assert from 'node:assert';
import { censorDictionary, findCensorHits } from './censor';
import type { WordLike } from './types';

const words: WordLike[] = [
  { text: 'esto', start: 0, end: 300 },
  { text: 'es', start: 350, end: 450 },
  { text: 'una', start: 500, end: 700 },
  { text: 'mierda.', start: 750, end: 1100 },
  { text: 'y', start: 1150, end: 1250 },
  { text: 'ese', start: 1300, end: 1500 },
  { text: 'cabrón', start: 1550, end: 1900 },
  { text: 'de', start: 1950, end: 2050 },
  { text: 'ahí', start: 2100, end: 2300 },
  { text: 'Cabron.', start: 2350, end: 2700 },
];

const hits = findCensorHits(words);
assert.strictEqual(hits.length, 3, `three hits, got ${hits.length}`);
assert.deepStrictEqual(hits.map((hit) => hit.index), [3, 6, 9], 'hits point at the right words');
assert.strictEqual(hits[0].word, 'mierda.', 'the original text is preserved for the review list');
assert.strictEqual(hits[0].startMs, 750, 'timing comes from the transcript');

// Accents and case must not hide a word: "cabrón" and "Cabron." are the same entry.
assert.strictEqual(hits[1].word, 'cabrón');
assert.strictEqual(hits[2].word, 'Cabron.');

// Innocuous words are not matched, including near-misses of a dictionary entry.
assert.deepStrictEqual(findCensorHits([{ text: 'cabronada', start: 0, end: 100 }]), [], 'no substring matching');
assert.deepStrictEqual(findCensorHits([{ text: 'putear', start: 0, end: 100 }]), [], 'no stemming guesses');

// Extra words are added for this run only.
const extra = findCensorHits([{ text: 'chorizo', start: 0, end: 200 }], ['chorizo']);
assert.strictEqual(extra.length, 1, 'a caller-supplied word is matched');
assert.deepStrictEqual(findCensorHits([{ text: 'chorizo', start: 0, end: 200 }]), [], 'and only when supplied');

// The dictionary is accent-insensitive in both directions.
const dictionary = censorDictionary();
assert.ok(dictionary.has('cabron'), 'accent-free alias is present');
assert.ok(dictionary.size > 30, 'the dictionary is populated');

assert.deepStrictEqual(findCensorHits([]), [], 'empty transcript is safe');

console.log('shorts/censor.verify: ok');
