/**
 * Reframe stabilization (Plan 5, OP-11), ported from clipmint's crop math (MIT).
 *
 * The detector already smooths with an EMA, but an EMA still *moves* on every sample, so a
 * subject tracker that jumps between two nearby faces produces a crop that twitches. These
 * three rules are what makes a crop feel deliberate:
 *
 * - dead zone: while the target stays within 12 % of the frame, hold still;
 * - minimum shot: once the crop has moved, it holds for 2 s before it may move again;
 * - ease: each sample closes at most interval/easeSeconds of the remaining distance.
 *
 * clipmint's "speaker-switch margin" is deliberately not ported: it arbitrates between two
 * tracked subjects, and every detector in this repo produces one focal point per sample.
 */

export interface FocalPoint {
  x: number;
  y: number;
}

export interface StabilizeOptions {
  fps: number;
  /** Frames between samples (the detector's interval). Default 15. */
  intervalFrames?: number;
  /** Fraction of the frame the target may wander before the crop follows. Default 0.12. */
  deadZone?: number;
  /** Seconds to close the distance to a new target. Default 0.45. */
  easeSeconds?: number;
  /** Seconds the crop holds after a move. Default 2. */
  minShotSeconds?: number;
}

export const STABILIZE_DEFAULT_DEAD_ZONE = 0.12;
export const STABILIZE_DEFAULT_EASE_SECONDS = 0.45;
export const STABILIZE_DEFAULT_MIN_SHOT_SECONDS = 2;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function stabilizeFocalPath(
  points: readonly FocalPoint[],
  opts: StabilizeOptions,
): FocalPoint[] {
  if (!points.length) return [];
  const fps = Math.max(1, opts.fps || 30);
  const intervalFrames = Math.max(1, Math.floor(opts.intervalFrames ?? 15));
  const deadZone = Math.max(0, opts.deadZone ?? STABILIZE_DEFAULT_DEAD_ZONE);
  const easeSeconds = Math.max(0.05, opts.easeSeconds ?? STABILIZE_DEFAULT_EASE_SECONDS);
  const minShotSeconds = Math.max(0, opts.minShotSeconds ?? STABILIZE_DEFAULT_MIN_SHOT_SECONDS);

  const intervalSeconds = intervalFrames / fps;
  // Share of the remaining distance one sample may close. interval >= ease → snap.
  const step = Math.min(1, intervalSeconds / easeSeconds);
  const minShotSamples = Math.max(1, Math.round(minShotSeconds / intervalSeconds));

  let current: FocalPoint = { x: clamp01(points[0].x), y: clamp01(points[0].y) };
  // Start "already settled" so the first real difference is allowed to move the crop.
  let samplesSinceMove = minShotSamples;
  const out: FocalPoint[] = [{ ...current }];

  for (let index = 1; index < points.length; index += 1) {
    const target = { x: clamp01(points[index].x), y: clamp01(points[index].y) };
    const distance = Math.hypot(target.x - current.x, target.y - current.y);
    const withinDeadZone = distance <= deadZone;
    const stillInShot = samplesSinceMove < minShotSamples;
    if (withinDeadZone || stillInShot) {
      samplesSinceMove += 1;
      out.push({ ...current });
      continue;
    }
    current = {
      x: clamp01(current.x + (target.x - current.x) * step),
      y: clamp01(current.y + (target.y - current.y) * step),
    };
    samplesSinceMove = 0;
    out.push({ ...current });
  }

  return out;
}
