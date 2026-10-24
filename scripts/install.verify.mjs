import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = join(root, 'install.sh');
const source = readFileSync(installer, 'utf8');

function run(args, options = {}) {
  return execFileSync('bash', [installer, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
    ...options,
  });
}

function runExpectingFailure(args) {
  try {
    run(args);
  } catch (error) {
    return {
      status: error.status,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
    };
  }
  assert.fail(`expected install.sh ${args.join(' ')} to fail`);
}

execFileSync('bash', ['-n', installer], { stdio: 'pipe' });
console.log('install.verify: bash syntax OK');

assert.match(source, /^#!\/usr\/bin\/env bash\n/, 'install.sh must start with a bash shebang');
assert.doesNotMatch(source, /^\s*read\b/m, 'install.sh must never prompt or read stdin');
assert.match(source, /curl|bash/, 'install.sh should document the curl usage');
assert.match(source, /OPENCHATCUT_MCP_TOKEN/, 'install.sh must provision an MCP token');

const help = run(['--help']);
for (const flag of [
  '--dir', '--host', '--port', '--ref', '--no-start', '--with-desktop',
  '--skip-system-deps', '--uninstall', '--purge', '--dry-run',
]) {
  assert.ok(help.includes(flag), `--help must document ${flag}`);
}
console.log('install.verify: help and static guards OK');

const failure = runExpectingFailure(['--purge']);
assert.notEqual(failure.status, 0, '--purge without --uninstall must fail');
assert.match(failure.stderr, /--purge only works together with --uninstall/);

const unknown = runExpectingFailure(['--not-a-flag']);
assert.notEqual(unknown.status, 0, 'unknown flags must fail');

if (process.platform !== 'linux') {
  console.log(`install.verify: dry-run skipped on ${process.platform} (installer targets Linux)`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'claudia-install-verify-'));
try {
  const installDir = join(work, 'claudia');
  const env = { ...process.env, HOME: join(work, 'home'), NO_COLOR: '1' };
  const dry = run(['--dry-run', '--dir', installDir, '--port', '5299'], { env });
  assert.match(dry, /^CLAUDIA_STATUS=dry-run$/m);
  assert.match(dry, /^CLAUDIA_MCP_URL=http:\/\/127\.0\.0\.1:5299\/api\/external-mcp\/mcp$/m);
  assert.match(dry, /^CLAUDIA_START=1$/m);
  assert.deepEqual(readdirSync(work), [], '--dry-run must not create files');

  const uninstallDry = run(['--uninstall', '--dry-run', '--dir', installDir], { env });
  assert.match(uninstallDry, /^CLAUDIA_ACTION=uninstall$/m);
  assert.deepEqual(readdirSync(work), [], '--uninstall --dry-run must not create files');

  console.log('install.verify: dry-run is side-effect free OK');
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('install.verify: ALL PASSED');
