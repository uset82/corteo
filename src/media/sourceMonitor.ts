import type { MediaAsset } from '../editor/types';

const PREVIEWABLE_KINDS: ReadonlySet<string> = new Set(['video', 'audio', 'image', 'gif', 'svg']);

export function canPreviewInSourceMonitor(asset: Pick<MediaAsset, 'kind' | 'src'>): boolean {
  return !!asset.src && PREVIEWABLE_KINDS.has(asset.kind);
}

const STILL_SECONDS = 5;

/** Total source frames; stills without an imported duration get a 5-second default. */
export function sourceTotalFrames(durationInFrames: number, fps: number, kind: string): number {
  const fallback = kind === 'image' || kind === 'svg' ? Math.round(Math.max(1, fps) * STILL_SECONDS) : 0;
  const frames = Number.isFinite(durationInFrames) && durationInFrames > 0 ? durationInFrames : fallback;
  return Math.max(1, Math.round(frames));
}

export interface SourceRange {
  /** inclusive first frame */
  inFrame: number;
  /** exclusive last frame */
  outFrame: number;
}

/** Keep in/out inside the source and guarantee at least one frame. */
export function normalizeSourceRange(total: number, inFrame: number, outFrame: number): SourceRange {
  const safeTotal = Math.max(1, Math.round(total));
  const start = Math.max(0, Math.min(Math.round(inFrame), safeTotal - 1));
  const end = Math.max(start + 1, Math.min(Math.round(outFrame), safeTotal));
  return { inFrame: start, outFrame: end };
}

export function clampSourceFrame(frame: number, total: number): number {
  const last = Math.max(0, Math.round(total) - 1);
  if (!Number.isFinite(frame)) return 0;
  return Math.max(0, Math.min(Math.round(frame), last));
}

export function sourceSeconds(frame: number, fps: number): number {
  return frame / Math.max(1, fps);
}

export function sourceFrameFromSeconds(seconds: number, fps: number, total: number): number {
  return clampSourceFrame(seconds * Math.max(1, fps), total);
}
