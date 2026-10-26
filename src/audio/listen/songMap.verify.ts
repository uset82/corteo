import assert from 'node:assert/strict';
import {
  attachLinesToSections,
  buildSongMap,
  groupWordsIntoLines,
  markChorusLines,
  normalizedLineText,
  SONG_MAP_ANALYZER_FINGERPRINT,
  SONG_MAP_SCHEMA_VERSION,
  type SongLyricWord,
  type SongMapLine,
  type SongMapSection,
} from './songMap.ts';
import type { MusicAnalysis } from '../intelligence/types.ts';

function word(text: string, startMs: number, endMs: number): SongLyricWord {
  return { text, startMs, endMs };
}

// 1. Silence ends a line; words inside one phrase stay together.
const words: SongLyricWord[] = [
  word('hola', 0, 300),
  word('mundo', 320, 600),
  word('otra', 1_500, 1_900),
  word('linea', 1_920, 2_300),
  word('final.', 2_320, 2_600),
  word('despues', 2_700, 3_000),
];
assert.deepEqual(groupWordsIntoLines(words), [
  { text: 'hola mundo', startMs: 0, endMs: 600 },
  { text: 'otra linea final.', startMs: 1_500, endMs: 2_600 },
  { text: 'despues', startMs: 2_700, endMs: 3_000 },
], 'a 900 ms gap starts a new line and a full stop closes one');

assert.deepEqual(groupWordsIntoLines(words, { gapMs: 100 }), [
  { text: 'hola mundo', startMs: 0, endMs: 600 },
  { text: 'otra linea final.', startMs: 1_500, endMs: 2_600 },
  { text: 'despues', startMs: 2_700, endMs: 3_000 },
], 'sentence punctuation closes a line even with a smaller gap');

const many = Array.from({ length: 15 }, (_, index) => word(`w${index}`, index * 100, index * 100 + 90));
const cappedWords = groupWordsIntoLines(many);
assert.equal(cappedWords.length, 2, 'a line never exceeds the word cap');
assert.equal(cappedWords[0]!.text.split(' ').length, 14);

const slow = Array.from({ length: 16 }, (_, index) => word(`s${index}`, index * 600, index * 600 + 400));
const cappedDuration = groupWordsIntoLines(slow);
assert.equal(cappedDuration.length, 2, 'a line never exceeds the duration cap');
assert.ok(cappedDuration.every((line) => line.endMs - line.startMs <= 8_000));

const dirty = groupWordsIntoLines([
  word('  hola  ', 0, 100),
  word('   ', 120, 130),
  word('mundo', Number.NaN, 200),
  word('otra', -50, 300),
]);
assert.deepEqual(dirty, [{ text: 'hola otra', startMs: 0, endMs: 300 }],
  'blank and non-finite words are dropped, negative starts clamp to 0 and text collapses');

// 2. Case, accents and punctuation do not hide a repeat.
assert.equal(normalizedLineText('Sí, sí.'), normalizedLineText('SI SI'));
const repeated: SongMapLine[] = [
  { text: 'La noche entera', startMs: 0, endMs: 1_000 },
  { text: 'otra cosa', startMs: 1_000, endMs: 2_000 },
  { text: 'LA NOCHE ENTERA!', startMs: 2_000, endMs: 3_000 },
  { text: 'final', startMs: 3_000, endMs: 4_000 },
];
const marked = markChorusLines(repeated);
assert.deepEqual(marked.chorusGroups, [{ index: 1, text: 'la noche entera', lineIndexes: [0, 2] }],
  'repeated lines become one chorus group in order of first appearance');
assert.deepEqual(marked.lines.map((line) => line.chorusGroup), [1, undefined, 1, undefined],
  'only repeated lines carry a group');
assert.equal(repeated[0]!.chorusGroup, undefined, 'marking a chorus does not mutate its input');

const twoGroups = markChorusLines([
  { text: 'a', startMs: 0, endMs: 1 },
  { text: 'b', startMs: 1, endMs: 2 },
  { text: 'b', startMs: 2, endMs: 3 },
  { text: 'a', startMs: 3, endMs: 4 },
]);
assert.deepEqual(twoGroups.chorusGroups.map((group) => group.text), ['a', 'b'],
  'chorus groups are numbered by first appearance, not by text');

