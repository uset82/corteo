// Runnable contract check for search_catalog (Plan 6, OP-14).
//
// Two halves, both stubbed: the phrase expansion and the FTS route. What is asserted is the
// join — the literal phrase is always searched, hits from several terms merge instead of
// duplicating, ranking follows how many terms matched, and a dead model degrades to the
// literal phrase instead of returning nothing.
import assert from 'node:assert';
import { execCatalogSearchTool, setQueryExpander } from './catalog-search-tools';
import { expandQuery, normalizeTerms } from '../search/queryExpansion';
import type { AgentContext } from '../context';

const ctx = {} as AgentContext;

// ── 1) Term normalisation: the phrase is first, duplicates and junk go ──────────────
assert.deepStrictEqual(
  normalizeTerms({ terms: ['coro', 'Coro', '  estribillo  ', '', 42, 'hook'] }, 'estribillo'),
  ['estribillo', 'coro', 'hook'],
  'the phrase is first, duplicates collapse, junk is dropped',
);
assert.deepStrictEqual(normalizeTerms(null, 'solo frase'), ['solo frase'], 'no model still yields the phrase');
assert.strictEqual(normalizeTerms({ terms: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 'x').length, 6, 'the cap holds');

// ── 2) A dead model degrades to the literal phrase ──────────────────────────────────
setQueryExpander(async () => { throw new Error('offline'); });
{
  const outcome = await expandQuery('donde explico el estribillo');
  assert.deepStrictEqual(outcome.terms, ['donde explico el estribillo'], 'the literal phrase survives');
  assert.strictEqual(outcome.modelUsed, false);
}

// ── 3) The join: several terms, merged hits, ranking by how many matched ───────────
const hitsFor: Record<string, Array<{ kind: string; projectId: string; ref: string; score: number }>> = {
  'donde explico el estribillo': [{ kind: 'transcript', projectId: 'p1', ref: 'w1', score: 9 }],
  coro: [
    { kind: 'transcript', projectId: 'p1', ref: 'w1', score: 7 },
    { kind: 'caption', projectId: 'p2', ref: 'c9', score: 8 },
  ],
  estribillo: [{ kind: 'transcript', projectId: 'p1', ref: 'w1', score: 6 }],
};
let calls = 0;
globalThis.fetch = (async (url: string) => {
  calls += 1;
  // search_content is a GET with ?q=..., not a POST body: the stub has to read the URL.
  const query = new URL(String(url), 'http://local').searchParams.get('q') ?? '';
  return {
    ok: true,
    status: 200,
    json: async () => ({ hits: hitsFor[query] ?? [] }),
  } as Response;
}) as typeof fetch;

setQueryExpander(async () => ({ terms: ['coro', 'estribillo'] }));
{
  const result = await execCatalogSearchTool('search_catalog', { query: 'donde explico el estribillo' }, ctx) as {
    ok: boolean; terms: string[]; modelUsed: boolean; count: number;
    hits: Array<{ ref: string; matchedCount: number; matchedTerms: string[] }>; note?: string;
  };
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.modelUsed, true);
  assert.deepStrictEqual(result.terms, ['donde explico el estribillo', 'coro', 'estribillo'], 'the phrase is first');
  assert.strictEqual(calls, 3, 'one search per term, including the literal one');
  assert.strictEqual(result.count, 2, 'two distinct hits after merging');
  assert.strictEqual(result.hits[0].ref, 'w1', 'the hit matched by three terms ranks first');
  assert.strictEqual(result.hits[0].matchedCount, 3);
  assert.deepStrictEqual(result.hits[0].matchedTerms.sort(), ['coro', 'donde explico el estribillo', 'estribillo'].sort());
  assert.strictEqual(result.hits[1].ref, 'c9', 'the weaker hit is still returned');
  assert.ok(/coro|estribillo/.test(result.note ?? ''), 'the note says which terms were added');
}

// ── 4) Empty phrase and unknown tool ──────────────────────────────────────────────
{
  const empty = await execCatalogSearchTool('search_catalog', { query: '   ' }, ctx) as { error?: string };
  assert.ok(empty.error);
  const unknown = await execCatalogSearchTool('search_everything', {}, ctx) as { error?: string };
  assert.ok(unknown.error);
}

setQueryExpander(null);
console.log('catalog-search-tools.verify: ok');
