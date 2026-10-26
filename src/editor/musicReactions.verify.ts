// Runnable check: `npx tsx src/editor/musicReactions.verify.ts`.
// Plan 2 › L-09 verification: beat frames after trim and speed, the per-clip
// keyframe cap, filter channels sampled through the real preview path, and the
// metadata merge/clear rules.
import assert from 'node:assert/strict';
import { appearanceAt, clipFiltersAt } from './clipFade';
import {
  MAX_REACTION_KEYFRAMES_PER_CLIP,
  MAX_REACTION_SAMPLES,
  buildClearMusicReactionPlan,
  buildMusicReactionPlan,
  mergeReactionMetadata,
  type ReactionAnalysis,
  type ReactionSample,
} from './musicReactions';
import { reduce } from './reduce';
import type { Action } from './reduce';
import type { MusicReactionMeta, TimelineItem, TimelineState } from './types';

const item = (
  id: string,
  kind: TimelineItem['kind'],
  track: string,
  startFrame: number,
  durationInFrames: number,
  patch: Partial<TimelineItem> = {},
): TimelineItem => ({ id, kind, track, startFrame, durationInFrames, name: id, ...patch });

const stateWith = (items: TimelineItem[], tracks: TimelineState['tracks'] = {}): TimelineState => ({
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items,
  tracks,
  trackOrder: Object.keys(tracks),
});

const analysis = (
  options: { durationMs?: number; beatsMs?: number[]; downbeatsMs?: number[]; energy?: number } = {},
): ReactionAnalysis => ({
  durationMs: options.durationMs ?? 60_000,
  beatsMs: options.beatsMs ?? [4_000, 6_000],
  downbeatsMs: options.downbeatsMs ?? [4_000],
  sections: [{
    fromMs: 0,
    toMs: options.durationMs ?? 60_000,
    role: 'build',
    energy: options.energy ?? 0.5,
    boundaryConfidence: 0.9,
  }],
});

const sets = (actions: Action[], prop?: string): Extract<Action, { type: 'setKeyframe' }>[] =>
  actions.filter((action): action is Extract<Action, { type: 'setKeyframe' }> => (
    action.type === 'setKeyframe' && (prop === undefined || action.prop === prop)
  ));

const peaks = (actions: Action[], prop: string): number[] => {
  const byFrame = new Map<number, number>();
  for (const action of sets(actions, prop)) byFrame.set(action.frame, action.value);
  return [...byFrame.entries()].filter(([, value]) => prop === 'blur' ? value > 0 : value > 1)
    .map(([frame]) => frame).sort((left, right) => left - right);
};

// ── 1) Beats land on the BGM's mapped frames after a 2s trim and 2x speed ──────
{
  const music = item('music', 'audio', 'A1', 100, 600, {
    src: '/m/song.wav', srcInFrame: 60, playbackRate: 2,
  });
  const video = item('video', 'video', 'V1', 30, 600);
  const plan = buildMusicReactionPlan({
    analysis: analysis(),
    musicItem: music,
    fps: 30,
    targets: [music, video],
    songMapRef: 'song-map:ref',
    reaction: 'pulso',
    intensity: 0.5,
  });
  assert.equal(plan.timing, 'beats', 'pulso defaults to beats');
  assert.deepEqual(plan.range, { fromFrame: 100, toFrame: 700 }, 'the plan range is the BGM clip');
  assert.equal(plan.targets.length, 1, 'the BGM clip is never a reaction target');
  assert.deepEqual(peaks(plan.actions, 'scale'), [100, 130], '4s and 6s map through srcIn 2s and 2x speed');
  const scale = sets(plan.actions, 'scale');
  assert.deepEqual(
    scale.map((action) => [action.frame, action.value]),
    [[0, 1], [100, 1.027], [105, 1], [130, 1.027], [135, 1], [599, 1]],
    'peaks, 5-frame decays and baseline keyframes stay inside the target clip',
  );
  assert.equal(scale[1]!.easing, 'easeOut');
  assert.deepEqual(plan.actions[0], { type: 'clearKeyframes', id: 'video', prop: 'scale' });
  const metadata = plan.actions.at(-1);
  assert.equal(metadata?.type, 'setMusicReactions');
  assert.deepEqual(plan.targets[0]!.reactions[0], {
    reaction: 'pulso', timing: 'beats', intensity: 0.5, props: ['scale'],
    songMapRef: 'song-map:ref', fromFrame: 100, toFrame: 630, keyframeCount: 6,
  });
  assert.deepEqual(plan.targets[0]!.fromFrame === 100 && plan.targets[0]!.toFrame === 630, true);

  const slow = buildMusicReactionPlan({
    analysis: analysis({ beatsMs: [4_000] }),
    musicItem: item('slow', 'audio', 'A1', 0, 600, { playbackRate: 0.5 }),
    fps: 30,
    targets: [item('slow-video', 'video', 'V1', 0, 600)],
    songMapRef: 'ref',
    reaction: 'pulso',
  });
  assert.deepEqual(peaks(slow.actions, 'scale'), [240], '0.5x speed stretches a 4s beat to frame 240');

  assert.throws(
    () => buildMusicReactionPlan({
      analysis: analysis(), musicItem: music, fps: 30, targets: [video],
      songMapRef: 'ref', reaction: 'pulso', fromFrame: 700, toFrame: 800,
    }),
    /does not overlap/,
    'a range outside the BGM clip must fail instead of writing nothing',
  );
}

