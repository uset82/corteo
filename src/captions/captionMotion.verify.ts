import assert from 'node:assert/strict';
import type { CaptionPage } from './types';
import {
  captionPageMotionStyle,
  captionWordMotionStyle,
  isCaptionMotionPreset,
  latidoScale,
} from './captionMotion';

const page: CaptionPage = {
  start: 1_000,
  end: 2_000,
  words: [
    { id: 'first', text: 'first', start: 1_000, end: 1_400 },
    { id: 'second', text: 'second', start: 1_500, end: 1_900 },
  ],
};

assert.equal(isCaptionMotionPreset('karaoke-pulse'), true);
assert.equal(isCaptionMotionPreset('unknown'), false);
assert.deepEqual(captionPageMotionStyle(undefined, page, 1_200), {});
assert.deepEqual(captionPageMotionStyle('none', page, 1_200), {});
assert.deepEqual(captionWordMotionStyle(undefined, page.words[0]!, 1_200), {});

const fadeStart = captionPageMotionStyle('fade-up', page, 1_000);
assert.equal(fadeStart.opacity, 0);
assert.equal(fadeStart.transform, 'translateY(18px)');
const fadeSettled = captionPageMotionStyle('fade-up', page, 1_500);
assert.equal(fadeSettled.opacity, 1);
assert.equal(fadeSettled.transform, 'translateY(0px)');
assert.deepEqual(
  captionPageMotionStyle('fade-up', page, 1_075),
  captionPageMotionStyle('fade-up', page, 1_075),
  'identical timeline milliseconds must produce identical render styles',
);
assert.equal(captionPageMotionStyle('pop', page, page.end).opacity, 0);

const hiddenWord = captionWordMotionStyle('word-pop', page.words[1]!, 1_499);
assert.equal(hiddenWord.opacity, 0);
const enteredWord = captionWordMotionStyle('word-pop', page.words[1]!, 1_700);
assert.equal(enteredWord.opacity, 1);
assert.equal(enteredWord.transform, 'scale(1)');

assert.deepEqual(captionWordMotionStyle('karaoke-pulse', page.words[0]!, 999), {});
assert.equal(captionWordMotionStyle('karaoke-pulse', page.words[0]!, 1_200).transform, 'scale(1.08)');
assert.deepEqual(captionPageMotionStyle('word-pop', page, 1_200), {});

// Plan 2 › L-10: latido pulses the active line on the beat grid stored with the captions.
assert.equal(isCaptionMotionPreset('latido'), true);
assert.equal(latidoScale(undefined, 1_500), 1);
assert.equal(latidoScale([], 1_500), 1);
const latidoBeats = [1_000, 1_500, 1_900];
assert.equal(latidoScale(latidoBeats, 999), 1, 'before the first beat there is no pulse');
const near = (actual: number, expected: number, label: string): void => {
  assert.ok(Math.abs(actual - expected) <= 1e-12, `${label}: expected ${expected}, got ${actual}`);
};
near(latidoScale(latidoBeats, 1_000), 1.07, 'the beat frame carries the full bump');
near(latidoScale(latidoBeats, 1_080), 1.0175, 'half the decay window leaves a quarter of the bump');
assert.equal(latidoScale(latidoBeats, 1_160), 1, 'the decay window ends before the next beat');
assert.equal(latidoScale(latidoBeats, 1_899), 1, 'the pulse is local to its own beat');
assert.deepEqual(captionPageMotionStyle('latido', page, 1_200, undefined), {}, 'no grid, no motion');
assert.deepEqual(
  captionPageMotionStyle('latido', page, 1_500, latidoBeats),
  { opacity: 1, transform: 'scale(1.07)', transformOrigin: 'center' },
);
assert.deepEqual(
  captionPageMotionStyle('latido', page, 1_500, latidoBeats),
  captionPageMotionStyle('latido', page, 1_500, latidoBeats),
  'identical timeline milliseconds must produce identical beat styles',
);

console.log('captionMotion.verify: deterministic preview/export motion contract passed');
