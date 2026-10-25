// Runnable contract check: `npm run verify:agent-tools` (or npx tsx this file).
// Covers the deterministic core of the Opus-parity rubric (Plan 5, OP-01): chapter
// segmentation, sentence-aligned candidates, measured signals, the 60/40 blend, the 0-99
// composite, the gates, the overlap dedupe and the parsing of untrusted model output.
// The model is never called here.
import assert from 'node:assert';
import { buildCandidates } from './candidates';
import { segmentChapters } from './chapters';
import { corpusStats, deterministicScores } from './signals';
import { blendScores, composite, dedupeByOverlap, gateMoment, overlapRatio, rankMoments, selectForReview } from './score';
import { genreFromReply, parseRubricJson, verdictsFromReply } from './rubric';
import type { ScoredMoment, WordLike } from './types';

// Three speech paragraphs, each closed by punctuation, separated by 2 s of silence.
const raw: Array<[string, number, number]> = [
  ['hola', 0, 300], ['estoy', 400, 700], ['grabando', 800, 1200], ['esto', 1300, 1600],
  ['para', 1700, 1900], ['todos', 2000, 2400], ['ustedes', 2500, 3000], ['hoy.', 3100, 3400],
  ['nadie', 5400, 5800], ['te', 5900, 6100], ['dice', 6200, 6400], ['esto', 6500, 6800],
  ['¿por', 6900, 7100], ['qué?', 7200, 7400], ['porque', 7500, 7800], ['duele', 7900, 8200],
  ['siempre.', 8300, 8600],
  ['mira', 10600, 10800], ['el', 10900, 11000], ['número', 11100, 11400], ['tres', 11500, 11800],
  ['de', 11900, 12000], ['la', 12100, 12200], ['lista.', 12300, 12600],
];
const words: WordLike[] = raw.map(([text, start, end]) => ({ text, start, end }));

// ── 1) Chapters: a long pause always splits; a short chapter merges backwards ───────────
const chapters = segmentChapters(words, { minChapterMs: 2000 });
assert.strictEqual(chapters.length, 3, 'three paragraphs separated by 2 s of silence');
assert.deepStrictEqual(chapters.map((c) => c.startWord), [0, 8, 17], 'chapter starts land on the word after the pause');
assert.strictEqual(chapters[0].endWord, 7, 'chapter closes on the last word before the pause');

const merged = segmentChapters(words);
assert.strictEqual(merged.length, 1, 'the same words merge into one chapter when chapters are too short');

// ── 2) Candidates never end mid-sentence when a sentence end fits the budget ────────────
const candidates = buildCandidates(words, chapters, { minMs: 2000, maxMs: 4000 });
assert.strictEqual(candidates.length, 3, 'one candidate per chapter at this duration budget');
assert.deepStrictEqual(candidates.map((c) => c.endWord), [7, 13, 23], 'each candidate snaps to a sentence end');
for (const candidate of candidates) {
  assert.match(candidate.text, /[.!?]$/, `candidate ends on punctuation: "${candidate.text}"`);
  assert.ok(candidate.endMs - candidate.startMs >= 1600, 'candidate respects the duration floor');
}

// A too-narrow budget still yields candidates, it does not spin or crash.
const narrow = buildCandidates(words, chapters, { minMs: 500, maxMs: 900 });
assert.ok(narrow.length > 0, 'narrow budget still produces candidates');

// ── 3) Measured signals: a question that opens with "nadie" hooks harder than a greeting ─
const stats = corpusStats(words);
const det = candidates.map((candidate) => deterministicScores(words, candidate, stats));
for (const dims of det) {
  for (const value of Object.values(dims)) {
    assert.ok(value >= 0 && value <= 100, `signal in range, got ${value}`);
  }
}
assert.ok(det[1].hook > det[0].hook, 'the "nadie te dice esto, ¿por qué?" opener hooks harder than "hola, estoy grabando"');

// ── 4) Blend: deterministic 60 / model 40, sound stays measured ─────────────────────────
const blended = blendScores({ hook: 0, flow: 0, value: 0, sound: 50 }, {
  hook: 100, flow: 100, value: 100, title: '', reason: '', risks: [],
});
assert.deepStrictEqual(blended, { hook: 40, flow: 40, value: 40, sound: 50 }, 'model contributes 40 % and never touches sound');
assert.deepStrictEqual(blendScores({ hook: 30, flow: 40, value: 50, sound: 60 }, null), { hook: 30, flow: 40, value: 50, sound: 60 }, 'no model → measured score survives');

