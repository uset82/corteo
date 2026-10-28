// The platform route is the only place corteo spawns a downloader, so these
// checks are about the two things that go wrong quietly: a URL that was never
// allowlisted reaching the binary, and a failed download leaving a file in the
// pool that the preview then has to explain.
//
// The downloader itself is exercised through an injected runner: no network, no
// 40 MB binary, and the exact stdout format is pinned.
// npx tsx server/plugins/platform-import.verify.ts
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.OPENCHATCUT_DATA_DIR = await mkdtemp(join(tmpdir(), 'platform-import-'));
const {
  PlatformImportError,
  downloadSection,
  finalFilePath,
  importPlatformVideo,
  parseProgress,
  parseReportLine,
  platformImportPlugin,
  ytdlpArgs,
} = await import('./platform-import.ts');
const { platformHostOf } = await import('../../shared/platform-urls.ts');
const { ytDlpBin } = await import('../media-binaries.ts');

const scratch = await mkdtemp(join(tmpdir(), 'platform-import-check-'));
const uploads = join(scratch, 'uploads');

try {
  // ── the allowlist is exact, not a substring test ──────────────────────────
  assert.equal(platformHostOf('https://www.youtube.com/watch?v=abc'), 'youtube.com');
  assert.equal(platformHostOf('https://youtu.be/abc'), 'youtu.be');
  assert.equal(platformHostOf('https://m.youtube.com/shorts/abc'), 'youtube.com');
  assert.equal(platformHostOf('https://vimeo.com/12345'), 'vimeo.com');
  assert.equal(platformHostOf('https://www.bilibili.com/video/BV1'), 'bilibili.com');
  assert.equal(platformHostOf('https://b23.tv/abc'), 'b23.tv');
  for (const rejected of [
    'https://example.com/video',
    'https://notyoutube.com/watch?v=abc',
    'https://youtube.com.evil.test/watch?v=abc',
    'ftp://youtube.com/video',
    'javascript:alert(1)',
    'youtube.com/watch?v=abc',
    '',
  ]) {
    assert.equal(platformHostOf(rejected), null, `${rejected} must not be allowlisted`);
  }

  // ── the range is a yt-dlp section, never a raw option ─────────────────────
  assert.equal(downloadSection(undefined, undefined), null);
  assert.equal(downloadSection(10, undefined), '*10-inf', 'a start-only range runs to the end');
  assert.equal(downloadSection(10, 40), '*10-40');
  assert.equal(downloadSection(undefined, 40), '*0-40');
  assert.equal(downloadSection(40, 10), '*40-inf', 'an end before the start is ignored, not treated as a whole video');

  const args = ytdlpArgs({ url: 'https://youtu.be/abc' }, '/tmp/x/source.%(ext)s');
  for (const expected of [
    '--no-playlist', '--no-simulate', '--newline', '--progress',
    'bv*+ba/b', 'res,fps', '--merge-output-format', 'mp4',
  ]) {
    assert.ok(args.includes(expected), `yt-dlp args must include ${expected}`);
  }
  const print = args[args.indexOf('--print') + 1] ?? '';
  assert.match(print, /^after_move:/, 'the credit line is printed after the move');
  for (const field of ['%(filepath)s', '%(title)s', '%(uploader)s', '%(webpage_url)s', '%(license)s']) {
    assert.ok(print.includes(field), `the credit line must carry ${field}`);
  }
  assert.equal(args[args.length - 2], '--', 'the URL is fenced off by --');
  assert.equal(args[args.length - 1], 'https://youtu.be/abc');
  assert.ok(args.indexOf('--download-sections') < 0, 'no range, no section flag');
  const ranged = ytdlpArgs({ url: 'https://youtu.be/abc', startSeconds: 5, endSeconds: 9 }, '/tmp/s.%(ext)s');
  assert.equal(ranged[ranged.indexOf('--download-sections') + 1], '*5-9');
  const withCookies = ytdlpArgs({ url: 'https://vimeo.com/1', cookiesFile: '/keys/cookies.txt' }, '/tmp/s.%(ext)s');
  assert.equal(withCookies[withCookies.indexOf('--cookies') + 1], '/keys/cookies.txt');
  const withFfmpeg = ytdlpArgs({ url: 'https://vimeo.com/1', ffmpegPath: '/opt/ffmpeg/bin/ffmpeg' }, '/tmp/s.%(ext)s');
  assert.equal(withFfmpeg[withFfmpeg.indexOf('--ffmpeg-location') + 1], '/opt/ffmpeg/bin', 'yt-dlp gets the directory, not the file');
  const noFfmpeg = ytdlpArgs({ url: 'https://vimeo.com/1', ffmpegPath: 'ffmpeg' }, '/tmp/s.%(ext)s');
  assert.ok(!noFfmpeg.includes('--ffmpeg-location'), 'a PATH-resolved ffmpeg is left to yt-dlp itself');

  // ── progress and the credit line ──────────────────────────────────────────
  assert.equal(parseProgress('[download]  12.3% of 5.00MiB at 1.00MiB/s')?.toFixed(3), '0.123');
  assert.equal(parseProgress('[download] 100% of 5.00MiB'), 1);
  assert.equal(parseProgress('[youtube] extracting'), null);
  assert.equal(parseProgress('[download] Destination: x.mp4'), null);

  const report = parseReportLine([
    '[youtube] Extracting URL',
    '[download]  50.0% of 10.00MiB',
    '/tmp/scratch/source.mp4\tMy Song\tchan\thttps://youtu.be/abc\tNA',
  ].join('\n'), '/tmp/scratch');
  assert.deepEqual(report, {
    filePath: '/tmp/scratch/source.mp4',
    title: 'My Song',
    uploader: 'chan',
    pageUrl: 'https://youtu.be/abc',
    license: undefined,
  });
  assert.equal(finalFilePath('no path here'), null);
  assert.equal(
    finalFilePath('/elsewhere/source.mp4\tT\tU\tP\tL', '/tmp/scratch'),
    null,
    'a path outside the scratch directory is never published',
  );
  assert.equal(report?.license, undefined, 'license NA is dropped');

  // ── a download lands in uploads only once it is readable media ────────────
  const fakeRunner = (stdoutOf: (args: string[]) => Promise<string>, options: { code?: number; stderr?: string; timedOut?: boolean } = {}) =>
    async (_binary: string, args: string[]) => ({
      code: options.code ?? 0,
      stdout: await stdoutOf(args),
      stderr: options.stderr ?? '',
      timedOut: options.timedOut ?? false,
    });
  const writeTarget = async (args: string[], body = 'fake-mp4') => {
    const template = args[args.indexOf('-o') + 1]!;
    const target = template.replace('%(ext)s', 'mp4');
    await writeFile(target, body);
    return target;
  };
  const progress: number[] = [];
  const imported = await importPlatformVideo({ url: 'https://youtu.be/abc' }, {
    binary: process.execPath,
    uploadsDir: uploads,
    probe: async () => ({
      probe: {
        durationSeconds: 12.5, width: 1920, height: 1080, fps: 30,
        hasAudioTrack: true, hasVideoTrack: true, qualityRisks: [],
      },
    }),
    onProgress: (fraction) => { progress.push(fraction); },
    runner: fakeRunner(async (argv) => {
      const target = await writeTarget(argv);
      return `[download]  50.0% of 10.00MiB\n${target}\tClase de canto\tCanal\t${'https://youtu.be/abc'}\tCC-BY`;
    }),
  });
  assert.ok(imported.path.startsWith('/media/uploads/'), 'the asset src is a /media/uploads path');
  assert.equal(imported.name, 'Clase de canto', 'the platform title is the display name');
  assert.equal(imported.durationSeconds, 12.5);
  assert.deepEqual(imported.source, {
    provider: 'youtu.be',
    title: 'Clase de canto',
    uploader: 'Canal',
    pageUrl: 'https://youtu.be/abc',
    license: 'CC-BY',
  });
  assert.ok(progress.some((fraction) => fraction > 0.05 && fraction < 1), 'download progress is reported');
  assert.equal(progress.at(-1), 0.95, 'the last progress update is the probe');
  const published = (await readdir(uploads)).filter((name) => !name.startsWith('.'));
  assert.equal(published.length, 1, 'one file lands in uploads');
  assert.equal(published[0]!.endsWith('.mp4'), true);
  assert.deepEqual(
    (await readdir(uploads)).filter((name) => name.startsWith('.platform-')),
    [],
    'the scratch directory is always removed',
  );

  // A path override wins, and an unknown title falls back to the uploaded name.
  const named = await importPlatformVideo({ url: 'https://vimeo.com/1', name: 'Mi clip' }, {
    binary: process.execPath,
    uploadsDir: uploads,
    probe: async () => ({ probe: null }),
    runner: fakeRunner(async (argv) => writeTarget(argv)),
  });
  assert.equal(named.name, 'Mi clip');

  // ── every failure mode is a code, and none leaves a file behind ───────────
  const beforeFailures = (await readdir(uploads)).filter((name) => !name.startsWith('.'));
  await assert.rejects(
    () => importPlatformVideo({ url: 'https://example.com/a.mp4' }, { uploadsDir: uploads }),
    (error: unknown) => error instanceof PlatformImportError && error.code === 'platform_unallowed',
  );
  await assert.rejects(
    () => importPlatformVideo({ url: 'https://youtu.be/abc' }, { binary: join(scratch, 'missing-yt-dlp'), uploadsDir: uploads }),
    (error: unknown) => error instanceof PlatformImportError && error.code === 'yt_dlp_missing',
  );
  await assert.rejects(
    () => importPlatformVideo({ url: 'https://youtu.be/abc' }, {
      binary: process.execPath, uploadsDir: uploads,
      runner: fakeRunner(async () => '', { code: 1, stderr: 'ERROR: Video unavailable' }),
    }),
    (error: unknown) => error instanceof PlatformImportError
      && error.code === 'download_failed'
      && /Video unavailable/.test(error.message),
  );
  await assert.rejects(
    () => importPlatformVideo({ url: 'https://youtu.be/abc' }, {
      binary: process.execPath, uploadsDir: uploads,
      runner: fakeRunner(async () => '', { timedOut: true }),
    }),
    (error: unknown) => error instanceof PlatformImportError && error.code === 'download_timeout',
  );
  await assert.rejects(
    () => importPlatformVideo({ url: 'https://youtu.be/abc' }, {
      binary: process.execPath, uploadsDir: uploads,
      probe: async () => ({ error: 'downloaded file is not readable mp4' }),
      runner: fakeRunner(async (argv) => {
        const target = await writeTarget(argv, '<html>blocked</html>');
        return target;
      }),
    }),
    (error: unknown) => error instanceof PlatformImportError && error.code === 'not_media',
  );
  const afterFailures = (await readdir(uploads)).filter((name) => !name.startsWith('.'));
  assert.deepEqual(afterFailures, beforeFailures, 'a failed download publishes nothing new');
  assert.deepEqual(
    (await readdir(uploads)).filter((name) => name.startsWith('.platform-')),
    [],
    'a failed download still removes its scratch directory',
  );

  // ── the binary resolves from vendor/ and takes the explicit override ──────
  const saved = process.env.OPENCHATCUT_YTDLP;
  try {
    delete process.env.OPENCHATCUT_YTDLP;
    assert.match(
      ytDlpBin(),
      new RegExp(`vendor[/\\\\]yt-dlp[/\\\\]${process.platform}-${process.arch}`),
      'the pinned binary lives under vendor/yt-dlp/<platform>',
    );
    process.env.OPENCHATCUT_YTDLP = join(scratch, 'custom', 'yt-dlp');
    assert.equal(ytDlpBin(), join(scratch, 'custom', 'yt-dlp'), 'OPENCHATCUT_YTDLP wins');
  } finally {
    if (saved === undefined) delete process.env.OPENCHATCUT_YTDLP;
    else process.env.OPENCHATCUT_YTDLP = saved;
  }

  // ── the plugin exposes exactly the mutation route ─────────────────────────
  const routes: string[] = [];
  const plugin = platformImportPlugin();
  assert.equal(plugin.name, 'openchatcut-platform-import');
  const configure = (plugin as unknown as { configureServer: (server: unknown) => void }).configureServer;
  configure({
    middlewares: { use: (path: string) => { routes.push(path); } },
    config: { logger: { error: () => {}, info: () => {} } },
  });
  assert.deepEqual(routes, ['/api/import-platform']);
} finally {
  delete process.env.OPENCHATCUT_DATA_DIR;
  await rm(scratch, { recursive: true, force: true });
}

console.log('platform-import.verify: the allowlist gates the downloader, and a failed fetch never reaches the pool');
