// Plan 2 › L-10: the `latido` beat grid. The mapping is the same trim/speed one
// the music reactions use, and resolution reads the shared analysis cache through
// an injected loader, so this runs with no model packs and no IndexedDB.
import assert from 'node:assert/strict';
import type { MediaAsset, TimelineItem } from '../editor/types';
import {
  LATIDO_NO_ANALYSIS,
  LATIDO_NO_SONG,
  mapBeatsToTimeline,
  resolveLatidoBeats,
} from './latidoBeats';

const song = {
  id: 'song',
  kind: 'audio',
  track: 'A1',
  startFrame: 100,
  durationInFrames: 300,
  srcInFrame: 60,
  playbackRate: 2,
  sourceAssetId: 'asset_song',
} as TimelineItem;
const still = {
  id: 'visual',
  kind: 'image',
  track: 'V1',
  startFrame: 0,
  durationInFrames: 200,
  srcInFrame: 0,
  playbackRate: 1,
} as TimelineItem;
const asset = { id: 'asset_song', kind: 'audio', name: 'song.wav' } as MediaAsset;

// 1. Source ms → timeline ms through a 2 s trim at 2x; beats outside the window drop.
assert.deepEqual(
  mapBeatsToTimeline(song, [1_000, 4_000, 6_000, 22_000], 30),
  [4_333, 5_333],
  'only beats inside the clipped source window survive, mapped at 30 fps',
);
assert.deepEqual(mapBeatsToTimeline(song, [4_000], 60), [3_167], '60 fps rounds to the frame grid');
assert.deepEqual(mapBeatsToTimeline(song, [], 30), []);

// 2. Resolution: the captions source item wins, else the first audio clip.
const load = async () => ({ bpm: 120, beatsMs: [1_000, 4_000, 6_000, 22_000] });
const fromSource = await resolveLatidoBeats({
  items: [still, song], assets: [asset], fps: 30, sourceItemId: 'song', loadAnalysis: load,
});
assert.deepEqual(
  fromSource,
  { beatsMs: [4_333, 5_333], bpm: 120, itemId: 'song' },
  'the song clip supplies the grid',
);
const fromFallback = await resolveLatidoBeats({
  items: [still, song], assets: [asset], fps: 30, sourceItemId: 'visual', loadAnalysis: load,
});
assert.ok(!('error' in fromFallback) && fromFallback.itemId === 'song', 'a non-audio source falls back to the first audio clip');

// 3. Every missing link reports a Spanish error instead of writing an empty grid.
const noSong = await resolveLatidoBeats({ items: [still], assets: [asset], fps: 30, loadAnalysis: load });
assert.deepEqual(noSong, { error: LATIDO_NO_SONG });
const noAsset = await resolveLatidoBeats({ items: [song], assets: [], fps: 30, loadAnalysis: load });
assert.deepEqual(noAsset, { error: LATIDO_NO_ANALYSIS });
const noAnalysis = await resolveLatidoBeats({ items: [song], assets: [asset], fps: 30, loadAnalysis: async () => null });
assert.deepEqual(noAnalysis, { error: LATIDO_NO_ANALYSIS });
const emptyGrid = await resolveLatidoBeats({
  items: [song], assets: [asset], fps: 30, loadAnalysis: async () => ({ bpm: 120, beatsMs: [] }),
});
assert.deepEqual(emptyGrid, { error: LATIDO_NO_ANALYSIS });
const outsideWindow = await resolveLatidoBeats({
  items: [song], assets: [asset], fps: 30, loadAnalysis: async () => ({ bpm: 120, beatsMs: [0, 1_000] }),
});
assert.deepEqual(outsideWindow, { error: 'El análisis no deja pulsos dentro de ese clip.' });

console.log('latidoBeats.verify: trim/speed mapping and analysis resolution passed');
