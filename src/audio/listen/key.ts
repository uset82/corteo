import type { KeyEstimate } from './types.ts';

// Krumhansl–Kessler key profiles, indexed by semitones above the tonic.
const KK_MAJOR = [
  6.35, 2.23, 3.48, 2.14, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const KK_MINOR = [
  6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];
const TONIC_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

function pearson(left: readonly number[], right: readonly number[]): number {
  const size = left.length;
  let leftMean = 0;
  let rightMean = 0;
  for (let i = 0; i < size; i += 1) {
    leftMean += left[i]!;
    rightMean += right[i]!;
  }
  leftMean /= size;
  rightMean /= size;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let i = 0; i < size; i += 1) {
    const leftDelta = left[i]! - leftMean;
    const rightDelta = right[i]! - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? covariance / denominator : 0;
}

/** Correlate the chroma the spectrum pass accumulated (index 0 = A) against every key. */
export function estimateKey(chroma: readonly number[]): KeyEstimate | null {
  let total = 0;
  for (const value of chroma) total += value;
  if (!(total > 0) || chroma.length !== 12) return null;
  let best = { tonic: 0, major: true, value: -2 };
  let second = -2;
  for (const major of [true, false]) {
    const profile = major ? KK_MAJOR : KK_MINOR;
    for (let tonic = 0; tonic < 12; tonic += 1) {
      const rotated = Array.from({ length: 12 }, (_, index) => profile[(index - tonic + 12) % 12]!);
      const value = pearson(chroma, rotated);
      if (value > best.value) {
        second = best.value;
        best = { tonic, major, value };
      } else if (value > second) {
        second = value;
      }
    }
  }
  return {
    tonic: TONIC_NAMES[best.tonic]!,
    mode: best.major ? 'major' : 'minor',
    confidence: Math.max(0, Math.min(1, (best.value - second) * 4)),
  };
}
