// Runnable contract check for the auto headline (Plan 5, OP-09). The model is stubbed.
import assert from 'node:assert';
import { clampHeadline, fallbackHeadline, generateHeadline, setHeadlineScorer } from './headline';

// ── 1) Clamping: quotes, trailing punctuation, word and character caps ─────────────────
assert.strictEqual(clampHeadline('"El precio sube siempre."'), 'El precio sube siempre');
assert.strictEqual(clampHeadline('  varios   espacios  '), 'varios espacios');
assert.strictEqual(clampHeadline('uno dos tres cuatro cinco seis siete ocho', 6), 'uno dos tres cuatro cinco seis');
const long = clampHeadline('palabra '.repeat(20), 10, 30);
assert.ok(long.length <= 30, `character cap holds: ${long.length}`);
assert.ok(!/\s$/.test(long), 'no trailing space');
assert.strictEqual(clampHeadline('   '), '', 'empty stays empty');
assert.strictEqual(clampHeadline('¡Ojo!'), '¡Ojo', 'a leading punctuation mark is kept, the trailing one is not');

// ── 2) Fallback: the opening sentence, clamped ────────────────────────────────────────
assert.strictEqual(
  fallbackHeadline('Nadie te cuenta esto del precio. Y luego pasa lo que pasa.'),
  'Nadie te cuenta esto del precio',
  'the first sentence becomes the headline, without its period',
);
assert.strictEqual(fallbackHeadline(''), '');
assert.strictEqual(fallbackHeadline('una dos tres cuatro cinco seis siete', 4), 'una dos tres cuatro');

// ── 3) Model path: used when it answers, clamped to the same limits ───────────────────
setHeadlineScorer(async () => 'El precio sube siempre y nadie lo dice');
const modelled = await generateHeadline('texto', { maxWords: 4 });
assert.strictEqual(modelled.modelUsed, true);
assert.strictEqual(modelled.headline, 'El precio sube siempre', 'the model reply is clamped to four words');

// ── 4) A dead or empty model degrades, and says so ───────────────────────────────────
setHeadlineScorer(async () => { throw new Error('offline'); });
const offline = await generateHeadline('Primera frase. Segunda.', { maxWords: 6 });
assert.strictEqual(offline.modelUsed, false);
assert.strictEqual(offline.headline, 'Primera frase');

setHeadlineScorer(async () => '   ');
const empty = await generateHeadline('Otra frase.', {});
assert.strictEqual(empty.modelUsed, false, 'an empty reply is not treated as a headline');
assert.strictEqual(empty.headline, 'Otra frase');

setHeadlineScorer(null);
console.log('shorts/headline.verify: ok');
