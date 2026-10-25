import { generateAgentText } from '../client';

/**
 * Query expansion for `search_catalog` (Plan 6, OP-14).
 *
 * The repo has no text-embedding model, and adding one is a dependency the plan does not name.
 * It does have a free local model (DeepSeek Harness / Ollama), and it already has an FTS5 index
 * over every project's chats, captions and transcripts. So the semantic step happens *before*
 * the index: the model rewrites what the user meant into the words an editor would have
 * written down. "donde explico el estribillo" becomes estribillo, coro, cantar, letra, hook.
 *
 * It is honest about its limits: this improves recall on vocabulary mismatch, it does not
 * understand a scene. The alternative — image similarity — needs no model but answers a
 * different question, and the card records that choice.
 */

export const MAX_TERMS = 6;

export const EXPAND_SYSTEM = `You turn a person's search phrase into the words an editor would have written in their own project.

Given a phrase, return 2 to 6 short search terms that would appear in transcripts, captions or chat messages about it:
- include the obvious synonyms and the words a speaker would actually say;
- include the English term when the phrase is Spanish and the material may be either;
- no phrases longer than three words, no explanations, no duplicates.

Output strict JSON only: {"terms":["...","..."]}`;

export type QueryExpander = (query: string) => Promise<unknown>;

async function llmExpand(query: string): Promise<unknown> {
  const text = await generateAgentText({
    maxOutputTokens: 200,
    system: EXPAND_SYSTEM,
    prompt: `Phrase: ${query}\n\nJSON only.`,
  });
  return parseExpansion(text);
}

let expander: QueryExpander = llmExpand;

/** Tests inject a stub here; null restores the real model path. */
export function setQueryExpander(fn: QueryExpander | null): void {
  expander = fn ?? llmExpand;
}

export function parseExpansion(text: string): unknown {
  const cleaned = text.replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('expander reply had no JSON object');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Trim, lower-case, drop empties and duplicates, cap length and count. */
export function normalizeTerms(raw: unknown, fallback: string): string[] {
  const list = Array.isArray((raw as { terms?: unknown } | null)?.terms)
    ? ((raw as { terms: unknown[] }).terms)
    : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [fallback, ...list]) {
    if (typeof item !== 'string') continue;
    const term = item.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

/**
 * Expand a phrase into search terms. The user's own words are always first and always
 * included, so the expansion can only add recall — it can never make the search miss what the
 * user literally typed.
 */
export async function expandQuery(query: string): Promise<{ terms: string[]; modelUsed: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { terms: [], modelUsed: false };
  try {
    const raw = await expander(trimmed);
    const terms = normalizeTerms(raw, trimmed);
    return { terms, modelUsed: terms.length > 1 };
  } catch {
    return { terms: normalizeTerms(null, trimmed), modelUsed: false };
  }
}
