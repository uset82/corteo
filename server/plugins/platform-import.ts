// POST /api/import-platform — download a public platform video with the pinned
// yt-dlp (scripts/sync-yt-dlp.mjs) and land it in /media/uploads as a normal
// media-pool source.
//
// Only allowlisted platforms and http(s) URLs reach the binary: an arbitrary
// URL piped to a downloader on the user's machine is an SSRF/abuse hole, and
// the allowlist is the whole point of this route existing next to
// /api/import-url.
//
// The download runs as a generation job: a multi-hundred-MB fetch cannot hold
// an HTTP request open, and the dialog and the agent both already know how to
// follow progress through /generate/progress.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadDir } from '../media-dir.ts';
import { ffmpegBin, ytDlpBin } from '../media-binaries.ts';
import { sha256File } from '../../shared/node-content-hash.ts';
import { platformHostOf, type PlatformHost } from '../../shared/platform-urls.ts';
import type { ProbeResult } from '../../shared/media-probe.ts';
import { probeImportedFile, type ImportProbe } from './import-probe.ts';
import { createGenerationJob } from './generation-jobs.ts';
import type { GenerationResult, UpdateGenerationJob } from './generation-job-types.ts';
import { editorCredentialAuthorized } from '../editor-auth.ts';
import { scrubInternalPaths } from '../error-scrub.ts';
import { readBody, sendError, sendJson } from './upload-route-http.ts';

const DOWNLOAD_TIMEOUT_MS = 45 * 60_000;
const MAX_JSON = 16 * 1024;

export type PlatformImportErrorCode =
  | 'platform_unallowed'
  | 'yt_dlp_missing'
  | 'download_failed'
  | 'download_timeout'
  | 'empty_download'
  | 'not_media';

export class PlatformImportError extends Error {
  readonly code: PlatformImportErrorCode;

  constructor(code: PlatformImportErrorCode, message: string) {
    super(message);
    this.name = 'PlatformImportError';
    this.code = code;
  }
}

export interface PlatformImportInput {
  url: string;
  startSeconds?: number;
  endSeconds?: number;
  name?: string;
}

export interface PlatformSourceCredit {
  provider?: string;
  title?: string;
  uploader?: string;
  pageUrl?: string;
  license?: string;
}

export interface PlatformImportResult {
  assetId: string;
  path: string;
  name: string;
  bytes: number;
  contentHash: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  fps?: number;
  sourceUrl: string;
  platform: PlatformHost;
  source: PlatformSourceCredit;
  probe: ProbeResult | null;
}

/** `--download-sections` argument for a range, or null for the whole video. */
export function downloadSection(startSeconds?: number, endSeconds?: number): string | null {
  const start = Number.isFinite(startSeconds) && Number(startSeconds) >= 0 ? Number(startSeconds) : undefined;
  const end = Number.isFinite(endSeconds) && Number(endSeconds) > (start ?? 0) ? Number(endSeconds) : undefined;
  if (start === undefined && end === undefined) return null;
  return `*${start ?? 0}-${end ?? 'inf'}`;
}

export interface YtDlpArgsInput extends PlatformImportInput {
  cookiesFile?: string | null;
  ffmpegPath?: string | null;
}

/** The download is pinned to the best video+audio merge the editor can read. */
export function ytdlpArgs(input: YtDlpArgsInput, outputTemplate: string): string[] {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-simulate',
    '--newline',
    '--progress',
    '-f', 'bv*+ba/b',
    '-S', 'res,fps',
    '--merge-output-format', 'mp4',
    // One tab-separated line after the move: the file path plus the credit fields.
    '--print', 'after_move:%(filepath)s\t%(title)s\t%(uploader)s\t%(webpage_url)s\t%(license)s',
    '-o', outputTemplate,
  ];
  const section = downloadSection(input.startSeconds, input.endSeconds);
  if (section) args.push('--download-sections', section);
  if (input.cookiesFile) args.push('--cookies', input.cookiesFile);
  if (input.ffmpegPath && isAbsolute(input.ffmpegPath)) args.push('--ffmpeg-location', dirname(input.ffmpegPath));
  // `--` keeps a URL that starts with `-` from being read as an option.
  args.push('--', input.url);
  return args;
}

/** `[download]  12.3% of 5.00MiB at …` → 0.123; anything else → null. */
export function parseProgress(line: string): number | null {
  if (!line.startsWith('[download]')) return null;
  const match = line.match(/(\d+(?:\.\d+)?)%/);
  if (!match) return null;
  const percent = Number(match[1]);
  if (!Number.isFinite(percent)) return null;
  return Math.min(1, Math.max(0, percent / 100));
}

export interface YtDlpReport {
  filePath: string | null;
  title?: string;
  uploader?: string;
  pageUrl?: string;
  license?: string;
}