// ── 5) Composite is 0-99, weighted, and capped like OpusClip's scale ────────────────────
assert.strictEqual(composite({ hook: 100, flow: 100, value: 100, sound: 100 }), 99, 'capped at 99, not 100');
assert.strictEqual(composite({ hook: 40, flow: 40, value: 40, sound: 50 }), 42, 'weighted mean rounds once');
assert.strictEqual(composite({ hook: 0, flow: 0, value: 0, sound: 0 }), 0, 'floor is 0');

// ── 6) Gates reject with a reason instead of silently down-ranking ──────────────────────
const ok = candidates[0];
assert.deepStrictEqual(gateMoment(ok, { hook: 80, flow: 30, value: 80, sound: 50 }, { minMs: 2000, maxMs: 4000 }), ['no se sostiene solo']);
assert.deepStrictEqual(gateMoment(ok, { hook: 80, flow: 80, value: 10, sound: 50 }, { minMs: 2000, maxMs: 4000 }), ['poca información']);
assert.deepStrictEqual(gateMoment(ok, { hook: 80, flow: 80, value: 80, sound: 50 }, { minMs: 2000, maxMs: 4000 }), []);

// ── 7) Ranking order, reject list and the overlap dedupe ────────────────────────────────
const ranked = rankMoments([
  { candidate: candidates[0], deterministic: { hook: 50, flow: 80, value: 60, sound: 60 }, verdict: null },
  { candidate: candidates[1], deterministic: { hook: 90, flow: 90, value: 90, sound: 70 }, verdict: null },
  { candidate: candidates[2], deterministic: { hook: 20, flow: 20, value: 20, sound: 20 }, verdict: null },
], { minMs: 2000, maxMs: 4000 });
assert.strictEqual(ranked[0].startWord, 8, 'best measured moment ranks first');
assert.strictEqual(ranked[0].gate, 'pass');
assert.strictEqual(ranked[2].gate, 'rejected', 'a weak flow/value candidate is rejected, not ranked third');
assert.ok(ranked[2].gateReasons.length > 0, 'the rejection carries reasons');

const moment = (startMs: number, endMs: number, score: number): ScoredMoment => ({
  startWord: 0, endWord: 0, startMs, endMs, text: '', chapter: 0, score,
  subscores: { hook: score, flow: score, value: score, sound: score },
  gate: 'pass', gateReasons: [], model: null,
  deterministic: { hook: score, flow: score, value: score, sound: score },
});
const overlap = overlapRatio(moment(0, 10_000, 80), moment(5_000, 16_000, 70));
assert.ok(overlap > 0.45 && overlap < 0.55, `overlap is a share of the shorter clip, got ${overlap}`);
const deduped = dedupeByOverlap([moment(0, 10_000, 80), moment(5_000, 16_000, 70), moment(20_000, 30_000, 60)]);
assert.deepStrictEqual(deduped.map((m) => m.score), [80, 60], 'the weaker duplicate is dropped, the disjoint one survives');

// ── 8) Untrusted model output: wrong indices are dropped, scores are clamped ────────────
const verdicts = verdictsFromReply({
  genre: 'podcast',
  moments: [
    { start: 0, end: 7, hook: 120, flow: 80, value: 70, title: '  Apertura  ', reason: 'gana', risks: ['x', 'y', 'z', 'w'] },
    { start: 0, end: 99, hook: 99, flow: 99, value: 99, title: 'inventado', reason: 'no', risks: [] },
  ],
}, candidates);
assert.strictEqual(verdicts.size, 1, 'a verdict whose indices do not match a candidate is dropped');
const first = verdicts.get(0)!;
assert.strictEqual(first.hook, 100, 'out-of-range score is clamped');
assert.strictEqual(first.title, 'Apertura');
assert.strictEqual(first.risks.length, 3, 'risks are capped at three');

assert.deepStrictEqual(parseRubricJson('```json\n{"genre":"podcast","moments":[]}\n```'), { genre: 'podcast', moments: [] });
assert.strictEqual(genreFromReply({ genre: 'Podcast' }), 'podcast');
assert.strictEqual(genreFromReply({ genre: 'auto' }), null, 'auto is not a classification');

// ── 9) The review set stays bounded without dropping the measured winner ────────────────
const many = words.map((_, i) => ({ candidate: candidates[i % candidates.length], deterministic: { hook: i, flow: i, value: i, sound: i } }));
assert.strictEqual(selectForReview(many.slice(0, 3), 2).length, 2, 'review limit is honoured');

console.log('shorts/rubric.verify: ok');
