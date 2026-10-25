import type { EnergyFrame, Moment, MomentKind } from './types.ts';

const MIN_MOMENT_GAP_MS = 1500;
/** 400 ms of 50 ms frames counts as a stop, not a breath. */
const STOP_FRAMES = 8;
const SPAN_FRAMES = 6;
const GAP_FRAMES = 4;
const LOCAL_WINDOW = 4;
const VOCAL_RUN_FRAMES = 10;

function movingAverage(values: readonly number[], window: number): number[] {
  const output = new Array<number>(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]!;
    if (i >= window) sum -= values[i - window]!;
    output[i] = sum / Math.min(window, i + 1);
  }
  return output;
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) * quantile)]!;
}

function mean(values: readonly number[], from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += values[i]!;
  return sum / Math.max(1, to - from);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupe(moments: readonly Moment[]): Moment[] {
  const kept: Moment[] = [];
  for (const moment of moments) {
    const last = kept[kept.length - 1];
    if (last && last.kind === moment.kind && moment.timeMs - last.timeMs < MIN_MOMENT_GAP_MS) {
      if (moment.strength > last.strength) kept[kept.length - 1] = moment;
      continue;
    }
    kept.push(moment);
  }
  return kept;
}

/**
 * Moments are energy shape, not semantics: a drop is a fast quiet→loud step, a
 * break the opposite, a build a gentler sustained rise, a stop a silence. The
 * vocal entries are a mid-band proxy; lyrics arrive with the transcript.
 */
export function deriveMoments(frames: readonly EnergyFrame[]): Moment[] {
  if (frames.length < 12) return [];
  const rms = movingAverage(frames.map((frame) => frame.rms), SPAN_FRAMES);
  const reference = Math.max(percentile(rms, 0.75), percentile(rms, 0.95) * 0.5);
  if (!(reference > 1e-6)) return [];
  const silence = Math.max(0.002, reference * 0.05);
  const moments: Moment[] = [];
  const push = (kind: MomentKind, index: number, strength: number): void => {
    moments.push({ kind, timeMs: frames[index]!.timeMs, strength: clamp01(strength) });
  };

  let quietStart = -1;
  let seenLoud = false;
  for (let i = 0; i < rms.length; i += 1) {
    if (rms[i]! >= reference * 0.5) seenLoud = true;
    if (rms[i]! <= silence) {
      if (quietStart < 0) quietStart = i;
      continue;
    }
    if (quietStart >= 0 && i - quietStart >= STOP_FRAMES && seenLoud) {
      // The smoothed series detects the silence; report where the raw samples
      // went quiet, otherwise the 6-frame trailing mean dates it ~250 ms late.
      let onset = quietStart;
      while (onset > 0 && frames[onset - 1]!.rms <= silence) onset -= 1;
      push('stop', onset, 1 - rms[quietStart]! / silence / 2);
    }
    quietStart = -1;
  }

  const ratios = new Float64Array(rms.length).fill(Number.NaN);
  for (let i = GAP_FRAMES + SPAN_FRAMES; i + GAP_FRAMES + SPAN_FRAMES <= rms.length; i += 1) {
    const before = mean(rms, i - GAP_FRAMES - SPAN_FRAMES, i - GAP_FRAMES);
    const after = mean(rms, i + GAP_FRAMES, i + GAP_FRAMES + SPAN_FRAMES);
    if (before > 1e-6 && after > 1e-6) ratios[i] = after / before;
  }
  for (let i = 0; i < ratios.length; i += 1) {
    const ratio = ratios[i]!;
    if (!Number.isFinite(ratio)) continue;
    let isPeak = true;
    for (let delta = -LOCAL_WINDOW; delta <= LOCAL_WINDOW && isPeak; delta += 1) {
      if (delta === 0) continue;
      const neighbor = ratios[i + delta];
      if (!Number.isFinite(neighbor)) continue;
      if (delta < 0 ? neighbor! >= ratio : neighbor! > ratio) isPeak = false;
    }
    if (!isPeak) continue;
    if (ratio >= 1.8) {
      push('drop', i, (ratio - 1) / 4);
    } else if (ratio <= 0.55) {
      push('break', i, (1 / ratio - 1) / 2);
    } else if (ratio >= 1.25 && ratio < 1.8) {
      push('build', i, (ratio - 1.2) / 0.6);
    }
  }

  const shares = movingAverage(
    frames.map((frame) => frame.mid / Math.max(1e-9, frame.bass + frame.mid + frame.brightness)),
    VOCAL_RUN_FRAMES,
  );
  let state: 'in' | 'out' | null = null;
  let run = 0;
  for (let i = 0; i < shares.length; i += 1) {
    const share = shares[i]!;
    const loud = rms[i]! >= reference * 0.08;
    if (share >= 0.45 && loud) {
      run = state === 'in' ? 0 : run + 1;
      if (state !== 'in' && run >= VOCAL_RUN_FRAMES) {
        push('vocals-in', i, share);
        state = 'in';
        run = 0;
      }
    } else if (share <= 0.25) {
      run = state === 'out' ? 0 : run + 1;
      if (state !== 'out' && run >= VOCAL_RUN_FRAMES) {
        push('vocals-out', i, 1 - share);
        state = 'out';
        run = 0;
      }
    } else {
      run = 0;
    }
  }

  return dedupe(moments.sort((left, right) => left.timeMs - right.timeMs));
}
