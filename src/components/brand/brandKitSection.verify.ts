// Contract check for the "Marca" section (Plan 5, OP-10 step 4). Static, like the shorts
// panel check: the promise is that the section speaks through i18n and commits through the
// same command the agent uses, not that it renders a particular pixel.
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { EN } from '../../i18n/dict/en';

const source = await readFile(new URL('./BrandKitSection.tsx', import.meta.url), 'utf8');

const keys = [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]);
assert.ok(keys.length >= 6, `the section is translated, found ${keys.length} strings`);
for (const key of new Set(keys)) {
  assert.ok(key in EN, `missing English dictionary entry for "${key}"`);
}

// It edits the kit the document carries and hands it back — it does not own storage.
assert.ok(source.includes('onSave('), 'the section commits through the callback it is given');
assert.ok(!/setBrandKit\s*\(/.test(source), 'the section does not call the command layer itself');

// The preset list comes from the single caption catalogue, not a copy.
assert.ok(source.includes('CAPTION_STYLES'), 'caption presets come from src/captions/styles.ts');

// The tunable fields are the three a person actually adjusts.
for (const field of ['kit.name', 'kit.captionPreset', 'kit.safeMargin']) {
  assert.ok(source.includes(field), `edits ${field}`);
}

console.log('settings/brand-kit-section.verify: ok');
