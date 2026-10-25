import { joinWords } from './candidates';
import { modelVerdicts } from './rubric';
import { blendScores, composite } from './score';
import { corpusStats, deterministicScores } from './signals';
import { GENRES, type Candidate, type Dimensions, type Genre, type ModelVerdict, type WordLike } from './types';

/**
 * Score already-chosen word ranges with the same engine `score_moments` uses.
 *
 * This is the bridge between selection and ranking: `find_highlights` (and later
 * `make_shorts`) pick spans first, then want a number, a reason and a risk list for each.
 * No gates here: choosing which spans to keep is the caller's decision, and a caller that
 * asked for three very short cuts should not silently get two because a gate disliked them.
 */

export interface RangeInput {
  startWord: number;
  endWord: number;
}

export interface RangeScore {
  /** Position in the input list, so callers can zip scores back onto their own results. */
  index: number;
  startWord: number;
  endWord: number;
  startMs: number;
  endMs: number;
  score: number;
  subscores: Dimensions;
  title: string;
  reason: string;
  risks: string[];
}

export interface ScoreRangesOptions {
  genre?: Genre;
  direction?: string;
  topic?: string;
  /** false skips the model and returns the measured score alone. */
  useModel?: boolean;
}

export function readGenre(value: unknown): Genre {
  const hit = typeof value === 'string' ? GENRES.find((g) => g === value) : undefined;
  return hit ?? 'auto';
}

export async function scoreRanges(
  words: readonly WordLike[],
  ranges: readonly RangeInput[],
  opts: ScoreRangesOptions = {},
): Promise<{ scores: RangeScore[]; modelUsed: boolean }> {
  if (!words.length || !ranges.length) return { scores: [], modelUsed: false };
  const last = words.length - 1;
  const candidates: Candidate[] = ranges.map((range, index) => {
    const startWord = Math.max(0, Math.min(last, Math.trunc(range.startWord)));
    const endWord = Math.max(startWord, Math.min(last, Math.trunc(range.endWord)));
    return {
      startWord,
      endWord,
      startMs: words[startWord].start,
      endMs: words[endWord].end,
      text: joinWords(words, startWord, endWord),
      chapter: index,
    };
  });

  const stats = corpusStats(words);
  const measured = candidates.map((candidate) => deterministicScores(words, candidate, stats));
  let verdicts = new Map<number, ModelVerdict>();
  let modelUsed = false;
  if (opts.useModel !== false) {
    const result = await modelVerdicts(candidates, {
      genre: opts.genre ?? 'auto',
      direction: opts.direction,
      topic: opts.topic,
    });
    verdicts = result.verdicts;
    modelUsed = verdicts.size > 0;
  }

  const scores = candidates.map((candidate, index) => {
    const verdict = verdicts.get(index) ?? null;
    const subscores = blendScores(measured[index], verdict);
    return {
      index,
      startWord: candidate.startWord,
      endWord: candidate.endWord,
      startMs: candidate.startMs,
      endMs: candidate.endMs,
      score: composite(subscores),
      subscores,
      title: verdict?.title ?? '',
      reason: verdict?.reason ?? '',
      risks: verdict?.risks ?? [],
    };
  });
  return { scores, modelUsed };
}
