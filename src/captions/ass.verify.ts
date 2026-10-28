import assert from 'node:assert/strict';
import { parseAss } from './ass';

// Karaoke tags: \k values are centiseconds and apply to the text that follows.
const KARAOKE = `[Script Info]
Title: importer check

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,48

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k20}Hel{\\k30}lo {\\k50}world
Dialogue: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,{\\pos(10,20)}Plain, with comma
Dialogue: 0,0:00:10.00,0:00:11.00,Default,,0,0,0,,{\\k10}one{\\k10}\\h{\\k10}two
Dialogue: 0,0:00:20.00,0:00:22.00,Default,,0,0,0,,Hello\\Nworld
`;

const words = parseAss(KARAOKE);
assert.deepEqual(words.map((word) => word.text), [
  'Hello', 'world', 'Plain, with comma', 'one', 'two', 'Hello world',
]);
const [hello, world, plain, one, two, broken] = words;
assert.equal(hello!.start, 1000);
assert.equal(hello!.end, 1400); // trailing space of the syllable run is not part of the word
assert.equal(world!.start, 1500);
assert.equal(world!.end, 2000);
assert.equal(plain!.start, 5000);
assert.equal(plain!.end, 7000);
assert.equal(one!.start, 10000);
assert.equal(two!.start, 10200);
assert.equal(broken!.start, 20000);
assert.equal(broken!.end, 22000);

// Reordered Format columns still resolve Start/End/Text.
const REORDERED = `[Events]
Format: Text, Layer, Start, End, Style
Dialogue: Reordered line,0,0:00:01.00,0:00:02.00,Default
`;
assert.deepEqual(parseAss(REORDERED).map((word) => word.text), ['Reordered line']);

assert.throws(() => parseAss('[Events]\nFormat: Layer, Start, End, Text\n'), /ASS 文件中没有有效字幕/);

// Uppercase \K is the same tag; several tags in one block leave the last one in charge.
{
  const words = parseAss([
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\K20}up{\\k10\\k30}per',
  ].join('\n'));
  // Syllables without a space between them are one word, as the pager needs.
  assert.deepEqual(words.map((word) => [word.text, word.start, word.end]), [['upper', 1000, 1500]]);
}

// A karaoke run longer than its cue is scaled to fit; the words never pass the cue end.
{
  const words = parseAss([
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\k100}a {\\k100}b',
  ].join('\n'));
  assert.deepEqual(words.map((word) => word.text), ['a', 'b']);
  assert.equal(words[0]!.start, 0);
  assert.equal(words[1]!.start, 500);
  assert.equal(words[1]!.end, 1000, 'overrunning karaoke is scaled into the cue');
}

// Text before the first tag keeps a slice of the cue even when the karaoke run
// already fills it: it weighs one average syllable, so the line is halved.
{
  const words = parseAss([
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Lead {\\k100}word',
  ].join('\n'));
  assert.deepEqual(words.map((word) => [word.text, word.start, word.end]), [['Lead', 0, 400], ['word', 500, 1000]]);
}

// Without a Format: line the v4+ column order applies (Start, End, … Text last).
{
  const words = parseAss('[Events]\nDialogue: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,plain line');
  assert.deepEqual(words.map((word) => [word.text, word.start, word.end]), [['plain line', 2000, 3000]]);
}

// Bad stamps and backwards ranges are dropped, not turned into zero-length words.
assert.throws(() => parseAss([
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:99.00,0:00:99.50,Default,,0,0,0,,{\\k10}bad',
  'Dialogue: 0,0:00:03.00,0:00:02.00,Default,,0,0,0,,{\\k10}backwards',
].join('\n')), /ASS 文件中没有有效字幕/);

console.log('ass.check: ok');
