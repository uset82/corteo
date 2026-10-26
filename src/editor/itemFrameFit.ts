import type { AspectFit } from './aspectTypes';

/** Per-item frame fit. `fill` stretches. The timeline's own fit stays contain | cover. */
export type ClipFrameFit = 'contain' | 'cover' | 'fill';

export function isClipFrameFit(value: unknown): value is ClipFrameFit {
  return value === 'contain' || value === 'cover' || value === 'fill';
}

/** Item fit when set, otherwise the timeline fit. */
export function clipFrameFitOf(item: { fit?: unknown }, timelineFit: AspectFit): ClipFrameFit {
  return isClipFrameFit(item.fit) ? item.fit : timelineFit;
}

/**
 * What MediaFill should use. An explicit item fit wins. With no item fit, a
 * blurred background still letterboxes so the blur stays visible.
 */
export function mediaFitFor(
  item: { fit?: unknown },
  timelineFit: AspectFit,
  backgroundFill: boolean,
): ClipFrameFit {
  if (isClipFrameFit(item.fit)) return item.fit;
  return backgroundFill ? 'contain' : timelineFit;
}
