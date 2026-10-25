// The visual proof for Plan 6, OP-08: an EMPHASISED word changes what is burned into a frame.
//
// The rule (captionWordColour), the channel (applyWordOverrides → word.emphasis) and the layer
// are unit-tested elsewhere. This file renders the real thing: the same cue twice, at the same
// frame, once with a word marked and once without, and compares the pixels the server produced.
// A control pair rendered from the same input must come back identical, otherwise "different"
// would prove nothing.
//
// The caption overlay is painted from a TRACK of kind caption — `captionTrackEntries` filters
// by `trackKind(id) === 'caption'`, which for a plain state means an id starting with "C" — so
// the fixture needs a `C1` track. Without it the still is just the clip's own colour and every
// comparison passes for the wrong reason.
//
// node remotion/caption-emphasis-render.verify.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { renderTimelineStills, setUploadsDirProvider } from './render.mjs';
import { disposeServeBundle } from './serve-bundle.mjs';

const run = promisify(execFile);
const WIDTH = 320;
const HEIGHT = 180;
const FPS = 30;
const SOURCE = 'talk.mp4';
// One cue, two words, in the same frame range; index 1 is the one that gets marked.
const WORDS = [
  { text: 'precio', start: 0, end: 500 },
  { text: '300', start: 500, end: 1000 },
];
// Phrase pacing, and a frame where the marked word is on screen but NOT the active one:
// the active word already paints in the highlight colour, so emphasising it is invisible.
const STILL_FRAME = 3;

function timelineState(name, wordOverrides, captionsEnabled = true) {
  return {
    id: name, fps: FPS, width: WIDTH, height: HEIGHT,
    items: [{
      id: 'v1-talk', name: SOURCE, kind: 'video', src: `/media/uploads/${SOURCE}`,
      track: 'V1', startFrame: 0, durationInFrames: 60, srcInFrame: 0, playbackRate: 1,
      width: WIDTH, height: HEIGHT,
      transcript: WORDS,
    }],
    trackOrder: ['V1', 'C1'], trackStates: {}, selectedId: null, selectedIds: [], assets: [],
    captions: {
      enabled: captionsEnabled, template: 'tiktok', pacing: 'phrase', sourceMode: 'timeline',
      ...(wordOverrides ? { wordOverrides } : {}),
    },
  };
}

const directory = await mkdtemp(join(tmpdir(), 'openchatcut-caption-emphasis-'));
try {
  setUploadsDirProvider(() => directory);

  // A tiny real clip: the composition needs a materialised asset even though the test is
  // about the caption overlay.
  await run(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', `color=c=0x203040:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=2`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(directory, SOURCE),
  ]);

  const still = async (state) => {
    const [frame] = await renderTimelineStills({ state, frames: [STILL_FRAME] });
    return String(frame.base64);
  };

  // 1. Control: the same input twice must render identically, or the comparison is noise.
  const plainState = timelineState('emphasis-plain');
  const controlA = await still(plainState);
  const controlB = await still(plainState);
  assert.equal(controlA, controlB, 'the same timeline renders the same still twice');
  assert.ok(controlA.length > 1000, 'the still has real content');

  // 2. The caption layer is painting at all: the same frame with the overlay off must differ.
  //    This is the assertion that would have caught the missing C1 track; a byte count did not.
  const noOverlay = await still(timelineState('emphasis-no-overlay', undefined, false));
  assert.notEqual(noOverlay, controlA, 'the caption layer paints onto the frame');

  // 3. The word is marked: the frame must change.
  const emphasised = timelineState('emphasis-on', { 1: { emphasis: true } });
  const marked = await still(emphasised);
  assert.notEqual(marked, controlA, 'marking a word changes the rendered frame');

  // 4. And only because of the mark: an empty override map renders like the plain timeline.
  const emptyOverrides = await still(timelineState('emphasis-empty', {}));
  assert.equal(emptyOverrides, controlA, 'an empty override map changes nothing');

  console.log('caption-emphasis-render.verify: emphasis changes the burned-in frame, and nothing else does');
} finally {
  await rm(directory, { recursive: true, force: true }).catch(() => {});
  await disposeServeBundle().catch(() => {});
}
