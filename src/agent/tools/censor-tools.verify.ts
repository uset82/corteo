// Runnable contract check for censor_words (Plan 5, OP-07): review first, mute second, and
// the mute is a volume-keyframe envelope — the clip is never cut.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { execCensorTool } from './censor-tools';

const words: TranscriptWord[] = [
  { text: 'esto', start: 0, end: 300 },
  { text: 'es', start: 350, end: 450 },
  { text: 'una', start: 500, end: 700 },
  { text: 'mierda.', start: 750, end: 1100 },
  { text: 'y', start: 1150, end: 1250 },
  { text: 'nada', start: 1300, end: 1500 },
  { text: 'más.', start: 1550, end: 1800 },
];

const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'talk', track: 'A1', startFrame: 0, durationInFrames: 60, name: 'Voz', kind: 'audio', src: '/v.wav', transcript: words }],
};

const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = {
  commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};

interface CensorResult {
  ok?: boolean; error?: string; applied?: boolean; itemId?: string;
  hits: { word: string; at: number; muteMs: number }[]; keyframes?: number; note?: string;
}

const itemOf = () => draft.getState().items.find((item) => item.id === 'talk')!;

// ── 1) First call: the hit list, and nothing is muted ─────────────────────────────────
const preview = await execCensorTool('censor_words', {}, ctx) as CensorResult;
assert.strictEqual(preview.ok, true);
assert.strictEqual(preview.applied, false, 'a preview never edits');
assert.strictEqual(preview.hits.length, 1, 'one profanity in this fixture');
assert.strictEqual(preview.hits[0].word, 'mierda.');
assert.strictEqual(preview.hits[0].at, 0.75, 'the hit carries its time');
assert.strictEqual(itemOf().keyframes?.volume, undefined, 'no volume keyframes after a preview');
assert.ok(/apply:true/.test(preview.note ?? ''), 'the note says how to apply');

// ── 2) Second call: a mute envelope, one undo step, the clip survives ────────────────
const applied = await execCensorTool('censor_words', { apply: true, padMs: 50 }, ctx) as CensorResult;
assert.strictEqual(applied.ok, true);
assert.strictEqual(applied.applied, true);
assert.strictEqual(applied.keyframes, 2, 'two keyframes per hit: mute on, mute off');

const volume = itemOf().keyframes?.volume ?? [];
assert.strictEqual(volume.length, 2, 'the envelope is on the volume property');
assert.strictEqual(volume[0].value, 0, 'the word starts muted');
assert.strictEqual(volume[1].value, 1, 'the clip returns to its own volume');
assert.ok(volume[1].frame > volume[0].frame, 'the envelope is ordered');
assert.strictEqual(itemOf().durationInFrames, 60, 'the clip is not cut: the timeline stays frame-aligned');

// ── 3) Extra words are censored on demand; nothing is added twice ────────────────────
const again = await execCensorTool('censor_words', { apply: true, extraWords: ['nada'] }, ctx) as CensorResult;
assert.strictEqual(again.applied, true);
assert.ok((itemOf().keyframes?.volume ?? []).length >= 4, 'the second hit adds its own envelope');

// ── 4) No transcript → clear error; unknown tool → error ─────────────────────────────
const bare = makeDraft(docFromTimeline({
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'v', track: 'A1', startFrame: 0, durationInFrames: 30, name: 'v', kind: 'audio', src: '/v.wav' }],
}));
const bareCtx: AgentContext = {
  commands: bare.commands, getState: bare.getState, getDoc: bare.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};
const missing = await execCensorTool('censor_words', {}, bareCtx) as CensorResult;
assert.ok(missing.error && /transcri/i.test(missing.error), 'missing transcript is a clear Spanish error');
const unknown = await execCensorTool('censor_everything', {}, ctx) as CensorResult;
assert.ok(unknown.error, 'unknown tool name errors');

console.log('censor-tools.verify: ok');