// ── 2) Per-clip keyframe caps hold for every reaction shape ────────────────────
{
  const beats = Array.from({ length: 2_400 }, (_, index) => index * 250);
  const downbeats = Array.from({ length: 600 }, (_, index) => index * 1_000);
  const sections = Array.from({ length: 20 }, (_, index) => ({
    fromMs: index * 30_000,
    toMs: (index + 1) * 30_000,
    role: (index % 2 === 0 ? 'build' : 'peak') as 'build' | 'peak',
    energy: index % 2 === 0 ? 0.25 : 0.85,
    boundaryConfidence: 0.9,
  }));
  const big: ReactionAnalysis = { durationMs: 600_000, beatsMs: beats, downbeatsMs: downbeats, sections };
  const music = item('music', 'audio', 'A1', 0, 18_000);
  const video = item('video', 'video', 'V1', 0, 18_000);
  const capOf = (reaction: 'pulso' | 'temblor' | 'respirar' | 'ken-burns-al-ritmo') => {
    const plan = buildMusicReactionPlan({
      analysis: big, musicItem: music, fps: 30, targets: [video], songMapRef: 'ref', reaction,
    });
    assert.ok(plan.keyframeCount > 0, `${reaction} writes keyframes on a dense song`);
    assert.ok(
      plan.keyframeCount <= MAX_REACTION_KEYFRAMES_PER_CLIP,
      `${reaction} must respect the ${MAX_REACTION_KEYFRAMES_PER_CLIP}-keyframe cap (got ${plan.keyframeCount})`,
    );
    assert.equal(plan.keyframeCount, sets(plan.actions).length, `${reaction} reports what it writes`);
    const written = sets(plan.actions);
    for (const action of written) {
      assert.ok(Number.isInteger(action.frame) && action.frame >= 0 && action.frame < video.durationInFrames);
      assert.ok(Number.isFinite(action.value));
    }
    assert.ok(plan.targets[0]!.samples.length <= MAX_REACTION_SAMPLES);
    return plan.keyframeCount;
  };
  assert.equal(capOf('pulso'), 96, '2,400 beats reduce to 47 peaks plus decays and two baselines');
  assert.ok(capOf('temblor') <= MAX_REACTION_KEYFRAMES_PER_CLIP, 'three shake channels fit the cap');
  assert.equal(capOf('respirar'), 84, '2,400 energy samples reduce to 40 events across two filters');
  assert.ok(capOf('ken-burns-al-ritmo') <= 24, 'section zooms use one keyframe per boundary');
}

// ── 3) Filter reactions sample through appearanceAt exactly as written ─────────
{
  const music = item('music', 'audio', 'A1', 0, 600);
  const flashSource = item('flash', 'video', 'V1', 0, 600, { filters: { brightness: 0.9 } });
  const flashPlan = buildMusicReactionPlan({
    analysis: analysis({ downbeatsMs: [4_000] }),
    musicItem: music, fps: 30, targets: [flashSource],
    songMapRef: 'ref', reaction: 'destello', intensity: 0.5,
  });
  const flash = flashPlan.actions.reduce(reduce, stateWith([music, flashSource])).items.find((x) => x.id === 'flash')!;
  assert.equal(clipFiltersAt(flash, 0).brightness, 0.9, 'the static filter is the baseline');
  assert.equal(clipFiltersAt(flash, 120).brightness, 1.0688, 'the flash peaks on the downbeat');
  assert.equal(clipFiltersAt(flash, 125).brightness, 0.9, 'it decays back after 5 frames');
  const flashAt = appearanceAt(flash, 120, false);
  assert.match(flashAt.foregroundStyle.filter ?? '', /brightness\(1\.0688\)/);

  const breatheSource = item('breathe', 'video', 'V2', 0, 600);
  const maybePlan = buildMusicReactionPlan({
    analysis: analysis(),
    musicItem: music, fps: 30, targets: [breatheSource],
    songMapRef: 'ref', reaction: 'respirar', intensity: 0.5,
  });
  const breathe = maybePlan.actions.reduce(reduce, stateWith([music, breatheSource])).items.find((x) => x.id === 'breathe')!;
  for (const frame of [0, 30, 75, 150, 299, 599]) {
    const filters = clipFiltersAt(breathe, frame);
    const appearance = appearanceAt(breathe, frame, false);
    assert.equal(
      appearance.foregroundStyle.filter,
      `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturate}) blur(${filters.blur}px)`,
      `frame ${frame}: the preview samples the same filter channel the plan wrote`,
    );
  }
  assert.equal(clipFiltersAt(breathe, 75).saturate, 1.0875, 'saturate rises on each energy sample');
  assert.equal(clipFiltersAt(breathe, 75).blur, 0.625, 'blur rides the same energy curve');
  assert.match(appearanceAt(breathe, 75, false).foregroundStyle.filter ?? '', /saturate\(1\.0875\) blur\(0\.625px\)/);
}

