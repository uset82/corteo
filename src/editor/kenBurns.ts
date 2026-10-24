// Ken Burns for stills — implemented as canonical keyframes on x/y/scale.
//
// An effect is *recognized* (rather than duplicated in the data model) when the
// timeline item carries keyframes for x, y and scale that all sit on exactly two
// frames: 0 and the last frame of the clip. Removing the effect removes those
// keyframes. Because preview and export already interpolate ItemKeyframes, a
// recognized Ken Burns pan/zoom renders identically everywhere for free.
//
// Per IMPLEMENTATION_PLAN §3.1 the stored spec is:
//   startX/startY/startScale → endX/endY/endScale with a segment easing.
// Units: x/y follow ClipTransform (percent of canvas, -100..100); scale is 1 = 100%.

import type { Keyframe, KeyframeProp, ItemKeyframes, TimelineItem } from './clipTypes';

/** Easings offered by the Ken Burns panel. */
export const KEN_BURNS_EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;

/** Easing keys understood by the Ken Burns UI (named easings only). */
export type NamedEasing = typeof KEN_BURNS_EASINGS[number];
/** Canonical easing of a generated segment; easeInOut is the classic documentary default. */
export const DEFAULT_KEN_BURNS_EASING: NamedEasing = 'easeInOut';

const KB_PROPS = ['x', 'y', 'scale'] as const satisfies readonly KeyframeProp[];

export interface KenBurnsSpec {
  startX: number;
  startY: number;
  startScale: number;
  endX: number;
  endY: number;
  endScale: number;
  easing: NamedEasing;
}

/** True when `item` carries the canonical two-point Ken Burns keyframe signature. */
export function hasKenBurns(item: Pick<TimelineItem, 'keyframes' | 'durationInFrames'>): boolean {
  return readKenBurns(item) !== null;
}

/**
 * Read the Ken Burns spec encoded by an item's keyframes, or null when the
 * item does not carry the signature. Recognition requires every kb prop to
 * hold exactly two keyframes anchored at frames 0 and durationInFrames-1.
 */
export function readKenBurns(item: Pick<TimelineItem, 'keyframes' | 'durationInFrames'>): KenBurnsSpec | null {
  const { keyframes } = item;
  if (!keyframes) return null;
  const lastFrame = item.durationInFrames - 1;
  if (lastFrame < 1) return null;
  const cursors: Record<KeyframeProp, Keyframe[] | undefined> = {
    x: keyframes.x, y: keyframes.y, scale: keyframes.scale,
    rotation: undefined, scaleX: undefined, scaleY: undefined, opacity: undefined, borderRadius: undefined, volume: undefined,
  };
  const xs = cursors.x, ys = cursors.y, ss = cursors.scale;
  if (!xs || !ys || !ss) return null;
  for (const values of [xs, ys, ss]) {
    if (values.length !== 2) return null;
    if (values[0]!.frame !== 0 || values[1]!.frame !== lastFrame) return null;
  }
  // Segment easing lives on the LEFT keyframe of a segment (see sampleKeyframes),
  // so the canonical signature carries it on the frame-0 keyframe of all three props.
  const easing = xs[0]!.easing ?? 'linear';
  if ((ys[0]!.easing ?? 'linear') !== easing || (ss[0]!.easing ?? 'linear') !== easing) return null;
  const namedEasing: NamedEasing = (KEN_BURNS_EASINGS as readonly unknown[]).includes(easing)
    ? (easing as NamedEasing)
    : null!;
  if (!namedEasing) return null;
  return {
    startX: xs[0]!.value, startY: ys[0]!.value, startScale: ss[0]!.value,
    endX: xs[1]!.value, endY: ys[1]!.value, endScale: ss[1]!.value,
    easing: namedEasing,
  };
}

/** Are two specs equal? Used to skip redundant reducer writes. */
export function sameKenBurns(a: KenBurnsSpec, b: KenBurnsSpec): boolean {
  return a.startX === b.startX && a.startY === b.startY && a.startScale === b.startScale
    && a.endX === b.endX && a.endY === b.endY && a.endScale === b.endScale
    && a.easing === b.easing;
}

/** Replace (or remove when spec is null) the Ken Burns keyframe signature on an item's
 * keyframes map. Returns the new map; null means "no change needed". */
export function writeKenBurns(
  item: Pick<TimelineItem, 'keyframes' | 'durationInFrames'>,
  spec: KenBurnsSpec | null,
): ItemKeyframes | null {
  const lastFrame = item.durationInFrames - 1;
  if (lastFrame < 1) return null;
  const keyframes: ItemKeyframes = { ...(item.keyframes ?? {}) };

  if (!spec) {
    let changed = false;
    for (const prop of KB_PROPS) {
      if (Array.isArray(keyframes[prop])) {
        delete keyframes[prop];
        changed = true;
      }
    }
    return changed ? keyframes : null;
  }

  // The easing belongs to the 0 → last segment, i.e. the frame-0 keyframe.
  const pairs: Record<(typeof KB_PROPS)[number], [Keyframe, Keyframe]> = {
    x: [
      { frame: 0, value: spec.startX, easing: spec.easing },
      { frame: lastFrame, value: spec.endX },
    ],
    y: [
      { frame: 0, value: spec.startY, easing: spec.easing },
      { frame: lastFrame, value: spec.endY },
    ],
    scale: [
      { frame: 0, value: spec.startScale, easing: spec.easing },
      { frame: lastFrame, value: spec.endScale },
    ],
  };
  for (const prop of KB_PROPS) {
    keyframes[prop] = pairs[prop];
  }
  return keyframes;
}

/** Serialize for the InspectorControls-facing wire format. */
export function serializeKenBurns(spec: KenBurnsSpec): string {
  return JSON.stringify(spec);
}
