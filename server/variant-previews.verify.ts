// P4-2: plan 480p preview files for every version, write a manifest, and serve
// them safely. The renderer is injected, so this checks orchestration without
// spending minutes in Chrome.
// Run: npx tsx server/variant-previews.verify.ts
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDraft } from '../src/editor/store.ts';
import type { TimelineState } from '../src/editor/types.ts';
import { docFromTimeline } from '../src/persist/projectStore.ts';
import {
  parseVariantPreviewRequest,
  readVariantPreviewFile,
  readVariantPreviewManifest,
  renderVariantPreviews,
  variantPreviewPath,
  variantPreviewUrl,
} from './variant-previews.ts';

const state: TimelineState = {
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items: [{
    id: 'title', track: 'V1', startFrame: 0, durationInFrames: 30, name: 'Title', kind: 'text',
    props: { text: 'Versión A', fontSize: 96, color: '#ffffff', fontWeight: 700, align: 'center' },
  }],
};
const draft = makeDraft(docFromTimeline(state));
const source = draft.getDoc().timelines[0]!;
const created = draft.commands.createVariants(source.id, [
  { label: 'Rápida', note: 'Cortes rápidos' },
  { label: 'Lenta', note: '' },
]);
assert.equal(created.ids.length, 2);
const doc = draft.getDoc();
const root = await mkdtemp(join(tmpdir(), 'occ-variant-previews-'));

try {
  const calls: Array<Record<string, unknown>> = [];
  const manifest = await renderVariantPreviews(doc, { groupId: created.groupId }, {
    rootDir: root,
    render: async (options) => {
      calls.push(options);
      await writeFile(String(options.outputLocation), Buffer.from('fake-preview'));
      return {};
    },
  });
  assert.equal(manifest.ok, true);
  assert.equal(manifest.groupId, created.groupId);
  assert.equal(manifest.previews.length, 2);
  assert.deepEqual(manifest.previews.map((preview) => preview.label), ['Rápida', 'Lenta']);
  assert.deepEqual(manifest.previews.map((preview) => preview.status), ['borrador', 'borrador']);
  assert.equal(manifest.previews[0]!.note, 'Cortes rápidos');
  for (const preview of manifest.previews) {
    assert.equal(preview.width, 864, '480p short side is 480px, 16:9 → 864x486');
    assert.equal(preview.height, 486);
    assert.equal(preview.fps, 30);
    assert.equal(preview.durationInFrames, 30);
    assert.equal(preview.bytes, Buffer.byteLength('fake-preview'));
    assert.equal(preview.url, variantPreviewUrl(created.groupId, preview.timelineId));
    assert.equal(preview.path, variantPreviewPath(created.groupId, preview.timelineId, root));
    assert.equal((await stat(preview.path)).isFile(), true);
  }
  assert.equal(calls.length, 2, 'one render per version');
  assert.equal(calls[0]!.codec, 'h264');
  assert.equal(calls[0]!.timelineId, created.ids[0]);
  assert.equal(calls[0]!.scale, 0.45);
  assert.equal(calls[0]!.project, doc);
  assert.equal(typeof calls[0]!.videoBitrate, 'number');
  assert.ok((calls[0]!.videoBitrate as number) >= 800_000);

  const loaded = await readVariantPreviewManifest(created.groupId, root);
  assert.deepEqual(loaded, manifest);
  const file = await readVariantPreviewFile(created.groupId, created.ids[0]!, root);
  assert.equal(file?.data.toString(), 'fake-preview');
  assert.equal(await readVariantPreviewManifest('vg_missing', root), null);
  assert.equal(await readVariantPreviewFile(created.groupId, '../escape', root), null);
  assert.throws(() => variantPreviewPath('../escape', created.ids[0]!, root), /invalid groupId/);
  assert.throws(() => variantPreviewPath(created.groupId, '../escape', root), /invalid timelineId/);

  const parsed = parseVariantPreviewRequest({ project: doc, groupId: created.groupId });
  assert.equal(parsed.project, doc);
  assert.deepEqual(parsed.selector, { groupId: created.groupId });
  assert.throws(() => parseVariantPreviewRequest({ project: {} }), /ProjectDoc/);
  assert.throws(() => parseVariantPreviewRequest(null), /JSON object/);

  await assert.rejects(
    () => renderVariantPreviews(doc, { groupId: 'vg_missing' }, { rootDir: root, render: async () => ({}) }),
    /no version group/,
  );
  await assert.rejects(
    () => renderVariantPreviews(doc, {}, { rootDir: root, render: async () => ({}) }),
    /no version group/,
    'the source sequence is not a version, and it is still active',
  );

  draft.commands.chooseVariant(created.ids[0]!);
  const fromActive = await renderVariantPreviews(draft.getDoc(), {}, {
    rootDir: root,
    render: async (options) => { await writeFile(String(options.outputLocation), Buffer.from('x')); return {}; },
  });
  assert.equal(fromActive.groupId, created.groupId, 'the active version resolves its own group');

  console.log('variant-previews.verify: 480p plan, per-version files, manifest and URL guards OK');
} finally {
  await rm(root, { recursive: true, force: true });
}
