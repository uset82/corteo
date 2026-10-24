// Proves the start script's command line, forward settings and token lookup
// without starting dsh: the spawn and the HTTP probe are stubs.
// node scripts/harness/start.verify.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHarnessArgs, ensureForwardEnabled, resolveCorteoMcp, startHarness,
} from './start.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'corteo-harness-start-'));
const configJson = await readFile(join(repoRoot, 'config/harness.json'), 'utf8');

async function homeFixture(name, settings) {
  const home = join(scratch, name);
  await mkdir(join(home, 'runtime/node_modules/@deepseek-ai/dsh'), { recursive: true });
  await writeFile(
    join(home, 'runtime/node_modules/@deepseek-ai/dsh/package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.2.1-rc.2' }),
  );
  await mkdir(join(home, 'runtime/node_modules/.bin'), { recursive: true });
  await writeFile(join(home, 'runtime/node_modules/.bin/dsh'), '#!/usr/bin/env node\n', { mode: 0o755 });
  await mkdir(join(home, 'our-free-model'), { recursive: true });
  await writeFile(join(home, 'our-free-model/settings.json'), JSON.stringify(settings));
  return home;
}

try {
  // ── the command line only carries the patch when one is given ─────────────
  {
    assert.deepEqual(
      buildHarnessArgs({ webPort: 3080 }),
      ['web', '--no-open', '--host', '127.0.0.1', '--port', '3080'],
    );
    assert.deepEqual(
      buildHarnessArgs({ webPort: 3081, patchPath: '/tmp/corteo.yml' }).slice(-2),
      ['--patch', '/tmp/corteo.yml'],
    );
  }

  // ── the token comes from the env, else the checkout's dev profile ─────────
  {
    const corteo = join(scratch, 'corteo');
    execFileSync('git', ['init', '-q', corteo]);
    const homeDir = join(scratch, 'home-dir');
    const profileId = '11111111-1111-4111-8111-111111111111';
    await mkdir(join(homeDir, '.openchatcut/dev-profiles', profileId), { recursive: true });
    await writeFile(
      join(corteo, '.git/openchatcut-dev-profile.json'),
      JSON.stringify({ version: 1, profileId, repoRoot: corteo }),
    );

    const fromEnv = await resolveCorteoMcp({
      corteoDir: corteo,
      env: { ...process.env, OPENCHATCUT_MCP_TOKEN: 'env-token' },
      homeDir,
    });
    assert.equal(fromEnv.token, 'env-token');

    const fromProfile = await resolveCorteoMcp({ corteoDir: corteo, env: process.env, homeDir });
    assert.equal(fromProfile.token, null, 'no token file yet');
    assert.match(fromProfile.reason, /primera petición MCP/);

    await writeFile(join(homeDir, '.openchatcut/dev-profiles', profileId, 'mcp-token'), 'file-token\n');
    const after = await resolveCorteoMcp({ corteoDir: corteo, env: process.env, homeDir });
    assert.equal(after.token, 'file-token');
    assert.match(after.source, /mcp-token$/);
  }

  // ── forward settings are written whole and keep the key ───────────────────
  {
    const home = await homeFixture('home-forward', {
      forwardKey: 'clave-larga-1234',
      distribution: 'managed',
      forward: { enabled: false, host: '0.0.0.0', port: 1, lan: { enabled: true, port: 2 } },
    });
    const settingsPath = join(home, 'our-free-model/settings.json');
    const result = await ensureForwardEnabled({
      settingsPath, port: 18899, webPort: 3080, probe: async () => ({ status: 0 }),
    });
    assert.equal(result.changed, true);
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
    assert.deepEqual(settings.forward, {
      enabled: true, host: '127.0.0.1', port: 18899, lan: { enabled: false, port: 0 },
    });
    assert.equal(settings.forwardKey, 'clave-larga-1234');
    assert.equal(settings.distribution, 'managed');
    await assert.rejects(
      ensureForwardEnabled({ settingsPath, port: 18900, webPort: 3080, probe: async () => ({ status: 401 }) }),
      /está corriendo/,
    );
  }

  // ── an already-running harness is not started twice ───────────────────────
  {
    const home = await homeFixture('home-running', { distribution: 'managed' });
    const result = await startHarness({
      root: repoRoot,
      home,
      probe: async () => ({ status: 401 }),
      spawnFn: () => assert.fail('must not spawn a second harness'),
      log: () => {},
    });
    assert.equal(result.running, true);
  }

  // ── a stopped harness spawns dsh with the patch and the token ─────────────
  {
    const root = join(scratch, 'fake-root');
    await mkdir(join(root, 'config/harness'), { recursive: true });
    await writeFile(join(root, 'config/harness.json'), configJson);
    const patchPath = join(root, 'config/harness/corteo-mcp.cordis.yml');
    await writeFile(patchPath, '- insert: []\n');
    const home = await homeFixture('home-spawn', {
      forwardKey: 'clave-larga-1234', distribution: 'managed',
    });
    const captured = {};
    const result = await startHarness({
      root,
      home,
      env: { ...process.env, OPENCHATCUT_MCP_TOKEN: 'token-para-mcp' },
      probe: async () => ({ status: 0 }),
      spawnFn: (cmd, args, options) => {
        captured.cmd = cmd;
        captured.args = args;
        captured.options = options;
        return { on: (event, cb) => { if (event === 'exit') setImmediate(() => cb(0)); } };
      },
      log: () => {},
    });
    assert.equal(result.code, 0);
    assert.equal(captured.cmd, join(home, 'runtime/node_modules/.bin/dsh'));
    assert.deepEqual(captured.args.slice(-2), ['--patch', patchPath]);
    assert.equal(captured.options.env.DSH_HOME, home);
    assert.equal(captured.options.env.CORTEO_MCP_TOKEN, 'token-para-mcp');
    assert.match(captured.options.env.CORTEO_MCP_URL, /^http:\/\/localhost:5199\//);
    const settings = JSON.parse(await readFile(join(home, 'our-free-model/settings.json'), 'utf8'));
    assert.equal(settings.forward.enabled, true);
    assert.equal(settings.forwardKey, 'clave-larga-1234');
  }

  // ── without a token it still starts, but says why the patch is missing ────
  {
    const home = await homeFixture('home-no-token', {
      forwardKey: 'clave-larga-1234', distribution: 'managed',
    });
    const lines = [];
    const captured = {};
    await startHarness({
      root: repoRoot,
      home,
      corteoDir: join(scratch, 'not-a-repo'),
      probe: async () => ({ status: 0 }),
      spawnFn: (cmd, args) => {
        captured.args = args;
        return { on: (event, cb) => { if (event === 'exit') setImmediate(() => cb(0)); } };
      },
      log: (line) => lines.push(line),
    });
    assert.ok(!captured.args.includes('--patch'), 'a tokenless patch would send an empty bearer');
    assert.ok(lines.some((line) => line.includes('Sin token MCP')), 'the missing token must be visible');
  }

  console.log('harness start verify passed (6 scenarios)');
} finally {
  const { rm } = await import('node:fs/promises');
  await rm(scratch, { recursive: true, force: true });
}
