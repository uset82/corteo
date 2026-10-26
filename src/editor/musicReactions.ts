// Music-driven motion (Plan 2 › L-09): pure generators that turn a cached
// analysis and the BGM clip's trim/speed mapping into sparse keyframes on the
// visual clips. The tools commit the whole list with commands.batch, so one
// reaction is one undo step; the metadata rides along so it can be listed and
// removed later.
import type { Action } from './reduce';
import type {
  KeyframeEasing,
  KeyframeProp,
  MusicReaction,
  MusicReactionMeta,
  MusicReactionTiming,
  TimelineItem,
} from './types';
import { getKeyframePropertyDefinition } from './keyframeRegistry';
import { localFrameForSourceMs, sourceMsAtLocalFrame } from './sourceLimit';
import {
  clamp01,
  clipEventFrames,
  energyAt,
  reactionEvents,
  type ReactionAnalysis,
  type ReactionEventFrame,
} from './musicReactionEvents';

export {
  MUSIC_REACTIONS,
  MUSIC_REACTION_TIMINGS,
} from './types';
export type { MusicReaction, MusicReactionMeta, MusicReactionTiming } from './types';
export { clipEventFrames, reactionEvents } from './musicReactionEvents';
export type { ReactionAnalysis, ReactionEvent, ReactionEventFrame } from './musicReactionEvents';

export const MAX_REACTION_KEYFRAMES_PER_CLIP = 96;
export const MAX_REACTION_TARGETS = 64;
export const MAX_REACTION_SAMPLES = 8;

export const DEFAULT_REACTION_TIMING: Record<MusicReaction, MusicReactionTiming> = {
  pulso: 'beats',
  golpe: 'drops',
  temblor: 'accents',
  destello: 'downbeats',
  respirar: 'energy',
  'ken-burns-al-ritmo': 'sections',
};

export const REACTION_PROPS: Record<MusicReaction, readonly KeyframeProp[]> = {
  pulso: ['scale'],
  golpe: ['scale'],
  temblor: ['x', 'y', 'rotation'],
  destello: ['brightness'],
  respirar: ['saturate', 'blur'],
  'ken-burns-al-ritmo': ['scale'],
};

export interface ReactionSample {
  readonly itemId: string;
  readonly frame: number;
  readonly prop: KeyframeProp;
  readonly value: number;
}

export interface ReactionTargetPlan {
  readonly itemId: string;
  /** Timeline frames covered by this reaction on the clip. */
  readonly fromFrame: number;
  readonly toFrame: number;
  readonly props: readonly KeyframeProp[];
  readonly keyframeCount: number;
  readonly reactions: readonly MusicReactionMeta[];
  readonly samples: readonly ReactionSample[];
}

export interface BuildMusicReactionInput {
  readonly analysis: ReactionAnalysis;
  readonly musicItem: TimelineItem;
  readonly fps: number;
  readonly targets: readonly TimelineItem[];
  readonly lockedItemIds?: ReadonlySet<string>;
  readonly songMapRef: string;
  readonly reaction: MusicReaction;
  readonly timing?: MusicReactionTiming;
  readonly intensity?: number;
  readonly fromFrame?: number;
  readonly toFrame?: number;
  readonly seed?: number | string;
}

export interface MusicReactionPlan {
  readonly reaction: MusicReaction;
  readonly timing: MusicReactionTiming;
  readonly intensity: number;
  readonly songMapRef: string;
  readonly range: { readonly fromFrame: number; readonly toFrame: number };
  readonly targets: readonly ReactionTargetPlan[];
  readonly actions: Action[];
  readonly keyframeCount: number;
  readonly lockedItemIds: readonly string[];
}

export interface BuildClearMusicReactionInput {
  readonly targets: readonly TimelineItem[];
  readonly lockedItemIds?: ReadonlySet<string>;
  readonly reaction?: MusicReaction;
}

export interface ClearedReactionTarget {
  readonly itemId: string;
  readonly removed: readonly MusicReaction[];
  readonly clearedProps: readonly KeyframeProp[];
  readonly remaining: readonly MusicReactionMeta[];
}

export interface ClearMusicReactionPlan {
  readonly actions: Action[];
  readonly targets: readonly ClearedReactionTarget[];
  readonly clearedProps: readonly KeyframeProp[];
  readonly lockedItemIds: readonly string[];
}

interface CurvePoint {
  readonly frame: number;
  readonly value: number;
  readonly easing?: KeyframeEasing;
}

const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

function baseValue(item: TimelineItem, prop: KeyframeProp): number {
  return getKeyframePropertyDefinition(prop).getBaseValue(item);
}

