// Regression for the .ass interchange (Phase 3.2): colour/timecode encoding,
// karaoke \k runs, style resolution, and word-level round-trip.
import assert from 'node:assert/strict';
import { assColor, assTimestamp, captionsToAss, parseAss } from './ass';
import type { CaptionsData } from './types';
import type { TimelineItem } from '../editor/types';

assert.equal(assColor('#FFFFFF'), '&H00FFFFFF');
assert.equal(assColor('#FF0000'), '&H000000FF', 'ASS stores BBGGRR');
assert.equal(assColor('#000000', 0.5), '&H80000000', 'alpha is inverted');

assert.equal(assTimestamp(0), '0:00:00.00');
assert.equal(assTimestamp(3_723_456), '1:02:03.46');
assert.equal(assTimestamp(-50), '0:00:00.00');

const words = [
  { text: 'uno', start: 0, end: 500 },
  { text: 'dos', start: 500, end: 1250 },
  { text: 'tres', start: 1250, end: 1250 },
];
const item = {
  id: 'clip1', track: 'v1', startFrame: 0, durationInFrames: 60,
  name: 'voz', kind: 'video', transcript: words,
} as unknown as TimelineItem;
const captions: CaptionsData = { enabled: true, template: 'karaoke-verse', pacing: 'phrase', sourceItemId: 'clip1' };

const ass = captionsToAss(captions, [item], 30, { title: 'Mi video' });
assert.ok(ass.includes('Title: Mi video'));
assert.ok(ass.includes('ScriptType: v4.00+'));
assert.ok(ass.includes('[V4+ Styles]') && ass.includes('[Events]'));
assert.ok(/Style: Karaoke,Playfair Display,50,/.test(ass), 'style follows the karaoke-verse preset');
assert.ok(ass.includes('{\\k50}uno'), 'first word holds 50 cs');
assert.ok(/\{\\k\d+\} dos/.test(ass), 'spaces between Latin words are preserved');
assert.ok(/\{\\k\d+\} tres/.test(ass), 'every word gets its own karaoke run');

const plain = captionsToAss(captions, [item], 30, { karaoke: false });
assert.ok(!plain.includes('{\\k'), 'karaoke:false emits plain lines');

const parsed = parseAss(ass);
assert.deepEqual(parsed.map((word) => word.text), ['uno', 'dos', 'tres']);
assert.equal(parsed[0]!.start, 0);
assert.ok(Math.abs(parsed[1]!.end - 1250) <= 34, 'frame-quantized timing round-trips within one 30 fps frame');

// A line without karaoke tags still becomes one timed word.
assert.deepEqual(parseAss('Dialogue: 0,0:00:01.00,0:00:02.50,Verse,,0,0,0,,hola mundo'), [
  { text: 'hola mundo', start: 1000, end: 2500 },
]);
assert.throws(() => parseAss('no dialogue here'), /ASS/);

console.log('ass.verify: colours, timestamps, karaoke runs and word round-trip');
