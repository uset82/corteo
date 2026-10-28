// P3-2: platform import uses yt-dlp behind an explicit host allowlist and then
// the normal media-import chain. A fake yt-dlp binary produces a real PNG, so
// this exercises progress, the upload copy and the probe without any network.
// Run: npx tsx server/platform-import.verify.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ffmpegBin } from './media-binaries.ts';

const scratch = await mkdtemp(join(tmpdir(), 'occ-platform-import-'));
process.env.OPENCHATCUT_DATA_DIR = join(scratch, 'data');
delete process.env.OPENCHATCUT_DEV_PROFILE_ID;
const {
  PLATFORM_HOSTS, downloadPlatformMedia, platformArgs, platformProgress, platformTarget, ytDlpBinary,
} = await import('./platform-import.ts');
const { parseImportPlatformRequest } = await import('./plugins/platform-import.ts');

try {
  const fixture = join(scratch, 'fixture.png');
  execFileSync(ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=red:s=320x180', '-frames:v', '1', fixture]);
  const binary = join(scratch, 'fake-yt-dlp.sh');
  await writeFile(binary, `#!/bin/sh
out=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
dir=$(dirname "$out")
cp "$FAKE_MEDIA_SOURCE" "$dir/fake.png"
echo "[download]  50.0% of 1MiB"
echo "[download] 100% of 1MiB"
echo "$dir/fake.png"
`);
  await chmod(binary, 0o755);
  process.env.FAKE_MEDIA_SOURCE = fixture;
  process.env.OPENCHATCUT_YTDLP = binary;
  assert.equal(ytDlpBinary(), binary);

  assert.deepEqual(platformTarget('https://youtu.be/abc'), { url: 'https://youtu.be/abc', host: 'youtu.be' });
  assert.equal(platformTarget('https://www.bilibili.com/video/BV1').host, 'www.bilibili.com');
  assert.throws(() => platformTarget('https://example.com/watch'), /unsupported platform host/);
  assert.throws(() => platformTarget('https://youtube.com.evil.test/watch'), /unsupported platform host/);
  assert.throws(() => platformTarget('https://user:pass@youtube.com/watch'), /credentials/);
  assert.throws(() => platformTarget('ftp://youtube.com/x'), /http\(s\)/);
  assert.ok(PLATFORM_HOSTS.has('b23.tv'));

  assert.equal(platformProgress('[download]  42.3% of 10MiB'), 42.3);
  assert.equal(platformProgress('[download] 100% of 10MiB'), 100);
  assert.equal(platformProgress('[info] x'), null);
  assert.match(platformArgs('https://youtu.be/x', '/tmp/out').join(' '), /-f bv\*\+ba\/b -S res,fps/);
  assert.match(platformArgs('https://youtu.be/x', '/tmp/out', { startSeconds: 5, endSeconds: 10 }).join(' '), /--download-sections \*5-10/);
  assert.throws(() => platformArgs('https://youtu.be/x', '/tmp/out', { startSeconds: 10, endSeconds: 5 }), /greater than/);

  const progress: number[] = [];
  const result = await downloadPlatformMedia('https://www.youtube.com/watch?v=abc', {
    binary,
    rootDir: scratch,
    knownHashes: [],
    onProgress: (percent) => progress.push(percent),
  });
  assert.deepEqual(progress, [50, 100]);
  assert.equal(result.platform, 'www.youtube.com');
  assert.equal(result.title, 'fake.png');
  assert.match(result.file.src, /^\/media\/uploads\//);
  assert.match(result.file.contentHash, /^[0-9a-f]{64}$/);
  assert.equal(result.file.kind, 'image');
  assert.ok(result.file.size > 0);
  assert.ok(result.file.width && result.file.height);

  const duplicate = await downloadPlatformMedia('https://www.youtube.com/watch?v=same', {
    binary, rootDir: scratch, knownHashes: [result.file.contentHash],
  }).then(() => null, (error) => error as Error);
  assert.match(duplicate?.message ?? '', /already in the media pool/);

  const request = parseImportPlatformRequest({
    url: 'https://youtu.be/abc', knownHashes: ['ab'.repeat(32), 7], startSeconds: 2, endSeconds: 4, name: 'Clip',
  });
  assert.deepEqual(request.section, { startSeconds: 2, endSeconds: 4 });
  assert.deepEqual(request.knownHashes, ['ab'.repeat(32)]);
  assert.throws(() => parseImportPlatformRequest({ url: 'https://example.com/x' }), /unsupported/);
  assert.equal(parseImportPlatformRequest({ url: 'https://vimeo.com/x' }).url, 'https://vimeo.com/x');

  assert.ok((await readdir(scratch)).some((name) => name === 'data'), 'the media profile was isolated');
  console.log('platform-import.verify: allowlist, progress, fake download and duplicate skip OK');
} finally {
  await rm(scratch, { recursive: true, force: true });
}
