// P4-2: render_variant_previews submits one 480p render per version, each from
// its own frozen snapshot, and stays a real (approval) browser tool.
// Run: npx tsx src/export/variantPreviews.verify.ts
import assert from 'node:assert/strict';
import { makeDraft } from '../editor/store';
import { docFromTimeline } from '../persist/projectStore';
import type { ProjectDoc, TimelineVariant } from '../editor/types';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../agent/external-tool-policy';
import { EXPORT_TOOL_NAMES, execExportTool, __resetExportSessionJobs } from '../agent/tools/export-tools';
import { readRenderJobSnapshot } from './renderJobClient';
import { variantPreviewBody, variantPreviewName } from './variantPreviews';

const tag = (label: string): TimelineVariant => ({ groupId: 'g1', label, status: 'candidate' });

function project(): { doc: ProjectDoc; baseId: string; labels: string[] } {
  const draft = makeDraft(docFromTimeline({
    fps: 30,
    width: 1920,
    height: 1080,
    selectedId: null,
    items: [{ id: 'v', track: 'V1', kind: 'video', name: 'v', startFrame: 0, durationInFrames: 60, src: '/v.mp4' }],
  }));
  const baseId = draft.getDoc().activeTimelineId;
  draft.commands.duplicateTimeline(baseId, { name: 'ritmo', activate: false, variant: tag('A') });
  draft.commands.duplicateTimeline(baseId, { name: 'cierre', activate: false, variant: tag('B') });
  draft.commands.duplicateTimeline(baseId, { name: 'plain', activate: false });
  return { doc: draft.getDoc(), baseId, labels: ['A', 'B'] };
}

// ── schema, policy and helper ─────────────────────────────────────────────────────
assert.equal(EXPORT_TOOL_NAMES.has('render_variant_previews'), true, 'the export family owns the tool');
assert.equal(isExternalReadTool('render_variant_previews'), false);
assert.equal(isExternalDraftTool('render_variant_previews'), false, 'starting renders is not a draft edit');
assert.equal(isExternalRealTool('render_variant_previews'), true, 'it needs the one-shot approval like submit_render_job');
assert.equal(isExternalServerDirectTool('render_variant_previews'), false, 'renders run from the editor (or its export service)');

{
  const { doc } = project();
  const member = doc.timelines.find((timeline) => timeline.variant?.label === 'A')!;
  assert.equal(variantPreviewName(member), 'ritmo · A');
  const body = await variantPreviewBody(doc, member);
  assert.equal(body.timelineId, member.id);
  assert.equal(body.resolution, '480p');
  assert.equal(body.codec, 'h264');
  assert.equal(body.format, 'video');
  assert.equal(body.name, 'ritmo · A');
  assert.equal((body.project as ProjectDoc).activeTimelineId, member.id, 'the snapshot targets the version, not the active sequence');
  assert.equal(doc.activeTimelineId, doc.timelines[0]!.id, 'the live project is untouched');
}

// ── the tool submits one job per member and skips untagged copies ─────────────────
const originalFetch = globalThis.fetch;
const posts: Array<{ url: string; body: Record<string, unknown> }> = [];
globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const target = String(url);
  if (target === '/export/job' && init?.method === 'POST') {
    posts.push({ url: target, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    return Response.json({ renderId: `preview-${posts.length}` });
  }
  if (target.startsWith('/export/job/')) {
    return Response.json({ id: decodeURIComponent(target.slice('/export/job/'.length)), status: 'running', progress: 10, params: {} });
  }
  throw new Error(`unexpected fetch: ${target}`);
}) as typeof fetch;
try {
  __resetExportSessionJobs();
  const { doc } = project();
  const ctx = {
    commands: {} as never,
    getState: () => { throw new Error('previews must derive state from the frozen snapshot'); },
    getDoc: () => doc,
    getCreativeMode: () => null,
    templates: [],
    audio: [],
  } as never;
  const result = await execExportTool('render_variant_previews', {}, ctx) as {
    ok?: boolean; groupId?: string; error?: string; next?: string; skipped?: number;
    previews?: Array<{ timelineId: string; label: string; renderId: string }>;
  };
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.groupId, 'g1');
  assert.deepEqual(result.previews!.map((preview) => preview.label), ['A', 'B']);
  assert.deepEqual(result.previews!.map((preview) => preview.renderId), ['preview-1', 'preview-2']);
  assert.match(result.next ?? '', /track_export/);
  assert.equal(posts.length, 2, 'one POST per version');
  assert.deepEqual(posts.map((post) => post.url), ['/export/job', '/export/job']);
  assert.deepEqual(posts.map((post) => post.body.resolution), ['480p', '480p']);
  assert.deepEqual(
    posts.map((post) => post.body.timelineId),
    result.previews!.map((preview) => preview.timelineId),
  );
  assert.ok(posts.every((post) => post.body.state && post.body.project));

  // Registry: the submitted previews are trackable like any export.
  const tracked = await execExportTool('track_export', { action: 'status', latest: false }, ctx) as
    { count?: number; jobs?: Array<{ renderId?: string }> };
  assert.equal(tracked.count, 2);
  assert.deepEqual(tracked.jobs!.map((job) => job.renderId), ['preview-2', 'preview-1'], 'newest first');

  const unknown = await execExportTool('render_variant_previews', { groupId: 'nope' }, ctx) as { error?: string };
  assert.match(unknown.error ?? '', /no variant group nope/);
} finally {
  globalThis.fetch = originalFetch;
}

// ── no group, and the four-tile cap ───────────────────────────────────────────────
globalThis.fetch = (async () => Response.json({ renderId: `cap-${Date.now()}` })) as typeof fetch;
try {
  const empty = makeDraft(docFromTimeline({ fps: 30, width: 1920, height: 1080, selectedId: null, items: [] }));
  const emptyCtx = {
    commands: empty.commands,
    getState: empty.getState,
    getDoc: empty.getDoc,
    getCreativeMode: () => null,
    templates: [],
    audio: [],
  } as never;
  assert.match(
    (await execExportTool('render_variant_previews', {}, emptyCtx) as { error?: string }).error ?? '',
    /no variant group yet/,
  );

  const many = makeDraft(docFromTimeline({ fps: 30, width: 1920, height: 1080, selectedId: null, items: [] }));
  const manyBase = many.getDoc().activeTimelineId;
  for (const label of ['A', 'B', 'C', 'D', 'E']) {
    many.commands.duplicateTimeline(manyBase, { name: label, activate: false, variant: tag(label) });
  }
  const manyCtx = {
    commands: many.commands,
    getState: many.getState,
    getDoc: many.getDoc,
    getCreativeMode: () => null,
    templates: [],
    audio: [],
  } as never;
  const capped = await execExportTool('render_variant_previews', {}, manyCtx) as
    { previews?: unknown[]; skipped?: number; note?: string };
  assert.equal(capped.previews!.length, 4, 'a 2x2 grid holds four versions');
  assert.equal(capped.skipped, 1);
  assert.match(capped.note ?? '', /four/);
} finally {
  globalThis.fetch = originalFetch;
}

// renderJobClient still parses the snapshots the dialog will poll.
globalThis.fetch = (async () => Response.json({ id: 'preview-1', status: 'running', progress: 40 })) as typeof fetch;
try {
  const snapshot = await readRenderJobSnapshot('preview-1');
  assert.equal(snapshot.status, 'running');
  assert.equal(snapshot.progress, 40);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('variantPreviews.verify: 480p per-version render jobs OK');
