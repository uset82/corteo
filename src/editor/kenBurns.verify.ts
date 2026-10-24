// kenBurns.verify — Phase 3.1: Ken Burns as canonical x/y/scale keyframes.
// Signature: an item with x/y/scale keyframes pinned to frames 0 and (n-1),
// each end keyframe carrying the same segment easing, is recognized as Ken Burns.
// Preview and export interpolate these keyframes everywhere, so an item that
// reads back as its own spec round-trips losslessly through the data model.
import assert from 'node:assert/strict';
import type { ItemKeyframes, TimelineItem } from './clipTypes';
import { hasKenBurns, readKenBurns, sameKenBurns, writeKenBurns, DEFAULT_KEN_BURNS_EASING } from './kenBurns';

const fakeItem = (durationInFrames: number, keyframes?: ItemKeyframes): Pick<TimelineItem, 'keyframes' | 'durationInFrames'> =>
  ({ durationInFrames, keyframes });

// ── Recognition ─────────────────────────────────────────────────────────────

assert.equal(hasKenBurns(fakeItem(150)), false, 'plain item without keyframes');

{
  const spec = {
    startX: 0, startY: 0, startScale: 1,
    endX: -15, endY: 8, endScale: 1.4,
    easing: DEFAULT_KEN_BURNS_EASING,
  };
  const keyframes = writeKenBurns(fakeItem(150), spec)!;
  assert.ok(keyframes, 'writeKenBurns produces a keyframe map');

  const withKb = fakeItem(150, keyframes);
  assert.ok(hasKenBurns(withKb), 'canonical signature recognized');
  const read = readKenBurns(withKb);
  assert.ok(read, 'spec readable');
  assert.ok(sameKenBurns(read!, spec), 'round-trip preserves spec losslessly');
}

{
  // Single keyframe per prop → not Ken Burns.
  const single: ItemKeyframes = {
    x: [{ frame: 0, value: 0 }],
    y: [{ frame: 0, value: 0 }],
    scale: [{ frame: 149, value: 2 }],
  };
  assert.equal(hasKenBurns(fakeItem(150, single)), false, 'one keyframe per prop rejected');

  // Keyframes not at 0/n-1 → not Ken Burns.
  const shifted: ItemKeyframes = {
    x: [{ frame: 1, value: 0 }, { frame: 149, value: -10 }],
    y: [{ frame: 0, value: 0 }, { frame: 149, value: -10 }],
    scale: [{ frame: 0, value: 1 }, { frame: 149, value: 1.5 }],
  };
  assert.equal(hasKenBurns(fakeItem(150, shifted)), false, 'off-anchor start frame rejected');

  // Mixed segment easings on the start keyframes → not Ken Burns.
  const mixedEase: ItemKeyframes = {
    x: [{ frame: 0, value: 0, easing: 'easeInOut' }, { frame: 149, value: -10 }],
    y: [{ frame: 0, value: 0, easing: 'easeOut' }, { frame: 149, value: -10 }],
    scale: [{ frame: 0, value: 1, easing: 'easeInOut' }, { frame: 149, value: 1.5 }],
  };
  assert.equal(hasKenBurns(fakeItem(150, mixedEase)), false, 'mixed easings rejected');
}

// ── Write / remove semantics ────────────────────────────────────────────────

{
  const item = fakeItem(90);
  const spec: Parameters<typeof writeKenBurns>[1] = {
    startX: 5, startY: -3, startScale: 1.1,
    endX: -8, endY: 12, endScale: 1.8,
    easing: 'easeIn' as typeof DEFAULT_KEN_BURNS_EASING,
  };
  const written = writeKenBurns(item, spec)!;
  assert.ok(written, 'write returns a map');
  assert.equal(written.x!.length, 2, 'x pinned');
  assert.equal(written.scale![1]!.frame, 89, 'end anchored to last frame');
  // The 0 → last segment reads its curve from the LEFT keyframe, so the easing
  // must sit there or the pan would render linear.
  assert.equal(written.x![0]!.easing, 'easeIn', 'easing on the start keyframe');
  assert.equal(written.scale![0]!.easing, 'easeIn', 'easing on every start keyframe');
  assert.equal(written.x![1]!.easing, undefined, 'end keyframe stays plain');

  const removed = writeKenBurns(fakeItem(90, written), null)!;
  assert.ok(removed, 'remove returns a map');
  assert.equal(removed.x, undefined, 'x keyframes cleared');
  assert.equal(removed.y, undefined, 'y keyframes cleared');
  assert.equal(removed.scale, undefined, 'scale keyframes cleared');

  // Removing from an item without any signature → no change (null).
  assert.equal(writeKenBurns(fakeItem(90), null), null, 'remove on clean item is a no-op');
}

console.log('kenBurns.verify: canonical keyframe signature recognized everywhere (识别/往返/移除)');
