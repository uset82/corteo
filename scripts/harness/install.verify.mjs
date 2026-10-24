// Proves the installer against fake npm/git/dsh commands: no network, no real
// harness. Covers the pinned commit check, the settings merge, the 0600 mode,
// the running-harness refusal and idempotence.
// node scripts/harness/install.verify.mjs
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installHarness } from './install.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'corteo-harness-install-'));
const logFile = join(scratch, 'calls.log');

const fakeCommands = {
  npm: `#!/usr/bin/env node
const { mkdirSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
appendFileSync(process.env.CALL_LOG, 'npm ' + args.join(' ') + '\\n');
const prefix = args[args.indexOf('--prefix') + 1];
const spec = args.at(-1);
const version = spec.slice(spec.lastIndexOf('@') + 1);
mkdirSync(join(prefix, 'node_modules/@deepseek-ai/dsh'), { recursive: true });
writeFileSync(join(prefix, 'node_modules/@deepseek-ai/dsh/package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version }));
mkdirSync(join(prefix, 'node_modules/.bin'), { recursive: true });
writeFileSync(join(prefix, 'node_modules/.bin/dsh'), \`#!/usr/bin/env node
const { mkdirSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
appendFileSync(process.env.CALL_LOG, 'dsh ' + args.join(' ') + '\\\\n');
const profile = args[args.indexOf('--profile') + 1];
const dir = args.at(-1);
const profileDir = join(process.env.DSH_HOME, 'profiles', profile);
mkdirSync(profileDir, { recursive: true });
writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
  name: 'dsh-profile-' + profile,
  private: true,
  dependencies: { 'dsh-our-free-model': 'link:' + dir },
}, null, 2));
\`, { mode: 0o755 });
`,
  git: `#!/usr/bin/env node
const { mkdirSync, readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
appendFileSync(process.env.CALL_LOG, 'git ' + args.join(' ') + '\\n');
if (args[0] === 'clone') {
  const dir = args.at(-1);
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(join(dir, '.fake-head'), process.env.FAKE_GIT_HEAD || process.env.FAKE_PINNED_COMMIT);
} else if (args[0] === '-C' && args[2] === 'rev-parse') {
  process.stdout.write(readFileSync(join(args[1], '.fake-head'), 'utf8'));
}
`,
  dsh: `#!/usr/bin/env node
const { mkdirSync, writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
appendFileSync(process.env.CALL_LOG, 'dsh ' + args.join(' ') + '\\n');
const profile = args[args.indexOf('--profile') + 1];
const dir = args.at(-1);
const profileDir = join(process.env.DSH_HOME, 'profiles', profile);
mkdirSync(profileDir, { recursive: true });
writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
  name: 'dsh-profile-' + profile,
  private: true,
  dependencies: { 'dsh-our-free-model': 'link:' + dir },
}, null, 2));
`,
  pnpm: `#!/usr/bin/env node
process.stdout.write('10.13.1\\n');
`,
};

async function fakeBin() {
  const dir = join(scratch, 'bin');
  await mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(fakeCommands)) {
    const path = join(dir, name);
    await writeFile(path, body);
    await chmod(path, 0o755);
  }
  return dir;
}

