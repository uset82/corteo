// The platform-import route spawns the pinned yt-dlp binary, so a truncated
// download or a placeholder script must never be installed — the same lesson as
// scripts/sync-whisper-cli.verify.mjs: the skip path is a verification, not
// existsSync().
// node scripts/sync-yt-dlp.verify.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MIN_YTDLP_BINARY_BYTES,
  PLATFORMS,
  VERSION,
  assetProblem,
  pinsFromRelease,
  platformKey,
  provisionedProblem,
  releaseUrl,
  rewritePins,
  versionProbeProblem,
} from './sync-yt-dlp.mjs';

// ── the pin table is complete and names a real asset per platform ───────────
assert.match(VERSION, /^\d{4}\.\d{2}\.\d{2}$/);
for (const [key, spec] of Object.entries(PLATFORMS)) {
  assert.ok(spec.bytes > 1_000_000, `${key} pins the asset size`);
  assert.match(spec.sha256, /^[0-9a-f]{64}$/, `${key} pins a sha256 for ${spec.asset}`);
  assert.ok(['yt-dlp', 'yt-dlp.exe'].includes(spec.executable), `${key} names its executable`);
  assert.match(releaseUrl(VERSION, spec.asset), /^https:\/\/github\.com\/yt-dlp\/yt-dlp\/releases\/download\//);
}
assert.equal(platformKey('linux', 'x64'), 'linux-x64');
assert.equal(platformKey('darwin', 'arm64'), 'darwin-arm64');
assert.ok(!PLATFORMS[platformKey('freebsd', 'x64')], 'unknown platforms fall through to an error, not a guess');

// ── an asset is judged before anything is written ───────────────────────────
{
  const bytes = new Uint8Array(2_000_000).fill(7);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const spec = { bytes: bytes.length, sha256: digest };
  assert.equal(assetProblem(bytes, spec), null, 'the pinned asset is accepted');
  assert.match(
    assetProblem(bytes.subarray(0, 1_000), spec) ?? '',
    /1000 bytes, pinned size is 2000000/,
    'a truncated download is rejected on size',
  );
  assert.match(
    assetProblem(new Uint8Array(bytes.length).fill(8), spec) ?? '',
    /does not match the pinned/,
    'same size, different bytes is rejected on digest',
  );
}

// ── `--version` has to actually run and name the pinned build ───────────────
{
  assert.equal(versionProbeProblem(0, `${VERSION}\n`, VERSION), null);
  assert.match(versionProbeProblem(127, '', VERSION) ?? '', /exited 127/, 'a binary that cannot start is rejected');
  assert.match(versionProbeProblem(0, '', VERSION) ?? '', /printed nothing/, 'a placeholder that exits 0 is rejected');
  assert.match(
    versionProbeProblem(0, '2026.08.01', VERSION) ?? '',
    /reports 2026\.08\.01, pinned is/,
    'a stale build is caught even when the file looks right',
  );
  assert.match(versionProbeProblem(0, 'hello', null) ?? '', /not a yt-dlp version/);
}

// ── a GitHub release payload becomes the pin table, or fails loudly ─────────
{
  const release = (tag, overrides = {}) => ({
    tag_name: tag,
    assets: [
      { name: 'yt-dlp.exe', size: 10, digest: `sha256:${'a'.repeat(64)}` },
      { name: 'yt-dlp_macos', size: 11, digest: `sha256:${'b'.repeat(64)}` },
      { name: 'yt-dlp_linux', size: 12, digest: `sha256:${'c'.repeat(64)}` },
      { name: 'yt-dlp_linux_aarch64', size: 13, digest: `sha256:${'d'.repeat(64)}` },
    ],
    ...overrides,
  });

  const pins = pinsFromRelease(release('2099.01.02'));
  assert.equal(pins.version, '2099.01.02');
  assert.equal(pins.platforms['win32-x64'].executable, 'yt-dlp.exe');
  assert.equal(pins.platforms['darwin-arm64'].asset, 'yt-dlp_macos');
  assert.equal(pins.platforms['linux-arm64'].bytes, 13);
  assert.equal(pins.platforms['linux-x64'].sha256, 'c'.repeat(64));

  assert.throws(() => pinsFromRelease({ tag_name: 'nope', assets: [] }), /no usable tag_name/);
  assert.throws(() => pinsFromRelease(release('2099.01.02', { assets: [] })), /has no yt-dlp\.exe/);
  assert.throws(
    () => pinsFromRelease(release('2099.01.02', {
      assets: [
        { name: 'yt-dlp.exe', size: 1, digest: 'sha256:abc' },
        { name: 'yt-dlp_macos', size: 1, digest: `sha256:${'b'.repeat(64)}` },
        { name: 'yt-dlp_linux', size: 1, digest: `sha256:${'c'.repeat(64)}` },
        { name: 'yt-dlp_linux_aarch64', size: 1, digest: `sha256:${'d'.repeat(64)}` },
      ],
    })),
    /no sha256 digest/,
    'a release without digests cannot be pinned',
  );
}

// ── `--update` rewrites this file's own pin, and only the pin ───────────────
{
  const source = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'sync-yt-dlp.mjs'), 'utf8');
  assert.equal(
    rewritePins(source, { version: VERSION, platforms: PLATFORMS }),
    source,
    'rewriting with the current pins is a no-op, so --update diffs only when the version moves',
  );

  const rewritten = rewritePins(source, {
    version: '2099.01.02',
    platforms: { 'linux-x64': { asset: 'yt-dlp_linux', bytes: 1_234_567, sha256: 'e'.repeat(64), executable: 'yt-dlp' } },
  });
  assert.match(rewritten, /export const VERSION = '2099\.01\.02';/);
  assert.match(rewritten, /bytes: 1_234_567,/);
  assert.ok(!rewritten.includes(VERSION), 'the old pin is gone');
  assert.ok(rewritten.includes('export const PROVENANCE_SUFFIX'), 'everything outside the pin survives');

  assert.throws(() => rewritePins('no constants here', { version: '1', platforms: {} }), /VERSION constant not found/);
  assert.throws(() => rewritePins('export const VERSION = \'x\';', { version: '1', platforms: {} }), /PLATFORMS constant not found/);
}