function cappedEvents(events: readonly ReactionEventFrame[], maxEvents: number, minGap: number): ReactionEventFrame[] {
  let selected = events;
  if (selected.length > maxEvents) {
    const stride = Math.ceil(selected.length / maxEvents);
    selected = selected.filter((_, index) => index % stride === 0);
  }
  const kept: ReactionEventFrame[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const event of selected) {
    if (event.frame - last < minGap) continue;
    kept.push(event);
    last = event.frame;
  }
  return kept;
}

function finishCurve(points: readonly CurvePoint[], lastFrame: number, base: number): CurvePoint[] {
  const byFrame = new Map<number, CurvePoint>();
  if (!points.some((point) => point.frame === 0)) byFrame.set(0, { frame: 0, value: base });
  for (const point of points) byFrame.set(point.frame, point);
  if (!byFrame.has(lastFrame)) byFrame.set(lastFrame, { frame: lastFrame, value: base });
  return [...byFrame.values()].sort((left, right) => left.frame - right.frame);
}

function pulseCurve(
  item: TimelineItem,
  prop: KeyframeProp,
  events: readonly ReactionEventFrame[],
  amplitude: number,
  decayFrames: number,
  lastFrame: number,
): CurvePoint[] {
  const base = baseValue(item, prop);
  const points: CurvePoint[] = [];
  for (const event of events) {
    points.push({ frame: event.frame, value: base + amplitude * event.strength, easing: 'easeOut' });
    const back = Math.min(lastFrame, event.frame + decayFrames);
    if (back > event.frame) points.push({ frame: back, value: base });
  }
  return finishCurve(points, lastFrame, base);
}

function shakeCurves(
  item: TimelineItem,
  events: readonly ReactionEventFrame[],
  intensity: number,
  decayFrames: number,
  lastFrame: number,
): Record<'x' | 'y' | 'rotation', CurvePoint[]> {
  const amplitude: Record<'x' | 'y' | 'rotation', number> = {
    x: 0.8 * intensity,
    y: 0.5 * intensity,
    rotation: 0.9 * intensity,
  };
  const half = Math.max(1, Math.round(decayFrames / 2));
  const curves = {} as Record<'x' | 'y' | 'rotation', CurvePoint[]>;
  for (const prop of ['x', 'y', 'rotation'] as const) {
    const base = baseValue(item, prop);
    const points: CurvePoint[] = [];
    for (const event of events) {
      const amount = amplitude[prop] * event.strength;
      points.push({ frame: event.frame, value: base + amount, easing: 'easeOut' });
      points.push({ frame: Math.min(lastFrame, event.frame + half), value: base - amount * 0.55, easing: 'easeInOut' });
      points.push({ frame: Math.min(lastFrame, event.frame + decayFrames), value: base });
    }
    curves[prop] = finishCurve(points, lastFrame, base);
  }
  return curves;
}

