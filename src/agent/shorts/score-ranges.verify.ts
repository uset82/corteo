// Runnable contract check for scoreRanges (Plan 5, OP-02): the bridge that turns
// already-chosen word ranges into the same 0-99 score `score_moments` produces. The model
// is stubbed; no network.
import assert from 'node:assert';
import { scoreRanges } from './score-ranges';
import { setRubricScorer } from './rubric';
import type { WordLike } from './types';

const words: WordLike[] = [
  { text: 'hola', start: 0, end: 300 }, { text: 'estoy', start: 400, end: 700 },
  { text: 'aquí.', start: 800, end: 1100 }, { text: 'nadie', start: 2000, end: 2400 },
  { text: 'te', start: 2500, end: 2700 }, { text: 'dice', start: 2800, end: 3000 },
  { text: 'esto.', start: 3100, end: 3400 }, { text: 'el', start: 5000, end: 5100 },
  { text: 'precio', start: 5200, end: 5500 }, { text: 'sube.', start: 5600, end: 5900 },
];

// ── 1) Empty inputs short-circuit instead of calling the model ──────────────────────────
let calls = 0;
setRubricScorer(async () => { calls += 1; return { moments: [] }; });
const empty = await scoreRanges(words, []);
assert.deepStrictEqual(empty, { scores: [], modelUsed: false });
assert.strictEqual(calls, 0, 'no model call for an empty range list');

// ── 2) No model → measured score, aligned to input order, still 0-99 ───────────────────
const measured = await scoreRanges(words, [
  { startWord: 3, endWord: 6 },
  { startWord: 0, endWord: 2 },
], { useModel: false });
assert.strictEqual(calls, 0, 'useModel:false never calls the model');
assert.strictEqual(measured.modelUsed, false);
assert.deepStrictEqual(measured.scores.map((s) => s.index), [0, 1], 'scores keep input order');
assert.deepStrictEqual(measured.scores.map((s) => s.startWord), [3, 0], 'ranges are echoed back');
for (const score of measured.scores) {
  assert.ok(score.score >= 0 && score.score <= 99, `score in 0-99, got ${score.score}`);
  assert.strictEqual(score.title, '', 'no model, no title');
}

// ── 3) With a model, the verdict is blended in (40 %) and carries title/reason/risks ───
setRubricScorer(async (candidates) => ({
  genre: 'podcast',
  moments: candidates.map((c) => ({
    start: c.startWord, end: c.endWord,
    hook: 100, flow: 100, value: 100,
    title: 'El precio sube', reason: 'cierra con un dato', risks: ['necesita contexto'],
  })),
}));
const withModel = await scoreRanges(words, [{ startWord: 7, endWord: 9 }]);
assert.strictEqual(withModel.modelUsed, true, 'model verdicts are reported');
const first = withModel.scores[0];
assert.strictEqual(first.title, 'El precio sube');
assert.strictEqual(first.reason, 'cierra con un dato');
assert.deepStrictEqual(first.risks, ['necesita contexto']);
assert.ok(first.score > measured.scores[0].score, 'a perfect model verdict lifts the score');

// Sound is never set by the model: 100 hook/flow/value + measured sound stays under 99 only
// when the measured sound is low, and the sub-score is the measured one.
const measuredSame = await scoreRanges(words, [{ startWord: 7, endWord: 9 }], { useModel: false });
assert.strictEqual(first.subscores.sound, measuredSame.scores[0].subscores.sound, 'sound stays measured');

// ── 4) Out-of-bounds ranges are clamped, not fatal (untrusted selection upstream) ──────
setRubricScorer(async () => ({ moments: [] }));
const clamped = await scoreRanges(words, [{ startWord: -5, endWord: 999 }]);
assert.strictEqual(clamped.scores.length, 1);
assert.strictEqual(clamped.scores[0].startWord, 0);
assert.strictEqual(clamped.scores[0].endWord, words.length - 1);

// ── 5) A failing model degrades to the measured score ──────────────────────────────────
setRubricScorer(async () => { throw new Error('offline'); });
const offline = await scoreRanges(words, [{ startWord: 0, endWord: 2 }]);
assert.strictEqual(offline.modelUsed, false);
assert.strictEqual(offline.scores.length, 1);
assert.ok(offline.scores[0].score >= 0, 'measured score survives a dead provider');

setRubricScorer(null);
console.log('shorts/score-ranges.verify: ok');
