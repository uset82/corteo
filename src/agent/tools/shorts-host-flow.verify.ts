import assert from 'node:assert/strict';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { TranscriptWord } from '../../transcript/types';
import type { AgentContext } from '../context';
import { setRubricScorer } from '../shorts/rubric';
import { shortsReviewEs } from '../shorts/review-text';
import { execShortsTool } from './shorts-tools';
import { execMakeShortsTool } from './make-shorts-tools';

const words: TranscriptWord[] = [];
const sentence = ['Nadie', 'te', 'dice', 'esto:', 'hay', 'tres', 'maneras', 'de', 'cambiar', 'tu', 'vida', 'hoy.'];
for (let group = 0; group < 18; group++) {
  for (let index = 0; index < sentence.length; index++) {
    const start = group * 10000 + index * 650;
    words.push({ text: sentence[index]!, start, end: start + 450 });
  }
}
const state: TimelineState = { fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'talk', track: 'V1', startFrame: 0, durationInFrames: 5400,
    name: 'Entrevista', kind: 'video', src: '/talk.mp4', transcript: words }] };
const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = { commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
  getCreativeMode: () => null, templates: [], audio: [] };
setRubricScorer(async (candidates) => ({
  genre: 'interview',
  moments: candidates.map((c, index) => ({ start: c.startWord, end: c.endWord,
    hook: 95, flow: 90, value: 92, title: `clip ${index}`, reason: 'cierra con una frase redonda', risks: ['necesita contexto'] })),
}));
try {
  const result = await execShortsTool('score_moments', { count: 3, minSeconds: 8, maxSeconds: 18 }, ctx) as {
    ok: boolean; reviewEs: string; moments: { startWord: number; endWord: number; startFrame: number; endFrame: number }[];
  };
  assert.equal(result.ok, true);
  assert.equal(result.moments.length, 3);
  assert.equal((result.reviewEs.match(/^\d+\./gm) ?? []).length, 3);
  assert.equal((result.reviewEs.match(/Por qué:/g) ?? []).length, 3);
  assert.equal((result.reviewEs.match(/Riesgos:/g) ?? []).length, 3);
  const ranges = result.moments.map(({ startWord, endWord }) => ({ startWord, endWord }));
  const shorts = await execMakeShortsTool('make_shorts', { ranges, count: 3, ratio: '9:16', reframe: false }, ctx) as {
    ok: boolean; clips: { sequenceId: string; reason: string; risks: string[]; startFrame: number; endFrame: number }[];
  };
  assert.equal(shorts.ok, true);
  assert.equal(shorts.clips.length, 3);
  assert.deepEqual(shorts.clips.map((clip) => [clip.startFrame, clip.endFrame]),
    result.moments.map((moment) => [moment.startFrame, moment.endFrame]));
  for (const clip of shorts.clips) {
    const timeline = draft.getDoc().timelines.find((entry) => entry.id === clip.sequenceId)!;
    assert.deepEqual([timeline.width, timeline.height], [1080, 1920]);
    assert.ok(clip.reason);
    assert.ok(Array.isArray(clip.risks));
  }
  const long = shortsReviewEs(Array.from({ length: 5 }, () => ({ score: 80, startSeconds: 0, endSeconds: 10,
    seconds: 10, subscores: { hook: 90, flow: 85, value: 88, sound: 70 }, reason: 'x'.repeat(5000), risks: ['y'.repeat(5000)] })));
  assert.ok(long.length <= 3000);
  assert.ok(long.endsWith('Tendencia: no disponible (no hay datos de plataforma).'));
  console.log('shorts-host-flow.verify: ok');
} finally {
  setRubricScorer(null);
}