/** Parse the single tab-separated credit line yt-dlp prints after moving the file. */
export function parseReportLine(output: string, root?: string): YtDlpReport | null {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    const [first, ...rest] = line.split('\t');
    if (!first || !isAbsolute(first)) continue;
    if (root && !insideDir(root, first)) continue;
    const [title, uploader, pageUrl, license] = rest.map(cleanField);
    return {
      filePath: first,
      title, uploader, pageUrl, license,
    };
  }
  return null;
}

/** The final path yt-dlp printed, or null when the output has none inside `root`. */
export function finalFilePath(output: string, root?: string): string | null {
  return parseReportLine(output, root)?.filePath ?? null;
}

function insideDir(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function cleanField(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text && text !== 'NA' && text !== 'N/A' ? text : undefined;
}

export type YtDlpRunner = (
  binary: string,
  args: string[],
  options: { timeoutMs: number; onLine?: (line: string) => void },
) => Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>;

export const defaultRunner: YtDlpRunner = (binary, args, options) => new Promise((resolvePromise) => {
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '';
  let stderr = '';
  let pending = '';
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, options.timeoutMs);
  const consume = (chunk: Buffer) => {
    pending += chunk.toString('utf8');
    let index = pending.search(/\r\n|\r|\n/);
    while (index >= 0) {
      const line = pending.slice(0, index);
      pending = pending.slice(index + (pending.startsWith('\r\n', index) ? 2 : 1));
      if (line) options.onLine?.(line);
      index = pending.search(/\r\n|\r|\n/);
    }
  };
  child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); consume(chunk); });
  child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
  child.on('error', (error) => {
    clearTimeout(timer);
    resolvePromise({ code: null, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut });
  });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (pending) options.onLine?.(pending);
    resolvePromise({ code, stdout, stderr, timedOut });
  });
});

export interface PlatformImportDeps {
  binary?: string;
  cookiesFile?: string | null;
  ffmpegPath?: string | null;
  uploadsDir?: string;
  runner?: YtDlpRunner;
  probe?: (path: string, fileName: string) => Promise<ImportProbe>;
  onProgress?: (fraction: number, phase: string) => Promise<void> | void;
  timeoutMs?: number;
}

function lastMeaningfulLine(...texts: string[]): string {
  for (const text of texts) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const error = [...lines].reverse().find((line) => /error|unable|failed|not available/i.test(line));
    if (error) return error.replace(/^ERROR:\s*/i, '');
    if (lines.length) return lines[lines.length - 1]!;
  }
  return 'yt-dlp exited without a reason';
}

async function firstDownloadedFile(scratch: string): Promise<string | null> {
  const names = await readdir(scratch).catch(() => [] as string[]);
  const usables = names.filter((name) => !name.startsWith('.') && !/\.(part|ytdl|temp)$/i.test(name));
  return usables[0] ? join(scratch, usables[0]) : null;
}

/**
 * Download, probe, and publish one platform video. The file is fetched into a
 * scratch directory first so a failed or unreadable download never leaves a
 * half-written .mp4 in the pool that the preview then has to explain.
 */
