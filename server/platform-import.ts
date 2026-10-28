// P3-2: download a platform page with the pinned yt-dlp into the media pool.
// The URL allowlist is explicit; progress is emitted while yt-dlp runs, and the
// finished file goes through the same directory-import chain as a local file
// (ffprobe, content hash, normalized previews). Tests inject a fake yt-dlp, so
// no network is used by the regression.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DirectoryImportedFile } from '../shared/directory-import.ts';
import {
  canonicalCurrentUploadDirectory,
  importDirectoryCandidate,
} from './directory-watch-import.ts';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DOWNLOAD_TIMEOUT_MS = 20 * 60_000;
const MEDIA_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4a', '.mp3', '.wav', '.opus', '.flac', '.aac', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

import { platformTarget } from '../shared/platform-import.ts';

export { PLATFORM_HOSTS, platformTarget } from '../shared/platform-import.ts';
export type { PlatformTarget } from '../shared/platform-import.ts';

export function ytDlpBinary(explicit = process.env.OPENCHATCUT_YTDLP): string {
  if (explicit && existsSync(explicit)) return explicit;
  const executable = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const bundled = join(ROOT, 'vendor', 'yt-dlp', `${process.platform}-${process.arch}`, executable);
  if (existsSync(bundled)) return bundled;
  throw new Error('yt-dlp is not installed; run npm run sync:yt-dlp');
}

export interface PlatformSection {
  startSeconds?: number;
  endSeconds?: number;
}

function sectionSpec(section?: PlatformSection): string | null {
  const start = section?.startSeconds;
  const end = section?.endSeconds;
  if (start === undefined && end === undefined) return null;
  if (start !== undefined && (!Number.isFinite(start) || start < 0)) throw new Error('startSeconds must be >= 0');
  if (end !== undefined && (!Number.isFinite(end) || end <= (start ?? 0))) throw new Error('endSeconds must be greater than startSeconds');
  return `*${start ?? 0}-${end ?? 'inf'}`;
}

export function platformArgs(url: string, output: string, section?: PlatformSection): string[] {
  const cookies = process.env.YTDLP_COOKIES_FILE?.trim();
  const sectionValue = sectionSpec(section);
  return [
    '--no-playlist', '--newline', '--no-warnings', '--retries', '3', '--socket-timeout', '20',
    '-f', 'bv*+ba/b', '-S', 'res,fps', '--merge-output-format', 'mp4',
    '--write-info-json',
    ...(cookies ? ['--cookies', cookies] : []),
    ...(sectionValue ? ['--download-sections', sectionValue] : []),
    '-o', join(output, '%(id)s.%(ext)s'),
    '--print', 'after_move:filepath',
    url,
  ];
}

export function platformProgress(line: string): number | null {
  const match = /^\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line.trim());
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : null;
}

interface RunResult {
  file: string;
  info: Record<string, unknown> | null;
}

function runYtDlp(binary: string, args: string[], onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let stderr = '';
    let stdout = '';
    let finalPath = '';
    let settled = false;
    const finish = (error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ file: finalPath, info: null });
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('yt-dlp download timed out'));
    }, DOWNLOAD_TIMEOUT_MS);
    child.stderr.on('data', (chunk: Buffer) => { stderr = `${stderr}${String(chunk)}`.slice(-4000); });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += String(chunk);
      const lines = stdout.split('\n');
      stdout = lines.pop() ?? '';
      for (const line of lines) {
        const percent = platformProgress(line);
        if (percent !== null) { onProgress?.(percent); continue; }
        if (isAbsolute(line.trim()) && existsSync(line.trim())) finalPath = line.trim();
      }
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(`yt-dlp exited ${code}: ${stderr.slice(-600)}`));
        return;
      }
      if (!finalPath) {
        const candidate = stdout.trim();
        if (isAbsolute(candidate) && existsSync(candidate)) finalPath = candidate;
      }
      finish(finalPath ? null : new Error('yt-dlp finished without a media file'));
    });
  });
}

async function infoFor(directory: string): Promise<Record<string, unknown> | null> {
  const info = (await readdir(directory)).find((name) => name.endsWith('.info.json'));
  if (!info) return null;
  try {
    return JSON.parse(await readFile(join(directory, info), 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function mediaFileIn(directory: string): Promise<string | null> {
  for (const name of await readdir(directory)) {
    if (!MEDIA_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    const path = join(directory, name);
    if ((await stat(path)).isFile()) return path;
  }
  return null;
}

export interface PlatformImportResult {
  readonly file: Omit<DirectoryImportedFile, 'importId'>;
  readonly title: string;
  readonly uploader?: string;
  readonly license?: string;
  readonly sourceUrl: string;
  readonly platform: string;
}

export interface PlatformImportOptions {
  readonly binary?: string;
  readonly section?: PlatformSection;
  readonly knownHashes?: readonly string[];
  readonly name?: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
  readonly rootDir?: string;
}

/** Download, import through the normal media chain, and clean the temp folder. */
export async function downloadPlatformMedia(url: unknown, options: PlatformImportOptions = {}): Promise<PlatformImportResult> {
  const target = platformTarget(url);
  const binary = options.binary ?? ytDlpBinary();
  const directory = await mkdtemp(join(options.rootDir ?? tmpdir(), 'corteo-platform-'));
  try {
    const run = await runYtDlp(binary, platformArgs(target.url, directory, options.section), options.onProgress, options.signal);
    const file = run.file && existsSync(run.file)
      ? run.file
      : await mediaFileIn(directory);
    if (!file) throw new Error('yt-dlp finished without a media file');
    const info = await infoFor(directory);
    const title = typeof info?.title === 'string' && info.title.trim()
      ? info.title.trim()
      : basename(file);
    const pinned = await canonicalCurrentUploadDirectory();
    const extension = extname(file);
    const titled = MEDIA_EXTENSIONS.has(extname(title).toLowerCase()) ? title : `${title}${extension}`;
    const imported = await importDirectoryCandidate({
      sourcePath: file,
      root: directory,
      name: options.name?.trim() || titled,
      pinnedUploadDirectory: pinned,
      knownHashes: new Set(options.knownHashes ?? []),
      cancelled: () => false,
      signal: options.signal ?? new AbortController().signal,
    });
    if (imported.status !== 'imported') {
      throw new Error(imported.status === 'duplicate'
        ? 'this video is already in the media pool'
        : `media import failed (${imported.status})`);
    }
    return {
      file: imported.prepared.file,
      title,
      sourceUrl: target.url,
      platform: target.host,
      ...(typeof info?.uploader === 'string' ? { uploader: info.uploader } : {}),
      ...(typeof info?.license === 'string' ? { license: info.license } : {}),
    };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
