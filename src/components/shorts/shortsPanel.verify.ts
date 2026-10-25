// Contract check for the "Analizar episodio" panel (Plan 5, OP-05).
//
// It is a static check on purpose: the panel's value is that it *reuses* the agent's tools
// and routes every visible string through i18n. A rendering test would need a canvas, a
// store and a mock editor, and would still not prove either of those two promises.
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { EN } from '../../i18n/dict/en';

const source = await readFile(new URL('./ShortsPanel.tsx', import.meta.url), 'utf8');

// 1. Every string it shows goes through t(), and every key has an English entry.
const keys = [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]);
assert.ok(keys.length >= 12, `the panel is not hardcoded: found ${keys.length} translated strings`);
for (const key of new Set(keys)) {
  assert.ok(key in EN, `missing English dictionary entry for "${key}"`);
}

// 2. It composes the agent's tools instead of owning a second pipeline.
assert.ok(
  source.includes("execShortsTool('score_moments'"),
  'scoring must go through score_moments, the same executor the agent calls',
);
assert.ok(
  source.includes("execMakeShortsTool('make_shorts'"),
  'cutting must go through make_shorts',
);
assert.ok(
  source.includes('ranges:'),
  'the panel must pass the exact spans the user checked',
);
assert.ok(
  source.includes('recordDecision'),
  'approve/reject must feed the calibration ledger',
);

// 3. No hardcoded Spanish or English product copy in JSX text positions.
const jsxText = source
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
  .join('\n');
for (const phrase of ['Analizar episodio', 'Crear clips', 'Todavía no hay']) {
  assert.ok(!jsxText.includes(phrase), `copy "${phrase}" is hardcoded instead of translated`);
}

// 4. It is read-only until the user acts: no direct command calls, no timeline mutation.
assert.ok(!/ctx\.commands\.\w+\(/.test(source), 'the panel must not drive the store directly');
assert.ok(!/commands\.batch\(/.test(source), 'the panel must let the tools own the undo step');

console.log('shorts/shorts-panel.verify: ok');
