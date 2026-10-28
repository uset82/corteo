import assert from 'node:assert/strict';
import { planSongFilm, type SongFilmInput } from './songFilm.ts';

const input: SongFilmInput = {
  fps: 30, width: 1080, height: 1920, fromFrame: 0, toFrame: 960,
  downbeatFrames: Array.from({ length: 16 }, (_, i) => i * 60),
  sections: [{ fromMs: 0, toMs: 10000, role: 'verse', energy: 0.2 },
    { fromMs: 10000, toMs: 20000, role: 'chorus', energy: 0.8 },
    { fromMs: 20000, toMs: 32000, role: 'outro', energy: 0.4 }],
  energy: { stepMs: 1000, values: Array.from({ length: 33 }, (_, i) => i / 32) },
  lyrics: [{ text: 'Vuelve', startMs: 0, endMs: 2000 }, { text: 'Noche', startMs: 4000, endMs: 6000 },
    { text: 'vuelve!', startMs: 8000, endMs: 10000 }, { text: 'Luz', startMs: 12000, endMs: 14000 }],
  stills: ['a', 'b'],
};
const plan = planSongFilm(input);
assert.equal(plan.cutGrid, 'downbeat');
assert.ok(plan.cutFrames.every((frame) => frame === 0 || frame === 960 || input.downbeatFrames.includes(frame)));
assert.ok(plan.visuals.every((visual) => visual.durationInFrames <= 240));
assert.deepEqual(plan.texts.map((text) => text.fromFrame), [0, 120, 240, 360]);
assert.equal(plan.texts[0]?.chorus, true);
assert.equal(plan.texts[2]?.chorus, true);
assert.ok(plan.texts[3]!.keyframes.scale![0]!.value > plan.texts[0]!.keyframes.scale![0]!.value);
assert.ok(plan.visuals.every((visual, i) => visual.assetId === input.stills[i % 2]));
for (const item of [...plan.visuals, ...plan.texts]) {
  assert.ok(item.fromFrame >= input.fromFrame && item.fromFrame + item.durationInFrames <= input.toFrame);
  for (const frames of Object.values(item.keyframes)) assert.ok(frames.length <= 64);
}
const fixed = planSongFilm({ ...input, downbeatFrames: [], stills: [] });
assert.equal(fixed.cutGrid, 'fixed-2s');
assert.deepEqual(fixed.cutFrames.slice(0, 4), [0, 60, 120, 180]);
assert.ok(fixed.visuals.every((visual) => visual.kind === 'solid'));
const long = planSongFilm({ ...input, toFrame: 20000, downbeatFrames: [0], lyrics: [{ text: 'long', startMs: 0, endMs: 666666 }] });
assert.ok(long.texts[0]!.keyframes.scale!.length <= 64);
console.log('songFilm.verify: ok');
