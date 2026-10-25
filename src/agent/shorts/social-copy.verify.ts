// Runnable contract check for social copy (Plan 5, OP-12). The model is stubbed; what is
// asserted is the clamping, the hashtag hygiene, the per-platform fallback and the limits.
import assert from 'node:assert';
import {
  COPY_PLATFORMS,
  PLATFORM_LIMITS,
  clampCopy,
  clampText,
  fallbackCopy,
  generateSocialCopy,
  normalizeHashtags,
  parseCopyJson,
  setSocialCopyScorer,
} from './social-copy';

// ── 1) clampText cuts on a word boundary, never mid-word when it can avoid it ──────────
assert.strictEqual(clampText('hola mundo', 50), 'hola mundo');
assert.strictEqual(clampText('hola   mundo\n\nfeliz', 50), 'hola mundo feliz', 'whitespace is normalised');
const clamped = clampText('uno dos tres cuatro cinco seis', 18);
assert.ok(clamped.length <= 18);
assert.ok(!/\s$/.test(clamped), 'trailing space is trimmed');

// ── 2) Hashtags: prefixes, duplicates and junk go away; the cap holds ─────────────────
assert.deepStrictEqual(normalizeHashtags(['#Uno', 'uno', '  #DOS ', 'tres'], 5), ['Uno', 'DOS', 'tres']);
assert.deepStrictEqual(normalizeHashtags(['##', '   ', 42, null], 5), [], 'empty and non-string tags are dropped');
assert.strictEqual(normalizeHashtags(['a', 'b', 'c', 'd'], 2).length, 2, 'the per-platform cap applies');
assert.deepStrictEqual(normalizeHashtags(['café', 'niño'], 5), ['café', 'niño'], 'accented letters survive');

// ── 3) Every platform limit is enforced on a deliberately oversized input ─────────────
const huge = {
  title: 'x'.repeat(500),
  description: 'y'.repeat(9000),
  hashtags: Array.from({ length: 40 }, (_, i) => `#tag${i}`),
};
for (const platform of COPY_PLATFORMS) {
  const copy = clampCopy(platform, huge);
  const limit = PLATFORM_LIMITS[platform];
  assert.ok(copy.title.length <= limit.title, `${platform} title <= ${limit.title}`);
  assert.ok(copy.description.length <= limit.description, `${platform} description <= ${limit.description}`);
  assert.ok(copy.hashtags.length <= limit.hashtags, `${platform} hashtags <= ${limit.hashtags}`);
  assert.strictEqual(copy.titleLength, copy.title.length, 'reported length matches');
  assert.strictEqual(copy.platform, platform);
}

// ── 4) Fallback: no model still yields postable text ─────────────────────────────────
const fallback = fallbackCopy({ text: 'Esta es la frase. Y esta la siguiente.', platforms: ['x', 'youtube'] });
assert.strictEqual(fallback.length, 2);
assert.strictEqual(fallback[0].title, 'Esta es la frase.', 'the opening sentence becomes the title');
assert.deepStrictEqual(fallback[0].hashtags, [], 'no invented hashtags');

// ── 5) A partial model reply is completed per platform, and honest about it ───────────
setSocialCopyScorer(async () => ({
  copy: [{ platform: 'tiktok', title: 'Mira esto', description: 'Dos frases cortas.', hashtags: ['#musica', '#musica', '#vivo'] }],
}));
const partial = await generateSocialCopy({
  text: 'Mira esto. Es importante.',
  platforms: ['tiktok', 'youtube'],
});
assert.strictEqual(partial.modelUsed, true);
assert.strictEqual(partial.copy.length, 2, 'one entry per requested platform');
const tiktok = partial.copy.find((c) => c.platform === 'tiktok')!;
assert.strictEqual(tiktok.title, 'Mira esto');
assert.deepStrictEqual(tiktok.hashtags, ['musica', 'vivo'], 'duplicates collapse, # is removed');
const youtube = partial.copy.find((c) => c.platform === 'youtube')!;
assert.strictEqual(youtube.title, 'Mira esto.', 'the platform the model skipped falls back to the clip text');

// ── 6) A dead model degrades to the fallback and says modelUsed:false ────────────────
setSocialCopyScorer(async () => { throw new Error('offline'); });
const offline = await generateSocialCopy({ text: 'Primera frase. Segunda.', platforms: ['x'] });
assert.strictEqual(offline.modelUsed, false);
assert.strictEqual(offline.copy[0].title, 'Primera frase.');

// ── 7) Untrusted output: a bad platform is ignored, a fenced reply is parsed ─────────
setSocialCopyScorer(async () => ({
  copy: [
    { platform: 'myspace', title: 'no', description: 'no', hashtags: [] },
    { platform: 'x', title: 'sí', description: 'ok', hashtags: [] },
  ],
}));
const filtered = await generateSocialCopy({ text: 'texto', platforms: ['x'] });
assert.strictEqual(filtered.copy.length, 1);
assert.strictEqual(filtered.copy[0].title, 'sí', 'the valid platform wins over the invented one');

assert.deepStrictEqual(parseCopyJson('```json\n{"copy":[]}\n```'), { copy: [] });

setSocialCopyScorer(null);
console.log('shorts/social-copy.verify: ok');
