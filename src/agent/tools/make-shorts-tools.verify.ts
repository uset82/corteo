// Runnable contract check for make_shorts (Plan 5, OP-03), the one-call pipeline.
// The model and reframe are the only moving parts stubbed by the environment: no network,
// and no DOM, which is exactly the "headless tab" case the tool must degrade through.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import type { TranscriptWord } from '../../transcript/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { setRubricScorer } from '../shorts/rubric';
import { execMakeShortsTool } from './make-shorts-tools';

const words: TranscriptWord[] = [
  { text: 'hola', start: 0, end: 300 }, { text: 'estoy', start: 400, end: 700 },
  { text: 'aquí.', start: 800, end: 1100 },
  { text: 'nadie', start: 3000, end: 3400 }, { text: 'te', start: 3500, end: 3700 },
  { text: 'dice', start: 3800, end: 4000 }, { text: 'esto.', start: 4100, end: 4400 },
  { text: 'el', start: 6000, end: 6100 }, { text: 'precio', start: 6200, end: 6500 },
  { text: 'sube', start: 6600, end: 6900 }, { text: 'siempre.', start: 7000, end: 7300 },
  { text: 'mira', start: 9000, end: 9200 }, { text: 'el', start: 9300, end: 9400 },
  { text: 'número', start: 9500, end: 9800 }, { text: 'tres.', start: 9900, end: 10200 },
];

const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [
    { id: 'talk', track: 'V1', startFrame: 0, durationInFrames: 400, name: 'Entrevista', kind: 'video', src: '/talk.mp4', transcript: words },
  ],
};

function freshContext(): { draft: ReturnType<typeof makeDraft>; ctx: AgentContext } {
  const clone: TimelineState = {
    ...state,
    items: state.items.map((it) => ({ ...it, transcript: it.transcript ? [...it.transcript] : undefined })),
  };
  const draft = makeDraft(docFromTimeline(clone));
  const ctx: AgentContext = {
    commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
    getCreativeMode: () => null, templates: [], audio: [],
  };
  return { draft, ctx };
}

interface ClipOut {
  sequenceId: string; title: string; startFrame: number; endFrame: number; seconds: number;
  score: number; subscores: { hook: number; flow: number; value: number; sound: number };
  reason: string; risks: string[]; captions: string; reframe: string; renderId?: string; note?: string;
}
type Result = {
  ok?: boolean; error?: string; count: number; clips: ClipOut[]; alternates: number;
  belowThreshold: number; threshold: number; analysisId: string; modelUsed: boolean;
  rejected: { score: number; title: string; reasons: string[] }[]; note?: string; renderIds?: string[];
};

setRubricScorer(async (candidates) => ({
  genre: 'interview',
  moments: candidates.map((c, i) => ({
    start: c.startWord, end: c.endWord,
    hook: 95, flow: 90, value: 92,
    title: `clip ${i + 1}`, reason: 'cierra con una frase redonda', risks: [],
  })),
}));

