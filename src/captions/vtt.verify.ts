import assert from 'node:assert/strict';
import { parseVtt } from './vtt';

const vtt = [
  '\uFEFFWEBVTT - coro',
  '',
  'NOTE este bloque es una nota',
  'no es un subtítulo',
  '',
  'STYLE',
  '::cue { color: yellow }',
  '',
  'intro',
  '00:01.500 --> 00:03.000 align:start position:10%',
  '<v Ana>Hola</v> &amp; adiós',
  '',
  '00:00:04.000 --> 00:00:06.250',
  'Segunda',
  'línea',
  '',
  '00:00:07.000 --> 00:00:08.000',
  '<c.yellow>Otra</c> <00:00:07.500>vez',
].join('\r\n');

assert.deepEqual(parseVtt(vtt), [
  // mm:ss.mmm, cue settings ignored, NOTE and STYLE blocks skipped.
  { text: 'Hola & adiós', start: 1500, end: 3000 },
  // hh:mm:ss.mmm, payload lines joined.
  { text: 'Segunda línea', start: 4000, end: 6250 },
  // Inline tag and inline timestamp stripped.
  { text: 'Otra vez', start: 7000, end: 8000 },
]);

// Malformed input is rejected with the reason, not an empty list.
assert.throws(() => parseVtt('WEBVTT\n\n00:02.000 --> 00:01.000\nbackwards'), /没有有效字幕/);
assert.throws(() => parseVtt('WEBVTT\n\nNOTE solo notas\nsin pistas'), /没有有效字幕/);
assert.throws(() => parseVtt('no es un vtt'), /没有有效字幕/);

console.log('vtt.verify: ok');
