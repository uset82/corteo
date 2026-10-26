/**
 * C-13 gate: the rehearsal is a real rehearsal.
 *
 * `scripts/bot-rehearsal.sh` installs corteo on a clean Linux box, which is a
 * five-minute job and not something `test:serial` can carry. So this file does
 * two things:
 *
 *   1. always, it reads the script and checks the properties that make the run
 *      meaningful — a throwaway HOME, the checkout as the install source, the
 *      PASS/FAIL contract, and a cleanup that cannot touch anything but its own
 *      temp directory;
 *   2. when BOT_REHEARSAL=1 is set, it runs it. That is the C-13 proof, and it
 *      belongs on a VM, not in a suite.
 *
 * A rehearsal that quietly stopped being a rehearsal — because someone pointed
 * HOME at the real one, or deleted the PASS line — would still exit 0. This is
 * what notices.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts/bot-rehearsal.sh');
const source = readFileSync(SCRIPT, 'utf8');

// ── it parses as bash ───────────────────────────────────────────────────────
try {
  execFileSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
} catch (error) {
  assert.fail(`scripts/bot-rehearsal.sh does not parse:\n${error.stderr || error.message}`);
}

// ── it runs somewhere that is not this machine ──────────────────────────────
assert.match(
  source,
  /export HOME="\$TMP\/home"/,
  'the rehearsal must install into a throwaway HOME, not the real one',
);
assert.match(
  source,
  /export CORTEO_SRC="file:\/\/\$REPO"/,
  'the rehearsal must install from the checkout, not from the network',
);
assert.match(
  source,
  /mktemp -d/,
  'the throwaway HOME has to come from mktemp',
);

// ── it ends in a verdict a caller can read ─────────────────────────────────
assert.match(source, /^\s*printf 'BOT_REHEARSAL=PASS\\n'/m, 'the rehearsal must print BOT_REHEARSAL=PASS');
assert.match(source, /^\s*printf 'BOT_REHEARSAL=FAIL\\n'/m, 'the rehearsal must print BOT_REHEARSAL=FAIL on the way out');

// ── it proves the video, not just the exit code ────────────────────────────
assert.match(source, /codec_name !== "h264"/, 'the rehearsal must check the codec');
assert.match(source, /duration > 1\.5 && duration < 3/, 'the rehearsal must check the duration it asked for');
assert.match(source, /selftest\.mp4/, 'the rehearsal must render its own file');

// ── it cleans up only what it created ──────────────────────────────────────
const removals = [...source.matchAll(/^\s*rm\s+.*$/gm)].map((match) => match[0].trim());
assert.deepEqual(
  removals,
  ['rm -rf -- "${TMP:?}"'],
  'the only deletion may be the mktemp directory, and it must use ${TMP:?} so an empty TMP cannot widen it',
);

// ── the opt-in run ─────────────────────────────────────────────────────────
if (process.env.BOT_REHEARSAL === '1') {
  const output = execFileSync('bash', [SCRIPT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  assert.match(output, /^BOT_REHEARSAL=PASS$/m, 'the rehearsal did not pass');
  const video = /^BOT_REHEARSAL_VIDEO=(.+)$/m.exec(output);
  assert.ok(video, 'the rehearsal passed without reporting the render');
  console.log(`bot-rehearsal.verify: ran the rehearsal, render is ${video[1]}`);
} else {
  console.log(
    'bot-rehearsal.verify: ok (structure only — set BOT_REHEARSAL=1 on a clean Linux box to run the install)',
  );
}
