import type { TimelineItem, TimelineState } from '../../editor/types';
import { isClipFrameFit, type ClipFrameFit } from '../../editor/itemFrameFit';
import { validateBackgroundFillUpdate } from './edit-item-background-fill';
import type { OpResult } from './edit-item-generic-result';

const FRAME_KINDS = new Set(['video', 'image', 'gif', 'svg']);
const HEX = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;

export interface ClipFramePatch {
  fit?: ClipFrameFit;
  /** Turn the blurred background on. Color mode leaves this unset and sets clearBlur. */
  backgroundFill?: true;
  clearBlur?: boolean;
  backgroundColor?: string;
}

/** `fit` and `background: {type, color?}` on a generic edit_item update. */
export function readClipFrame(
  item: TimelineItem,
  entry: Record<string, unknown>,
): ClipFramePatch | { error: string } | null {
  if (entry.fit === undefined && entry.background === undefined) return null;
  if (!FRAME_KINDS.has(item.kind)) {
    return { error: `fit/background only supports video, image, gif, or svg (got ${item.kind})` };
  }
  const patch: ClipFramePatch = {};
  if (entry.fit !== undefined) {
    if (!isClipFrameFit(entry.fit)) return { error: 'fit must be cover, contain, or fill' };
    patch.fit = entry.fit;
  }
  if (entry.background !== undefined) {
    const background = entry.background;
    if (!background || typeof background !== 'object' || Array.isArray(background)) {
      return { error: 'background must be {type:"blur"|"color", color?}' };
    }
    const type = (background as { type?: unknown }).type;
    const color = (background as { color?: unknown }).color;
    if (type === 'blur') {
      if (item.kind !== 'video' && item.kind !== 'image') {
        return { error: 'background blur only supports video or image clips on the bottom video track (V1)' };
      }
      patch.backgroundFill = true;
    } else if (type === 'color') {
      if (color !== undefined && (typeof color !== 'string' || !HEX.test(color.trim()))) {
        return { error: 'background.color must be #rgb, #rrggbb, or #rrggbbaa' };
      }
      patch.backgroundColor = typeof color === 'string' ? color.trim() : '#000000';
      patch.clearBlur = true;
    } else {
      return { error: 'background.type must be blur or color' };
    }
  }
  return patch;
}

/** Merge fit / background into a generic update plan. Returns an error or null. */
export function mergeClipFrame(
  plan: OpResult,
  state: TimelineState,
  item: TimelineItem,
  entry: Record<string, unknown>,
): { error: string } | null {
  const parsed = readClipFrame(item, entry);
  if (parsed && 'error' in parsed) return parsed;
  const track = typeof plan.track === 'string' ? plan.track : undefined;
  const enabled = parsed?.backgroundFill === true ? true : entry.backgroundFill;
  if (enabled !== undefined || entry.backgroundFillStrength !== undefined) {
    const backgroundFill = validateBackgroundFillUpdate(
      state,
      item,
      enabled,
      entry.backgroundFillStrength,
      track,
    );
    if (backgroundFill && 'error' in backgroundFill) return backgroundFill;
    if (backgroundFill) {
      plan.backgroundFill = backgroundFill.enabled;
      if (backgroundFill.strength !== undefined) plan.backgroundFillStrength = backgroundFill.strength;
    }
  } else if (parsed?.clearBlur && (item.kind === 'video' || item.kind === 'image')) {
    plan.backgroundFill = false;
  }
  if (parsed?.fit) plan.fit = parsed.fit;
  if (parsed?.backgroundColor !== undefined) plan.backgroundColor = parsed.backgroundColor;
  return null;
}
