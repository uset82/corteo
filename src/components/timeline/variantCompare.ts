// Pure pieces of "Comparar versiones": which versions fit the grid, how far a
// follower may drift before it is seeked, and the status wording.
import type { Timeline, VariantStatus } from '../../editor/types';

/** The grid is 2x2, so a group never shows more than four versions at once. */
export const MAX_COMPARE_VERSIONS = 4;

/** Below this the follower is left alone; above it the clock is corrected. */
export const VARIANT_SYNC_DRIFT_SECONDS = 0.2;

export function compareMembers(members: readonly Timeline[]): Timeline[] {
  return members.slice(0, MAX_COMPARE_VERSIONS);
}

export function needsSync(masterSeconds: number, followerSeconds: number): boolean {
  return Math.abs(masterSeconds - followerSeconds) > VARIANT_SYNC_DRIFT_SECONDS;
}

/** Seek target clamped to the follower's own length: versions may differ. */
export function seekTarget(seconds: number, duration: number): number {
  const top = Number.isFinite(duration) && duration > 0 ? duration : seconds;
  return Math.max(0, Math.min(seconds, top));
}

export function formatCompareSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const STATUS_KEYS: Record<VariantStatus, string> = {
  candidate: '候选',
  chosen: '已选用',
  discarded: '已淘汰',
};

export function variantStatusLabelKey(status: VariantStatus): string {
  return STATUS_KEYS[status];
}