async function readCallLog() {
  try {
    return await readFile(logFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function resetCallLog() {
  await writeFile(logFile, '');
}

// Version probes are read-only; only these three lines would change the home.
function mutations(log) {
  return log.split('\n').filter((line) => /^(npm install|git clone|dsh plugin)/.test(line));
}

const bin = await fakeBin();
const baseEnv = {
  ...process.env,
  PATH: `${bin}:${process.env.PATH}`,
  CALL_LOG: logFile,
  FAKE_PINNED_COMMIT: '25ab765d6bb860779dbd8c53062953524f3cac09',
};

try {
  // ── a fresh home installs everything and creates private settings ─────────
  {
    const home = join(scratch, 'home-fresh');
    await resetCallLog();
    const result = await installHarness({ root, home, env: baseEnv, probe: async () => ({ status: 0 }) });
    assert.equal(result.changed, true);
    const calls = await readCallLog();
    assert.match(calls, /npm install --prefix .*@deepseek-ai\/dsh@0\.2\.1-rc\.2/);
    assert.match(calls, /git clone --depth 1 --branch v2\.5\.9/);
    assert.match(calls, /dsh plugin --profile web add/);

    const settingsPath = join(home, 'our-free-model/settings.json');
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
    assert.equal(settings.distribution, 'managed', 'the installer pins managed mode');
    assert.equal((await stat(settingsPath)).mode & 0o777, 0o600, 'settings carry the forward key');

    await resetCallLog();
    const again = await installHarness({ root, home, env: baseEnv, probe: async () => ({ status: 0 }) });
    assert.equal(again.changed, false);
    assert.deepEqual(mutations(await readCallLog()), [], 'a second run must not install, clone or register anything');
  }

  // ── a different commit stops before registering the plugin ────────────────
  {
    const home = join(scratch, 'home-wrong-commit');
    await resetCallLog();
    await assert.rejects(
      installHarness({ root, home, env: { ...baseEnv, FAKE_GIT_HEAD: 'deadbeef' }, probe: async () => ({ status: 0 }) }),
      /commit deadbeef.*esperaba 25ab765d/s,
    );
    assert.ok(!(await readCallLog()).includes('plugin'), 'the plugin must not be added after a bad clone');
  }

  // ── an existing settings file keeps its keys and becomes private ──────────
  {
    const home = join(scratch, 'home-existing');
    await mkdir(join(home, 'runtime/node_modules/@deepseek-ai/dsh'), { recursive: true });
    await writeFile(
      join(home, 'runtime/node_modules/@deepseek-ai/dsh/package.json'),
      JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.2.1-rc.2' }),
    );
    await mkdir(join(home, 'runtime/node_modules/.bin'), { recursive: true });
    await writeFile(join(home, 'runtime/node_modules/.bin/dsh'), '#!/usr/bin/env node\n', { mode: 0o755 });
    await mkdir(join(home, 'vendor/dsh-our-free-model/.git'), { recursive: true });
    await writeFile(join(home, 'vendor/dsh-our-free-model/.fake-head'), '25ab765d6bb860779dbd8c53062953524f3cac09');
    await mkdir(join(home, 'profiles/web'), { recursive: true });
    await writeFile(join(home, 'profiles/web/package.json'), JSON.stringify({
      dependencies: { 'dsh-our-free-model': `link:${join(home, 'vendor/dsh-our-free-model')}` },
    }));
    const settingsPath = join(home, 'our-free-model/settings.json');
    await mkdir(join(home, 'our-free-model'), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({
      forwardKey: 'secreto-1234',
      forward: { enabled: true, host: '127.0.0.1', port: 18899, lan: { enabled: false, port: 0 } },
      distribution: 'auto',
    }));
    await resetCallLog();
    const result = await installHarness({ root, home, env: baseEnv, probe: async () => ({ status: 0 }) });
    assert.equal(result.changed, true);
    assert.deepEqual(mutations(await readCallLog()), [], 'nothing but the settings needed a write');
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
    assert.equal(settings.distribution, 'managed');
    assert.equal(settings.forwardKey, 'secreto-1234', 'the key survives the merge');
    assert.equal(settings.forward.port, 18899, 'the forward block survives the merge');
    assert.equal((await stat(settingsPath)).mode & 0o777, 0o600);
  }

  // ── a running harness refuses the settings rewrite ────────────────────────
  {
    const home = join(scratch, 'home-running');
    await mkdir(join(home, 'runtime/node_modules/@deepseek-ai/dsh'), { recursive: true });
    await writeFile(
      join(home, 'runtime/node_modules/@deepseek-ai/dsh/package.json'),
      JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.2.1-rc.2' }),
    );
    await mkdir(join(home, 'runtime/node_modules/.bin'), { recursive: true });
    await writeFile(join(home, 'runtime/node_modules/.bin/dsh'), '#!/usr/bin/env node\n', { mode: 0o755 });
    await mkdir(join(home, 'vendor/dsh-our-free-model/.git'), { recursive: true });
    await writeFile(join(home, 'vendor/dsh-our-free-model/.fake-head'), '25ab765d6bb860779dbd8c53062953524f3cac09');
    await mkdir(join(home, 'profiles/web'), { recursive: true });
    await writeFile(join(home, 'profiles/web/package.json'), JSON.stringify({
      dependencies: { 'dsh-our-free-model': `link:${join(home, 'vendor/dsh-our-free-model')}` },
    }));
    await assert.rejects(
      installHarness({ root, home, env: baseEnv, probe: async () => ({ status: 401 }) }),
      /está corriendo/,
    );
  }

  console.log('harness install verify passed (4 scenarios)');
} finally {
  const { rm } = await import('node:fs/promises');
  await rm(scratch, { recursive: true, force: true });
}
