// P2-2: import_subtitles parses ASS karaoke and creates one caption track with
// word-level timing in one undo batch. Server-direct and draft-safe.
// Run: npx tsx src/agent/tools/subtitle-tools.verify.ts
import assert from 'node:assert/strict';
import { makeDraft } from '../../editor/store';
import { captionsOnTrack, type TimelineState, type TrackId } from '../../editor/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import { execSubtitleTool } from './subtitle-tools';
import { SUBTITLE_TOOL_NAMES, SUBTITLE_TOOL_SCHEMAS } from './schemas/subtitle-tools';

const state: TimelineState = {
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items: [{
    id: 'title', track: 'V1', startFrame: 0, durationInFrames: 90, name: 'Title', kind: 'text',
    props: { text: 'Hola', fontSize: 96, color: '#fff', fontWeight: 700, align: 'center' },
  }],
};
const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = {
  commands: draft.commands,
  getState: draft.getState,
  getDoc: draft.getDoc,
  getCreativeMode: () => null,
  templates: [],
  audio: [],
};

assert.deepEqual([...SUBTITLE_TOOL_NAMES], ['import_subtitles']);
const schema = SUBTITLE_TOOL_SCHEMAS[0]!;
assert.equal(schema.name, 'import_subtitles');
assert.match(schema.description ?? '', /\\k/);
assert.equal(isExternalDraftTool('import_subtitles'), true);
assert.equal(isExternalServerDirectTool('import_subtitles'), true);
assert.equal(isExternalReadTool('import_subtitles'), false);
assert.equal(isExternalRealTool('import_subtitles'), false);

const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k50}Hola {\\k100}mundo
`;
const result = await execSubtitleTool('import_subtitles', { content: ass, name: 'Karaoke verso' }, ctx) as {
  ok?: boolean; trackId?: TrackId; format?: string; words?: number; durationMs?: number;
};
assert.equal(result.ok, true);
assert.equal(result.format, 'ass');
assert.equal(result.words, 2);
assert.equal(result.durationMs, 3000);
const captions = captionsOnTrack(draft.getState(), result.trackId!);
assert.ok(captions, 'a caption track with captions exists');
assert.equal(captions!.enabled, true);
assert.equal(captions!.template, 'verso', 'ASS karaoke defaults to the verse style');
assert.equal(captions!.pacing, 'word', 'word pacing makes the karaoke highlight move');
assert.equal(captions!.sourceEntries?.[0]?.label, 'Karaoke verso');
assert.deepEqual(captions!.sourceEntries?.[0]?.words?.map((word) => [word.text, word.start, word.end]), [
  ['Hola', 1000, 1500],
  ['mundo', 1500, 3000],
]);
const actions = draft.takeActions();
assert.equal(actions.length, 1, 'one undo step');
assert.equal(actions[0]!.type, 'batch');
assert.equal((actions[0] as { label?: string }).label, 'Crear pista de subtítulos');

const vtt = await execSubtitleTool('import_subtitles', { content: 'WEBVTT\n\n00:01.000 --> 00:02.000\nOtra', format: 'vtt' }, ctx) as { ok?: boolean; format?: string; trackId?: TrackId };
assert.equal(vtt.ok, true);
assert.equal(vtt.format, 'vtt');
assert.equal(captionsOnTrack(draft.getState(), vtt.trackId!)?.sourceEntries?.[0]?.words?.[0]?.text, 'Otra');

assert.match((await execSubtitleTool('import_subtitles', { content: '' }, ctx) as { error?: string }).error ?? '', /content is required/);
assert.match((await execSubtitleTool('import_subtitles', { content: 'no subtitles' }, ctx) as { error?: string }).error ?? '', /无法识别/);
assert.match((await execSubtitleTool('unknown', {}, ctx) as { error?: string }).error ?? '', /unknown tool/);
console.log('subtitle-tools.verify: ASS karaoke import creates one word-timed caption track OK');
