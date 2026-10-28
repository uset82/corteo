// Runnable contract check for score_moments (Plan 5, OP-01), the read-only scoring tool.
// The model is stubbed: no network. Covers the happy path, the untrusted-output path (a
// verdict with invented indices must not create a moment), the model-offline path and the
// no-transcript error. Also asserts the tool never edits the timeline.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { execShortsTool, setRubricScorer } from './shorts-tools';

const words: TranscriptWord[] = [
  { text: 'hola', start: 0, end: 300 },
  { text: 'estoy', start: 400, end: 700 },
  { text: 'grabando', start: 800, end: 1200 },
  { text: 'para', start: 1300, end: 1600 },
  { text: 'todos.', start: 1700, end: 2000 },
  { text: 'nadie', start: 3600, end: 4000 },
  { text: 'te', start: 4100, end: 4300 },
  { text: 'dice', start: 4400, end: 4600 },
  { text: 'esto:', start: 4700, end: 5000 },
  { text: 'el', start: 5100, end: 5200 },
  { text: 'precio', start: 5300, end: 5600 },
  { text: 'sube', start: 5700, end: 6000 },
  { text: 'siempre.', start: 6100, end: 6400 },
  { text: 'mira', start: 8000, end: 8200 },
  { text: 'el', start: 8300, end: 8400 },
  { text: 'número', start: 8500, end: 8800 },
  { text: 'tres.', start: 8900, end: 9200 },
];

const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [
    { id: 'talk', track: 'V1', startFrame: 0, durationInFrames: 300, name: 'Entrevista', kind: 'video', src: '/talk.mp4', transcript: words },
  ],
};

const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = {
  commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};

interface MomentOut {
  startWord: number; endWord: number; startFrame: number; endFrame: number; seconds: number;
  score: number; subscores: { hook: number; flow: number; value: number; sound: number };
  gate: string; gateReasons: string[]; title: string; reason: string; risks: string[];
}
type Result = {
  ok?: boolean; error?: string; reviewEs: string; moments: MomentOut[]; rejected: MomentOut[]; modelUsed: boolean;
  failedBatches: number; genre: string; chapters: number; candidates: number; alternates: number; threshold: number;
};

// ── 1) Happy path: the model's verdicts drive the ranking, invented indices are dropped ──
setRubricScorer(async (candidates) => ({
  genre: 'podcast',
  moments: [
    ...candidates.map((c, i) => ({
      start: c.startWord, end: c.endWord,
      hook: 90 - i * 5, flow: 85, value: 88,
      title: `momento ${i + 1}`, reason: 'cierra con una frase redonda', risks: [],
    })),
    { start: 9999, end: 9999, hook: 100, flow: 100, value: 100, title: 'inventado', reason: 'no existe', risks: [] },
  ],
}));

const result = await execShortsTool('score_moments', { count: 2, minSeconds: 1, maxSeconds: 5 }, ctx) as Result;
assert.strictEqual(result.ok, true, 'tool succeeds');
assert.strictEqual(result.modelUsed, true, 'model verdicts were used');
assert.strictEqual(result.failedBatches, 0);
assert.strictEqual(result.genre, 'podcast', 'the model classification is reported');
assert.ok(result.chapters >= 1, `chapters were segmented, got ${result.chapters}`);
assert.ok(result.candidates >= 2, `candidates were built, got ${result.candidates}`);
assert.strictEqual(result.moments.length, 2, 'count caps the returned moments');
assert.strictEqual(result.threshold, 55, 'the publish threshold is exposed');
assert.match(result.reviewEs, /1\. [\s\S]*Por qué:[\s\S]*Riesgos:[\s\S]*Tendencia: no disponible/);
assert.ok(result.reviewEs.length <= 3000);

