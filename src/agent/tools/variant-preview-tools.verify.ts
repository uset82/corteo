// P4-2: render_variant_previews is a real tool (it writes preview files) and
// the browser executor sends the exact project graph to the preview route.
// Run: npx tsx src/agent/tools/variant-preview-tools.verify.ts
import assert from 'node:assert/strict';
import type { AgentContext } from '../context';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import { execVariantPreviewTool } from './variant-preview-tools';
import { VARIANT_PREVIEW_TOOL_NAMES, VARIANT_PREVIEW_TOOL_SCHEMAS } from './schemas/variant-preview-tools';

assert.deepEqual([...VARIANT_PREVIEW_TOOL_NAMES], ['render_variant_previews']);
const schema = VARIANT_PREVIEW_TOOL_SCHEMAS[0]!;
assert.equal(schema.name, 'render_variant_previews');
assert.match(schema.description ?? '', /480p/);
assert.match(schema.description ?? '', /Real operation/);
assert.equal(isExternalRealTool('render_variant_previews'), true);
assert.equal(isExternalReadTool('render_variant_previews'), false);
assert.equal(isExternalDraftTool('render_variant_previews'), false);
assert.equal(isExternalServerDirectTool('render_variant_previews'), false, 'it renders in the server route, not in a headless draft');

const project = {
  activeTimelineId: 'tl_b',
  timelines: [
    { id: 'tl_a', name: 'A', variant: { groupId: 'vg_1', label: 'A', note: '', status: 'borrador' } },
    { id: 'tl_b', name: 'B', variant: { groupId: 'vg_1', label: 'B', note: '', status: 'borrador' } },
  ],
};
const ctx = { getDoc: () => project } as unknown as AgentContext;
const calls: Array<{ url: string; init: RequestInit }> = [];
const originalFetch = globalThis.fetch;
const manifest = { ok: true, groupId: 'vg_1', previews: [{ timelineId: 'tl_a', url: '/api/variant-previews/vg_1/tl_a.mp4' }] };
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return { ok: true, status: 200, json: async () => manifest };
}) as typeof fetch;
try {
  const result = await execVariantPreviewTool('render_variant_previews', { groupId: 'vg_1' }, ctx);
  assert.deepEqual(result, manifest);
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(calls.length, 1);
assert.equal(calls[0]!.url, '/api/variant-previews');
const body = JSON.parse(String(calls[0]!.init.body));
assert.equal(body.groupId, 'vg_1');
assert.deepEqual(body.project, project);
assert.equal(body.timelineId, undefined);
assert.deepEqual(await execVariantPreviewTool('other_tool', {}, ctx), { error: 'unknown tool other_tool' });

console.log('variant-preview-tools.verify: real 480p preview tool and route payload OK');
