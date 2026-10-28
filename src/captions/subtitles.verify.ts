import assert from 'node:assert/strict';
import { parseSubtitles, subtitleFormatFromName } from './subtitles';
import { subtitleTrackName, withSubtitleLane } from './subtitleImport';
import type { CaptionsData } from './types';

// ── Format routing ─────────────────────────────────────────────────────────
assert.equal(subtitleFormatFromName('Letra.SRT'), 'srt');
assert.equal(subtitleFormatFromName('karaoke.ass'), 'ass');
assert.equal(subtitleFormatFromName('old.ssa'), 'ass', '.ssa is the older name of the same container');
assert.equal(subtitleFormatFromName('subs.vtt'), 'vtt');
assert.equal(subtitleFormatFromName('notas.txt'), null);
assert.equal(subtitleFormatFromName('sin-extension'), null);

const SRT = '1\n00:00:01,000 --> 00:00:03,000\nHola mundo\n';
const ASS = [
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k100}Can{\\k100}to',
].join('\n');
const VTT = 'WEBVTT\n\n00:00:05.000 --> 00:00:08.000\nOtra <00:00:06.500>vez\n';

assert.deepEqual(parseSubtitles('a.srt', SRT), [{ text: 'Hola mundo', start: 1000, end: 3000 }]);
assert.deepEqual(parseSubtitles('a.ass', ASS), [{ text: 'Canto', start: 1000, end: 3000 }]);
assert.deepEqual(
  parseSubtitles('a.vtt', VTT),
  [{ text: 'Otra', start: 5000, end: 6500 }, { text: 'vez', start: 6500, end: 8000 }],
  'VTT inline timestamps keep per-word timing',
);
// An explicit format wins over a meaningless extension.
assert.deepEqual(parseSubtitles('letra.txt', SRT, 'srt'), [{ text: 'Hola mundo', start: 1000, end: 3000 }]);
assert.throws(() => parseSubtitles('letra.txt', SRT), /无法识别的字幕格式/);

// ── One manual lane per import ─────────────────────────────────────────────
assert.equal(subtitleTrackName('coro.ass'), 'coro');
assert.equal(subtitleTrackName('Coro final.VTT'), 'Coro final');
assert.equal(subtitleTrackName('sin_extension'), 'sin_extension');

const words = parseSubtitles('coro.ass', ASS);

// A fresh track: one lane named after the file, cues carry stable ids.
{
  const plan = withSubtitleLane(null, [], 'coro.ass', words);
  const lane = plan.captions.sourceEntries![0]!;
  assert.equal(plan.captions.sourceEntries!.length, 1);
  assert.equal(lane.id, plan.laneId);
  assert.equal(lane.label, 'coro');
  assert.ok(lane.itemId?.startsWith('manual:'));
  assert.deepEqual(lane.words?.map((word) => [word.text, word.start, word.end]), [['Canto', 1000, 3000]]);
  assert.ok(lane.words?.every((word) => typeof word.id === 'string' && word.id.length > 0), 'cues get stable ids');
  assert.equal(plan.captions.enabled, true);
  assert.equal(plan.captions.sourceMode, 'item');
  assert.equal(plan.captions.sources, undefined);
  assert.equal(plan.captions.words, undefined);
}

// An empty manual lane is the lane to fill: no stray empty row next to the import.
{
  const base: CaptionsData = {
    enabled: false,
    template: 'black-bar',
    pacing: 'phrase',
    sourceEntries: [{ id: 'lane_empty', itemId: 'manual:lane_empty', label: '手动字幕 1', words: [] }],
    sourceMode: 'item',
  };
  const plan = withSubtitleLane(base, [], 'letra.vtt', parseSubtitles('letra.vtt', VTT));
  assert.equal(plan.captions.sourceEntries!.length, 1, 'emptied lane reused, no second lane');
  assert.equal(plan.laneId, 'lane_empty');
  assert.equal(plan.captions.sourceEntries![0]!.label, 'letra');
  assert.equal(plan.captions.enabled, true, 'import turns captions on');
}

// A lane that already has words keeps them and the import joins as another lane.
{
  const base: CaptionsData = {
    enabled: true,
    template: 'black-bar',
    pacing: 'phrase',
    sourceEntries: [
      { id: 'lane_a', itemId: 'manual:lane_a', label: 'intro', words: [{ text: 'antes', start: 0, end: 500 }] },
    ],
    sourceMode: 'item',
    layoutPolicy: { mode: 'single-lane', maxVisibleSources: 1 },
  };
  const plan = withSubtitleLane(base, [], 'coro.ass', words);
  assert.equal(plan.captions.sourceEntries!.length, 2);
  assert.equal(plan.captions.sourceEntries![0]!.label, 'intro');
  assert.deepEqual(plan.captions.sourceEntries![0]!.words?.map((word) => word.text), ['antes']);
  assert.deepEqual(plan.captions.sourceEntries![1]!.words?.map((word) => word.text), ['Canto']);
  assert.deepEqual(plan.captions.layoutPolicy, { mode: 'auto-stack' }, 'single-lane would hide the lane that was just kept');
}

console.log('subtitles.check: ok');
