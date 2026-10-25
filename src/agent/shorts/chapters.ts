import type { Chapter, WordLike } from './types';

/**
 * Chapter segmentation: the video is cut into speech paragraphs before any moment is
 * scored. OpusClip attributes its coherence gains to exactly this step (segment into
 * chapters, then pick inside them), and it is cheaper than scoring flat sliding windows.
 *
 * Two deterministic boundaries, no model:
 * - a long pause always starts a new chapter;
 * - a sentence end plus a short pause starts one too.
 * Chapters shorter than `minChapterMs` merge into the previous one, so a stray "sí."
 * does not become its own chapter.
 */
export interface ChapterOptions {
  /** A pause at least this long always starts a new chapter. */
  gapMs?: number;
  /** A shorter pause also starts one when the previous word closes a sentence. */
  pauseMs?: number;
  /** Chapters shorter than this merge into the previous one. */
  minChapterMs?: number;
}

const TERMINAL = /[.!?…]["'”’»)]?$/;

/** True when the word ends a sentence (Spanish and English punctuation). */
export function isSentenceEnd(text: string): boolean {
  return TERMINAL.test(text.trim());
}

export function segmentChapters(words: readonly WordLike[], opts: ChapterOptions = {}): Chapter[] {
  if (!words.length) return [];
  const gapMs = opts.gapMs ?? 1500;
  const pauseMs = opts.pauseMs ?? 700;
  const minChapterMs = opts.minChapterMs ?? 8000;

  const make = (startWord: number, endWord: number): Chapter => ({
    startWord,
    endWord,
    startMs: words[startWord].start,
    endMs: words[endWord].end,
  });

  const raw: Chapter[] = [];
  let start = 0;
  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    const previousCloses = isSentenceEnd(words[i - 1].text);
    if (gap >= gapMs || (previousCloses && gap >= pauseMs)) {
      raw.push(make(start, i - 1));
      start = i;
    }
  }
  raw.push(make(start, words.length - 1));

  const merged: Chapter[] = [];
  for (const chapter of raw) {
    const previous = merged[merged.length - 1];
    if (previous && chapter.endMs - chapter.startMs < minChapterMs) {
      previous.endWord = chapter.endWord;
      previous.endMs = chapter.endMs;
      continue;
    }
    merged.push({ ...chapter });
  }
  return merged;
}
