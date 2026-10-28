import assert from 'node:assert/strict';
import { detectSubtitleFormat, parseSubtitleFile } from './subtitleImport';
import { importSubtitleCues, newManualCaptions } from './manualCaptions';
import type { CaptionsData } from './types';

const SRT = '1\n00:00:01,000 --> 00:00:02,000\nFirst line\n\n2\n00:00:03,000 --> 00:00:04,500\nSecond line\n';
const VTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nVtt line\n';
const ASS = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Asset line
`;

// Extension routing.
assert.equal(parseSubtitleFile('a.srt', SRT).format, 'srt');
assert.deepEqual(parseSubtitleFile('a.srt', SRT).words.map((word) => word.text), ['First line', 'Second line']);
assert.equal(parseSubtitleFile('a.vtt', VTT).format, 'vtt');
assert.equal(parseSubtitleFile('a.ass', ASS).format, 'ass');
assert.equal(parseSubtitleFile('a.ssa', ASS).format, 'ssa', 'SSA keeps its own label but parses as ASS');
assert.deepEqual(parseSubtitleFile('a.ssa', ASS).words.map((word) => word.text), ['Asset line']);

// Content sniffing when the extension is missing or unknown.
assert.equal(detectSubtitleFormat('subtitles.txt', VTT), 'vtt');
assert.equal(detectSubtitleFormat('subtitles.txt', ASS), 'ass');
assert.equal(detectSubtitleFormat('subtitles', SRT), 'srt');

// importSubtitleCues: replace by default, append on request, label only on import.
const base: CaptionsData = newManualCaptions();
const replaced = importSubtitleCues(base, [], [{ text: 'Intro', start: 0, end: 1000 }], { label: 'Letra' });
const lane = replaced.sourceEntries![0]!;
assert.equal(replaced.sourceEntries!.length, 1);
assert.equal(lane.label, 'Letra');
assert.deepEqual(lane.words!.map((word) => word.text), ['Intro']);
assert.ok(lane.words![0]!.id, 'imported cues get stable manual identities');
assert.equal(replaced.sourceMode, 'item');
assert.equal(replaced.words, undefined, 'legacy standalone words cleared');

const appended = importSubtitleCues(
  { ...base, sourceEntries: replaced.sourceEntries },
  [],
  [{ text: 'Coro', start: 2000, end: 3000 }],
  { mode: 'append' },
);
assert.deepEqual(appended.sourceEntries![0]!.words!.map((word) => word.text), ['Intro', 'Coro']);
assert.deepEqual(
  appended.sourceEntries![0]!.words!.map((word) => word.start),
  [0, 2000],
  'appended cues stay in timeline order',
);

console.log('subtitleImport.check: ok');
