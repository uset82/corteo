// Runnable contract check for tighten_speech (Plan 5, OP-06): review first, apply second,
// and the apply path really goes through clean_script (one undo step).
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { execTightenTool } from './tighten-tools';

const words: TranscriptWord[] = [
  { text: 'eh', start: 0, end: 250 },
  { text: 'hoy', start: 300, end: 600 },
  { text: 'este', start: 700, end: 1000 },
  { text: 'grabamos', start: 1100, end: 1600 },
  { text: 'el', start: 1700, end: 1800 },
  { text: 'programa.', start: 1900, end: 2300 },
];

const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'talk', track: 'A1', startFrame: 0, durationInFrames: 100, name: 'Voz', kind: 'audio', src: '/v.wav', transcript: words }],
};

const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = {
  commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};

interface TightenResult {
  ok?: boolean; error?: string; applied?: boolean;
  preview?: { itemId: string; fillers: { word: string; at: number; reason: string }[]; pauses: { after: string; seconds: number }[]; savedSeconds: number; hidden: number };
  note?: string; cleanScript?: unknown;
}

// ── 1) First call: a review list, and nothing is edited ─────────────────────────────────
const before = JSON.stringify(draft.getState().items);
const preview = await execTightenTool('tighten_speech', {}, ctx) as TightenResult;
assert.strictEqual(preview.ok, true, 'preview answers');
assert.strictEqual(preview.applied, false, 'the first call never edits');
assert.ok(preview.preview, 'the preview block is present');
assert.ok(preview.preview.fillers.length >= 2, `fillers are listed, got ${preview.preview.fillers.length}`);
assert.ok(preview.preview.fillers.every((f) => typeof f.at === 'number'), 'each filler carries its time');
assert.ok(/apply:true/.test(preview.note ?? ''), 'the note tells the model how to apply');
assert.strictEqual(JSON.stringify(draft.getState().items), before, 'the timeline is untouched after a preview');

// ── 2) Second call: applies through clean_script, one undo step ────────────────────────
const applied = await execTightenTool('tighten_speech', { apply: true }, ctx) as TightenResult;
assert.strictEqual(applied.applied, true, 'apply reports that it applied');
assert.strictEqual(applied.ok, true, 'apply succeeds on a transcribed clip');
assert.ok(applied.cleanScript !== undefined, 'the clean_script result is passed through, not hidden');

// ── 3) No transcript: a clear error, and no edit ───────────────────────────────────────
const bare = makeDraft(docFromTimeline({
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'v', track: 'A1', startFrame: 0, durationInFrames: 90, name: 'v', kind: 'audio', src: '/v.wav' }],
}));
const bareCtx: AgentContext = {
  commands: bare.commands, getState: bare.getState, getDoc: bare.getDoc,
  getCreativeMode: () => null, templates: [], audio: [],
};
const missing = await execTightenTool('tighten_speech', {}, bareCtx) as TightenResult;
assert.ok(missing.error && /transcri/i.test(missing.error), 'missing transcript is a clear Spanish error');

// ── 4) Unknown tool name is refused ────────────────────────────────────────────────────
const unknown = await execTightenTool('tighten_everything', {}, ctx) as TightenResult;
assert.ok(unknown.error, 'unknown tool name errors');

console.log('tighten-tools.verify: ok');
