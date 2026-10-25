import { generateAgentText } from '../client';

/**
 * Auto headline (Plan 5, OP-09): the one line that sits above a short.
 *
 * OpusClip caps headline generation at the top ten clips for cost reasons; the same instinct
 * here is that a headline is a *choice*, not a summary — it should be the line that makes
 * someone stop, which is almost never the first sentence and never a restatement of the
 * topic. The model proposes it; the fallback still produces something postable.
 */

export const HEADLINE_MAX_WORDS = 6;
export const HEADLINE_MAX_CHARS = 60;

export const HEADLINE_SYSTEM = `You write the one-line headline that sits at the top of a vertical short.

Rules:
- At most six words. Shorter is better.
- It must be a hook a person would stop scrolling for, not a summary of the topic and not clickbait the clip does not deliver.
- Prefer the speaker's own strongest phrase when it fits; otherwise compress it.
- No quotes, no ellipsis, no emoji, no hashtags, no ending period.
- Write in the language of the transcript.
- Output only the headline text, nothing else.`;

export type HeadlineScorer = (text: string) => Promise<string>;

async function llmHeadline(text: string): Promise<string> {
  const reply = await generateAgentText({
    maxOutputTokens: 64,
    system: HEADLINE_SYSTEM,
    prompt: `Transcript of the clip:\n${text.slice(0, 3000)}\n\nHeadline:`,
  });
  return reply;
}

let scorer: HeadlineScorer = llmHeadline;

/** Tests inject a stub here; null restores the real model path. */
export function setHeadlineScorer(fn: HeadlineScorer | null): void {
  scorer = fn ?? llmHeadline;
}

/** Trim a candidate to the limits without splitting a word. */
export function clampHeadline(raw: string, maxWords = HEADLINE_MAX_WORDS, maxChars = HEADLINE_MAX_CHARS): string {
  const clean = raw
    .replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
    .replace(/[.!?…]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  const words = clean.split(' ');
  const byWords = words.slice(0, Math.max(1, maxWords)).join(' ');
  if (byWords.length <= maxChars) return byWords;
  const cut = byWords.slice(0, maxChars);
  const space = cut.lastIndexOf(' ');
  return (space > maxChars * 0.5 ? cut.slice(0, space) : cut).trim();
}

/**
 * No model: the opening sentence, clamped. It is not clever, but it is the speaker's own
 * words and it beats an empty headline block.
 */
export function fallbackHeadline(text: string, maxWords = HEADLINE_MAX_WORDS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const first = clean.split(/(?<=[.!?])\s+/)[0] ?? clean;
  return clampHeadline(first, maxWords);
}

/** Model first, clamped; on failure or an empty reply, the fallback. */
export async function generateHeadline(
  text: string,
  opts: { maxWords?: number } = {},
): Promise<{ headline: string; modelUsed: boolean }> {
  const maxWords = Math.max(2, Math.min(10, opts.maxWords ?? HEADLINE_MAX_WORDS));
  try {
    const raw = await scorer(text);
    const headline = clampHeadline(raw, maxWords);
    if (headline) return { headline, modelUsed: true };
  } catch {
    // fall through to the deterministic line
  }
  return { headline: fallbackHeadline(text, maxWords), modelUsed: false };
}
