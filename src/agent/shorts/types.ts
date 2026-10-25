/** Shared shapes for the Opus-parity shorts pipeline (Plan 5, OP-01). */

/** A transcript word as the scoring code needs it; TranscriptWord is structurally compatible. */
export interface WordLike {
  text: string;
  start: number; // ms
  end: number; // ms
}

export type Genre = 'auto' | 'podcast' | 'interview' | 'tutorial' | 'vlog' | 'livestream';

export const GENRES: readonly Genre[] = ['auto', 'podcast', 'interview', 'tutorial', 'vlog', 'livestream'];

/**
 * The four public dimensions of the score.
 *
 * OpusClip shows Hook/Flow/Value/Trend. Trend is deliberately absent here: it needs
 * platform trend data, which this editor does not have, and a fabricated dimension would
 * be the one lie a test cannot catch. `sound` replaces it and is measured, not predicted.
 */
export interface Dimensions {
  /** First three seconds: does it make you stay? */
  hook: number;
  /** Does it stand alone: setup, turn, payoff, clean ending. */
  flow: number;
  /** Is something actually being said: numbers, claims, names, quotable lines. */
  value: number;
  /** Delivery energy: pace, exclamations, laughter, dead air. */
  sound: number;
}

export const DIMENSIONS = ['hook', 'flow', 'value', 'sound'] as const;
export type DimensionKey = (typeof DIMENSIONS)[number];

/** A speech paragraph on the source timeline, in inclusive word indices. */
export interface Chapter {
  startWord: number;
  endWord: number;
  startMs: number;
  endMs: number;
}

/** A window that could become one clip. Word indices are inclusive. */
export interface Candidate {
  startWord: number;
  endWord: number;
  startMs: number;
  endMs: number;
  /** Words joined for the model and for the reason line. */
  text: string;
  chapter: number;
}

/** What the model adds: the three judgements a DSP cannot make. */
export interface ModelVerdict {
  hook: number;
  flow: number;
  value: number;
  title: string;
  reason: string;
  risks: string[];
}

export interface ScoredMoment extends Candidate {
  /** 0-99, the number both the UI and the agent read. */
  score: number;
  subscores: Dimensions;
  gate: 'pass' | 'rejected';
  gateReasons: string[];
  model: ModelVerdict | null;
  deterministic: Dimensions;
}
