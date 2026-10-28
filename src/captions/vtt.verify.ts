// P2-2: WebVTT import — hour and minute timestamps, tags, entities, NOTE blocks.
// Run: npx tsx src/captions/vtt.verify.ts
import assert from 'node:assert/strict';
import { parseVtt, parseVttTime } from './vtt';

assert.equal(parseVttTime('00:01.000'), 1000);
assert.equal(parseVttTime('01:02:03.004'), 3_723_004);
assert.equal(parseVttTime('00:00:60.000'), null);

const words = parseVtt(`WEBVTT

NOTE this is a comment

cup-1
00:01.000 --> 00:03.500 line:90% align:center
Hello <b>world</b> &amp; all.

00:00:04.000 --> 00:00:05.000
Second cue
`);
assert.deepEqual(words.map((word) => [word.text, word.start, word.end]), [
  ['Hello world & all.', 1000, 3500],
  ['Second cue', 4000, 5000],
]);

assert.throws(() => parseVtt('WEBVTT\n\nNOTE nothing'), /VTT 文件中没有有效字幕/);
console.log('vtt.check: cues and timestamps OK');
