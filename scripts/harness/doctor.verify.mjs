// Exercises the doctor against a stub of the forward port: a good setup, a
// stopped harness, forwarding off and a wrong key. No real harness involved.
// node scripts/harness/doctor.verify.mjs
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DoctorError, runDoctor } from './doctor.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const KEY = 'clave-de-prueba-1234';
const scratch = await mkdtemp(join(tmpdir(), 'corteo-harness-doctor-'));

const stub = createServer((req, res) => {
  if (req.url.startsWith('/v1/models')) {
    if (req.headers.authorization !== `Bearer ${KEY}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"error":"missing or invalid API key"}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'alpha-free' }, { id: 'beta-free' }, { id: 'combo:recommended-free' }] }));
    return;
  }
  res.writeHead(401);
  res.end();
});

async function listen(server) {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return server.address().port;
}

async function closedPort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((done) => server.close(done));
  return port;
}

async function homeFixture(name, version, commit, settings) {
  const home = join(scratch, name);
  await mkdir(join(home, 'runtime/node_modules/@deepseek-ai/dsh'), { recursive: true });
  await writeFile(
    join(home, 'runtime/node_modules/@deepseek-ai/dsh/package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh', version }),
  );
  await mkdir(join(home, 'vendor/dsh-our-free-model/.git'), { recursive: true });
  await writeFile(join(home, 'vendor/dsh-our-free-model/.fake-head'), commit);
  await mkdir(join(home, 'our-free-model'), { recursive: true });
  await writeFile(join(home, 'our-free-model/settings.json'), JSON.stringify(settings));
  return home;
}

try {
  const port = await listen(stub);
  const dead = await closedPort();

  const bin = join(scratch, 'bin');
  await mkdir(bin, { recursive: true });
  const fakeGit = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === '-C') process.stdout.write(readFileSync(require('node:path').join(args[1], '.fake-head'), 'utf8'));
`;
  await writeFile(join(bin, 'git'), fakeGit);
  await chmod(join(bin, 'git'), 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  const healthy = {
    forwardKey: KEY,
    forward: { enabled: true, host: '127.0.0.1', port, lan: { enabled: false, port: 0 } },
  };
  const home = await homeFixture('home-ok', '0.2.1-rc.2', '25ab765d6bb860779dbd8c53062953524f3cac09', healthy);

  // ── a healthy setup passes and masks the key ──────────────────────────────
  {
    const lines = [];
    const result = await runDoctor({
      root: repoRoot, home, webPort: port, forwardPort: port, env, log: (line) => lines.push(line),
    });
    assert.equal(result.ok, true);
    assert.equal(result.forwardPort, port);
    assert.deepEqual(result.models, ['alpha-free', 'beta-free', 'combo:recommended-free']);
    const printed = lines.join('\n');
    assert.match(printed, new RegExp(`URL base: http://127\\.0\\.0\\.1:${port}/v1`));
    assert.match(printed, /Clave:    …1234/);
    assert.ok(!printed.includes(KEY), 'the full key must stay hidden without --show-key');
  }

  // ── --show-key reveals it on purpose ──────────────────────────────────────
  {
    const lines = [];
    await runDoctor({
      root: repoRoot, home, webPort: port, forwardPort: port, showKey: true, env, log: (line) => lines.push(line),
    });
    assert.ok(lines.join('\n').includes(KEY));
  }

  // ── a stopped harness fails at step 2 ─────────────────────────────────────
  {
    await assert.rejects(
      runDoctor({ root: repoRoot, home, webPort: dead, forwardPort: port, env, log: () => {} }),
      (error) => error instanceof DoctorError && error.step === 2 && /no responde|nada responde/.test(error.message),
    );
  }

  // ── forwarding off fails at step 3 ────────────────────────────────────────
  {
    const off = await homeFixture('home-off', '0.2.1-rc.2', '25ab765d6bb860779dbd8c53062953524f3cac09', {
      forwardKey: KEY,
      forward: { enabled: false, host: '127.0.0.1', port, lan: { enabled: false, port: 0 } },
    });
    await assert.rejects(
      runDoctor({ root: repoRoot, home: off, webPort: port, forwardPort: port, env, log: () => {} }),
      (error) => error instanceof DoctorError && error.step === 3 && /apagado/.test(error.message),
    );
  }

  // ── a wrong key fails at step 4 ───────────────────────────────────────────
  {
    const wrong = await homeFixture('home-wrong', '0.2.1-rc.2', '25ab765d6bb860779dbd8c53062953524f3cac09', {
      forwardKey: 'otra-clave',
      forward: { enabled: true, host: '127.0.0.1', port, lan: { enabled: false, port: 0 } },
    });
    await assert.rejects(
      runDoctor({ root: repoRoot, home: wrong, webPort: port, forwardPort: port, env, log: () => {} }),
      (error) => error instanceof DoctorError && error.step === 4 && /401/.test(error.message),
    );
  }

  // ── a version mismatch fails at step 1 ────────────────────────────────────
  {
    const old = await homeFixture('home-old', '0.1.7-rc.2', '25ab765d6bb860779dbd8c53062953524f3cac09', healthy);
    await assert.rejects(
      runDoctor({ root: repoRoot, home: old, webPort: port, forwardPort: port, env, log: () => {} }),
      (error) => error instanceof DoctorError && error.step === 1 && /0\.1\.7-rc\.2/.test(error.message),
    );
  }

  console.log('harness doctor verify passed (6 scenarios)');
} finally {
  await new Promise((done) => stub.close(done));
  const { rm } = await import('node:fs/promises');
  await rm(scratch, { recursive: true, force: true });
}
