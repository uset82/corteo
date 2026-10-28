import assert from 'node:assert/strict';
import { parseVtt } from './vtt';

const VTT = `WEBVTT
Kind: captions

NOTE this comment block is ignored

STYLE
::cue { color: white }

00:00:01.000 --> 00:00:03.000
Hello world

cue-2
00:00:05.000 --> 00:00:08.000 align:start position:10%
<v Singer><00:00:05.000>One <00:00:06.000>two <00:00:07.000>three</v>
`;

const words = parseVtt(VTT);
assert.deepEqual(words.map((word) => word.text), ['Hello world', 'One', 'two', 'three']);
assert.equal(words[0]!.start, 1000);
assert.equal(words[0]!.end, 3000);
assert.equal(words[1]!.start, 5000);
assert.equal(words[1]!.end, 6000);
assert.equal(words[2]!.start, 6000);
assert.equal(words[3]!.start, 7000);
assert.equal(words[3]!.end, 8000);

// mm:ss.mmm shorthand without an hours field.
const SHORT = 'WEBVTT\n\n00:10.000 --> 00:12.500\nShort stamps\n';
assert.deepEqual(parseVtt(SHORT), [{ text: 'Short stamps', start: 10_000, end: 12_500 }]);

// Payload lines are joined and entities decoded; tags never leak into the text.
const MULTI = 'WEBVTT\n\n00:00:04.000 --> 00:00:06.250\n<v Ana>Hola</v> &amp; adiós\nSegunda\nlínea\n';
assert.deepEqual(parseVtt(MULTI), [{ text: 'Hola & adiós Segunda línea', start: 4000, end: 6250 }]);

// A cue that ends before it starts is dropped; a file with none left throws.
assert.throws(() => parseVtt('WEBVTT\n\n00:05.000 --> 00:04.000\nnope\n'), /VTT 文件中没有有效字幕/);
assert.throws(() => parseVtt('WEBVTT\n\nNOTE solo notas\nsin pistas\n'), /VTT 文件中没有有效字幕/);
assert.throws(() => parseVtt('no es un vtt'), /VTT 文件中没有有效字幕/);

console.log('vtt.check: ok');
