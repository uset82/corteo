export { CATALOG_SEARCH_TOOL_SCHEMAS, CATALOG_SEARCH_TOOL_NAMES } from './schemas/catalog-search-tools';
import type { AgentContext } from '../context';
import { expandQuery, setQueryExpander } from '../search/queryExpansion';
import { execSearchTool } from './search-tools';

// search_catalog — Plan 6, OP-14.
//
// Composition, not a new index: the semantic step is the query expansion (free local model),
// and the retrieval is the FTS5 index `search_content` already maintains across every project.
// One phrase becomes several terms; each term is searched; hits are merged by (project, ref)
// and ranked by how many distinct terms they matched. The user's literal phrase is always one
// of the terms, so expansion can only add recall.

export { setQueryExpander };

type Args = Record<string, unknown>;

interface Hit {
  kind?: string;
  projectId?: string;
  ref?: string;
  score?: number;
  [key: string]: unknown;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;

function hitKey(hit: Hit): string {
  return `${hit.projectId ?? ''}::${hit.kind ?? ''}::${hit.ref ?? ''}`;
}

export async function execCatalogSearchTool(
  name: string,
  args: Args,
  _ctx: AgentContext,
): Promise<unknown> {
  if (name !== 'search_catalog') return { error: `unknown tool ${name}` };

  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) return { error: 'Falta la frase a buscar.' };

  const limit = Number.isInteger(args.limit)
    ? Math.max(1, Math.min(MAX_LIMIT, Number(args.limit)))
    : DEFAULT_LIMIT;
  const projectId = typeof args.projectId === 'string' && args.projectId.trim() ? args.projectId.trim() : undefined;

  const { terms, modelUsed } = await expandQuery(query);
  if (!terms.length) return { error: 'La frase quedó vacía al normalizarla.' };

  // One search per term. `search_content` is the existing cross-project index; this tool adds
  // the rewrite, not a second store.
  const perTerm = await Promise.all(terms.map(async (term) => {
    const result = await execSearchTool('search_content', {
      query: term,
      limit: 20,
      ...(projectId ? { projectId } : {}),
    }) as { hits?: Hit[]; error?: string };
    return { term, hits: Array.isArray(result.hits) ? result.hits : [] };
  }));

  const merged = new Map<string, { hit: Hit; matched: string[]; score: number }>();
  for (const { term, hits } of perTerm) {
    for (const hit of hits) {
      const key = hitKey(hit);
      const existing = merged.get(key);
      if (existing) {
        if (!existing.matched.includes(term)) existing.matched.push(term);
        continue;
      }
      merged.set(key, { hit, matched: [term], score: Number(hit.score) || 0 });
    }
  }

  const ranked = [...merged.values()]
    .sort((a, b) => b.matched.length - a.matched.length || b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({ ...entry.hit, matchedTerms: entry.matched, matchedCount: entry.matched.length }));

  return {
    ok: true,
    query,
    terms,
    modelUsed,
    count: ranked.length,
    hits: ranked,
    note: ranked.length
      ? (modelUsed
        ? `La frase se buscó también como: ${terms.slice(1).join(', ')}.`
        : 'Sin modelo: se buscó la frase tal cual.')
      : 'No apareció nada con esa frase ni con sus términos equivalentes.',
  };
}
