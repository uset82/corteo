import { sampleKeyframes } from './keyframes';
import { coerceKeyframeValue, isFilterKeyframeProp } from './keyframeRegistry';
import type { ClipFilters, KeyframeProp, TimelineItem } from './types';
import { flexCropClipPath, hasFlexCrop } from './flexCrop';

/** Fade multiplier at a Sequence-relative frame. */
export function clipFadeFactor(
  frame: number,
  durationInFrames: number,
  fadeInFrames = 0,
  fadeOutFrames = 0,
): number {
  let factor = 1;
  if (fadeInFrames > 0) factor = Math.min(factor, frame / fadeInFrames);
  if (fadeOutFrames > 0) factor = Math.min(factor, (durationInFrames - frame) / fadeOutFrames);
  return Math.max(0, Math.min(1, factor));
}

/** Visual opacity shared by the foreground and any full-canvas companion layer. */
export function clipOpacityAt(item: TimelineItem, frame: number, hidden = false): number {
  const opacityKeyframes = item.keyframes?.opacity;
  const opacity = opacityKeyframes?.length
    ? sampleKeyframes(opacityKeyframes, frame)
    : item.transform?.opacity ?? 1;
  const visibleOpacity = hidden ? 0 : Math.max(0, Math.min(1, opacity));
  return clipFadeFactor(frame, item.durationInFrames, item.fadeInFrames, item.fadeOutFrames) * visibleOpacity;
}

export interface ClipAppearance {
  opacity: number;
  borderRadius: number;
  foregroundStyle: import('react').CSSProperties;
}

/** Filter values at an item-local frame: a keyframed channel overrides the
 *  static ClipFilters value, clamped so easing overshoot cannot emit a negative
 *  CSS filter. */
export function clipFiltersAt(item: TimelineItem, frame: number): Required<ClipFilters> {
  const channel = (prop: KeyframeProp, fallback: number): number => {
    const kfs = item.keyframes?.[prop];
    if (!kfs?.length) return item.filters?.[prop as keyof ClipFilters] ?? fallback;
    return coerceKeyframeValue(prop, sampleKeyframes(kfs, frame));
  };
  const tidy = (value: number): number => Math.round(value * 1e4) / 1e4;
  return {
    brightness: tidy(channel('brightness', 1)),
    contrast: tidy(channel('contrast', 1)),
    saturate: tidy(channel('saturate', 1)),
    blur: tidy(channel('blur', 0)),
  };
}

const hasFilterChannel = (item: TimelineItem): boolean =>
  (Object.keys(item.keyframes ?? {}) as KeyframeProp[]).some((prop) => (
    isFilterKeyframeProp(prop) && (item.keyframes?.[prop]?.length ?? 0) > 0
  ));

/** Per-frame clip appearance (opacity/border/transform/crop/filters) shared by
 *  the clip wrapper and the shared-visual video group. */
export function appearanceAt(
  item: import('./types').TimelineItem,
  frame: number,
  hiddenByCaptions: boolean,
  canvas: { width: number; height: number } = { width: 0, height: 0 },
): ClipAppearance {
  const keyframeValue = (prop: import('./types').KeyframeProp): number | undefined => {
    const values = item.keyframes?.[prop];
    return values?.length ? sampleKeyframes(values, frame) : undefined;
  };
  const transform = item.transform;
  const scale = keyframeValue('scale');
  const scaleX = keyframeValue('scaleX') ?? transform?.scaleX ?? scale ?? transform?.scale ?? 1;
  const scaleY = keyframeValue('scaleY') ?? transform?.scaleY ?? scale ?? transform?.scale ?? 1;
  const hasScale = scale !== undefined || keyframeValue('scaleX') !== undefined || keyframeValue('scaleY') !== undefined
    || transform?.scale !== undefined || transform?.scaleX !== undefined || transform?.scaleY !== undefined;
  const hasTransform = transform || keyframeValue('x') !== undefined || keyframeValue('y') !== undefined
    || keyframeValue('rotation') !== undefined || hasScale;
  const cssTransform = hasTransform
    ? `translate(${keyframeValue('x') ?? transform?.x ?? 0}%, ${keyframeValue('y') ?? transform?.y ?? 0}%) rotate(${keyframeValue('rotation') ?? transform?.rotation ?? 0}deg) scale(${scaleX}, ${scaleY})`
    : undefined;
  const crop = transform?.crop;
  const clipPath = hasFlexCrop(crop) ? flexCropClipPath(crop, canvas.width, canvas.height) : undefined;
  const opacity = clipOpacityAt(item, frame, hiddenByCaptions);
  const filters = item.filters !== undefined || hasFilterChannel(item)
    ? clipFiltersAt(item, frame)
    : null;
  return {
    opacity,
    borderRadius: Math.max(0, keyframeValue('borderRadius') ?? transform?.borderRadius ?? 0),
    foregroundStyle: {
      transform: cssTransform,
      transformOrigin: '50% 50%',
      transformBox: 'border-box',
      filter: filters
        ? `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturate}) blur(${filters.blur}px)`
        : undefined,
      clipPath,
    },
  };
}
