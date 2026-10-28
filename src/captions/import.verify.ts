// P2-2: one subtitle entry point for the UI and the MCP tool.
// Run: npx tsx src/captions/import.verify.ts
import assert from 'node:assert/strict';
import { inferSubtitleFormat, parseSubtitles, subtitleFormatFromName } from './import';

assert.equal(subtitleFormatFromName('lyrics.SRT'), 'srt');
assert.equal(subtitleFormatFromName('karaoke.ass'), 'ass');
assert.equal(subtitleFormatFromName('karaoke.ssa'), 'ass');
assert.equal(subtitleFormatFromName('lyrics.vtt'), 'vtt');
assert.equal(subtitleFormatFromName('notes.txt'), null);

assert.equal(inferSubtitleFormat('WEBVTT\n\n00:01.000 --> 00:02.000\nHola'), 'vtt');
assert.equal(inferSubtitleFormat('[Events]\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Hola'), 'ass');
assert.equal(inferSubtitleFormat('1\n00:00:01,000 --> 00:00:02,000\nHola'), 'srt');
assert.equal(inferSubtitleFormat('just words'), null);

const srt = parseSubtitles('1\n00:00:01,000 --> 00:00:02,000\nHola\n');
assert.equal(srt.format, 'srt');
assert.deepEqual(srt.words, [{ text: 'Hola', start: 1000, end: 2000 }]);
const vtt = parseSubtitles('WEBVTT\n\n00:01.000 --> 00:02.000\nHola\n', 'vtt');
assert.equal(vtt.format, 'vtt');
const ass = parseSubtitles('[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\k50}Hola\n');
assert.equal(ass.format, 'ass');
assert.deepEqual(ass.words.map((word) => [word.text, word.start, word.end]), [['Hola', 0, 1000]]);
assert.throws(() => parseSubtitles('not subtitles'), /无法识别字幕格式/);
assert.throws(() => parseSubtitles('not subtitles', 'vtt'), /VTT 文件中没有有效字幕/);
console.log('subtitles-import.check: format detection and dispatch OK');