export async function importPlatformVideo(
  input: PlatformImportInput,
  deps: PlatformImportDeps = {},
): Promise<PlatformImportResult> {
  const platform = platformHostOf(input.url);
  if (!platform) {
    throw new PlatformImportError(
      'platform_unallowed',
      'only YouTube, Vimeo and Bilibili links are supported; use download_media for a direct file URL',
    );
  }
  const binary = deps.binary ?? ytDlpBin();
  if (!existsSync(binary)) {
    throw new PlatformImportError(
      'yt_dlp_missing',
      'yt-dlp is not provisioned. Run npm run sync:yt-dlp (or set OPENCHATCUT_YTDLP) and try again.',
    );
  }
  const uploads = deps.uploadsDir ?? uploadDir();
  await mkdir(uploads, { recursive: true });
  const scratch = await mkdtemp(join(uploads, '.platform-'));
  const runner = deps.runner ?? defaultRunner;
  try {
    const args = ytdlpArgs({
      ...input,
      cookiesFile: deps.cookiesFile === undefined ? process.env.YTDLP_COOKIES_FILE : deps.cookiesFile,
      ffmpegPath: deps.ffmpegPath === undefined ? ffmpegBin() : deps.ffmpegPath,
    }, join(scratch, 'source.%(ext)s'));
    await deps.onProgress?.(0.02, 'starting');
    const run = await runner(binary, args, {
      timeoutMs: deps.timeoutMs ?? DOWNLOAD_TIMEOUT_MS,
      onLine: (line) => {
        const fraction = parseProgress(line);
        if (fraction !== null) void deps.onProgress?.(0.05 + fraction * 0.85, 'downloading');
      },
    });
    if (run.timedOut) {
      throw new PlatformImportError('download_timeout', 'the platform download timed out');
    }
    if (run.code !== 0) {
      throw new PlatformImportError('download_failed', lastMeaningfulLine(run.stderr, run.stdout));
    }
    const report = parseReportLine(run.stdout, scratch);
    const downloaded = report?.filePath ?? await firstDownloadedFile(scratch);
    if (!downloaded) {
      throw new PlatformImportError('empty_download', 'yt-dlp reported success but wrote no file');
    }
    const extension = extname(downloaded).toLowerCase() || '.mp4';
    const assetId = randomUUID();
    const fileName = `${assetId}${extension}`;
    const finalPath = join(uploads, fileName);
    await rename(downloaded, finalPath);
    await deps.onProgress?.(0.95, 'probing');
    const probed = await (deps.probe ?? probeImportedFile)(finalPath, fileName);
    if ('error' in probed) {
      await rm(finalPath, { force: true }).catch(() => undefined);
      throw new PlatformImportError('not_media', probed.error);
    }
    const info = await stat(finalPath);
    return {
      assetId,
      path: `/media/uploads/${fileName}`,
      name: input.name?.trim() || report?.title?.trim() || fileName,
      bytes: info.size,
      contentHash: await sha256File(finalPath),
      durationSeconds: probed.probe?.durationSeconds ?? 0,
      width: probed.probe?.width,
      height: probed.probe?.height,
      fps: probed.probe?.fps,
      sourceUrl: input.url,
      platform,
      source: {
        provider: platform,
        title: report?.title,
        uploader: report?.uploader,
        pageUrl: report?.pageUrl ?? input.url,
        license: report?.license,
      },
      probe: probed.probe,
    };
  } finally {
    await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function generationResultOf(imported: PlatformImportResult): GenerationResult {
  return {
    assetId: imported.assetId,
    kind: 'video',
    name: imported.name,
    path: imported.path,
    durationSeconds: imported.durationSeconds,
    width: imported.width,
    height: imported.height,
    fps: imported.fps,
    sizeBytes: imported.bytes,
    source: imported.source,
  };
}

interface ImportPlatformBody {
  url?: string;
  name?: string;
  startSeconds?: number;
  endSeconds?: number;
  operationId?: string;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function handleImportPlatform(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}') as ImportPlatformBody;
    const url = String(body.url ?? '').trim();
    const platform = platformHostOf(url);
    if (!platform) {
      sendJson(res, 400, {
        ok: false,
        code: 'platform_unallowed',
        error: 'only YouTube, Vimeo and Bilibili links are supported',
      });
      return;
    }
    const startSeconds = finiteNumber(body.startSeconds);
    const endSeconds = finiteNumber(body.endSeconds);
    if (startSeconds !== undefined && endSeconds !== undefined && endSeconds <= startSeconds) {
      sendJson(res, 400, { ok: false, code: 'invalid_range', error: 'endSeconds must be greater than startSeconds' });
      return;
    }
    const input: PlatformImportInput = {
      url,
      startSeconds,
      endSeconds,
      name: typeof body.name === 'string' ? body.name : undefined,
    };
    const submission = await createGenerationJob(
      { kind: 'platform-import', url, platform, startSeconds, endSeconds },
      async (_jobId: string, update: UpdateGenerationJob, registerDownload) => {
        const imported = await importPlatformVideo(input, {
          onProgress: (fraction, phase) => update({ progress: Math.round(fraction * 100), phase }),
        });
        const result = generationResultOf(imported);
        await registerDownload(imported.path, async () => result);
        return result;
      },
      {
        operationId: body.operationId,
        provider: 'yt-dlp',
        toolName: 'import_from_platform',
        label: input.name ?? url,
        submitArgs: { url, startSeconds, endSeconds },
        expectedResultCount: 1,
      },
    );
    sendJson(res, 202, { ok: true, platform, ...submission });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof PlatformImportError ? error.code : 'import_failed';
    sendJson(res, error instanceof PlatformImportError ? 409 : 500, { ok: false, code, error: scrubInternalPaths(message) });
  }
}

export function platformImportPlugin(): Plugin {
  return {
    name: 'openchatcut-platform-import',
    configureServer(server) {
      server.middlewares.use('/api/import-platform', (req, res) => {
        if (req.method !== 'POST') {
          sendError(res, 405, 'method not allowed — use POST');
          return;
        }
        if (!editorCredentialAuthorized(req, true)) {
          req.resume();
          sendError(res, 401, 'editor credential required');
          return;
        }
        void handleImportPlatform(req, res).catch((error: unknown) => {
          server.config.logger.error(`[import-platform] ${error instanceof Error ? error.message : String(error)}`);
        });
      });
    },
  };
}
