export const CLAP_WINDOW_SECONDS = 10;
export const CLAP_WINDOW_STEP_SECONDS = 8;
// Whole-track labels need representative coverage, not exhaustive segment retrieval.
export const MAX_CLAP_REPRESENTATIVE_WINDOWS = 24;

/** Start offsets of the 10 s windows that fit inside the track, thinned to 24. */
export function sourceWindowStarts(sampleCount: number, sampleRate: number): number[] {
  const windowSamples = sampleRate * CLAP_WINDOW_SECONDS;
  const stepSamples = sampleRate * CLAP_WINDOW_STEP_SECONDS;
  const candidates = [0];
  while (candidates[candidates.length - 1]! + windowSamples < sampleCount) {
    candidates.push(candidates[candidates.length - 1]! + stepSamples);
  }
  return uniformlySelectStarts(candidates);
}

export function uniformlySelectStarts(candidates: readonly number[]): number[] {
  if (candidates.length <= MAX_CLAP_REPRESENTATIVE_WINDOWS) return [...candidates];
  const lastIndex = candidates.length - 1;
  return Array.from(
    { length: MAX_CLAP_REPRESENTATIVE_WINDOWS },
    (_, index) => candidates[Math.round((index * lastIndex) / (MAX_CLAP_REPRESENTATIVE_WINDOWS - 1))]!,
  );
}

/** Mean of unit vectors, re-normalized; throws when the mean has no direction. */
export function normalizedMeanVector(sum: Float64Array, count: number): number[] {
  const mean = Array.from(sum, (value) => value / count);
  const norm = Math.hypot(...mean);
  if (!Number.isFinite(norm) || norm <= Number.EPSILON) throw new Error('CLAP returned a zero mean embedding');
  return mean.map((value) => value / norm);
}
