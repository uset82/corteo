import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = join(root, 'scripts/corteo-install.sh');
const source = readFileSync(installer, 'utf8');

execFileSync('bash', ['-n', installer], { stdio: 'pipe' });
assert.match(source, /^#!\/usr\/bin\/env bash\n/);
assert.doesNotMatch(source, /^\s*read\b/m, 'the installer must not prompt');
assert.match(source, /curl -fsSL https:\/\/raw\.githubusercontent\.com\/uset82\/corteo\/main\/scripts\/corteo-install\.sh \| bash/);
assert.match(source, /CORTEO_SELF_TEST=PASS/);
assert.match(source, /CC_RENDER_GL=swangle/);
assert.match(source, /OPENCHATCUT_PROVIDERS=off/);
assert.match(source, /unset NPM_CONFIG_PREFIX npm_config_prefix/);
assert.match(source, /self-test step failed/);
assert.match(source, /CC_BROWSER_EXECUTABLE/);
assert.match(source, /ensureBrowser/);
assert.doesNotMatch(source, /if ! self_test/);
assert.doesNotMatch(source, /API_KEY|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{8,}/);

console.log('corteo-install.verify: syntax and non-interactive guards pass');
