// P2-2: ASS karaoke (\k/\kf/\ko) becomes word-timed captions, including
// reordered Format columns, comma text, override tags and drawing blocks.
// Run: npx tsx src/captions/ass.verify.ts
import assert from 'node:assert/strict';
import { parseAss, parseAssTime } from './ass';

assert.equal(parseAssTime('0:00:01.50'), 1500);
assert.equal(parseAssTime('0:00:01.005'), 1005);
assert.equal(parseAssTime('1:02:03.04'), 3_723_040);

const header = '[Script Info]\nTitle: test\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
const words = parseAss(`${header}Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k50}Hola {\\k100}mundo\n`);
assert.deepEqual(words.map((word) => word.text), ['Hola', 'mundo']);
assert.equal(words[0]!.start, 1000);
assert.equal(words[0]!.end, 1500);
assert.equal(words[1]!.start, 1500);
assert.equal(words[1]!.end, 3000, 'the last karaoke word extends to the Dialogue end');

const kfko = parseAss(`${header}Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,{\\kf50}Uno{\\ko50}Dos\n`);
assert.deepEqual(kfko.map((word) => [word.text, word.start, word.end]), [
  ['Uno', 0, 500],
  ['Dos', 500, 2000],
]);

const reordered = parseAss('[Events]\nFormat: Start, End, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
  + 'Dialogue: 0:00:00.00,0:00:02.00,0,Default,,0,0,0,,{\\k100}Hola, mundo\n');
assert.deepEqual(reordered.map((word) => word.text), ['Hola,', 'mundo']);
assert.equal(reordered[0]!.start, 0);
assert.equal(reordered[1]!.start, reordered[0]!.end);
assert.equal(reordered[reordered.length - 1]!.end, 2000);

const tagged = parseAss(`${header}Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\i1}{\\k50}Hello{\\i0} {\\k50}world\n`);
assert.deepEqual(tagged.map((word) => word.text), ['Hello', 'world']);
assert.deepEqual(tagged.map((word) => word.end - word.start), [500, 500]);

const drawing = parseAss(`${header}Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\p1}m 0 0 l 10 10{\\p0}{\\k50}Hola\n`);
assert.deepEqual(drawing.map((word) => word.text), ['Hola'], 'vector drawing text is not a caption');

const plain = parseAss(`${header}Dialogue: 0,0:00:02.00,0:00:04.00,Default,,0,0,0,,Una linea sin karaoke\n`);
assert.deepEqual(plain, [{ text: 'Una linea sin karaoke', start: 2000, end: 4000 }]);

assert.throws(() => parseAss('not an ass file'), /ASS 文件中没有有效字幕/);
console.log('ass.check: karaoke word timing OK');
