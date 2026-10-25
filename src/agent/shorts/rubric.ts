import { generateAgentText } from '../client';
import type { Candidate, Genre, ModelVerdict } from './types';
import { GENRES } from './types';

/**
 * The model half of the rubric.
 *
 * The model is asked for the three judgements a DSP cannot make (hook, flow, value) and
 * nothing else: it never sees or sets the price of delivery (`sound` is measured), and it
 * never decides the ranking on its own (it is 40 % of the blend). Word indices, not
 * timestamps, are the contract, so a model that drifts by a second cannot invent a cut.
 */

export interface RubricOptions {
  genre: Genre;
  /** Free-text steering: what the user asked for, in their words. It outranks defaults. */
  direction?: string;
  topic?: string;
}

export type RubricScorer = (candidates: readonly Candidate[], opts: RubricOptions) => Promise<unknown>;

/** Candidates per model call, and the text ceiling per candidate. */
const MAX_PER_CALL = 10;
const MAX_TEXT_CHARS = 1200;

export const RUBRIC_SYSTEM = `You score candidate moments cut from one long video, so an editor can pick which ones to post as short vertical clips.

Step 1 - classify the content once: podcast, interview, tutorial, vlog or livestream.
Step 2 - score every candidate 0-100 on three dimensions:
- hook: do the first three seconds make someone stop scrolling? A question, a claim, a number, a turn, or an opening mid-action. Filler openings score low.
- flow: does it stand alone? Setup, turn, payoff, and a clean ending. An opening that needs the previous minute, or an ending that trails off on a connector, scores low.
- value: is something actually being said? Concrete numbers, named things, a quotable line, a real lesson. Small talk and empty filler score low.
Judge only the words given. Never guess what the rest of the video says, and never reward length by itself.

Rules:
- One entry per candidate, keyed by the start and end word indices you were given. Never invent indices.
- title: at most six words, in Spanish, the way a person would label the clip.
- reason: one sentence in Spanish saying why it works or what it lacks.
- risks: up to three short Spanish warnings (needs setup, cuts mid-claim, weak payoff). Use [] when none.
- Output strict JSON only, no prose and no Markdown fence:
{"genre":"podcast","moments":[{"start":0,"end":0,"hook":0,"flow":0,"value":0,"title":"...","reason":"...","risks":[]}]}`;

function buildUserPrompt(candidates: readonly Candidate[], opts: RubricOptions): string {
  const lines = candidates.map((c, i) => {
    const seconds = ((c.endMs - c.startMs) / 1000).toFixed(1);
    return `${i + 1}. [${c.startWord}-${c.endWord}] (${seconds}s) ${c.text.slice(0, MAX_TEXT_CHARS)}`;
  });
  const steer: string[] = [];
  if (opts.genre !== 'auto') steer.push(`Content type: ${opts.genre}.`);
  if (opts.topic) steer.push(`Only moments about: ${opts.topic}.`);
  if (opts.direction) steer.push(`The user asked for: ${opts.direction}`);
  return `${steer.join('\n')}${steer.length ? '\n\n' : ''}Candidates:\n${lines.join('\n')}\n\nScore all ${candidates.length} candidates. JSON only.`;
}

async function llmScore(candidates: readonly Candidate[], opts: RubricOptions): Promise<unknown> {
  const text = await generateAgentText({
    maxOutputTokens: 2048,
    system: RUBRIC_SYSTEM,
    prompt: buildUserPrompt(candidates, opts),
  });
  return parseRubricJson(text);
}

let scorer: RubricScorer = llmScore;

/** Tests inject a stub here; pass null to restore the real model path. */
export function setRubricScorer(fn: RubricScorer | null): void {
  scorer = fn ?? llmScore;
}

/** Extract the JSON object from a model reply that may be wrapped in a fence or prose. */
export function parseRubricJson(text: string): unknown {
  const cleaned = text.replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('model reply had no JSON object');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const clampScore = (n: unknown): number => {
  const value = Number(n);
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const asText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function readRisks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .slice(0, 3)
    .map((r) => r.trim().slice(0, 120));
}

/**
 * Map the model reply onto the candidates it was given. A verdict that does not match a
 * candidate's own word indices is dropped: the model may not move a cut.
 */
export function verdictsFromReply(
  raw: unknown,
  candidates: readonly Candidate[],
): Map<number, ModelVerdict> {
  const out = new Map<number, ModelVerdict>();
  if (!raw || typeof raw !== 'object') return out;
  const moments = (raw as { moments?: unknown }).moments;
  if (!Array.isArray(moments)) return out;
  for (const entry of moments) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    const index = candidates.findIndex((c) => c.startWord === start && c.endWord === end);
    if (index < 0) continue;
    out.set(index, {
      hook: clampScore(o.hook),
      flow: clampScore(o.flow),
      value: clampScore(o.value),
      title: asText(o.title, 60),
      reason: asText(o.reason, 240),
      risks: readRisks(o.risks),
    });
  }
  return out;
}

/** Read the genre the model classified, if it is one we know. */
export function genreFromReply(raw: unknown): Genre | null {
  const value = (raw as { genre?: unknown } | null)?.genre;
  if (typeof value !== 'string') return null;
  const hit = GENRES.find((g) => g === value.trim().toLowerCase());
  return hit && hit !== 'auto' ? hit : null;
}

/**
 * Score every candidate through the model, in bounded batches. A batch that fails is
 * skipped, not fatal: those candidates keep their deterministic score.
 */
export async function modelVerdicts(
  candidates: readonly Candidate[],
  opts: RubricOptions,
): Promise<{ verdicts: Map<number, ModelVerdict>; genre: Genre | null; failedBatches: number }> {
  const verdicts = new Map<number, ModelVerdict>();
  let genre: Genre | null = null;
  let failedBatches = 0;
  for (let offset = 0; offset < candidates.length; offset += MAX_PER_CALL) {
    const batch = candidates.slice(offset, offset + MAX_PER_CALL);
    try {
      const raw = await scorer(batch, opts);
      const found = verdictsFromReply(raw, batch);
      for (const [index, verdict] of found) verdicts.set(offset + index, verdict);
      genre = genre ?? genreFromReply(raw);
    } catch {
      failedBatches += 1;
    }
  }
  return { verdicts, genre, failedBatches };
}
