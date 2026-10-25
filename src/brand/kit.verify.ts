// Runnable contract check for the brand kit data layer (Plan 5, OP-10, step 1).
// Pure: defaults, coercion of untrusted input, and what the validator reports.
import assert from 'node:assert';
import { DEFAULT_BRAND_KIT, brandKitIssues, brandKitOf, normalizeBrandKit, withBrandKit } from './kit';
import type { ProjectDoc } from '../editor/projectTypes';
import { makeDraft } from '../editor/store';
import { docFromTimeline } from '../persist/projectStore';
import type { TimelineState } from '../editor/types';

// ── 1) Anything becomes a usable kit, field by field ────────────────────────────────
assert.deepStrictEqual(normalizeBrandKit(null), DEFAULT_BRAND_KIT, 'no kit → the defaults, unchanged');
assert.deepStrictEqual(normalizeBrandKit({}), DEFAULT_BRAND_KIT, 'an empty object is the defaults');

const partial = normalizeBrandKit({ name: '  Claudia  ', captionPreset: 'bili' });
assert.strictEqual(partial.name, 'Claudia', 'the name is trimmed');
assert.strictEqual(partial.captionPreset, 'bili', 'a valid preset is kept');
assert.deepStrictEqual(partial.palette, DEFAULT_BRAND_KIT.palette, 'missing palette falls back, it does not empty');

// ── 2) Bad values are coerced, not fatal ─────────────────────────────────────────────
const messy = normalizeBrandKit({
  palette: ['#fff', 'not-a-colour', '#112233', 42, '#aabbccdd'],
  safeMargin: 9,
  introSeconds: -3,
  ratios: ['9:16', 'wide', '1:1'],
});
assert.deepStrictEqual(messy.palette, ['#fff', '#112233', '#aabbccdd'], 'only real hex colours survive, max five');
assert.strictEqual(messy.safeMargin, 0.2, 'safeMargin clamps into 0..0.2');
assert.strictEqual(messy.introSeconds, 0, 'a negative intro clamps to zero');
assert.deepStrictEqual(messy.ratios, ['9:16', '1:1'], 'only n:n ratios survive');

// ── 3) A watermark that half makes sense is kept, one that does not is dropped ──────
const stamped = normalizeBrandKit({
  watermark: { assetId: ' asset-1 ', position: 'bottom-right', scale: 4, opacity: -1 },
});
assert.ok(stamped.watermark, 'a valid corner keeps the watermark');
assert.strictEqual(stamped.watermark!.assetId, 'asset-1');
assert.strictEqual(stamped.watermark!.scale, 0.6, 'scale clamps to the ceiling');
assert.strictEqual(stamped.watermark!.opacity, 0.05, 'opacity clamps to the floor');

const noCorner = normalizeBrandKit({ watermark: { assetId: 'x', position: 'middle-ish' } });
assert.strictEqual(noCorner.watermark, undefined, 'an unknown corner drops the watermark instead of guessing');

// ── 4) The validator explains what the normalizer silently repairs ──────────────────
assert.deepStrictEqual(brandKitIssues(null), [{ field: 'kit', problem: 'El kit no es un objeto.' }]);
const issues = brandKitIssues({
  captionPreset: 'no-such-style',
  palette: ['#fff', 'nope'],
  watermark: { position: 'middle-ish' },
}, ['tiktok', 'bili']);
const fields = issues.map((issue) => issue.field).sort();
assert.deepStrictEqual(fields, ['captionPreset', 'palette', 'watermark.position'], 'each problem is reported once');
assert.ok(issues.every((issue) => /[áéíóúñ]|\./.test(issue.problem)), 'messages are Spanish and punctuated');

assert.deepStrictEqual(brandKitIssues({ captionPreset: 'tiktok' }, ['tiktok']), [], 'a clean kit has no issues');
assert.deepStrictEqual(
  brandKitIssues({ captionPreset: 'anything' }, []),
  [],
  'without a preset catalogue the validator does not guess',
);

