// Music reactions over MCP (Plan 2 › L-09): build, apply and clear music-driven
// keyframes. Shared by the browser tools and the headless server tool, which
// only differ in how they load the cached analysis.
import type { AgentContext } from '../context';
import type { MediaAsset, TimelineItem, TimelineState } from '../../editor/types';
import { sourceRevisionOf } from '../../editor/mediaSourceRevision';
import type { MusicAnalysis } from '../../audio/intelligence/types';
import {
  MUSIC_REACTIONS,
  MUSIC_REACTION_TIMINGS,
  MAX_REACTION_KEYFRAMES_PER_CLIP,
  buildClearMusicReactionPlan,
  buildMusicReactionPlan,
  type MusicReaction,
  type MusicReactionPlan,
  type MusicReactionTiming,
} from '../../editor/musicReactions';
import { songMapCacheKey, songMapRemoteKey } from '../../../shared/music-inference/song-map-record';
import { resolveMusicTarget, resolvePrefix, type Args } from './music-target';

export const MUSIC_REACTION_TOOL_NAMES = new Set([
  'music_reaction_plan',
  'apply_music_reaction',
  'clear_music_reaction',
]);

const MAX_REPORTED_TARGETS = 8;
const MAX_REPORTED_SAMPLES = 6;
const MAX_REPORTED_LOCKED = 16;

export interface MusicReactionToolDeps {
  loadAnalysis(asset: MediaAsset): Promise<MusicAnalysis | null>;
  unavailableAnalysis(asset: MediaAsset): Promise<Record<string, unknown>>;
}

const REACTIONS = new Set<string>(MUSIC_REACTIONS);
const TIMINGS = new Set<string>(MUSIC_REACTION_TIMINGS);

function reactionArg(args: Args): MusicReaction {
  const value = args.reaction;
  if (typeof value !== 'string' || !REACTIONS.has(value)) {
    throw new Error(`reaction must be one of ${MUSIC_REACTIONS.join(', ')}`);
  }
  return value as MusicReaction;
}

function timingArg(args: Args): MusicReactionTiming | undefined {
  const value = args.timing;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !TIMINGS.has(value)) {
    throw new Error(`timing must be one of ${MUSIC_REACTION_TIMINGS.join(', ')}`);
  }
  return value as MusicReactionTiming;
}

function intensityArg(args: Args): number {
  const value = args.intensity;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0.5;
}

