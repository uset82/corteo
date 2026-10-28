import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../skills/corteo/SKILL.md', import.meta.url), 'utf8');
for (const text of ['## One name', 'inbox --host', 'song-film', 'reviewEs', 'CORTEO_SELF_TEST=pass', 'corteo.env', 'CORTEO_OCC', '1080x1920', '~/corteo-exports']) {
  assert.ok(skill.includes(text), `skill must contain ${text}`);
}
assert.doesNotMatch(skill, /CORTEO_SELF_TEST=PASS/);
assert.doesNotMatch(skill, /clau[d]ia|Bearer [A-Za-z0-9_-]{20,}/i);
console.log('corteo-skill.verify: ok');
