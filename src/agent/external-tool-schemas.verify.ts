import assert from 'node:assert/strict';
import { externalToolSchemas, PROVIDERS_OFF_HIDDEN_TOOLS } from './external-tool-schemas.ts';

const previous = process.env.OPENCHATCUT_PROVIDERS;
try {
  delete process.env.OPENCHATCUT_PROVIDERS;
  const open = externalToolSchemas().map((tool) => tool.name);
  assert.ok(open.includes('search_stock_media'));
  assert.ok(open.includes('submit_image'));
  assert.ok(open.includes('read_timeline') || open.includes('edit_item') || open.length > 20);

  process.env.OPENCHATCUT_PROVIDERS = 'off';
  const closed = new Set(externalToolSchemas().map((tool) => tool.name));
  for (const name of PROVIDERS_OFF_HIDDEN_TOOLS) {
    if (open.includes(name)) assert.equal(closed.has(name), false, `${name} leaves the MCP catalog`);
  }
  assert.equal(closed.has('search_stock_media'), false);
  assert.equal(closed.has('submit_image'), false);
  assert.ok(closed.size > 0, 'editing tools stay listed');
  assert.ok([...closed].some((name) => !PROVIDERS_OFF_HIDDEN_TOOLS.has(name)));
} finally {
  if (previous === undefined) delete process.env.OPENCHATCUT_PROVIDERS;
  else process.env.OPENCHATCUT_PROVIDERS = previous;
}

console.log('external-tool-schemas.verify: generation and stock leave MCP when providers are off');