// ── 1) The pipeline: N moments in, N ordinary sequences out, source untouched ──────────
{
  const { draft, ctx } = freshContext();
  const originalId = draft.getDoc().activeTimelineId;
  const res = await execMakeShortsTool('make_shorts', {
    count: 2, minSeconds: 1, maxSeconds: 4, minScore: 0, reframe: false,
  }, ctx) as Result;

  assert.strictEqual(res.ok, true, 'tool succeeds');
  assert.strictEqual(res.count, 2, 'two clips requested, two clips created');
  assert.strictEqual(res.modelUsed, true, 'model verdicts were used');
  assert.strictEqual(res.threshold, 0, 'the threshold is echoed back');
  assert.ok(res.analysisId, 'an analysis id is returned so the run can be referenced');
  assert.strictEqual(res.clips.length, 2);

  const ids = new Set(res.clips.map((c) => c.sequenceId));
  assert.strictEqual(ids.size, 2, 'each clip is its own sequence');
  assert.ok(res.clips.every((c) => c.score >= 0 && c.score <= 99), 'every clip carries a 0-99 score');
  assert.ok(res.clips.every((c) => Number.isInteger(c.subscores.hook)), 'sub-scores are integers');
  assert.ok(res.clips.every((c) => c.captions === 'skipped'), 'captions stay off when no preset is given');
  assert.ok(res.clips.every((c) => c.reframe === 'skipped'), 'reframe stays off when reframe:false');

  const doc = draft.getDoc();
  assert.strictEqual(doc.timelines.length, 3, 'original + two clips, nothing else');
  assert.strictEqual(doc.activeTimelineId, originalId, 'the user view returns to the original sequence');
  for (const clip of res.clips) {
    const timeline = doc.timelines.find((t) => t.id === clip.sequenceId)!;
    assert.deepStrictEqual([timeline.width, timeline.height, timeline.fit], [1080, 1920, 'cover'], 'clips are 9:16 cover');
    assert.ok(timeline.items.length >= 1, 'the clip holds its trimmed source');
    assert.ok(clip.endFrame > clip.startFrame, 'frame range is usable');
  }
}

// ── 2) Reframe without a DOM degrades honestly: clips are still cut, the note says why ──
{
  const { ctx } = freshContext();
  const res = await execMakeShortsTool('make_shorts', {
    count: 1, minSeconds: 1, maxSeconds: 4, minScore: 0, reframe: true,
  }, ctx) as Result;
  assert.strictEqual(res.ok, true, 'reframe failure never fails the run');
  assert.strictEqual(res.clips[0].reframe, 'skipped', 'no DOM → reframe is skipped');
  assert.ok(res.note && /pestaña/i.test(res.note), 'the note tells the user a tab is needed');
}

// ── 3) Captions: turning them on never throws, and the state is reported truthfully ────
{
  const { ctx } = freshContext();
  const res = await execMakeShortsTool('make_shorts', {
    count: 1, minSeconds: 1, maxSeconds: 4, minScore: 0, reframe: false, captionsPreset: 'auto',
  }, ctx) as Result;
  assert.strictEqual(res.ok, true, 'a caption problem never fails the run');
  assert.strictEqual(res.clips[0].captions, 'applied', 'captions turn on from the anchored transcript source');
}

// ── 4) minScore above every score: nothing is cut, and the caller is told why ──────────
{
  const { draft, ctx } = freshContext();
  const res = await execMakeShortsTool('make_shorts', {
    count: 3, minSeconds: 1, maxSeconds: 4, minScore: 99, reframe: false,
  }, ctx) as Result;
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.count, 0, 'no clip reaches minScore 99');
  assert.deepStrictEqual(res.clips, []);
  assert.ok(res.note && /minScore/.test(res.note), 'the note explains the threshold');
  assert.strictEqual(draft.getDoc().timelines.length, 1, 'nothing is created when everything is below the line');
}

// ── 5) No transcript and unknown tool: clear errors, no sequences ──────────────────────
{
  const bare = makeDraft(docFromTimeline({
    fps: 30, width: 1920, height: 1080, selectedId: null,
    items: [{ id: 'v', track: 'V1', startFrame: 0, durationInFrames: 90, name: 'v', kind: 'video', src: '/v.mp4' }],
  }));
  const ctx: AgentContext = {
    commands: bare.commands, getState: bare.getState, getDoc: bare.getDoc,
    getCreativeMode: () => null, templates: [], audio: [],
  };
  const res = await execMakeShortsTool('make_shorts', {}, ctx) as Result;
  assert.ok(res.error && /transcri/i.test(res.error), 'missing transcript returns a clear Spanish error');
  assert.strictEqual(bare.getDoc().timelines.length, 1, 'the error path creates nothing');
  const unknown = await execMakeShortsTool('make_everything', {}, ctx) as Result;
  assert.ok(unknown.error, 'unknown tool name errors');
}

setRubricScorer(null);
console.log('make-shorts-tools.verify: ok');
