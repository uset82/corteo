// Runnable check: `npx tsx src/editor/kenBurns.verify.ts`.
// The generator writes only generic transform keyframes (scale/x/y), and those are
// what preview and export sample. Scope: the plan itself (values, frames, easing,
// clears) and the result through the real reducer.
import assert from 'node:assert/strict';
import { KEN_BURNS_DIRECTIONS, kenBurnsActions, resolveKenBurnsDirection, type KenBurnsPlan } from './kenBurns';
import { sampleKeyframes } from './keyframes';
import { reduce } from './reduce';
import type { TimelineItem, TimelineState } from './types';

const image = (patch: Partial<TimelineItem> = {}): TimelineItem => ({
  id: 'img-1', track: 'V1', startFrame: 0, durationInFrames: 90, kind: 'image', name: 'foto', src: '/m/foto.jpg',
  ...patch,
} as TimelineItem);

const stateWith = (item: TimelineItem): TimelineState => ({
  fps: 30, width: 1920, height: 1080, selectedId: null,
  tracks: { V1: { kind: 'video' } },
  trackOrder: ['V1'],
  items: [item],
});

const plan = (options: Parameters<typeof kenBurnsActions>[0]): KenBurnsPlan => {
  const result = kenBurnsActions(options);
  assert.ok(result, 'the plan exists for a normal clip');
  return result;
};
const sets = (p: KenBurnsPlan, prop: string) => p.actions.filter((a) => a.type === 'setKeyframe' && a.prop === prop);
const clears = (p: KenBurnsPlan) => p.actions.filter((a) => a.type === 'clearKeyframes').map((a) => (a as { prop: string }).prop);

// ── 1) Zoom in: 100% → 112% on the last frame, eased, old motion cleared ──────────
{
  const p = plan({ itemId: 'img-1', durationInFrames: 90, direction: 'in' });
  assert.equal(p.direction, 'in');
  assert.deepEqual(p.actions.map((a) => a.type), [
    'clearKeyframes', 'clearKeyframes', 'clearKeyframes', 'setKeyframe', 'setKeyframe',
  ], 'clears first, then the two scale keyframes');
  assert.deepEqual(clears(p), ['scale', 'x', 'y'], 'a fresh move replaces scale, x and y');
  const scale = sets(p, 'scale') as { frame: number; value: number; easing?: string }[];
  assert.deepEqual(scale.map((k) => [k.frame, k.value]), [[0, 1], [89, 1.12]], 'first frame 100%, last frame 112%');
  assert.equal(scale[0]!.easing, 'easeInOut', 'the segment is eased');
  assert.equal(scale[1]!.easing, undefined, 'the end keyframe needs no easing');
}

// ── 2) Zoom out is the same travel in reverse ──────────────────────────────────────
{
  const scale = sets(plan({ itemId: 'img-1', durationInFrames: 90, direction: 'out' }), 'scale') as { value: number }[];
  assert.deepEqual(scale.map((k) => k.value), [1.12, 1], 'zoom out starts wide');
}

// ── 3) Pans: one constant scale, x or y travel centred on the static transform ─────
{
  const left = plan({ itemId: 'img-1', durationInFrames: 90, direction: 'left', baseX: 10 });
  const scale = sets(left, 'scale') as { value: number }[];
  assert.deepEqual(scale.map((k) => k.value), [1.12, 1.12], 'a pan keeps one scale');
  const x = sets(left, 'x') as { frame: number; value: number }[];
  assert.deepEqual(x.map((k) => [k.frame, k.value]), [[0, 14.8], [89, 5.2]], 'travels across the static centre');
  assert.equal(sets(left, 'y').length, 0, 'a horizontal pan leaves y alone');
  assert.equal(left.scaleFrom, left.scaleTo);

  const up = plan({ itemId: 'img-1', durationInFrames: 90, direction: 'up', baseY: -2 });
  assert.equal(sets(up, 'x').length, 0, 'a vertical pan leaves x alone');
  assert.deepEqual((sets(up, 'y') as { value: number }[]).map((k) => k.value), [2.8, -6.8]);
}

// ── 4) Seeded random: reproducible per seed, spread over time ─────────────────────
{
  const once = resolveKenBurnsDirection('random', 'clip-a');
  for (let i = 0; i < 20; i++) {
    assert.equal(resolveKenBurnsDirection('random', 'clip-a'), once, 'the same seed picks the same move');
  }
  const seen = new Set(Array.from({ length: 60 }, (_, seed) => resolveKenBurnsDirection('random', seed)));
  assert.ok(seen.size >= 4, `different seeds spread over the six moves (saw ${[...seen].join(',')})`);
  assert.equal(resolveKenBurnsDirection(undefined, 'clip-a'), 'in', 'no direction means a slow push in');
  for (const direction of KEN_BURNS_DIRECTIONS) {
    if (direction !== 'random') assert.equal(resolveKenBurnsDirection(direction, 1), direction, 'explicit directions pass through');
  }
  assert.deepEqual(kenBurnsActions({ itemId: 'img-1', durationInFrames: 90, direction: 'random', seed: 'clip-a' })?.actions,
    kenBurnsActions({ itemId: 'img-1', durationInFrames: 90, direction: 'random', seed: 'clip-a' })?.actions,
    'the whole plan is reproducible');
}

// ── 5) Strength bounds and short clips ────────────────────────────────────────────
{
  const tiny = plan({ itemId: 'img-1', durationInFrames: 90, direction: 'in', strength: 0.001 });
  assert.deepEqual((sets(tiny, 'scale') as { value: number }[]).map((k) => k.value), [1, 1.02], 'strength floors at 2%');
  const huge = plan({ itemId: 'img-1', durationInFrames: 90, direction: 'in', strength: 9 });
  assert.deepEqual((sets(huge, 'scale') as { value: number }[]).map((k) => k.value), [1, 1.5], 'strength caps at 50%');
  assert.equal(kenBurnsActions({ itemId: 'img-1', durationInFrames: 1 }), null, 'one frame has no travel');
  assert.equal(kenBurnsActions({ itemId: 'img-1', durationInFrames: 0 }), null, 'no duration, no plan');
  assert.equal(kenBurnsActions({ itemId: '', durationInFrames: 90 }), null, 'no item, no plan');
}

// ── 6) Through the real reducer: the sampled scale moves and a second move replaces the first ──
{
  const item = image({ transform: { x: 3, y: -4, scale: 1 } });
  const applied = plan({ itemId: item.id, durationInFrames: item.durationInFrames, direction: 'in' })
    .actions.reduce(reduce, stateWith(item));
  const clip = applied.items[0]!;
  const scaleAt = (frame: number) => sampleKeyframes(clip.keyframes!.scale!, frame);
  assert.equal(scaleAt(0), 1, 'starts at 100%');
  assert.ok(scaleAt(44) > 1.02 && scaleAt(44) < 1.1, `moves in the middle (${scaleAt(44).toFixed(3)})`);
  assert.equal(scaleAt(89), 1.12, 'ends at 112%');
  assert.deepEqual(clip.transform, { x: 3, y: -4, scale: 1 }, 'the static transform is untouched');

  const panned = plan({ itemId: item.id, durationInFrames: item.durationInFrames, direction: 'right' })
    .actions.reduce(reduce, applied);
  const after = panned.items[0]!;
  assert.equal(after.keyframes!.scale!.length, 2, 'the old zoom keyframes are gone');
  assert.equal(after.keyframes!.x!.length, 2, 'the pan replaced them with two x keyframes');
  assert.equal(after.keyframes!.y, undefined, 'no stale y channel');
}

console.log('kenBurns.verify: ok');
