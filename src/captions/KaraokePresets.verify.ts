// KaraokePresets.verify — Phase 3.2: karaoke template registry + SRT cue round-trip.
import assert from 'node:assert/strict';
import {
  KARAOKE_LAYOUT,
  KARAOKE_TEMPLATES,
  cuesToSrt,
  isKaraokeTemplate,
  karaokeTemplateOf,
  parseSrtCues,
} from './KaraokePresets';

// ── Registry ────────────────────────────────────────────────────────────────

assert.deepEqual([...KARAOKE_TEMPLATES], ['karaoke-verse', 'karaoke-chant', 'karaoke-fill']);
assert.equal(isKaraokeTemplate('karaoke-verse'), true);
assert.equal(isKaraokeTemplate('plain'), false);
assert.equal(isKaraokeTemplate(12), false);
assert.equal(isKaraokeTemplate(undefined), false);
assert.equal(karaokeTemplateOf('karaoke-chant'), 'karaoke-chant');
assert.equal(karaokeTemplateOf('plain'), null);
assert.equal(karaokeTemplateOf(undefined), null);
assert.deepEqual(KARAOKE_LAYOUT['karaoke-chant'], { anchor: 'middle-center' });
assert.equal(KARAOKE_LAYOUT['karaoke-verse'].anchor, 'bottom-center');
assert.equal(Object.keys(KARAOKE_LAYOUT).length, KARAOKE_TEMPLATES.length, 'every preset has a layout');

// ── SRT parsing ─────────────────────────────────────────────────────────────

const srt = '1\n00:00:01,500 --> 00:00:02,250\nhola mundo\n\n2\n00:00:03,000 --> 00:00:04,000\nsegunda\nlínea\n';
assert.deepEqual(parseSrtCues(srt), [
  { startMs: 1500, endMs: 2250, text: 'hola mundo' },
  { startMs: 3000, endMs: 4000, text: 'segunda\nlínea' },
]);
// Dot decimals and CRLF are accepted; blocks without a usable timecode are skipped.
assert.deepEqual(parseSrtCues('1\r\n00:00:05.250 --> 00:00:06.000\r\npunto\r\n'), [
  { startMs: 5250, endMs: 6000, text: 'punto' },
]);
assert.deepEqual(parseSrtCues('garbage'), []);
assert.deepEqual(parseSrtCues('1\n00:00:01,000 --> 00:00:02,000\n\n'), [], 'empty text is skipped');
assert.deepEqual(parseSrtCues('1\nnot a timecode\ntext\n'), []);

// ── SRT export round-trip ───────────────────────────────────────────────────

const cues = parseSrtCues(srt);
const written = cuesToSrt(cues);
assert.match(written, /^1\n00:00:01,500 --> 00:00:02,250\nhola mundo\n\n2\n/);
assert.deepEqual(parseSrtCues(written), cues, 'export round-trips through its parser');
assert.equal(cuesToSrt([]), '\n');

console.log('KaraokePresets.verify: karaoke templates and SRT cue round-trips');