// ── 4) Pulse scale reaches the preview transform, never a stale first peak ─────
{
  const music = item('music', 'audio', 'A1', 0, 600);
  const video = item('video', 'video', 'V1', 0, 600, { transform: { scale: 1.2 } });
  const plan = buildMusicReactionPlan({
    analysis: analysis({ beatsMs: [2_000] }),
    musicItem: music, fps: 30, targets: [video], songMapRef: 'ref', reaction: 'pulso', intensity: 1,
  });
  const clip = plan.actions.reduce(reduce, stateWith([music, video])).items.find((x) => x.id === 'video')!;
  assert.deepEqual(
    sets(plan.actions, 'scale').filter((action) => action.value > 1.2).map((action) => action.frame),
    [60],
  );
  assert.match(appearanceAt(clip, 60, false).foregroundStyle.transform ?? '', /scale\(1\.254, 1\.254\)/);
  assert.match(appearanceAt(clip, 0, false).foregroundStyle.transform ?? '', /scale\(1\.2, 1\.2\)/);
  assert.match(appearanceAt(clip, 30, false).foregroundStyle.transform ?? '', /scale\(1\.2\d*, 1\.2\d*\)/);
}

// ── 5) Metadata: disjoint reactions coexist, a shared prop replaces ────────────
{
  const destello: MusicReactionMeta = {
    reaction: 'destello', timing: 'downbeats', intensity: 0.4, props: ['brightness'],
    songMapRef: 'old', fromFrame: 0, toFrame: 120, keyframeCount: 6,
  };
  const golpe = mergeReactionMetadata([destello], {
    reaction: 'golpe', timing: 'drops', intensity: 0.5, props: ['scale'],
    songMapRef: 'ref', fromFrame: 0, toFrame: 120, keyframeCount: 4,
  });
  assert.deepEqual(golpe.map((entry) => entry.reaction), ['destello', 'golpe'], 'disjoint props coexist');
  const pulso = mergeReactionMetadata(golpe, {
    reaction: 'pulso', timing: 'beats', intensity: 0.5, props: ['scale'],
    songMapRef: 'ref', fromFrame: 0, toFrame: 120, keyframeCount: 4,
  });
  assert.deepEqual(pulso.map((entry) => entry.reaction), ['destello', 'pulso'], 'a shared prop replaces the old reaction');

  const video = item('video', 'video', 'V1', 0, 600, { musicReactions: [destello] });
  const plan = buildMusicReactionPlan({
    analysis: analysis({ beatsMs: [2_000] }),
    musicItem: item('music', 'audio', 'A1', 0, 600), fps: 30, targets: [video],
    songMapRef: 'ref', reaction: 'pulso',
  });
  const merged = plan.targets[0]!.reactions;
  assert.deepEqual(merged.map((entry) => entry.reaction), ['destello', 'pulso']);
  const metadataAction = plan.actions.at(-1);
  assert.equal(metadataAction?.type, 'setMusicReactions');
  assert.equal(metadataAction.type === 'setMusicReactions' ? metadataAction.reactions.length : 0, 2);
}

// ── 6) Locked tracks and out-of-range clips are skipped and reported ──────────
{
  const music = item('music', 'audio', 'A1', 0, 600);
  const video = item('video', 'video', 'V1', 0, 600);
  const plan = buildMusicReactionPlan({
    analysis: analysis(), musicItem: music, fps: 30, targets: [video],
    lockedItemIds: new Set(['video']), songMapRef: 'ref', reaction: 'pulso',
  });
  assert.deepEqual(plan.lockedItemIds, ['video']);
  assert.equal(plan.actions.length, 0, 'a locked target gets no keyframes');

  const late = item('late', 'video', 'V2', 2_000, 600);
  const partial = buildMusicReactionPlan({
    analysis: analysis(), musicItem: music, fps: 30, targets: [video, late],
    songMapRef: 'ref', reaction: 'pulso',
  });
  assert.deepEqual(partial.targets.map((target) => target.itemId), ['video'], 'beats outside a clip never write to it');

  const tiny = item('tiny', 'video', 'V2', 0, 2);
  const skipped = buildMusicReactionPlan({
    analysis: analysis(), musicItem: music, fps: 30, targets: [tiny],
    songMapRef: 'ref', reaction: 'pulso',
  });
  assert.equal(skipped.actions.length, 0, 'a two-frame clip cannot hold a reaction');
}

