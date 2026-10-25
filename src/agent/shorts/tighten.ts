import { normalizeToken } from './signals';
import type { WordLike } from './types';

/**
 * The review half of `tighten_speech`: what *would* be removed, computed from the
 * transcript alone so the user sees the list before anything is cut.
 *
 * The edit itself is delegated to `clean_script`, which already removes fillers and
 * compresses pauses as one undoable batch. This module exists so the operation can be
 * previewed, and so the filler vocabulary can be Spanish-first instead of whatever the
 * engine happens to carry.
 */

export const SPANISH_FILLERS: readonly string[] = [
  'eh', 'ehh', 'em', 'emm', 'mmm', 'mmmh', 'este', 'esto', 'bueno', 'pues', 'digamos',
  'tipo', 'ajá', 'aja', 'vale', 'okay', 'ok', 'mmm', 'ehh',
];

export const FILLER_PHRASES: readonly string[] = ['o sea', 'es que', 'you know', 'i mean'];

export interface FillerHit {
  index: number;
  word: string;
  atMs: number;
  reason: 'filler' | 'phrase' | 'repeated';
}

export interface PauseHit {
  afterWordIndex: number;
  gapMs: number;
}

export interface TightenPreview {
  fillers: FillerHit[];
  pauses: PauseHit[];
  /** Rough time recovered, in ms: filler durations plus the part of each pause over the cap. */
  savedMs: number;
  /** Hits past the reporting cap; the edit still covers them. */
  hidden: number;
}

export interface TightenOptions {
  /** Extra unigram fillers, matched case- and punctuation-insensitively. */
  extraFillers?: readonly string[];
  /** Pauses longer than this get compressed to it. */
  minPauseMs?: number;
  /** Report cap per list, so a 2-hour transcript cannot flood the model. */
  limit?: number;
}

const DEFAULT_MIN_PAUSE_MS = 400;
const DEFAULT_LIMIT = 40;

export function previewTighten(words: readonly WordLike[], opts: TightenOptions = {}): TightenPreview {
  const minPauseMs = Math.max(120, opts.minPauseMs ?? DEFAULT_MIN_PAUSE_MS);
  const limit = Math.max(1, opts.limit ?? DEFAULT_LIMIT);
  const fillers = new Set([...SPANISH_FILLERS, ...(opts.extraFillers ?? []).map(normalizeToken)]);
  const tokens = words.map((w) => normalizeToken(w.text));

  const hits: FillerHit[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < words.length; i += 1) {
    const token = tokens[i];
    if (!token || seen.has(i)) continue;
    if (fillers.has(token)) {
      hits.push({ index: i, word: words[i].text, atMs: words[i].start, reason: 'filler' });
      seen.add(i);
      continue;
    }
    // A false start repeats the same token twice ("yo yo creo").
    if (i > 0 && token.length > 1 && tokens[i - 1] === token) {
      hits.push({ index: i, word: words[i].text, atMs: words[i].start, reason: 'repeated' });
      seen.add(i);
      continue;
    }
    // Two-word fillers ("o sea", "es que") mark both words.
    if (i + 1 < words.length) {
      const pair = `${token} ${tokens[i + 1]}`;
      if (FILLER_PHRASES.includes(pair)) {
        hits.push({ index: i, word: words[i].text, atMs: words[i].start, reason: 'phrase' });
        seen.add(i);
      }
    }
  }

  const pauses: PauseHit[] = [];
  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > minPauseMs) pauses.push({ afterWordIndex: i - 1, gapMs: Math.round(gap) });
  }

  let savedMs = 0;
  for (const hit of hits) {
    const word = words[hit.index];
    savedMs += Math.max(0, word.end - word.start);
  }
  for (const pause of pauses) savedMs += Math.max(0, pause.gapMs - minPauseMs);

  return {
    fillers: hits.slice(0, limit),
    pauses: pauses.slice(0, limit),
    savedMs: Math.round(savedMs),
    hidden: Math.max(0, hits.length - limit) + Math.max(0, pauses.length - limit),
  };
}