// ── the skip path is a verification, not existsSync() ──────────────────────
{
  const expected = { version: VERSION, assetSha256: 'a'.repeat(64) };
  const record = { version: VERSION, source: 'asset', assetSha256: 'a'.repeat(64), binarySha256: 'b'.repeat(64) };
  const binary = { bytes: 41_000_000, executable: true, sha256: 'b'.repeat(64) };
  const good = { expected, record, binary, probe: { problem: null } };

  assert.equal(provisionedProblem(good), null, 'a verified binary is reused');
  assert.match(provisionedProblem({ ...good, record: null }) ?? '', /no provenance record/);
  assert.match(
    provisionedProblem({ ...good, record: { ...record, version: '2026.01.01' } }) ?? '',
    /want 2026\.10\.26|want/,
    'a stale upstream version is re-provisioned',
  );
  assert.match(
    provisionedProblem({ ...good, record: { ...record, assetSha256: 'c'.repeat(64) } }) ?? '',
    /asset digest does not match/,
    'a binary from a different asset than the pinned one is re-provisioned',
  );
  assert.match(provisionedProblem({ ...good, binary: null }) ?? '', /binary is missing/);
  assert.match(
    provisionedProblem({ ...good, binary: { bytes: 17, executable: true, sha256: 'b'.repeat(64) } }) ?? '',
    /only 17 bytes/,
    'the 17-byte "#!/bin/sh; exit 0" placeholder never survives',
  );
  assert.equal(MIN_YTDLP_BINARY_BYTES, 1 << 20);
  assert.match(provisionedProblem({ ...good, binary: { ...binary, executable: false } }) ?? '', /not executable/);
  assert.match(
    provisionedProblem({ ...good, binary: { ...binary, sha256: 'd'.repeat(64) } }) ?? '',
    /does not match its provenance digest/,
    'bytes replaced after provisioning are caught',
  );
  assert.match(
    provisionedProblem({ ...good, probe: { problem: '`--version` exited 127' } }) ?? '',
    /exited 127/,
    'a probe failure re-provisions even when the digests line up',
  );

  // An explicitly supplied binary has no knowable upstream version, but it is
  // still held to the digest, size, executable-bit and probe checks.
  const override = { ...record, source: 'override', version: null, assetSha256: null };
  assert.equal(provisionedProblem({ ...good, record: override }), null);
  assert.match(
    provisionedProblem({ ...good, record: override, binary: { bytes: 17, executable: true, sha256: 'b'.repeat(64) } }) ?? '',
    /only 17 bytes/,
  );
}

console.log('sync-yt-dlp.verify: the pin is checked before install, and the skip path verifies');
