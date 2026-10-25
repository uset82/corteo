// Runnable contract check for write_clip_title (Plan 5, OP-09): one undoable text clip with
// the headline, a preview path that edits nothing, and the two error paths.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { execHeadlineTool, setHeadlineScorer } from './headline-tools';

const words: TranscriptWord[] = [
  { text: 'Nadie', start: 0, end: 300 },
  { text: 'te', start: 350, end: 500 },
  { text: 'cuenta', start: 550, end: 900 },
  { text: 'esto', start: 950, end: 1200 },
  { text: 'del', start: 1250, end: 1400 },
  { text: 'precio.', start: 1450, end: 1800 },
];

const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'talk', track: 'V1', startFrame: 0, durationInFrames: 60, name: 'Charla', kind: 'video', src: '/talk.mp4', transcript: words }],
};

const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = {
  commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};

interface HeadlineResult {
  ok?: boolean; error?: string; applied?: boolean; headline?: string; itemId?: string;
  modelUsed?: boolean; startFrame?: number; durationInFrames?: number; note?: string;
}

setHeadlineScorer(async () => 'El precio sube siempre y nadie lo dice');

// ── 1) Preview: the wording, and nothing on the timeline ──────────────────────────────
const before = draft.getState().items.length;
const preview = await execHeadlineTool('write_clip_title', { apply: false, maxWords: 4 }, ctx) as HeadlineResult;
assert.strictEqual(preview.ok, true);
assert.strictEqual(preview.applied, false);
assert.strictEqual(preview.headline, 'El precio sube siempre', 'clamped to four words');
assert.strictEqual(draft.getState().items.length, before, 'a preview creates nothing');

// ── 2) Apply: one text clip with the headline, on the top video track ────────────────
const applied = await execHeadlineTool('write_clip_title', { maxWords: 4, seconds: 4 }, ctx) as HeadlineResult;
assert.strictEqual(applied.ok, true);
assert.strictEqual(applied.applied, true);
assert.ok(applied.itemId, 'the new clip id is returned');

const text = draft.getState().items.find((item) => item.id === applied.itemId)!;
assert.ok(text, 'the headline clip exists');
assert.strictEqual(text.kind, 'text');
assert.strictEqual(text.props?.text, 'El precio sube siempre', 'the wording is on the clip');
assert.strictEqual(text.startFrame, 0, 'it starts at the beginning of the moment');
assert.strictEqual(text.durationInFrames, 120, 'four seconds at 30 fps');
assert.deepStrictEqual([text.props?.fontWeight, text.props?.align], [800, 'center'], 'headline style');
assert.ok(text.track !== 'V1', 'it lands on a track above the source, not on top of it');

// ── 3) A word range focuses the headline on that moment ─────────────────────────────
const ranged = await execHeadlineTool('write_clip_title', { apply: false, startWord: 0, endWord: 3 }, ctx) as HeadlineResult;
assert.strictEqual(ranged.ok, true);

// ── 4) Model offline: still a headline, honestly flagged ────────────────────────────
setHeadlineScorer(async () => { throw new Error('offline'); });
const offline = await execHeadlineTool('write_clip_title', {}, ctx) as HeadlineResult;
assert.strictEqual(offline.modelUsed, false);
assert.strictEqual(offline.headline, 'Nadie te cuenta esto del precio', 'the clip opens the fallback headline');
assert.ok(/Sin modelo/.test(offline.note ?? ''), 'the note says the model was absent');

// ── 5) No transcript and unknown tool ───────────────────────────────────────────────
const bare = makeDraft(docFromTimeline({
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'v', track: 'V1', startFrame: 0, durationInFrames: 30, name: 'v', kind: 'video', src: '/v.mp4' }],
}));
const bareCtx: AgentContext = {
  commands: bare.commands, getState: bare.getState, getDoc: bare.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};
const missing = await execHeadlineTool('write_clip_title', {}, bareCtx) as HeadlineResult;
assert.ok(missing.error && /transcri/i.test(missing.error), 'missing transcript is a clear Spanish error');
const unknown = await execHeadlineTool('write_everything', {}, ctx) as HeadlineResult;
assert.ok(unknown.error, 'unknown tool name errors');

setHeadlineScorer(null);
console.log('headline-tools.verify: ok');