// 3. Lines land in the section that contains their start.
const sections: SongMapSection[] = [
  { fromMs: 0, toMs: 1_000, role: 'intro-like', energy: 0.3 },
  { fromMs: 1_000, toMs: 2_000, role: 'peak', energy: 0.9 },
  { fromMs: 2_000, toMs: 3_000, role: 'outro-like', energy: 0.4 },
];
const attached = attachLinesToSections([
  { text: 'a', startMs: 0, endMs: 100 },
  { text: 'b', startMs: 1_000, endMs: 1_100 },
  { text: 'c', startMs: 2_999, endMs: 3_000 },
  { text: 'd', startMs: 3_500, endMs: 3_600 },
], sections);
assert.deepEqual(attached.map((line) => line.sectionIndex), [0, 1, 2, 2],
  'boundaries belong to the later section and past-the-end lines clamp to the last');

// 4. The map composes analysis sections, transcript lines and their choruses.
const analysis: MusicAnalysis = {
  schemaVersion: 1,
  assetId: 'asset-song',
  sourceRevision: 'rev-song',
  createdAt: 1,
  durationMs: 3_000,
  modelPacks: { rhythm: 'r', semantic: 's' },
  bpm: 120,
  meter: 4,
  beatConfidence: 0.9,
  beatsMs: [0, 500, 1_000, 1_500, 2_000, 2_500],
  downbeatsMs: [0, 2_000],
  sections: [
    { fromMs: 0, toMs: 1_000, role: 'intro-like', energy: 0.3, boundaryConfidence: 0.5 },
    { fromMs: 1_000, toMs: 2_000, role: 'peak', energy: 0.9, boundaryConfidence: 0.5,
      mood: { kind: 'mood', label: 'festive', score: 0.8 } },
    { fromMs: 2_000, toMs: 3_000, role: 'outro-like', energy: 0.4, boundaryConfidence: 0.5 },
  ],
  tags: [],
  embedding: new Array(512).fill(0),
};
const map = buildSongMap({ analysis, transcriptWords: words, createdAt: 7 });
assert.equal(map.schemaVersion, SONG_MAP_SCHEMA_VERSION);
assert.equal(map.analyzerFingerprint, SONG_MAP_ANALYZER_FINGERPRINT);
assert.equal(map.lyricsSource, 'transcript');
assert.equal(map.lines.length, 3);
assert.deepEqual(map.lines.map((line) => line.sectionIndex), [0, 1, 2]);
assert.deepEqual(map.chorusGroups, []);
assert.equal(map.sections[1]!.mood?.label, 'festive', 'section moods travel into the map');
assert.equal(map.createdAt, 7);

const choral = buildSongMap({
  analysis,
  transcriptWords: [
    word('la', 0, 100), word('noche', 120, 300),
    word('otra', 1_000, 1_100), word('frase', 1_120, 1_300),
    word('la', 2_000, 2_100), word('noche', 2_120, 2_300),
  ],
  createdAt: 8,
});
assert.equal(choral.lyricsSource, 'transcript');
assert.deepEqual(choral.chorusGroups.map((group) => group.lineIndexes), [[0, 2]]);
assert.deepEqual(choral.lines.map((line) => line.chorusGroup), [1, undefined, 1]);

// User lines replace the transcript entirely, and the map says so.
const userMap = buildSongMap({
  analysis,
  transcriptWords: words,
  userLines: [word('mi letra', 0, 900), word('mi letra', 2_000, 2_900)],
  createdAt: 9,
});
assert.equal(userMap.lyricsSource, 'user');
assert.deepEqual(userMap.lines.map((line) => line.text), ['mi letra', 'mi letra'],
  'provided lyrics win over the transcript');
assert.deepEqual(userMap.lines.map((line) => line.sectionIndex), [0, 2]);
assert.deepEqual(userMap.chorusGroups.map((group) => group.lineIndexes), [[0, 1]]);

const emptyMap = buildSongMap({ analysis, createdAt: 10 });
assert.equal(emptyMap.lyricsSource, 'none');
assert.deepEqual(emptyMap.lines, []);
assert.deepEqual(emptyMap.chorusGroups, []);

console.log('songMap.verify: line grouping, chorus candidates, section attachment, cache shape');
