// import_subtitles contract: SRT/ASS/VTT text → manual caption lane.
// Covers karaoke word timing, replace/append modes, templatePreset, keeping the
// transcript lane intact, and the error paths.
import assert from 'node:assert/strict';
import { makeDraft } from '../../editor/store';
import type { TimelineState } from '../../editor/types';
import { docFromTimeline } from '../../persist/projectStore';
import type { TranscriptWord } from '../../transcript/types';
import type { AgentContext } from '../context';
import { execCaptionsTool } from './captions-tools';

const transcript: TranscriptWord[] = [{ text: 'hello', start: 0, end: 400 }];
const state: TimelineState = {
  fps: 30, width: 1920, height: 1080, selectedId: null,
  items: [{ id: 'clip', track: 'A1', startFrame: 0, durationInFrames: 120, name: 'vo', kind: 'audio', src: '/vo.mp3', transcript }],
  captions: { enabled: true, template: 'plain', pacing: 'phrase', sourceItemId: 'clip' },
};
const draft = makeDraft(docFromTimeline(state));
const ctx: AgentContext = { commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc, getCreativeMode: () => null, templates: [], audio: [] };

// ASS karaoke → per-word timing, template switch, transcript lane kept.
const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k20}Verse {\\k40}line
Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,{\\k100}Chorus
`;
const first = await execCaptionsTool('import_subtitles', {
  content: ass, filename: 'lyrics.ass', templatePreset: 'coro',
}, ctx) as { ok?: boolean; format?: string; cues?: number; template?: string; error?: string };
assert.equal(first.ok, true, `ASS import should succeed: ${first.error ?? ''}`);
assert.equal(first.format, 'ass');
assert.equal(first.cues, 3, 'karaoke syllables merge into words');
assert.equal(first.template, 'coro', 'templatePreset applies on import');

const captions = draft.getState().captions!;
assert.equal(captions.enabled, true);
assert.equal(captions.template, 'coro');
const entries = captions.sourceEntries ?? [];
assert.ok(entries.some((entry) => entry.itemId === 'clip'), 'transcript lane survives the import');
const lane = entries.find((entry) => entry.words !== undefined);
assert.ok(lane, 'a manual lane holds the imported cues');
assert.deepEqual(lane!.words!.map((word) => word.text), ['Verse', 'line', 'Chorus']);
assert.equal(lane!.words![0]!.start, 1000);
assert.equal(lane!.words![1]!.start, 1200, 'second syllable starts after the first karaoke tag');
assert.equal(lane!.label, 'lyrics', 'lane label defaults to the filename stem');

// Append mode keeps existing cues (VTT with inline timestamps).
const vtt = `WEBVTT

00:00:10.000 --> 00:00:12.000
<00:00:10.000>After <00:00:11.000>chorus
`;
const second = await execCaptionsTool('import_subtitles', {
  content: vtt, filename: 'outro.vtt', mode: 'append',
}, ctx) as { ok?: boolean; cues?: number; error?: string };
assert.equal(second.ok, true, `VTT append should succeed: ${second.error ?? ''}`);
assert.equal(second.cues, 2);
assert.deepEqual(
  draft.getState().captions!.sourceEntries!.find((entry) => entry.words !== undefined)!.words!.map((word) => word.text),
  ['Verse', 'line', 'Chorus', 'After', 'chorus'],
  'append keeps the earlier cues',
);

// Replace mode swaps the lane content but not the transcript lane.
const srt = '1\n00:00:20,000 --> 00:00:22,000\nReplacement line\n';
const third = await execCaptionsTool('import_subtitles', {
  content: srt, filename: 'fix.srt', mode: 'replace',
}, ctx) as { ok?: boolean; cues?: number; error?: string };
assert.equal(third.ok, true, `SRT replace should succeed: ${third.error ?? ''}`);
assert.deepEqual(
  draft.getState().captions!.sourceEntries!.find((entry) => entry.words !== undefined)!.words!.map((word) => word.text),
  ['Replacement line'],
);

// Errors: missing content, unparseable file, unknown format fallback error text.
const empty = await execCaptionsTool('import_subtitles', {}, ctx) as { error?: string };
assert.ok(empty.error, 'missing content errors');
const broken = await execCaptionsTool('import_subtitles', { content: 'not a subtitle file', filename: 'x.srt' }, ctx) as { error?: string };
assert.match(broken.error ?? '', /SRT 文件中没有有效字幕/, 'parser message surfaces (UI translates it)');

console.log('import-subtitles.check: ok');
