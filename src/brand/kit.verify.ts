// Runnable contract check for the brand kit data layer (Plan 5, OP-10, step 1).
// Pure: defaults, coercion of untrusted input, and what the validator reports.
import assert from 'node:assert';
import { DEFAULT_BRAND_KIT, brandKitIssues, normalizeBrandKit } from './kit';

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

console.log('brand/kit.verify: ok');