// ── 5) Round trip: a normalized kit normalizes to itself ────────────────────────────
const twice = normalizeBrandKit(normalizeBrandKit({ name: 'X', palette: ['#000000'], watermark: { position: 'top-left' } }));
assert.deepStrictEqual(twice, normalizeBrandKit({ name: 'X', palette: ['#000000'], watermark: { position: 'top-left' } }), 'normalization is idempotent');

// ── 6) Documents: a project without a kit reads as the defaults; one with a kit reads its own
const bareDoc = { version: 9, assets: [], mediaFolders: [], timelines: [], activeTimelineId: '' } as unknown as ProjectDoc;
assert.deepStrictEqual(brandKitOf(bareDoc), DEFAULT_BRAND_KIT, 'a project that predates the field uses the defaults');
assert.deepStrictEqual(brandKitOf(null), DEFAULT_BRAND_KIT, 'no document at all is still safe');

const saved = withBrandKit(bareDoc, { name: 'Canal', captionPreset: 'bili', palette: ['#101010'] });
assert.strictEqual(saved.brandKit?.name, 'Canal');
assert.deepStrictEqual(brandKitOf(saved), saved.brandKit, 'the reader returns what the writer stored');
assert.strictEqual(bareDoc.brandKit, undefined, 'withBrandKit does not mutate the input document');

// The kit has to survive the JSON round trip that persistence actually performs.
const reloaded = JSON.parse(JSON.stringify(saved)) as ProjectDoc;
assert.deepStrictEqual(brandKitOf(reloaded), saved.brandKit, 'the kit survives serialization unchanged');

// A corrupted stored kit (an older build, a hand-edited file) normalizes instead of throwing.
const corrupted = { ...bareDoc, brandKit: { palette: 'red', safeMargin: 'mucho', watermark: { position: 'nope' } } } as unknown as ProjectDoc;
const repaired = brandKitOf(corrupted);
assert.deepStrictEqual(repaired.palette, DEFAULT_BRAND_KIT.palette, 'a corrupted palette falls back');
assert.strictEqual(repaired.safeMargin, DEFAULT_BRAND_KIT.safeMargin);
assert.strictEqual(repaired.watermark, undefined, 'a corrupted watermark is dropped, not guessed');

// Writing through the helper is also idempotent.
assert.deepStrictEqual(withBrandKit(saved, saved.brandKit), saved, 're-applying the same kit is a no-op');

// ── 7) Committing the kit through the editor: normalized on the way in, one history step ──
{
  const state: TimelineState = {
    fps: 30, width: 1920, height: 1080, selectedId: null,
    items: [{ id: 'v', track: 'V1', startFrame: 0, durationInFrames: 30, name: 'v', kind: 'video', src: '/v.mp4' }],
  };
  const draft = makeDraft(docFromTimeline(state));
  assert.deepStrictEqual(brandKitOf(draft.getDoc()), DEFAULT_BRAND_KIT, 'a fresh project has no kit');

  draft.commands.setBrandKit({ name: 'Canal', palette: ['#101010'], safeMargin: 9 });
  const stored = brandKitOf(draft.getDoc());
  assert.strictEqual(stored.name, 'Canal', 'the command writes the document');
  assert.deepStrictEqual(stored.palette, ['#101010']);
  assert.strictEqual(stored.safeMargin, 0.2, 'a value the reducer had to clamp is clamped in the doc, not later');

  // A malformed kit cannot corrupt the document, because the reducer normalizes it.
  draft.commands.setBrandKit({ palette: 'rojo', watermark: { position: 'middle' } });
  const repairedInDoc = brandKitOf(draft.getDoc());
  assert.deepStrictEqual(repairedInDoc.palette, DEFAULT_BRAND_KIT.palette, 'garbage in the payload never reaches the doc');
  assert.strictEqual(repairedInDoc.watermark, undefined);

  draft.commands.setBrandKit(null);
  assert.deepStrictEqual(brandKitOf(draft.getDoc()), DEFAULT_BRAND_KIT, 'null clears the kit back to the defaults');
  assert.strictEqual(draft.getDoc().brandKit, undefined, 'the field is absent, not an empty object');
}

console.log('brand/kit.verify: ok');
