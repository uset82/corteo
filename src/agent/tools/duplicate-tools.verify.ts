// P2-3: find_duplicate_media — read-only, server-direct, and the browser
// executor posts the project payload to the duplicate route.
// Run: npx tsx src/agent/tools/duplicate-tools.verify.ts
import assert from 'node:assert/strict';
import type { AgentContext } from '../context';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import { execDuplicateTool } from './duplicate-tools';
import { DUPLICATE_TOOL_NAMES, DUPLICATE_TOOL_SCHEMAS } from './schemas/duplicate-tools';

assert.deepEqual([...DUPLICATE_TOOL_NAMES], ['find_duplicate_media']);
const schema = DUPLICATE_TOOL_SCHEMAS[0]!;
assert.equal(schema.name, 'find_duplicate_media');
const description = schema.description ?? '';
assert.match(description, /Read-only/);
assert.match(description, /10%, 50% and 90%/);
const threshold = schema.input_schema.properties?.threshold as { minimum?: number; maximum?: number } | undefined;
assert.equal(threshold?.minimum, 0);
assert.equal(threshold?.maximum, 32);
assert.equal(isExternalReadTool('find_duplicate_media'), true);
assert.equal(isExternalServerDirectTool('find_duplicate_media'), true, 'headless MCP can run it with no editor tab');
assert.equal(isExternalDraftTool('find_duplicate_media'), true);
assert.equal(isExternalRealTool('find_duplicate_media'), false, 'finding duplicates is not a real-project operation');

const state = {
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items: [{
    id: 'item-1', track: 'V1', kind: 'video', name: 'clip 1', startFrame: 0,
    durationInFrames: 60, src: '/media/uploads/clip.mp4', sourceAssetId: 'asset-1', srcInFrame: 30,
  }],
};
const ctx = {
  getState: () => state,
  getDoc: () => ({
    assets: [{
      id: 'asset-1', name: 'clip.mp4', kind: 'video', src: '/media/uploads/clip.mp4',
      durationInFrames: 60, sourceContentHash: 'ab'.repeat(32),
    }],
  }),
} as unknown as AgentContext;

const calls: Array<{ url: string; init: RequestInit }> = [];
const originalFetch = globalThis.fetch;
const report = { ok: true, groups: [], reused: [], threshold: 8 };
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return { ok: true, status: 200, json: async () => report };
}) as typeof fetch;
try {
  const result = await execDuplicateTool('find_duplicate_media', { threshold: 8 }, ctx);
  assert.deepEqual(result, report);
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(calls.length, 1);
assert.equal(calls[0]!.url, '/api/media-duplicates');
const body = JSON.parse(String(calls[0]!.init.body));
assert.equal(body.fps, 30);
assert.equal(body.includeThumbnails, false);
assert.equal(body.threshold, 8);
assert.deepEqual(body.assets[0], {
  id: 'asset-1', name: 'clip.mp4', kind: 'video', src: '/media/uploads/clip.mp4',
  contentHash: 'ab'.repeat(32), durationSeconds: 2,
});
assert.deepEqual(body.items[0], {
  id: 'item-1', assetId: 'asset-1', name: 'clip 1', startFrame: 0, srcInFrame: 30, durationInFrames: 60,
});

assert.deepEqual(await execDuplicateTool('another_tool', {}, ctx), { error: 'unknown tool another_tool' });
console.log('duplicate-tools.verify: find_duplicate_media is read-only, server-direct, and posts the route payload OK');
