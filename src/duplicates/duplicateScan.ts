// Frame sampling for the duplicate-shot detector (Phase 3.4).
//
// The perceptual hash needs pixels, so this module owns the DOM side: it grabs
// one representative frame per visual clip (video midpoint, still image as-is),
// downsamples it to the 9×8 dHash grid and hands back a signature. Media is
// same-origin (`/media/uploads/…`), so the canvas is never tainted.
import type { TimelineItem } from '../editor/types';
import {
  differenceHash,
  groupDuplicates,
  DEFAULT_DUPLICATE_THRESHOLD,
  HASH_ROWS,
  SAMPLE_COLUMNS,
  type DuplicateGroup,
} from './perceptualHash';

/** Kinds whose representative frame can be sampled from `src`. */
const SAMPLED_KINDS = new Set<TimelineItem['kind']>(['video', 'image', 'gif']);

const SEEK_TIMEOUT_MS = 8000;

export function isSampledItem(item: TimelineItem): boolean {
  return SAMPLED_KINDS.has(item.kind) && !!item.src?.startsWith('/media/uploads/');
}

function drawAndSample(source: CanvasImageSource): string {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_COLUMNS;
  canvas.height = HASH_ROWS;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('canvas 2D context unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, SAMPLE_COLUMNS, HASH_ROWS);
  const { data } = context.getImageData(0, 0, SAMPLE_COLUMNS, HASH_ROWS);
  const gray = new Uint8Array(SAMPLE_COLUMNS * HASH_ROWS);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    // Rec. 601 luma keeps a red title on a blue field distinct from the reverse.
    gray[index] = Math.round(
      (data[offset] ?? 0) * 0.299 + (data[offset + 1] ?? 0) * 0.587 + (data[offset + 2] ?? 0) * 0.114,
    );
  }
  return differenceHash(gray);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image failed to load: ${src}`));
    image.src = src;
  });
}

function seekToMidpoint(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('video seek timed out')), SEEK_TIMEOUT_MS);
    const done = (): void => {
      window.clearTimeout(timer);
      resolve();
    };
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', () => {
      window.clearTimeout(timer);
      reject(new Error('video failed to load'));
    }, { once: true });
    video.currentTime = Math.max(0, seconds);
  });
}

/** One signature for one clip: video midpoint by default, the whole still otherwise. */
export async function captureItemHash(item: TimelineItem, fps: number): Promise<string | null> {
  if (!isSampledItem(item) || !item.src) return null;
  if (item.kind !== 'video') return drawAndSample(await loadImage(item.src));

  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.src = item.src;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('video failed to load')), { once: true });
  });
  // Midpoint of the *source* window this clip shows, not of the file.
  const sourceStart = (item.srcInFrame ?? 0) / fps;
  const sourceSpan = (item.durationInFrames * (item.playbackRate ?? 1)) / fps;
  await seekToMidpoint(video, (video.duration || sourceStart + sourceSpan) * 0.5);
  const hash = drawAndSample(video);
  video.removeAttribute('src');
  video.load();
  return hash;
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[];
  scanned: number;
  skipped: number;
  failed: number;
}

/**
 * Hash every sampleable visual clip and group the near-identical ones.
 * `onProgress` receives 0..1 so the dialog can show a bar.
 */
export async function scanForDuplicates(
  items: readonly TimelineItem[],
  fps: number,
  options: { threshold?: number; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<DuplicateScanResult> {
  const candidates = items.filter(isSampledItem);
  const hashed: Array<{ id: string; hash: string }> = [];
  let failed = 0;
  for (const [index, item] of candidates.entries()) {
    if (options.signal?.aborted) break;
    try {
      const hash = await captureItemHash(item, fps);
      if (hash) hashed.push({ id: item.id, hash });
      else failed += 1;
    } catch {
      failed += 1;
    }
    options.onProgress?.((index + 1) / Math.max(1, candidates.length));
  }
  return {
    groups: groupDuplicates(hashed, options.threshold ?? DEFAULT_DUPLICATE_THRESHOLD),
    scanned: hashed.length,
    skipped: items.length - candidates.length,
    failed,
  };
}
