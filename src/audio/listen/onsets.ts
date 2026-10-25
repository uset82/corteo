import { onsetEnvelope } from '../beats.ts';
import type { OnsetPoint } from './types.ts';

/** Two onsets closer than this are the same hit (a click's attack and ring). */
const MIN_GAP_MS = 120;
const PEAK_WINDOW_HOPS = 2;
const ACCENT_STRENGTH = 0.6;

/**
 * Flux credits an attack to the first 1024-sample window that contains it, so
 * the envelope peak lands up to two hops *before* the real attack — coarser
 * than the 10 ms the click test asks for. Search two hops either side of the
 * peak for the loudest sample, then walk back to where the attack starts.
 */
function refineAttackMs(samples: Float32Array, sampleRate: number, approxMs: number, spanMs: number): number {
  const half = Math.max(1, Math.round((2 * spanMs / 1000) * sampleRate));
  const center = Math.round((approxMs / 1000) * sampleRate);
  const from = Math.max(0, center - half);
  const to = Math.min(samples.length - 1, center + half);
  let peak = 0;
  let peakAt = from;
  for (let i = from; i <= to; i += 1) {
    const value = Math.abs(samples[i]!);
    if (value > peak) {
      peak = value;
      peakAt = i;
    }
  }
  if (peak <= 0) return approxMs;
  const threshold = peak * 0.25;
  let start = peakAt;
  while (start > from && Math.abs(samples[start - 1]!) >= threshold) start -= 1;
  return (start / sampleRate) * 1000;
}

export function detectOnsets(samples: Float32Array, sampleRate: number): OnsetPoint[] {
  const { env, hopSeconds } = onsetEnvelope(samples, sampleRate);
  if (env.length < PEAK_WINDOW_HOPS * 2 + 1) return [];
  let mean = 0;
  for (const value of env) mean += value;
  mean /= env.length;
  let variance = 0;
  for (const value of env) variance += (value - mean) ** 2;
  const gate = mean + Math.sqrt(variance / env.length) * 1.5;
  let max = 0;
  for (const value of env) if (value > max) max = value;
  if (max <= 0) return [];
  const picked: { timeMs: number; strength: number }[] = [];
  const hopMs = hopSeconds * 1000;
  for (let i = PEAK_WINDOW_HOPS; i < env.length - PEAK_WINDOW_HOPS; i += 1) {
    const value = env[i]!;
    if (value < gate) continue;
    let isPeak = true;
    for (let delta = -PEAK_WINDOW_HOPS; delta <= PEAK_WINDOW_HOPS && isPeak; delta += 1) {
      if (delta !== 0 && env[i + delta]! > value) isPeak = false;
    }
    if (!isPeak) continue;
    const approxMs = i * hopMs;
    picked.push({
      timeMs: refineAttackMs(samples, sampleRate, approxMs, hopMs),
      strength: value / max,
    });
  }
  const kept: { timeMs: number; strength: number }[] = [];
  for (const onset of picked) {
    const last = kept[kept.length - 1];
    if (last && onset.timeMs - last.timeMs < MIN_GAP_MS) {
      if (onset.strength > last.strength) kept[kept.length - 1] = onset;
      continue;
    }
    kept.push(onset);
  }
  return kept;
}

export function pickAccents(onsets: readonly OnsetPoint[]): OnsetPoint[] {
  return onsets.filter((onset) => onset.strength >= ACCENT_STRENGTH);
}
