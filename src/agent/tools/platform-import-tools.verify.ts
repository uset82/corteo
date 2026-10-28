// P3-2: import_from_platform is a real browser-tier tool. It reads the route's
// NDJSON progress, reports it to the model, and adds one pool asset at the end.
// Run: npx tsx src/agent/tools/platform-import-tools.verify.ts
import assert from 'node:assert/strict';
import type { AgentContext } from '../context';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import { execPlatformImportTool } from './platform-import-tools';
import { PLATFORM_IMPORT_TOOL_NAMES, PLATFORM_IMPORT_TOOL_SCHEMAS } from './schemas/platform-import-tools';

assert.deepEqual([...PLATFORM_IMPORT_TOOL_NAMES], ['import_from_platform']);
const schema = PLATFORM_IMPORT_TOOL_SCHEMAS[0]!;
assert.equal(schema.name, 'import_from_platform');
assert.match(schema.description ?? '', /yt-dlp/);
assert.match(schema.description ?? '', /Real operation/);
assert.equal(isExternalRealTool('import_from_platform'), true);
assert.equal(isExternalReadTool('import_from_platform'), false);
assert.equal(isExternalDraftTool('import_from_platform'), false);
assert.equal(isExternalServerDirectTool('import_from_platform'), false);

const file = {
  name: 'clip.png', src: '/media/uploads/clip.png', storedName: 'clip.png', contentHash: 'ab'.repeat(32),
  kind: 'image', size: 128, sourceModifiedAt: Date.now(), width: 320, height: 180,
};
const body = [
  JSON.stringify({ type: 'progress', percent: 50 }),
  JSON.stringify({ type: 'progress', percent: 100 }),
  JSON.stringify({ type: 'done', file, title: 'Una canción', sourceUrl: 'https://youtu.be/abc', platform: 'youtu.be', uploader: 'Canal', license: 'CC-BY' }),
].join('\n') + '\n';
const added: unknown[] = [];
const notes: string[] = [];
const ctx = {
  getState: () => ({ fps: 30, assets: [] }),
  getDoc: () => ({ assets: [], timelines: [] }),
  commands: { addAsset: (asset: unknown) => added.push(asset) },
  onToolProgress: (note: string) => notes.push(note),
} as unknown as AgentContext;
const calls: Array<{ url: string; init: RequestInit }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}) as typeof fetch;
try {
  const result = await execPlatformImportTool('import_from_platform', { url: 'https://youtu.be/abc' }, ctx) as {
    ok?: boolean; asset?: { id: string; name: string; kind: string }; title?: string; uploader?: string; license?: string;
  };
  assert.equal(result.ok, true);
  assert.equal(result.asset?.name, 'clip.png');
  assert.equal(result.asset?.kind, 'image');
  assert.equal(result.title, 'Una canción');
  assert.equal(result.uploader, 'Canal');
  assert.equal(result.license, 'CC-BY');
  assert.equal(added.length, 1, 'one pool asset is added');
  assert.deepEqual((added[0] as { source?: unknown }).source, {
    title: 'Una canción', uploader: 'Canal', pageUrl: 'https://youtu.be/abc', license: 'CC-BY',
  }, 'platform attribution is stored on the asset');
  assert.deepEqual(notes, ['Descargando de la plataforma… 50%', 'Descargando de la plataforma… 100%']);
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(calls.length, 1);
assert.equal(calls[0]!.url, '/api/import-platform');
const sent = JSON.parse(String(calls[0]!.init.body));
assert.equal(sent.url, 'https://youtu.be/abc');
assert.deepEqual(sent.knownHashes, []);

assert.deepEqual(await execPlatformImportTool('other', {}, ctx), { error: 'unknown tool other' });
assert.match((await execPlatformImportTool('import_from_platform', {}, ctx) as { error?: string }).error ?? '', /url is required/);
console.log('platform-import-tools.verify: NDJSON progress and pool asset import OK');
