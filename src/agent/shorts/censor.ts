import { normalizeToken } from './signals';
import type { WordLike } from './types';

/**
 * Profanity detection for `censor_words`. Spanish-first, with the common Latin-American
 * variants, because the speaker this editor belongs to does not swear in English only.
 *
 * Detection is on normalized tokens (case and punctuation removed, accents kept) plus an
 * accent-free alias for every entry, so "cabrón" and "cabron" both match.
 */

const BASE: readonly string[] = [
  'mierda', 'mierdas', 'joder', 'jodido', 'jodida', 'jodete', 'puta', 'puto', 'putas', 'putos',
  'cabron', 'cabrona', 'cabrones', 'coño', 'coño', 'hostia', 'hostias', 'gilipollas', 'capullo',
  'capulla', 'pendejo', 'pendeja', 'verga', 'carajo', 'chinga', 'chingar', 'culero', 'culiao',
  'marica', 'maricon', 'zorra', 'perra', 'imbecil', 'estupido', 'estupida', 'idiota',
  'fuck', 'fucking', 'shit', 'bitch', 'asshole',
];

/** Accent-insensitive aliases, so the matcher does not depend on how the ASR punctuated it. */
const stripAccents = (word: string): string =>
  word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export interface CensorHit {
  index: number;
  word: string;
  startMs: number;
  endMs: number;
}

export function censorDictionary(extra: readonly string[] = []): Set<string> {
  const out = new Set<string>();
  for (const word of [...BASE, ...extra]) {
    const normalized = normalizeToken(word);
    if (!normalized) continue;
    out.add(normalized);
    out.add(stripAccents(normalized));
  }
  return out;
}

export function findCensorHits(words: readonly WordLike[], extra: readonly string[] = []): CensorHit[] {
  const dictionary = censorDictionary(extra);
  const hits: CensorHit[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const token = normalizeToken(words[index].text);
    if (!token) continue;
    if (dictionary.has(token) || dictionary.has(stripAccents(token))) {
      hits.push({
        index,
        word: words[index].text,
        startMs: words[index].start,
        endMs: words[index].end,
      });
    }
  }
  return hits;
}
