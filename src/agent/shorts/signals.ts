import type { Candidate, Dimensions, WordLike } from './types';

/**
 * Deterministic signals: what can be measured without a model.
 *
 * These are deliberately simple and explainable. They exist so the score still works with
 * providers off, and so a weak local model cannot decide the ranking on its own (it is
 * 40 % of the blend, never the whole of it).
 *
 * Spanish-first word lists; the editor's user is a Spanish speaker and most sources will be.
 */

const FILLERS = new Set([
  'eh', 'ehh', 'em', 'emm', 'mmm', 'mmmh', 'este', 'esto', 'bueno', 'pues', 'digamos', 'tipo',
  'osea', 'aja', 'ajá', 'vale', 'okay', 'ok',
]);
const FILLER_PHRASES = ['o sea', 'es que', 'como que', '¿no?', '¿verdad?', 'po'];
const HOOK_MARKERS = [
  'nadie', 'nunca', 'siempre', 'todo', 'nada', 'verdad', 'mentira', 'error', 'secreto',
  'clave', 'imagina', 'mira', 'escucha', 'atención', 'problema', 'porque', 'pero',
];
const QUESTION_WORDS = ['que', 'qué', 'como', 'cómo', 'porque', 'porqué', 'cuando', 'cuándo', 'quien', 'quién', 'donde', 'dónde', 'cuanto', 'cuánto'];
const TRAILING_CONNECTORS = ['y', 'pero', 'porque', 'entonces', 'aunque', 'mientras', 'o', 'que', 'como', 'si'];
const LAUGHTER = ['jaja', 'jajaja', 'jeje', 'risas', 'risa', 'jajajaja'];

/** Lowercase and strip punctuation, keeping letters and digits (Unicode aware). */
export function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}¿¡]/gu, '');
}

export interface CorpusStats {
  /** Mean words per second across the whole transcript. */
  wordsPerSecond: number;
  totalWords: number;
}

export function corpusStats(words: readonly WordLike[]): CorpusStats {
  if (!words.length) return { wordsPerSecond: 0, totalWords: 0 };
  const spanMs = Math.max(1, words[words.length - 1].end - words[0].start);
  return { wordsPerSecond: words.length / (spanMs / 1000), totalWords: words.length };
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

interface Window {
  from: number;
  to: number;
}

function windowOf(words: readonly WordLike[], cand: Candidate, untilMs: number): Window {
  let to = cand.startWord;
  for (let i = cand.startWord; i <= cand.endWord; i += 1) {
    if (words[i].start - cand.startMs > untilMs) break;
    to = i;
  }
  return { from: cand.startWord, to };
}

function tokensIn(words: readonly WordLike[], from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i <= to && i < words.length; i += 1) out.push(normalizeToken(words[i].text));
  return out;
}

function countMarkers(tokens: readonly string[], markers: readonly string[]): number {
  return tokens.filter((t) => markers.includes(t)).length;
}

/** Hook: the first three seconds decide whether anyone watches the rest. */
function scoreHook(words: readonly WordLike[], cand: Candidate): number {
  const first = windowOf(words, cand, 3000);
  const tokens = tokensIn(words, first.from, first.to);
  const rawText = words.slice(first.from, first.to + 1).map((w) => w.text).join(' ');
  let score = 40;
  if (countMarkers(tokens, QUESTION_WORDS) > 0 || rawText.includes('¿')) score += 15;
  if (/\d/.test(rawText)) score += 10;
  if (countMarkers(tokens, HOOK_MARKERS) > 0) score += 12;
  if (/[!]/.test(rawText)) score += 6;
  const opener = tokens[0] ?? '';
  if (FILLERS.has(opener) || FILLER_PHRASES.includes(opener)) score -= 15;
  if (cand.endMs - cand.startMs < 6000) score -= 8;
  return clamp(score);
}