const [best, second] = result.moments;
assert.ok(best.score >= second.score, 'moments are ranked best first');
assert.ok(best.score <= 99, 'score uses the 0-99 scale');
for (const key of ['hook', 'flow', 'value', 'sound'] as const) {
  const value = best.subscores[key];
  assert.ok(Number.isInteger(value) && value >= 0 && value <= 100, `sub-score ${key} is an integer 0-100`);
}
assert.match(best.title, /^momento \d+$/, 'the model title is passed through');
assert.strictEqual(best.gate, 'pass', 'returned moments passed the gates');
assert.ok(best.endFrame > best.startFrame, 'frame range is usable by the cut tools');
assert.strictEqual(best.seconds, Number(((words[best.endWord].end - words[best.startWord].start) / 1000).toFixed(1)), 'seconds match the word range');

// ── 2) Read-only: nothing on the timeline changed, no sequence was created ─────────────
const doc = draft.getDoc();
assert.strictEqual(doc.timelines.length, 1, 'score_moments never creates a sequence');
assert.strictEqual(draft.getState().items.length, 1, 'score_moments never touches the items');

// ── 3) Model offline: the measured score still ranks, and says so ───────────────────────
setRubricScorer(async () => { throw new Error('no provider'); });
const offline = await execShortsTool('score_moments', { count: 3, minSeconds: 1, maxSeconds: 5 }, ctx) as Result;
assert.strictEqual(offline.ok, true, 'offline the tool still answers');
assert.strictEqual(offline.modelUsed, false, 'modelUsed is false without a model');
assert.ok(offline.failedBatches > 0, 'the failed batch is reported, not hidden');
assert.ok(Array.isArray(offline.moments), 'moments is always an array');
for (const moment of offline.moments) {
  assert.strictEqual(moment.reason, 'Solo señales medidas (sin modelo).', 'the reason says the model was absent');
}

// ── 4) No transcript: clear error, no crash, no sequence ────────────────────────────────
const bareState: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'v', track: 'V1', startFrame: 0, durationInFrames: 90, name: 'v', kind: 'video', src: '/v.mp4' }],
};
const bare = makeDraft(docFromTimeline(bareState));
const bareCtx: AgentContext = {
  commands: bare.commands, getState: bare.getState, getDoc: bare.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};
setRubricScorer(null);
const bareResult = await execShortsTool('score_moments', {}, bareCtx) as Result;
assert.ok(bareResult.error && /transcri/i.test(bareResult.error), 'missing transcript returns a clear Spanish error');
assert.strictEqual(bare.getDoc().timelines.length, 1, 'the error path creates nothing');

// ── 5) calibrate_scores reports the ledger; score_moments accepts `calibration` ────────
const calibrated = await execShortsTool('calibrate_scores', {}, ctx) as {
  ok: boolean; decisions: number; confident: boolean; applied: boolean;
  weights: { hook: number; flow: number; value: number; sound: number }; suggestedMinScore: number;
};
assert.strictEqual(calibrated.ok, true, 'calibrate_scores answers');
assert.strictEqual(calibrated.decisions, 0, 'a profile with no storage has no decisions');
assert.strictEqual(calibrated.confident, false, 'no decisions means no calibration');
assert.strictEqual(calibrated.applied, false, 'nothing is applied on thin data');
assert.deepStrictEqual(calibrated.weights, { hook: 1, flow: 1, value: 1, sound: 1 }, 'neutral weights');
assert.strictEqual(calibrated.suggestedMinScore, 55);

const withCalibration = await execShortsTool('score_moments', {
  count: 2, minSeconds: 1, maxSeconds: 5, calibration: true,
}, ctx) as Result & { calibration?: { decisions: number; applied: boolean } };
assert.strictEqual(withCalibration.ok, true, 'calibration:true does not break scoring');
assert.deepStrictEqual(withCalibration.calibration, { decisions: 0, applied: false }, 'the run reports the calibration it used');

// ── 5) Unknown tool name is refused, not silently accepted ─────────────────────────────
const unknown = await execShortsTool('score_everything', {}, ctx) as { error?: string };
assert.ok(unknown.error, 'unknown tool name errors');

console.log('shorts-tools.verify: ok');