// ── 7) Clear removes metadata and only the props no other reaction claims ─────
{
  const destello: MusicReactionMeta = {
    reaction: 'destello', timing: 'downbeats', intensity: 0.4, props: ['brightness'],
    songMapRef: 'ref', fromFrame: 0, toFrame: 600, keyframeCount: 4,
  };
  const golpe: MusicReactionMeta = {
    reaction: 'golpe', timing: 'drops', intensity: 0.5, props: ['scale'],
    songMapRef: 'ref', fromFrame: 0, toFrame: 600, keyframeCount: 4,
  };
  const video = item('video', 'video', 'V1', 0, 600, {
    musicReactions: [destello, golpe],
    keyframes: { brightness: [{ frame: 0, value: 0.9 }], scale: [{ frame: 0, value: 1 }] },
  });
  const clearGolpe = buildClearMusicReactionPlan({ targets: [video], reaction: 'golpe' });
  assert.deepEqual(clearGolpe.clearedProps, ['scale']);
  assert.deepEqual(clearGolpe.actions, [
    { type: 'clearKeyframes', id: 'video', prop: 'scale' },
    { type: 'setMusicReactions', id: 'video', reactions: [destello] },
  ]);
  assert.deepEqual(clearGolpe.targets[0]!.removed, ['golpe']);

  const cleared = clearGolpe.actions.reduce(reduce, stateWith([video])).items[0]!;
  assert.deepEqual(cleared.musicReactions?.map((entry) => entry.reaction), ['destello']);
  assert.equal(cleared.keyframes?.scale, undefined, 'the cleared channel is gone');
  assert.equal(cleared.keyframes?.brightness?.length, 1, 'the surviving reaction keeps its channel');

  const clearAll = buildClearMusicReactionPlan({ targets: [video] });
  assert.deepEqual([...clearAll.clearedProps].sort(), ['brightness', 'scale']);
  const emptied = clearAll.actions.reduce(reduce, stateWith([video])).items[0]!;
  assert.equal(emptied.musicReactions, undefined, 'clearing everything drops the metadata field');
  assert.equal(emptied.keyframes, undefined);

  const locked = buildClearMusicReactionPlan({ targets: [video], lockedItemIds: new Set(['video']) });
  assert.equal(locked.actions.length, 0);
  assert.deepEqual(locked.lockedItemIds, ['video']);
}

// ── 8) The same input always produces the same plan ───────────────────────────
{
  const build = () => buildMusicReactionPlan({
    analysis: {
      ...analysis(),
      sections: [
        { fromMs: 0, toMs: 20_000, role: 'intro-like', energy: 0.2, boundaryConfidence: 0.8 },
        { fromMs: 20_000, toMs: 60_000, role: 'peak', energy: 0.9, boundaryConfidence: 0.9 },
      ],
    },
    musicItem: item('music', 'audio', 'A1', 0, 600),
    fps: 30,
    targets: [item('video', 'video', 'V1', 0, 600)],
    songMapRef: 'ref',
    reaction: 'ken-burns-al-ritmo',
    intensity: 0.7,
    seed: 'clip-a',
  });
  const first = build();
  assert.deepEqual(first.actions, build().actions, 'same seed, same keyframes');
  assert.deepEqual(first.targets[0]!.samples as ReactionSample[], build().targets[0]!.samples);
  assert.ok(first.keyframeCount >= 2);
  const directions = new Set<string>();
  for (let seed = 0; seed < 40; seed += 1) {
    const plan = buildMusicReactionPlan({
      analysis: analysis(), musicItem: item('music', 'audio', 'A1', 0, 600), fps: 30,
      targets: [item('video', 'video', 'V1', 0, 600)], songMapRef: 'ref',
      reaction: 'ken-burns-al-ritmo', seed,
    });
    const scale = sets(plan.actions, 'scale');
    directions.add(scale[0]!.value < scale[1]!.value ? 'in' : 'out');
  }
  assert.deepEqual([...directions].sort(), ['in', 'out'], 'seeds spread over push-in and pull-out');
}

console.log('musicReactions.verify: ok');
