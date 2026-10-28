import assert from 'node:assert/strict';
import { parseLrc, resolveLyrics, splitPlainLyrics, timeUntimedLines } from './lyricsInput.ts';

assert.deepEqual(parseLrc('[ar:artist]\n[offset:+500]\n[00:01.00][00:03.250] hola\n[00:05] adiós'),
  [{ text: 'hola', startMs: 1500, endMs: 3750 }, { text: 'hola', startMs: 3750, endMs: 5500 },
    { text: 'adiós', startMs: 5500, endMs: 9500 }]);
assert.equal(parseLrc('plain'), null);
assert.deepEqual(splitPlainLyrics('[Coro]\n A \n(x2)\n[Verso 1]\nA\n(bis)\n[Chorus]\n B'), ['A', 'A', 'B']);
const timing = { downbeatsMs: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000], fromMs: 0, toMs: 8000 };
assert.deepEqual(timeUntimedLines(['a', 'b', 'c', 'd'], timing).map((line) => line.startMs), [0, 2000, 4000, 6000]);
assert.deepEqual(timeUntimedLines(['a', 'b', 'c', 'd', 'e', 'f'], { downbeatsMs: [0, 3000], fromMs: 0, toMs: 6000 }).map((line) => line.startMs), [0, 1000, 2000, 3000, 4000, 5000]);
assert.deepEqual(timeUntimedLines(['a', 'b', 'c'], { downbeatsMs: [], fromMs: 0, toMs: 6000 }).map((line) => line.startMs), [0, 2000, 4000]);
const base = { ...timing, pasted: 'paste', besideLrc: '[00:01] lrc', besideTxt: 'txt', transcriptLines: [{ text: 'transcript', startMs: 0, endMs: 1000 }] };
assert.equal(resolveLyrics(base).source, 'pasted');
assert.equal(resolveLyrics({ ...base, pasted: '' }).source, 'lrc');
assert.equal(resolveLyrics({ ...base, pasted: '', besideLrc: '' }).source, 'txt');
assert.equal(resolveLyrics({ ...base, pasted: '', besideLrc: '', besideTxt: '' }).source, 'transcript');
assert.equal(resolveLyrics({ ...base, pasted: '', besideLrc: '', besideTxt: '', transcriptLines: [] }).source, 'none');
assert.deepEqual(resolveLyrics({ ...timing, fromMs: 2000, toMs: 4000, pasted: '[00:01] one\n[00:03] two\n[00:05] three' }).lines,
  [{ text: 'one', startMs: 2000, endMs: 3000 }, { text: 'two', startMs: 3000, endMs: 4000 }]);
console.log('lyricsInput.verify: ok');