function finiteFrame(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function musicItemFor(args: Args, ctx: AgentContext): { item: TimelineItem; asset: MediaAsset } {
  const target = resolveMusicTarget(args, ctx);
  if (!target.item) {
    throw new Error('itemId is required: music reactions need the BGM clip for trim/speed mapping');
  }
  return { item: target.item, asset: target.asset };
}

function isVisual(item: TimelineItem): boolean {
  return item.kind !== 'audio';
}

function rangelike(musicItem: TimelineItem, args: Args): { fromFrame: number; toFrame: number } {
  const musicFrom = musicItem.startFrame;
  const musicTo = musicItem.startFrame + musicItem.durationInFrames;
  return {
    fromFrame: Math.max(musicFrom, Math.round(finiteFrame(args.fromFrame) ?? musicFrom)),
    toFrame: Math.min(musicTo, Math.round(finiteFrame(args.toFrame) ?? musicTo)),
  };
}

function reactionTargets(
  state: TimelineState,
  musicItem: TimelineItem,
  args: Args,
  range: { fromFrame: number; toFrame: number },
): { targets: TimelineItem[]; lockedItemIds: Set<string> } {
  const visual = state.items.filter((item) => isVisual(item) && item.id !== musicItem.id);
  const requested = Array.isArray(args.targetItemIds)
    ? args.targetItemIds.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : [];
  const selected = requested.length
    ? requested.map((id) => resolvePrefix(visual, id.trim(), 'visual clip'))
    : visual.filter((item) => item.startFrame < range.toFrame
      && item.startFrame + item.durationInFrames > range.fromFrame);
  const targets = [...new Map(selected.map((item) => [item.id, item])).values()]
    .filter((item) => item.startFrame < range.toFrame && item.startFrame + item.durationInFrames > range.fromFrame)
    .sort((left, right) => left.startFrame - right.startFrame || left.id.localeCompare(right.id));
  const lockedItemIds = new Set(targets
    .filter((item) => state.tracks?.[item.track]?.locked === true)
    .map((item) => item.id));
  return { targets, lockedItemIds };
}

export async function musicSongMapRef(asset: MediaAsset): Promise<string> {
  return songMapRemoteKey(songMapCacheKey(asset.id, sourceRevisionOf(asset)));
}

function compactPlan(plan: MusicReactionPlan): Record<string, unknown> {
  const targets = plan.targets.slice(0, MAX_REPORTED_TARGETS).map((target) => ({
    itemId: target.itemId,
    keyframes: target.keyframeCount,
    props: target.props,
    fromFrame: target.fromFrame,
    toFrame: target.toFrame,
    samples: target.samples.slice(0, MAX_REPORTED_SAMPLES),
  }));
  return {
    reaction: plan.reaction,
    timing: plan.timing,
    intensity: plan.intensity,
    songMapRef: plan.songMapRef,
    range: plan.range,
    targetCount: plan.targets.length,
    keyframeCount: plan.keyframeCount,
    keyframeCap: MAX_REACTION_KEYFRAMES_PER_CLIP,
    lockedTargetIds: plan.lockedItemIds.slice(0, MAX_REPORTED_LOCKED),
    targets,
    truncated: plan.targets.length > targets.length,
  };
}

async function currentAnalysis(
  asset: MediaAsset,
  deps: MusicReactionToolDeps,
): Promise<MusicAnalysis | Record<string, unknown>> {
  const analysis = await deps.loadAnalysis(asset);
  if (analysis) return analysis;
  return await deps.unavailableAnalysis(asset);
}

function isAnalysis(value: MusicAnalysis | Record<string, unknown>): value is MusicAnalysis {
  return 'beatsMs' in value && 'sections' in value;
}

async function planReaction(
  args: Args,
  ctx: AgentContext,
  deps: MusicReactionToolDeps,
): Promise<unknown> {
  const { item: musicItem, asset } = musicItemFor(args, ctx);
  const analysis = await currentAnalysis(asset, deps);
  if (!isAnalysis(analysis)) return analysis;
  const songMapRef = await musicSongMapRef(asset);
  const range = rangelike(musicItem, args);
  const { targets, lockedItemIds } = reactionTargets(ctx.getState(), musicItem, args, range);
  const plan = buildMusicReactionPlan({
    analysis,
    musicItem,
    fps: ctx.getState().fps,
    targets,
    lockedItemIds,
    songMapRef,
    reaction: reactionArg(args),
    timing: timingArg(args),
    intensity: intensityArg(args),
    fromFrame: range.fromFrame,
    toFrame: range.toFrame,
    seed: typeof args.seed === 'string' || typeof args.seed === 'number' ? args.seed : undefined,
  });
  return { ok: true, ...compactPlan(plan) };
}

async function applyReaction(
  args: Args,
  ctx: AgentContext,
  deps: MusicReactionToolDeps,
): Promise<unknown> {
  const { item: musicItem, asset } = musicItemFor(args, ctx);
  const analysis = await currentAnalysis(asset, deps);
  if (!isAnalysis(analysis)) return analysis;
  const songMapRef = await musicSongMapRef(asset);
  const supplied = typeof args.songMapRef === 'string' ? args.songMapRef.trim() : '';
  if (!supplied) {
    return {
      error: 'songMapRef is required; call music_reaction_plan for this BGM clip, then pass its songMapRef',
      missingSongMapRef: true,
      currentSongMapRef: songMapRef,
    };
  }
  if (supplied !== songMapRef) {
    return {
      error: 'stale songMapRef; call music_reaction_plan again before applying a reaction',
      staleSongMapRef: true,
      currentSongMapRef: songMapRef,
    };
  }
  const range = rangelike(musicItem, args);
  const { targets, lockedItemIds } = reactionTargets(ctx.getState(), musicItem, args, range);
  const plan = buildMusicReactionPlan({
    analysis,
    musicItem,
    fps: ctx.getState().fps,
    targets,
    lockedItemIds,
    songMapRef,
    reaction: reactionArg(args),
    timing: timingArg(args),
    intensity: intensityArg(args),
    fromFrame: range.fromFrame,
    toFrame: range.toFrame,
    seed: typeof args.seed === 'string' || typeof args.seed === 'number' ? args.seed : undefined,
  });
  if (!plan.actions.length) {
    return {
      ok: true,
      changed: false,
      songMapRef,
      reaction: plan.reaction,
      timing: plan.timing,
      reason: plan.lockedItemIds.length
        ? 'all target clips are on locked tracks; unlock them and retry'
        : 'no beats or sections fall inside the target clips; check the timing and the BGM trim',
      lockedTargetIds: plan.lockedItemIds.slice(0, MAX_REPORTED_LOCKED),
    };
  }
  ctx.commands.batch(plan.actions, `Reacción musical: ${plan.reaction}`);
  return {
    ok: true,
    changed: true,
    reaction: plan.reaction,
    timing: plan.timing,
    intensity: plan.intensity,
    songMapRef,
    range: plan.range,
    targetCount: plan.targets.length,
    keyframeCount: plan.keyframeCount,
    lockedTargetIds: plan.lockedItemIds.slice(0, MAX_REPORTED_LOCKED),
    targets: plan.targets.slice(0, MAX_REPORTED_TARGETS).map((target) => ({
      itemId: target.itemId,
      keyframes: target.keyframeCount,
      props: target.props,
      samples: target.samples.slice(0, MAX_REPORTED_SAMPLES),
    })),
    note: `Reacción "${plan.reaction}" aplicada a ${plan.targets.length} clip(s): ${plan.keyframeCount} keyframes en un solo paso de deshacer.`,
  };
}

async function clearReaction(args: Args, ctx: AgentContext): Promise<unknown> {
  const { item: musicItem, asset } = musicItemFor(args, ctx);
  const supplied = typeof args.songMapRef === 'string' ? args.songMapRef.trim() : '';
  let currentRef: string | undefined;
  if (supplied) {
    currentRef = await musicSongMapRef(asset);
    if (supplied !== currentRef) {
      return {
        error: 'stale songMapRef; call music_reaction_plan again before clearing a reaction',
        staleSongMapRef: true,
        currentSongMapRef: currentRef,
      };
    }
  }
  const reaction = args.reaction === undefined ? undefined : reactionArg(args);
  const range = rangelike(musicItem, args);
  const { targets, lockedItemIds } = reactionTargets(ctx.getState(), musicItem, args, range);
  const plan = buildClearMusicReactionPlan({ targets, lockedItemIds, reaction });
  if (!plan.actions.length) {
    return {
      ok: true,
      changed: false,
      reason: lockedItemIds.size
        ? 'the target clips are on locked tracks; unlock them and retry'
        : 'the target clips carry no music reactions to clear',
      lockedTargetIds: [...lockedItemIds].slice(0, MAX_REPORTED_LOCKED),
    };
  }
  ctx.commands.batch(plan.actions, reaction ? `Quitar reacción musical: ${reaction}` : 'Quitar reacciones musicales');
  return {
    ok: true,
    changed: true,
    ...(currentRef ? { songMapRef: currentRef } : {}),
    clearedTargets: plan.targets.map((target) => ({
      itemId: target.itemId,
      removed: target.removed,
      clearedProps: target.clearedProps,
    })),
    clearedProps: plan.clearedProps,
    lockedTargetIds: plan.lockedItemIds.slice(0, MAX_REPORTED_LOCKED),
    note: `Reacción musical quitada de ${plan.targets.length} clip(s) en un solo paso de deshacer.`,
  };
}

export async function execMusicReactionTool(
  name: string,
  args: Args,
  ctx: AgentContext,
  deps: MusicReactionToolDeps,
): Promise<unknown> {
  try {
    if (name === 'music_reaction_plan') return await planReaction(args, ctx, deps);
    if (name === 'apply_music_reaction') return await applyReaction(args, ctx, deps);
    if (name === 'clear_music_reaction') return await clearReaction(args, ctx);
    return { error: `unknown tool ${name}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
