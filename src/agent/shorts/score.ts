import type { CalibrationWeights } from './calibration';
import type { Candidate, Dimensions, DimensionKey, ModelVerdict, ScoredMoment } from './types';

/**
 * The blend, the gates and the dedupe.
 *
 * Blend: deterministic 60 % / model 40 %, per dimension. `sound` is deterministic only,
 * because a text model cannot hear the delivery. A candidate with no verdict keeps its
 * measured score, so the pipeline still produces a ranking with providers off.
 *
 * Gates come before ranking, not after: a candidate that cannot stand alone is dropped
 * with a reason, instead of being quietly down-ranked and shown anyway.
 */

export const MODEL_WEIGHT = 0.4;
/** Jev's composite floor (Gitee, MIT), which is also a sensible "publish-worthy" line. */
export const PUBLISH_THRESHOLD = 55;

const WEIGHTS: Record<DimensionKey, number> = { hook: 0.35, flow: 0.25, value: 0.25, sound: 0.15 };

export interface GateOptions {
  minMs: number;
  maxMs: number;
}

export function blendScores(det: Dimensions, model: ModelVerdict | null): Dimensions {
  if (!model) return { ...det };
  const mix = (measured: number, judged: number): number =>
    Math.round(measured * (1 - MODEL_WEIGHT) + judged * MODEL_WEIGHT);
  return {
    hook: mix(det.hook, model.hook),
    flow: mix(det.flow, model.flow),
    value: mix(det.value, model.value),
    // The model never sees the audio, so it does not get a say in this one.
    sound: det.sound,
  };
}

/**
 * Weighted composite, 0-99 (OpusClip's scale, not 0-100).
 * `multipliers` are the calibration weights; they are normalised so the identity vector
 * reproduces the unweighted score exactly and the 0-99 scale keeps its meaning.
 */
export function composite(dims: Dimensions, multipliers?: Partial<CalibrationWeights>): number {
  const keys = Object.keys(WEIGHTS) as DimensionKey[];
  const scaled = keys.map((key) => WEIGHTS[key] * (multipliers?.[key] ?? 1));
  const total = scaled.reduce((sum, value) => sum + value, 0) || 1;
  const raw = keys.reduce((sum, key, index) => sum + dims[key] * scaled[index], 0) / total;
  return Math.max(0, Math.min(99, Math.round(raw)));
}

export function gateMoment(cand: Candidate, dims: Dimensions, opts: GateOptions): string[] {
  const reasons: string[] = [];
  if (dims.flow < 40) reasons.push('no se sostiene solo');
  if (dims.value < 30) reasons.push('poca información');
  const durationMs = cand.endMs - cand.startMs;
  if (durationMs < opts.minMs * 0.8) reasons.push('demasiado corto');
  if (durationMs > opts.maxMs * 1.05) reasons.push('demasiado largo');
  return reasons;
}

export interface RankInput {
  candidate: Candidate;
  deterministic: Dimensions;
  verdict: ModelVerdict | null;
}

/** Score and gate every candidate, best first. */
export function rankMoments(
  inputs: readonly RankInput[],
  opts: GateOptions,
  multipliers?: Partial<CalibrationWeights>,
): ScoredMoment[] {
  const scored = inputs.map((input) => {
    const subscores = blendScores(input.deterministic, input.verdict);
    const gateReasons = gateMoment(input.candidate, subscores, opts);
    return {
      ...input.candidate,
      score: composite(subscores, multipliers),
      subscores,
      gate: (gateReasons.length ? 'rejected' : 'pass') as ScoredMoment['gate'],
      gateReasons,
      model: input.verdict,
      deterministic: input.deterministic,
    };
  });
  scored.sort((a, b) => b.score - a.score || a.startWord - b.startWord);
  return scored;
}

/** Overlap as a share of the shorter clip, so a long clip does not swallow a short one. */
export function overlapRatio(a: Candidate, b: Candidate): number {
  const start = Math.max(a.startMs, b.startMs);
  const end = Math.min(a.endMs, b.endMs);
  if (end <= start) return 0;
  const shorter = Math.min(a.endMs - a.startMs, b.endMs - b.startMs);
  return shorter > 0 ? (end - start) / shorter : 0;
}

/**
 * Drop near-duplicates, keeping the higher score. 40 % is the midpoint between clipmint's
 * 25 % footage overlap and Anil's 50 % candidate collapse.
 */
export function dedupeByOverlap(moments: readonly ScoredMoment[], maxRatio = 0.4): ScoredMoment[] {
  const kept: ScoredMoment[] = [];
  for (const moment of moments) {
    if (kept.some((other) => overlapRatio(other, moment) > maxRatio)) continue;
    kept.push(moment);
  }
  return kept;
}

/** Keep the review set bounded: the measured composite decides what the model is asked about. */
export function selectForReview<T extends { candidate: Candidate; deterministic: Dimensions }>(
  inputs: readonly T[],
  limit: number,
): T[] {
  if (inputs.length <= limit) return [...inputs];
  const ranked = [...inputs].sort(
    (a, b) => composite(b.deterministic) - composite(a.deterministic) || a.candidate.startWord - b.candidate.startWord,
  );
  const chosen = new Set(ranked.slice(0, limit));
  return inputs.filter((input) => chosen.has(input));
}
