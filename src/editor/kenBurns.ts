import type { Action } from './reduce';
import type { KeyframeEasing } from './types';

// Ken Burns for stills: two keyframes per axis (item-local frame 0 and the last
// frame), written together with the old motion cleared. The caller commits the
// whole list with commands.batch, so the move is one undo step.
//
// Everything lands on generic transform keyframes (scale, x, y), which both the
// preview (effectivePreviewTransform) and the export path sample, so no render
// code is involved.

export const KEN_BURNS_DIRECTIONS = ['in', 'out', 'left', 'right', 'up', 'down', 'random'] as const;

export type KenBurnsDirection = typeof KEN_BURNS_DIRECTIONS[number];
export type ResolvedKenBurnsDirection = Exclude<KenBurnsDirection, 'random'>;

export interface KenBurnsOptions {
  itemId: string;
  durationInFrames: number;
  direction?: KenBurnsDirection;
  /** Zoom travel as a fraction of 100%: 0.12 → 100% to 112%. Clamped to 0.02–0.5. */
  strength?: number;
  /** Deterministic pick for direction 'random'; defaults to the item id. */
  seed?: number | string;
  /** Static transform the pan should stay centred on. */
  baseX?: number;
  baseY?: number;
  easing?: KeyframeEasing;
}

export interface KenBurnsPlan {
  itemId: string;
  direction: ResolvedKenBurnsDirection;
  scaleFrom: number;
  scaleTo: number;
  actions: Action[];
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed) >>> 0;
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: one deterministic draw per seed, good enough to pick a direction. */
function randomUnit(seed: number | string): number {
  let state = (hashSeed(seed) + 0x6d2b79f5) >>> 0;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
}

export function resolveKenBurnsDirection(
  direction: KenBurnsDirection | undefined,
  seed: number | string,
): ResolvedKenBurnsDirection {
  const pick = direction ?? 'in';
  if (pick !== 'random') return pick;
  const choices: ResolvedKenBurnsDirection[] = ['in', 'out', 'left', 'right', 'up', 'down'];
  return choices[Math.min(choices.length - 1, Math.floor(randomUnit(seed) * choices.length))];
}

/** Two keyframes on one prop: start with the segment easing, end holds the value. */
function ramp(
  itemId: string,
  prop: 'scale' | 'x' | 'y',
  lastFrame: number,
  from: number,
  to: number,
  easing: KeyframeEasing,
): Action[] {
  return [
    { type: 'setKeyframe', id: itemId, prop, frame: 0, value: round3(from), easing },
    { type: 'setKeyframe', id: itemId, prop, frame: lastFrame, value: round3(to) },
  ];
}

/** Null when the clip is too short to move (a single frame has no travel). */
export function kenBurnsActions(options: KenBurnsOptions): KenBurnsPlan | null {
  const { itemId } = options;
  const lastFrame = Math.round(options.durationInFrames) - 1;
  if (!itemId || !Number.isFinite(lastFrame) || lastFrame < 1) return null;

  const strength = Math.min(0.5, Math.max(0.02, options.strength ?? 0.12));
  const direction = resolveKenBurnsDirection(
    options.direction,
    options.seed ?? itemId,
  );
  const easing = options.easing ?? 'easeInOut';
  const zoomed = 1 + strength;
  // A pan keeps one scale for the whole shot; leaving 20% of the zoom travel as
  // headroom means the frame edge can never show (scale 1.12 → 6% margin a side,
  // pan travels ±4.8%).
  const pan = round3(strength * 40);
  const baseX = options.baseX ?? 0;
  const baseY = options.baseY ?? 0;

  const actions: Action[] = [
    { type: 'clearKeyframes', id: itemId, prop: 'scale' },
    { type: 'clearKeyframes', id: itemId, prop: 'x' },
    { type: 'clearKeyframes', id: itemId, prop: 'y' },
  ];

  if (direction === 'in' || direction === 'out') {
    const from = direction === 'in' ? 1 : zoomed;
    const to = direction === 'in' ? zoomed : 1;
    actions.push(...ramp(itemId, 'scale', lastFrame, from, to, easing));
    return { itemId, direction, scaleFrom: round3(from), scaleTo: round3(to), actions };
  }

  actions.push(
    { type: 'setKeyframe', id: itemId, prop: 'scale', frame: 0, value: round3(zoomed) },
    { type: 'setKeyframe', id: itemId, prop: 'scale', frame: lastFrame, value: round3(zoomed) },
  );
  if (direction === 'left' || direction === 'right') {
    const sign = direction === 'left' ? 1 : -1;
    actions.push(...ramp(itemId, 'x', lastFrame, baseX + sign * pan, baseX - sign * pan, easing));
  } else {
    const sign = direction === 'up' ? 1 : -1;
    actions.push(...ramp(itemId, 'y', lastFrame, baseY + sign * pan, baseY - sign * pan, easing));
  }
  return { itemId, direction, scaleFrom: round3(zoomed), scaleTo: round3(zoomed), actions };
}
