import assert from 'node:assert/strict';
import { parseAss } from './ass';

const ass = [
  '[Script Info]',
  'Title: Prueba',
  'ScriptType: v4.00+',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize',
  'Style: Default,Arial,48',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  // \k: two syllables that fill the cue exactly.
  'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k100}Hel{\\k100}lo',
  // \kf and \K with a style block in front; the karaoke run is shorter than the
  // cue, so it must keep its own timing instead of stretching to the cue end.
  'Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,{\\an8}{\\kf50}uno {\\K50}dos',
  // \ko, and a syllable that is not a whole word.
  'Dialogue: 0,0:00:07.00,0:00:09.00,Default,,0,0,0,,{\\ko20}tre{\\ko20}s',
  // Text before the first tag belongs to the line.
  'Dialogue: 0,0:00:10.00,0:00:12.00,Default,,0,0,0,,Antes{\\k20}despues',
  // No karaoke at all: one caption, \\N keeps the words apart.
  'Dialogue: 0,0:00:13.00,0:00:14.00,Default,,0,0,0,,{\\b1}linea uno\\Nlinea dos',
  // Comment lines are notes, not captions.
  'Comment: 0,0:00:15.00,0:00:16.00,Default,,0,0,0,,no es una pista',
].join('\r\n');

const words = parseAss(ass);
assert.deepEqual(words, [
  { text: 'Hel', start: 1000, end: 2000 },
  { text: 'lo', start: 2000, end: 3000 },
  { text: 'uno', start: 4000, end: 4500 },
  { text: 'dos', start: 4500, end: 5000 },
  { text: 'tre', start: 7000, end: 7200 },
  { text: 's', start: 7200, end: 7400 },
  { text: 'Antes', start: 10000, end: 10200 },
  { text: 'despues', start: 10200, end: 10400 },
  { text: 'linea uno linea dos', start: 13000, end: 14000 },
]);

// Centiseconds, not milliseconds: .50 is half a second.
assert.deepEqual(parseAss([
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:00.50,0:00:01.50,Default,,0,0,0,,{\\k100}uno',
].join('\n')), [{ text: 'uno', start: 500, end: 1500 }]);

// Out-of-order lines come back sorted.
assert.deepEqual(parseAss([
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,later',
  'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,earlier',
].join('\n')).map((word) => word.text), ['earlier', 'later']);

// Malformed input is rejected with the reason, not an empty list.
assert.throws(() => parseAss('no es un ass'), /没有有效字幕/);
assert.throws(() => parseAss([
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  // 99 seconds is not a time; the line is dropped and nothing is left.
  'Dialogue: 0,0:00:99.00,0:00:99.50,Default,,0,0,0,,{\\k10}mal',
].join('\n')), /没有有效字幕/);
assert.throws(() => parseAss([
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  // Backwards range: nothing to time.
  'Dialogue: 0,0:00:03.00,0:00:02.00,Default,,0,0,0,,{\\k10}atras',
].join('\n')), /没有有效字幕/);

console.log('ass.verify: ok');
