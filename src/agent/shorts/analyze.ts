import { buildCandidates } from './candidates';
import { segmentChapters } from './chapters';
import { modelVerdicts } from './rubric';
import { corpusStats, deterministicScores } from './signals';
import { dedupeByOverlap, rankMoments, selectForReview } from './score';
import type { CalibrationWeights } from './calibration';
import type { Genre, ModelVerdict, ScoredMoment, WordLike } from './types';

/**
 * The analysis half of the pipeline, shared by `score_moments` and `make_shorts`.
 *
 * One function so the two tools cannot disagree: `score_moments` prints what this returns,
 * `make_shorts` cuts what this returns. Chapters first, then sentence-aligned candidates,
 * measured signals, a bounded model pass, gates, ranking, dedupe.
 */

export interface AnalyzeOptions {
  minMs: number;
  maxMs: number;
  /** How many passing moments to keep. */
  count: number;
  /** Candidates sent to the model; bounded so a 2-hour source is not 40 model calls. */
  reviewLimit?: number;
  genre?: Genre;
  direction?: string;
  topic?: string;
  /** false skips the model: measured scores only, for a fast or offline run. */
  useModel?: boolean;
  /** Calibration multipliers from the approve/reject ledger; omitted means neutral. */
  weights?: Partial<CalibrationWeights>;
}

export interface AnalyzeResult {
  chapters: number;
  candidates: number;
  reviewed: number;
  /** Passing, deduped, capped at `count`, best first. */
  moments: ScoredMoment[];
  /** Passing after dedupe, before the `count` cap. */
  passing: number;
  rejected: ScoredMoment[];
  modelUsed: boolean;
  failedBatches: number;
  detectedGenre: Genre | null;
}

const DEFAULT_REVIEW_LIMIT = 24;
const MAX_REJECTS = 5;

export async function analyzeMoments(
  words: readonly WordLike[],
  opts: AnalyzeOptions,
): Promise<AnalyzeResult> {
  const stats = corpusStats(words);
  const chapters = segmentChapters(words);
  const candidates = buildCandidates(words, chapters, { minMs: opts.minMs, maxMs: opts.maxMs });
  if (!candidates.length) {
    return {
      chapters: chapters.length,
      candidates: 0,
      reviewed: 0,
      moments: [],
      passing: 0,
      rejected: [],
      modelUsed: false,
      failedBatches: 0,
      detectedGenre: null,
    };
  }

  const inputs = candidates.map((candidate) => ({
    candidate,
    deterministic: deterministicScores(words, candidate, stats),
  }));
  const review = selectForReview(inputs, opts.reviewLimit ?? DEFAULT_REVIEW_LIMIT);

  let verdicts = new Map<number, ModelVerdict>();
  let modelUsed = false;
  let failedBatches = 0;
  let detectedGenre: Genre | null = null;
  if (opts.useModel !== false) {
    const result = await modelVerdicts(
      review.map((r) => r.candidate),
      { genre: opts.genre ?? 'auto', direction: opts.direction, topic: opts.topic },
    );
    verdicts = result.verdicts;
    modelUsed = verdicts.size > 0;
    failedBatches = result.failedBatches;
    detectedGenre = result.genre;
  }

  const ranked = rankMoments(
    review.map((input, index) => ({
      candidate: input.candidate,
      deterministic: input.deterministic,
      verdict: verdicts.get(index) ?? null,
    })),
    { minMs: opts.minMs, maxMs: opts.maxMs },
    opts.weights,
  );

  const passing = dedupeByOverlap(ranked.filter((m) => m.gate === 'pass'));
  return {
    chapters: chapters.length,
    candidates: candidates.length,
    reviewed: review.length,
    moments: passing.slice(0, opts.count),
    passing: passing.length,
    rejected: ranked.filter((m) => m.gate === 'rejected').slice(0, MAX_REJECTS),
    modelUsed,
    failedBatches,
    detectedGenre,
  };
}
