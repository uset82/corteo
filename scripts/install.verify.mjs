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
  '--json', '--print-token', '--self-test',
]) {
  assert.ok(help.includes(flag), `--help must document ${flag}`);
}
console.log('install.verify: help and static guards OK');

const failure = runExpectingFailure(['--purge']);
assert.notEqual(failure.status, 0, '--purge without --uninstall must fail');
assert.match(failure.stderr, /--purge only works together with --uninstall/);

const unknown = runExpectingFailure(['--not-a-flag']);
assert.notEqual(unknown.status, 0, 'unknown flags must fail');

// ── the token never reaches stdout by default ───────────────────────────────
// C-09 moved the token out of the report: a bot reads the 0600 file instead, so
// the secret does not have to travel through a chat transcript. The old heredoc
// wrote it unconditionally, so its absence is worth asserting.
assert.match(
  source,
  /report CORTEO_MCP_TOKEN_FILE "\$SECRETS"/,
  'the report must carry the token path',
);
assert.doesNotMatch(
  source,
  /CORTEO_MCP_TOKEN=\$OPENCHATCUT_MCP_TOKEN/,
  'the token must not be written to the report unconditionally',
);
assert.match(
  source,
  /if \(\( PRINT_TOKEN == 1 \)\); then\n\s+report CORTEO_MCP_TOKEN "\$OPENCHATCUT_MCP_TOKEN" stdout-only/,
  'the token is reported only under --print-token, and never written to the file',
);
console.log('install.verify: token stays out of the default output OK');

// ── every key the report promises is actually reported ──────────────────────
const REPORTED = [
  'CORTEO_STATUS', 'CORTEO_URL', 'CORTEO_LOCAL_URL', 'CORTEO_MCP_URL',
  'CORTEO_MCP_TOKEN_FILE', 'CORTEO_OCC', 'CORTEO_APP_DIR', 'CORTEO_DATA_DIR',
  'CORTEO_GUIDE', 'CORTEO_LOG', 'CORTEO_MANAGER', 'CORTEO_MIGRATED_FROM',
  'CORTEO_LEGACY_SERVICE', 'CORTEO_PORT_STATE', 'CORTEO_SELF_TEST',
];
for (const key of REPORTED) {
  assert.ok(
    source.includes(`report ${key} `),
    `write_report must report ${key}`,
  );
}
console.log(`install.verify: ${REPORTED.length} report keys present OK`);

// ── the self-test exists and cannot be a no-op ──────────────────────────────
assert.match(source, /CORTEO_SELF_TEST/, 'the installer must report a self-test result');
assert.match(source, /render --out "\$out" --to 2s --resolution 480p/, 'the self-test must render 2s at 480p');
assert.match(source, /ffprobe -v error -show_entries format=duration/, 'the self-test must check the render with ffprobe');
assert.match(source, /cli-dist\/occ\.mjs/, 'the self-test must drive the CLI');
assert.doesNotMatch(source, /"\$BIN_DIR\/occ" project new/, 'the self-test must not use the wrapper that pins the dev profile');
console.log('install.verify: self-test shape OK');

if (process.platform !== 'linux') {
  console.log(`install.verify: dry-run skipped on ${process.platform} (installer targets Linux)`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'corteo-install-verify-'));
try {
  const installDir = join(work, 'corteo');
  const env = { ...process.env, HOME: join(work, 'home'), NO_COLOR: '1' };
  const dry = run(['--dry-run', '--dir', installDir, '--port', '5299'], { env });
  assert.match(dry, /^CORTEO_STATUS=dry-run$/m);
  assert.match(dry, /^CORTEO_MCP_URL=http:\/\/127\.0\.0\.1:5299\/api\/external-mcp\/mcp$/m);
  // Text mode keeps the 1/0 contract it has always had; only --json promotes
  // these to real booleans.
  assert.match(dry, /^CORTEO_START=1$/m);
  assert.match(dry, /^CORTEO_PORT_STATE=(free|shifted|in-use)$/m);
  assert.doesNotMatch(dry, /^CORTEO_MCP_TOKEN=/m, 'the default output must not carry the token');
  assert.deepEqual(readdirSync(work), [], '--dry-run must not create files');

  const uninstallDry = run(['--uninstall', '--dry-run', '--dir', installDir], { env });
  assert.match(uninstallDry, /^CORTEO_ACTION=uninstall$/m);
  assert.deepEqual(readdirSync(work), [], '--uninstall --dry-run must not create files');

  console.log('install.verify: dry-run is side-effect free OK');

  // ── --json is one object on stdout, and nothing else ─────────────────────
  const jsonArgs = ['--dry-run', '--dir', installDir, '--port', '5299', '--json'];
  const jsonRaw = run(jsonArgs, { env });
  assert.equal(
    jsonRaw.trim().split('\n').length,
    1,
    '--json must print exactly one line on stdout',
  );
  const parsed = JSON.parse(jsonRaw);
  for (const key of [
    'CORTEO_STATUS', 'CORTEO_DIR', 'CORTEO_URL', 'CORTEO_MCP_URL',
    'CORTEO_PORT_STATE', 'CORTEO_LEGACY_ACTION', 'CORTEO_SELF_TEST',
  ]) {
    assert.ok(key in parsed, `--json must carry ${key}`);
  }
  assert.equal(parsed.CORTEO_STATUS, 'dry-run');
  assert.equal(typeof parsed.CORTEO_START, 'boolean', 'CORTEO_START must be a JSON boolean');
  assert.equal(typeof parsed.CORTEO_WITH_DESKTOP, 'boolean', 'CORTEO_WITH_DESKTOP must be a JSON boolean');
  assert.ok(
    !Object.keys(parsed).some((key) => key === 'CORTEO_MCP_TOKEN'),
    '--json must not carry the token unless --print-token is passed',
  );
  console.log('install.verify: --json is one parseable object OK');

  // ── idempotence: the same plan twice ─────────────────────────────────────
  const again = run(jsonArgs, { env });
  assert.equal(again, jsonRaw, '--dry-run --json must be deterministic');
  assert.deepEqual(readdirSync(work), [], '--json --dry-run must not create files');
  console.log('install.verify: the plan is idempotent OK');

  // ── a failure is still one parseable object ──────────────────────────────
  const jsonFailure = runExpectingFailure(['--json', '--dry-run', '--port', '70000']);
  assert.notEqual(jsonFailure.status, 0);
  const failed = JSON.parse(jsonFailure.stdout);
  assert.equal(failed.CORTEO_STATUS, 'failed');
  assert.ok(typeof failed.CORTEO_FAILED_STAGE === 'string' && failed.CORTEO_FAILED_STAGE.length > 0);
  console.log('install.verify: JSON failure path OK');
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('install.verify: ALL PASSED');