/** Flow: setup, turn, payoff, clean ending. A clip that ends on a connector feels cut. */
function scoreFlow(words: readonly WordLike[], cand: Candidate, stats: CorpusStats): number {
  const tokens = tokensIn(words, cand.startWord, cand.endWord);
  const durationSec = Math.max(1, (cand.endMs - cand.startMs) / 1000);
  const wps = tokens.length / durationSec;
  let score = 50;
  if (isTerminal(words[cand.endWord].text)) score += 15;
  else score -= 10;
  const tail = tokens[tokens.length - 1] ?? '';
  if (TRAILING_CONNECTORS.includes(tail)) score -= 12;
  const fillerCount = tokens.filter((t) => FILLERS.has(t)).length;
  const fillerRatio = fillerCount / Math.max(1, tokens.length);
  if (fillerRatio > 0.02) score -= Math.min(25, (fillerRatio - 0.02) * 400);
  if (hasRepeatedBigram(tokens)) score -= 10;
  const mean = stats.wordsPerSecond || wps;
  if (wps >= mean * 0.75 && wps <= mean * 1.45) score += 10;
  else if (wps < mean * 0.5 || wps > mean * 1.9) score -= 10;
  return clamp(score);
}

function isTerminal(text: string): boolean {
  return /[.!?…]["'”’»)]?$/.test(text.trim());
}

/** A false start repeats two adjacent tokens ("yo yo creo"). */
function hasRepeatedBigram(tokens: readonly string[]): boolean {
  for (let i = 1; i < tokens.length; i += 1) {
    if (tokens[i] && tokens[i] === tokens[i - 1] && tokens[i].length > 1) return true;
  }
  return false;
}

/** Value: is something actually being said. */
function scoreValue(words: readonly WordLike[], cand: Candidate): number {
  const tokens = tokensIn(words, cand.startWord, cand.endWord);
  const raw = words.slice(cand.startWord, cand.endWord + 1);
  let score = 40;
  const numbers = (cand.text.match(/\d/g) ?? []).length;
  if (numbers) score += Math.min(16, numbers * 4);
  const properNouns = raw.filter((w, i) => i > 0 && /^\p{Lu}/u.test(w.text.trim())).length;
  if (properNouns) score += Math.min(12, properNouns * 3);
  score += Math.min(12, countMarkers(tokens, HOOK_MARKERS) * 3);
  if (countMarkers(tokens, ['yo', 'mi', 'creo', 'pienso', 'siento']) > 0) score += 5;
  const durationSec = (cand.endMs - cand.startMs) / 1000;
  if (durationSec > 90) score -= 10;
  if (tokens.length < 12) score -= 15;
  return clamp(score);
}

/** Sound: how it is delivered, independent of what is said. */
function scoreSound(words: readonly WordLike[], cand: Candidate, stats: CorpusStats): number {
  const tokens = tokensIn(words, cand.startWord, cand.endWord);
  const durationMs = Math.max(1, cand.endMs - cand.startMs);
  const wps = tokens.length / (durationMs / 1000);
  let score = 50;
  const mean = stats.wordsPerSecond || wps;
  const ratio = wps / Math.max(0.01, mean);
  if (ratio >= 0.9 && ratio <= 1.35) score += 20;
  else if (ratio >= 0.7 && ratio <= 1.6) score += 8;
  else score -= 12;
  if (/[!]/.test(cand.text)) score += 8;
  if (countMarkers(tokens, LAUGHTER) > 0) score += 12;
  let deadMs = 0;
  for (let i = cand.startWord + 1; i <= cand.endWord; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 600) deadMs += gap;
  }
  if (deadMs / durationMs > 0.3) score -= 15;
  return clamp(score);
}

export function deterministicScores(
  words: readonly WordLike[],
  cand: Candidate,
  stats: CorpusStats,
): Dimensions {
  return {
    hook: scoreHook(words, cand),
    flow: scoreFlow(words, cand, stats),
    value: scoreValue(words, cand),
    sound: scoreSound(words, cand, stats),
  };
}
