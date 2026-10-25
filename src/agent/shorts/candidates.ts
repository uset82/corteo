import { isSentenceEnd } from './chapters';
import type { Candidate, Chapter, WordLike } from './types';

/**
 * Candidate windows inside a chapter, snapped to sentence ends.
 *
 * A candidate never ends mid-sentence when a sentence end exists inside the duration
 * budget, and a candidate is never truncated just to hit the target length: the budget
 * decides which sentence end to take, not how much of a sentence to keep.
 */
export interface CandidateOptions {
  minMs: number;
  maxMs: number;
}

/** Join transcript words for the model, keeping Spanish punctuation attached. */
export function joinWords(words: readonly WordLike[], from: number, to: number): string {
  const parts: string[] = [];
  for (let i = from; i <= to && i < words.length; i += 1) parts.push(words[i].text.trim());
  return parts.join(' ').replace(/\s+([,.;:!?…»)])/g, '$1').replace(/([«(])\s+/g, '$1').trim();
}

export function buildCandidates(
  words: readonly WordLike[],
  chapters: readonly Chapter[],
  opts: CandidateOptions,
): Candidate[] {
  const minMs = Math.max(1000, opts.minMs);
  const maxMs = Math.max(minMs, opts.maxMs);
  const out: Candidate[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    let i = chapter.startWord;
    while (i <= chapter.endWord) {
      const startMs = words[i].start;
      // Extend until the budget floor is reached, so a candidate is never too short.
      let j = i;
      while (j < chapter.endWord && words[j].end - startMs < minMs) j += 1;

      // Then take the last fitting word, preferring the first sentence end inside the ceiling.
      let end = j;
      let snapped = false;
      for (let k = j; k <= chapter.endWord; k += 1) {
        if (words[k].end - startMs > maxMs) break;
        end = k;
        if (isSentenceEnd(words[k].text)) {
          snapped = true;
          break;
        }
      }

      const endMs = words[end].end;
      const durationMs = endMs - startMs;
      if (durationMs >= minMs * 0.8) {
        out.push({
          startWord: i,
          endWord: end,
          startMs,
          endMs,
          text: joinWords(words, i, end),
          chapter: chapterIndex,
        });
      }
      if (end >= chapter.endWord) break;
      // A truncated (unsnapped) window advances to the next word; a snapped one starts after it.
      i = snapped ? end + 1 : Math.max(end + 1, i + 1);
    }
  });

  return out;
}
