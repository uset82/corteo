import type { TranscriptWord } from '../transcript/types';

/**
 * Which words deserve emphasis (Plan 5, OP-08).
 *
 * The judgement is deliberately narrow: numbers, names and shouted words. Everything else —
 * every adjective, every "importante" — is what makes a short look like a carousel of yellow
 * text. OpusClip's AI Emojis/Keywords leans on a model; this leans on what is verifiable from
 * the transcript, and a model can be layered on later without changing the contract.
 */

export interface KeywordCandidate {
  index: number;
  word: string;
  reason: 'number' | 'name' | 'caps';
}

/** Words that look capitalised for grammar, not because they name something. */
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'y', 'o', 'pero', 'que',
  'en', 'con', 'por', 'para', 'sin', 'al', 'se', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'lo',
  'es', 'son', 'era', 'fue', 'hay', 'no', 'sí', 'si', 'ya', 'muy', 'más', 'menos', 'este',
  'esta', 'esto', 'estos', 'estas', 'como', 'cuando', 'donde', 'porque', 'the', 'a', 'an',
]);

const NUMBER = /\d/;

/** A token that starts uppercase and is not just a sentence-initial function word. */
function looksLikeName(raw: string): boolean {
  const clean = raw.replace(/^[¿¡"'«(]+/, '');
  if (!clean) return false;
  const first = clean[0];
  if (first !== first.toLocaleUpperCase() || first === first.toLocaleLowerCase()) return false;
  const lower = clean.toLocaleLowerCase().replace(/[^\p{L}]/gu, '');
  if (!lower || STOPWORDS.has(lower)) return false;
  // ALL-CAPS is a different signal, handled separately.
  return clean !== clean.toLocaleUpperCase();
}

function isShouted(raw: string): boolean {
  const letters = raw.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  return letters === letters.toLocaleUpperCase() && letters !== letters.toLocaleLowerCase();
}

/**
 * Candidate words, in reading order, capped. A candidate inside a one-word sentence is kept:
 * "¿Cuánto? 300." is exactly the kind of line this is for.
 */
export function keywordCandidates(
  words: readonly TranscriptWord[],
  max = 8,
): KeywordCandidate[] {
  const limit = Math.max(1, Math.min(50, max));
  const out: KeywordCandidate[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const raw = words[index].text?.trim() ?? '';
    if (!raw) continue;
    if (NUMBER.test(raw)) out.push({ index, word: raw, reason: 'number' });
    else if (isShouted(raw)) out.push({ index, word: raw, reason: 'caps' });
    else if (looksLikeName(raw)) out.push({ index, word: raw, reason: 'name' });
    if (out.length >= limit) break;
  }
  return out;
}

/** The override map those candidates imply, merged over whatever is already there. */
export function emphasisOverrides(
  existing: Record<string, unknown> | undefined,
  candidates: readonly KeywordCandidate[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  for (const candidate of candidates) {
    const current = next[candidate.index];
    next[candidate.index] = {
      ...(current && typeof current === 'object' ? current : {}),
      emphasis: true,
    };
  }
  return next;
}
