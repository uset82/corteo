import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/corteo-acceptance.sh');
const source = readFileSync(script, 'utf8');
const skill = readFileSync(join(root, 'skills/corteo/SKILL.md'), 'utf8');

execFileSync('bash', ['-n', script], { stdio: 'pipe' });
execFileSync('bash', ['-n', join(root, 'scripts/corteo-env.sh')], { stdio: 'pipe' });
execFileSync('bash', ['-n', join(root, 'scripts/corteo')], { stdio: 'pipe' });
execFileSync('bash', ['-n', join(root, 'scripts/corteo-local.sh')], { stdio: 'pipe' });

for (const needle of [
  'NPM_CONFIG_PREFIX',
  'ACCEPTANCE=PASS',
  'ACCEPTANCE=FAIL',
  'node_major',
  'mcp token --show',
  'fromFrame":30',
  '--resolution 1080p',
  '--resolution 4k',
  '1080x1920',
  'detect_beats',
  'Failed to load url /@fs/src/main.tsx',
  'CORTEO_PORT',
  'CORTEO_STORE_DIR',
  '--to-audio',
  'item fit',
  'geq=',
  'frame-bars.mjs',
]) {
  assert.match(source, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), needle);
}
assert.match(skill, /scripts\/corteo/);
assert.match(skill, /NPM_CONFIG_PREFIX/);
assert.match(skill, /mcp token --show/);
assert.match(skill, /detect_beats/);
assert.match(skill, /--resolution 4k/);
assert.match(skill, /1080x1920/);
assert.match(skill, /Receta rápida/);
assert.match(skill, /--to-audio/);
assert.match(skill, /--mode cover/);
assert.match(skill, /--background blur/);
assert.match(skill, /while your editor is on/);
assert.match(skill, /CORTEO_STORE_DIR/);
assert.doesNotMatch(source, /API_KEY|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{8,}/);

console.log('corteo-acceptance.verify: syntax and skill guards pass');
