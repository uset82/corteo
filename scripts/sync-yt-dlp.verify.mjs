// P3-1: the pinned yt-dlp download verifies size + SHA-256 and a second run is
// a no-op. No network here: the download seam returns fixture bytes.
// Run: node scripts/sync-yt-dlp.verify.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  VERSION, PLATFORMS, assetProblem, binaryPath, provenancePath, provenanceProblem, provision, sha256,
} from './sync-yt-dlp.mjs';

assert.match(VERSION, /^\d{4}\.\d{2}\.\d{2}$/);
for (const [platform, spec] of Object.entries(PLATFORMS)) {
  assert.match(spec.sha256, /^[0-9a-f]{64}$/, `${platform} pins a sha256`);
  assert.ok(spec.bytes > 1_000_000, `${platform} pins the full asset size`);
  assert.match(binaryPath(platform, spec), new RegExp(`vendor/yt-dlp/${platform}/${spec.executable.replace('.', '\\.')}$`));
}

const bytes = new TextEncoder().encode('pinned yt-dlp fixture');
const spec = { asset: 'yt-dlp-fixture', bytes: bytes.length, sha256: sha256(bytes), executable: 'yt-dlp-fixture' };
assert.equal(assetProblem(bytes, spec), null);
assert.match(assetProblem(bytes.subarray(1), spec) ?? '', /pinned size/);
assert.match(assetProblem(new Uint8Array(bytes.length).fill(3), spec) ?? '', /does not match the pinned/);

assert.equal(provenanceProblem({ version: VERSION, asset: spec.asset, bytes: spec.bytes, sha256: spec.sha256 }, spec), null);
assert.match(provenanceProblem({ ...spec, version: '1999.01.01', asset: spec.asset, sha256: spec.sha256 }, spec) ?? '', /version/);
assert.match(provenanceProblem({ version: VERSION, asset: spec.asset, bytes: spec.bytes, sha256: '0'.repeat(64) }, spec) ?? '', /sha256/);

const root = await mkdtemp(join(tmpdir(), 'yt-dlp-sync-'));
try {
  const binary = join(root, 'fixture', spec.executable);
  await mkdir(dirname(binary), { recursive: true });
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    assert.match(url, new RegExp(`${VERSION}/yt-dlp-fixture$`));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer };
  };

  const first = await provision({ platform: 'test-x64', spec, binary, fetchImpl });
  assert.equal(first.ok, true);
  assert.equal(first.provisioned, false);
  assert.equal(calls, 1);
  assert.deepEqual(new Uint8Array(await readFile(binary)), bytes);
  const provenance = JSON.parse(await readFile(provenancePath(binary), 'utf8'));
  assert.equal(provenance.version, VERSION);
  assert.equal(provenance.sha256, spec.sha256);

  const second = await provision({ platform: 'test-x64', spec, binary, fetchImpl });
  assert.equal(second.ok, true);
  assert.equal(second.provisioned, true, 'a valid binary is a no-op');
  assert.equal(calls, 1, 'the second run does not hit the network');

  await writeFile(binary, 'corrupted');
  const checked = await provision({ platform: 'test-x64', spec, binary, fetchImpl, check: true });
  assert.equal(checked.ok, false);
  assert.match(checked.reason ?? '', /pinned size|does not match the pinned/);
  assert.equal(calls, 1, 'check never downloads');
  const repaired = await provision({ platform: 'test-x64', spec, binary, fetchImpl });
  assert.equal(repaired.provisioned, false, 'a corrupt binary is downloaded again');
  assert.equal(calls, 2);
  assert.deepEqual(new Uint8Array(await readFile(binary)), bytes);

  await rm(binary);
  await assert.rejects(
    () => provision({
      platform: 'test-x64', spec, binary,
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(2).buffer }),
    }),
    /failed verification/,
  );
  assert.equal((await import('node:fs')).existsSync(binary), false, 'a bad download is never installed');
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('sync-yt-dlp.verify: pinned size/sha256, no-op rerun and bad-download rejection OK');