function energyCurve(
  item: TimelineItem,
  prop: KeyframeProp,
  events: readonly ReactionEventFrame[],
  amplitude: number,
  lastFrame: number,
): CurvePoint[] {
  const base = baseValue(item, prop);
  const points = events.map((event) => ({
    frame: event.frame,
    value: base + amplitude * event.strength,
    easing: 'easeInOut' as const,
  }));
  return finishCurve(points, lastFrame, base);
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function kenBurnsCurve(
  item: TimelineItem,
  analysis: ReactionAnalysis,
  musicItem: TimelineItem,
  fps: number,
  intensity: number,
  seed: string,
  range: { readonly fromFrame: number; readonly toFrame: number },
): CurvePoint[] {
  const firstFrame = Math.max(0, range.fromFrame - item.startFrame);
  const lastFrame = Math.min(item.durationInFrames - 1, range.toFrame - 1 - item.startFrame);
  if (lastFrame - firstFrame < 1) return [];
  const fromMs = sourceMsAtLocalFrame(musicItem, range.fromFrame - musicItem.startFrame, fps);
  const toMs = sourceMsAtLocalFrame(musicItem, range.toFrame - 1 - musicItem.startFrame, fps);
  const boundaries: Array<{ timeMs: number; frame: number }> = [{ timeMs: fromMs, frame: firstFrame }];
  for (const section of analysis.sections) {
    if (section.fromMs <= fromMs || section.fromMs >= toMs) continue;
    const local = localFrameForSourceMs(musicItem, section.fromMs, fps);
    if (local === null) continue;
    const frame = musicItem.startFrame + local - item.startFrame;
    if (frame > firstFrame && frame < lastFrame) boundaries.push({ timeMs: section.fromMs, frame });
  }
  boundaries.push({ timeMs: toMs, frame: lastFrame });
  boundaries.sort((left, right) => left.frame - right.frame);
  const unique = boundaries.filter((entry, index) => index === 0 || entry.frame > boundaries[index - 1]!.frame);

  const weights: number[] = [];
  let total = 0;
  for (let index = 1; index < unique.length; index += 1) {
    const previous = unique[index - 1]!;
    const current = unique[index]!;
    const weight = Math.max(1, current.timeMs - previous.timeMs)
      * (0.25 + energyAt(analysis, (current.timeMs + previous.timeMs) / 2));
    weights.push(weight);
    total += weight;
  }
  const base = baseValue(item, 'scale');
  const travel = 0.06 + 0.14 * intensity;
  const direction = hashSeed(`${seed}:${item.id}`) % 2 === 0 ? 'in' : 'out';
  let progress = 0;
  const points = unique.map((entry, index) => {
    if (index > 0) progress += total > 0 ? (weights[index - 1] ?? 0) / total : 1 / Math.max(1, unique.length - 1);
    const eased = direction === 'in' ? progress : 1 - progress;
    return {
      frame: entry.frame,
      value: base * (1 + travel * eased),
      easing: 'linear' as const,
    };
  });
  return finishCurve(points, item.durationInFrames - 1, base);
}

function curvesForTarget(
  target: TimelineItem,
  input: BuildMusicReactionInput,
  events: readonly ReactionEventFrame[],
  lastFrame: number,
  range: { readonly fromFrame: number; readonly toFrame: number },
): Array<{ prop: KeyframeProp; points: CurvePoint[] }> {
  const intensity = input.intensity ?? 0.5;
  if (input.reaction === 'temblor') {
    const maxEvents = Math.floor((MAX_REACTION_KEYFRAMES_PER_CLIP - 6) / 9);
    const kept = cappedEvents(events, maxEvents, Math.round(input.fps * 0.24));
    const curves = shakeCurves(target, kept, intensity, Math.round(input.fps * 0.24), lastFrame);
    return (['x', 'y', 'rotation'] as const).map((prop) => ({ prop, points: curves[prop] }));
  }
  if (input.reaction === 'respirar') {
    const maxEvents = Math.floor((MAX_REACTION_KEYFRAMES_PER_CLIP - 4) / 2);
    const kept = cappedEvents(events, maxEvents, 1);
    return [
      { prop: 'saturate', points: energyCurve(target, 'saturate', kept, 0.35 * intensity, lastFrame) },
      { prop: 'blur', points: energyCurve(target, 'blur', kept, 2.5 * intensity, lastFrame) },
    ];
  }
  if (input.reaction === 'ken-burns-al-ritmo') {
    return [{
      prop: 'scale',
      points: kenBurnsCurve(
        target, input.analysis, input.musicItem, input.fps, intensity,
        String(input.seed ?? input.songMapRef), range,
      ),
    }];
  }
  const maxEvents = Math.floor((MAX_REACTION_KEYFRAMES_PER_CLIP - 2) / 2);
  const decayMs = input.reaction === 'golpe' ? 300 : input.reaction === 'destello' ? 140 : 160;
  const decayFrames = Math.max(1, Math.round((decayMs / 1000) * input.fps));
  const kept = cappedEvents(events, maxEvents, decayFrames);
  const prop: KeyframeProp = input.reaction === 'destello' ? 'brightness' : 'scale';
  const amplitude = input.reaction === 'golpe' ? 0.2 * intensity : input.reaction === 'destello' ? 0.5 * intensity : 0.08 * intensity;
  return [{ prop, points: pulseCurve(target, prop, kept, amplitude, decayFrames, lastFrame) }];
}

export function mergeReactionMetadata(
  existing: readonly MusicReactionMeta[] | undefined,
  incoming: MusicReactionMeta,
): MusicReactionMeta[] {
  const incomingProps = new Set(incoming.props);
  const kept = (existing ?? []).filter((entry) => (
    entry.reaction !== incoming.reaction && !entry.props.some((prop) => incomingProps.has(prop))
  ));
  return [...kept, incoming];
}

function samplesFor(
  itemId: string,
  curves: ReadonlyArray<{ prop: KeyframeProp; points: readonly CurvePoint[] }>,
): ReactionSample[] {
  const flat = curves.flatMap(({ prop, points }) => points.map((point) => ({
    itemId,
    frame: point.frame,
    prop,
    value: round4(point.value),
  })));
  if (flat.length <= MAX_REACTION_SAMPLES) return flat;
  const stride = Math.ceil(flat.length / MAX_REACTION_SAMPLES);
  return flat.filter((_, index) => index % stride === 0).slice(0, MAX_REACTION_SAMPLES);
}

export function buildMusicReactionPlan(input: BuildMusicReactionInput): MusicReactionPlan {
  const timing = input.timing ?? DEFAULT_REACTION_TIMING[input.reaction];
  const intensity = clamp01(input.intensity ?? 0.5);
  const musicFrom = input.musicItem.startFrame;
  const musicTo = input.musicItem.startFrame + input.musicItem.durationInFrames;
  const range = {
    fromFrame: Math.max(musicFrom, Math.round(input.fromFrame ?? musicFrom)),
    toFrame: Math.min(musicTo, Math.round(input.toFrame ?? musicTo)),
  };
  if (range.toFrame <= range.fromFrame) throw new Error('the requested reaction range does not overlap the BGM clip');
  const events = reactionEvents(input.analysis, timing);
  const locked = input.lockedItemIds ?? new Set<string>();
  const targets = [...new Map(input.targets.map((item) => [item.id, item])).values()]
    .filter((item) => item.id !== input.musicItem.id)
    .slice(0, MAX_REACTION_TARGETS);
  const lockedItemIds = targets.filter((item) => locked.has(item.id)).map((item) => item.id);
  const actions: Action[] = [];
  const plans: ReactionTargetPlan[] = [];
  let keyframeCount = 0;

  for (const target of targets) {
    if (locked.has(target.id) || target.durationInFrames < 3) continue;
    const lastFrame = target.durationInFrames - 1;
    const frames = clipEventFrames(events, target, input.musicItem, input.fps, range);
    // The ken-burns curve derives its own section boundaries; a clip that sits
    // entirely inside one section still gets its slow push.
    if (!frames.length && input.reaction !== 'ken-burns-al-ritmo') continue;
    const curves = curvesForTarget(target, { ...input, intensity }, frames, lastFrame, range);
    const written = curves.flatMap(({ prop, points }) => points.map((point) => ({ prop, point })));
    if (!written.length) continue;
    const props = curves.map(({ prop }) => prop);
    const merged = mergeReactionMetadata(target.musicReactions, {
      reaction: input.reaction,
      timing,
      intensity,
      props,
      songMapRef: input.songMapRef,
      fromFrame: Math.max(range.fromFrame, target.startFrame),
      toFrame: Math.min(range.toFrame, target.startFrame + target.durationInFrames),
      keyframeCount: written.length,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    });
    for (const prop of props) actions.push({ type: 'clearKeyframes', id: target.id, prop });
    for (const { prop, point } of written) {
      actions.push({
        type: 'setKeyframe',
        id: target.id,
        prop,
        frame: point.frame,
        value: round4(point.value),
        ...(point.easing ? { easing: point.easing } : {}),
      });
    }
    actions.push({ type: 'setMusicReactions', id: target.id, reactions: merged });
    keyframeCount += written.length;
    plans.push({
      itemId: target.id,
      fromFrame: Math.max(range.fromFrame, target.startFrame),
      toFrame: Math.min(range.toFrame, target.startFrame + target.durationInFrames),
      props,
      keyframeCount: written.length,
      reactions: merged,
      samples: samplesFor(target.id, curves),
    });
  }

  return {
    reaction: input.reaction,
    timing,
    intensity,
    songMapRef: input.songMapRef,
    range,
    targets: plans,
    actions,
    keyframeCount,
    lockedItemIds,
  };
}

export function buildClearMusicReactionPlan(input: BuildClearMusicReactionInput): ClearMusicReactionPlan {
  const locked = input.lockedItemIds ?? new Set<string>();
  const actions: Action[] = [];
  const targets: ClearedReactionTarget[] = [];
  const allCleared = new Set<KeyframeProp>();
  for (const target of input.targets) {
    if (locked.has(target.id)) continue;
    const existing = target.musicReactions ?? [];
    const removed = input.reaction
      ? existing.filter((entry) => entry.reaction === input.reaction)
      : existing;
    if (!removed.length) continue;
    const remaining = existing.filter((entry) => !removed.includes(entry));
    const claimed = new Set(remaining.flatMap((entry) => entry.props));
    const clearedProps = [...new Set(removed.flatMap((entry) => entry.props))]
      .filter((prop) => !claimed.has(prop));
    for (const prop of clearedProps) {
      actions.push({ type: 'clearKeyframes', id: target.id, prop });
      allCleared.add(prop);
    }
    actions.push({ type: 'setMusicReactions', id: target.id, reactions: remaining });
    targets.push({
      itemId: target.id,
      removed: removed.map((entry) => entry.reaction),
      clearedProps,
      remaining,
    });
  }
  return {
    actions,
    targets,
    clearedProps: [...allCleared],
    lockedItemIds: input.targets.filter((item) => locked.has(item.id)).map((item) => item.id),
  };
}
