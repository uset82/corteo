// Media duplicate detection, shared by POST /api/media-duplicates and the
// headless find_duplicate_media tool. Exact copies are grouped by their SHA-256
// content hash; everything else is compared as 64-bit dHashes sampled by
// ffmpeg at 10%, 50% and 90% of that clip's own duration. The frame cache is
// keyed by content hash, so a rename never re-samples the same bytes.
import { existsSync } from 'node:fs';
import { isSafeUploadName, resolveUploadFile } from './media-dir.ts';
import { normalizeSha256Hash } from '../shared/content-hash.ts';
import { ffmpegBin } from './media-binaries.ts';
import { ffmpegThreadArgs, spawnMediaProcess } from './media-process.ts';

export interface DuplicateMediaAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  /** Absolute path on this machine. */
  readonly path: string;
  readonly contentHash?: string;
  /** Clip duration in seconds; the sample points are fractions of this, not of the file. */
  readonly durationSeconds?: number;
}

export interface DuplicateTimelineItem {
  readonly id: string;
  readonly assetId: string;
  readonly name: string;
  readonly startFrame: number;
  readonly srcInFrame: number;
  readonly durationInFrames: number;
}

export interface DuplicateGroup {
  readonly id: string;
  readonly kind: 'exact' | 'visual';
  readonly assetIds: readonly string[];
  readonly names: readonly string[];
  /** JPEG data URLs, one per group. Omitted by the headless tool. */
  readonly thumbnails?: readonly string[];
  /** Worst dHash Hamming distance inside a visual group. */
  readonly maxDistance?: number;
}

export interface DuplicateReuse {
  readonly assetId: string;
  readonly name: string;
  readonly occurrences: ReadonlyArray<{
    readonly itemId: string;
    readonly name: string;
    readonly startFrame: number;
    readonly srcInFrame: number;
    readonly durationInFrames: number;
    /** Another occurrence uses the exact same source window. */
    readonly sameRange: boolean;
  }>;
}

export interface DuplicateReport {
  readonly ok: true;
  readonly groups: readonly DuplicateGroup[];
  readonly reused: readonly DuplicateReuse[];
  readonly checked: {
    readonly assets: number;
    readonly visual: number;
    readonly cached: number;
    readonly skipped: number;
  };
  readonly threshold: number;
  readonly truncated: boolean;
}

export interface DuplicateAnalysisOptions {
  readonly threshold?: number;
  readonly includeThumbnails?: boolean;
}

const VISUAL_KINDS = new Set(['video', 'image', 'gif', 'svg']);
const HASH_W = 9;
const HASH_H = 8;
const HASH_BYTES = HASH_W * HASH_H;
const DEFAULT_THRESHOLD = 10;
const MAX_DISTANCE = 32;
const MAX_ASSETS = 60;
const MAX_ITEMS = 1000;
const FRAME_TIMEOUT_MS = 20_000;
const THUMB_WIDTH = 160;

/** Resolve an asset `src` under /media/uploads to a readable file, or null. */
export function resolveUploadAssetPath(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const clean = decodeURIComponent((src.split('?')[0] ?? '').trim());
  const match = clean.match(/^\/media\/uploads\/([^/]+)$/);
  if (!match || !isSafeUploadName(match[1]!)) return null;
  const path = resolveUploadFile(match[1]!);
  return path && existsSync(path) ? path : null;
}

/** 10/50/90% of this clip's own duration; images (and very short clips) are one frame. */
export function duplicateSampleTimes(kind: string, durationSeconds: number | undefined): number[] {
  if (kind !== 'video' || !Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0.2) return [0];
  const duration = durationSeconds as number;
  return [duration * 0.1, duration * 0.5, Math.min(duration * 0.9, duration - 0.05)];
}

/** 64-bit dHash from an ffmpeg 9x8 gray frame: each bit is left > right. */
export function dhashFromGray(pixels: Buffer): bigint {
  if (pixels.length < HASH_BYTES) throw new Error('dHash needs a 9x8 gray frame');
  let hash = 0n;
  for (let y = 0; y < HASH_H; y += 1) {
    for (let x = 0; x < HASH_W - 1; x += 1) {
      const left = pixels[y * HASH_W + x] ?? 0;
      const right = pixels[y * HASH_W + x + 1] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let value = a ^ b;
  let distance = 0;
  while (value !== 0n) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

interface FrameCapture {
  readonly frames: readonly bigint[];
  readonly thumbnail?: string;
}

const frameCache = new Map<string, Promise<FrameCapture>>();

/** Test seam: forget every sampled frame. */
export function clearDuplicateFrameCache(): void {
  frameCache.clear();
}

function runFfmpegFrame(args: string[], signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawnMediaProcess(ffmpegBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    let settled = false;
    const finish = (error: Error | null, buffer?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(buffer ?? Buffer.alloc(0));
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('ffmpeg frame timed out'));
    }, FRAME_TIMEOUT_MS);
    const onAbort = () => {
      child.kill('SIGKILL');
      finish(new Error('duplicate analysis aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => { stderr = `${stderr}${String(chunk)}`.slice(-600); });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (code === 0) finish(null, Buffer.concat(chunks));
      else finish(new Error(`ffmpeg frame exit ${code}: ${stderr}`));
    });
  });
}

function frameArgs(path: string, seconds: number, videoArgs: string[]): string[] {
  return [
    '-nostdin', '-hide_banner', '-loglevel', 'error', ...ffmpegThreadArgs(),
    '-ss', Math.max(0, seconds).toFixed(3), '-i', path, '-frames:v', '1', '-an', '-sn',
    ...videoArgs,
  ];
}

async function captureFrame(path: string, seconds: number, signal?: AbortSignal): Promise<bigint> {
  const pixels = await runFfmpegFrame(frameArgs(path, seconds, [
    '-vf', `scale=${HASH_W}:${HASH_H}:flags=area`, '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1',
  ]), signal);
  return dhashFromGray(pixels);
}

async function captureThumbnail(path: string, seconds: number, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const jpeg = await runFfmpegFrame(frameArgs(path, seconds, [
      '-vf', `scale=${THUMB_WIDTH}:-2`, '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1',
    ]), signal);
    return jpeg.length ? `data:image/jpeg;base64,${jpeg.toString('base64')}` : undefined;
  } catch {
    return undefined;
  }
}

function frameKey(asset: DuplicateMediaAsset): string {
  return normalizeSha256Hash(asset.contentHash) ?? asset.path;
}

/** A frame capture is cached by content hash for the lifetime of the server process. */
function captureAssetFrames(
  asset: DuplicateMediaAsset,
  includeThumbnails: boolean,
  signal?: AbortSignal,
): Promise<FrameCapture> {
  const key = frameKey(asset);
  const known = frameCache.get(key);
  if (known) return known;
  const pending = (async () => {
    const times = duplicateSampleTimes(asset.kind, asset.durationSeconds);
    const frames: bigint[] = [];
    for (const seconds of times) frames.push(await captureFrame(asset.path, seconds, signal));
    const thumbnail = includeThumbnails ? await captureThumbnail(asset.path, times[0]!, signal) : undefined;
    return { frames, thumbnail };
  })();
  frameCache.set(key, pending);
  pending.catch(() => { if (frameCache.get(key) === pending) frameCache.delete(key); });
  return pending;
}

function clampThreshold(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_THRESHOLD;
  return Math.max(0, Math.min(MAX_DISTANCE, numeric));
}

function visualGroupsOf(entries: Array<{ asset: DuplicateMediaAsset; frames: readonly bigint[]; thumbnail?: string }>, threshold: number) {
  const groups: Array<{
    representative: (typeof entries)[number];
    members: Array<(typeof entries)[number]>;
    maxDistance: number;
  }> = [];
  for (const entry of entries) {
    let target: (typeof groups)[number] | undefined;
    for (const group of groups) {
      if (group.representative.frames.length !== entry.frames.length) continue;
      const distances = group.representative.frames.map((frame, index) => hammingDistance(frame, entry.frames[index]!));
      if (distances.every((distance) => distance <= threshold)) {
        group.members.push(entry);
        group.maxDistance = Math.max(group.maxDistance, ...distances);
        target = group;
        break;
      }
    }
    if (!target) groups.push({ representative: entry, members: [entry], maxDistance: 0 });
  }
  return groups.filter((group) => group.members.length > 1);
}

function reusedRanges(items: readonly DuplicateTimelineItem[], assetsById: ReadonlyMap<string, DuplicateMediaAsset>): DuplicateReuse[] {
  const byAsset = new Map<string, DuplicateTimelineItem[]>();
  for (const item of items.slice(0, MAX_ITEMS)) {
    if (!item.assetId || !assetsById.has(item.assetId)) continue;
    const rows = byAsset.get(item.assetId) ?? [];
    rows.push(item);
    byAsset.set(item.assetId, rows);
  }
  return [...byAsset.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([assetId, rows]) => ({
      assetId,
      name: assetsById.get(assetId)?.name ?? rows[0]!.name,
      occurrences: rows.map((row) => ({
        itemId: row.id,
        name: row.name,
        startFrame: row.startFrame,
        srcInFrame: row.srcInFrame,
        durationInFrames: row.durationInFrames,
        sameRange: rows.some((other) => other !== row
          && other.srcInFrame === row.srcInFrame
          && other.durationInFrames === row.durationInFrames),
      })),
    }));
}

function createUnionFind(ids: readonly string[]) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (start: string): string => {
    let root = start;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    let current = start;
    while (parent.get(current) !== root) {
      const next = parent.get(current) ?? root;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };
  return { find, union };
}

export async function analyzeMediaDuplicates(
  assets: readonly DuplicateMediaAsset[],
  items: readonly DuplicateTimelineItem[] = [],
  options: DuplicateAnalysisOptions = {},
  signal?: AbortSignal,
): Promise<DuplicateReport> {
  const threshold = clampThreshold(options.threshold);
  const includeThumbnails = options.includeThumbnails !== false;
  const visual = assets.filter((asset) => VISUAL_KINDS.has(asset.kind) && existsSync(asset.path)).slice(0, MAX_ASSETS);
  const truncated = assets.length > MAX_ASSETS;
  const assetsById = new Map(visual.map((asset) => [asset.id, asset]));

  const byHash = new Map<string, DuplicateMediaAsset[]>();
  for (const asset of visual) {
    const hash = normalizeSha256Hash(asset.contentHash);
    if (!hash) continue;
    const members = byHash.get(hash) ?? [];
    members.push(asset);
    byHash.set(hash, members);
  }

  let cached = 0;
  const capture = async (asset: DuplicateMediaAsset): Promise<FrameCapture> => {
    if (frameCache.has(frameKey(asset))) cached += 1;
    return captureAssetFrames(asset, includeThumbnails, signal);
  };

  // Exact hashes and visual matches are one relation: a blurred copy has to
  // join the exact pair it resembles, and an exact pair is one group.
  const unionFind = createUnionFind(visual.map((asset) => asset.id));
  for (const members of byHash.values()) {
    for (const member of members.slice(1)) unionFind.union(members[0]!.id, member.id);
  }
  const entries: Array<{ asset: DuplicateMediaAsset; frames: readonly bigint[]; thumbnail?: string }> = [];
  for (const asset of visual) {
    try {
      entries.push({ asset, ...await capture(asset) });
    } catch {
      // A codec ffmpeg cannot decode is skipped, not fatal for the rest.
    }
  }
  const captured = new Map(entries.map((entry) => [entry.asset.id, entry]));
  for (const group of visualGroupsOf(entries, threshold)) {
    for (const member of group.members) unionFind.union(group.representative.asset.id, member.asset.id);
  }

  const membersByRoot = new Map<string, DuplicateMediaAsset[]>();
  for (const asset of visual) {
    const root = unionFind.find(asset.id);
    const members = membersByRoot.get(root) ?? [];
    members.push(asset);
    membersByRoot.set(root, members);
  }
  const groups: DuplicateGroup[] = [];
  let visualIndex = 0;
  for (const members of membersByRoot.values()) {
    if (members.length < 2) continue;
    const hashes = members.map((asset) => normalizeSha256Hash(asset.contentHash));
    const isExact = hashes.every(Boolean) && new Set(hashes).size === 1;
    const thumbnail = members.map((asset) => captured.get(asset.id)?.thumbnail).find(Boolean);
    const frames = members.map((asset) => captured.get(asset.id)?.frames);
    let maxDistance = 0;
    if (frames.every(Boolean) && new Set(frames.map((frame) => frame!.length)).size === 1) {
      for (let i = 0; i < frames.length; i += 1) {
        for (let j = i + 1; j < frames.length; j += 1) {
          maxDistance = Math.max(maxDistance, ...frames[i]!.map((frame, index) => hammingDistance(frame, frames[j]![index]!)));
        }
      }
    }
    if (!isExact) visualIndex += 1;
    groups.push({
      id: isExact ? `exact-${hashes[0]!.slice(0, 12)}` : `visual-${visualIndex}`,
      kind: isExact ? 'exact' : 'visual',
      assetIds: members.map((asset) => asset.id),
      names: members.map((asset) => asset.name),
      ...(includeThumbnails && thumbnail ? { thumbnails: members.map(() => thumbnail) } : {}),
      ...(isExact ? { maxDistance: 0 } : { maxDistance }),
    });
  }

  return {
    ok: true,
    groups,
    reused: reusedRanges(items, assetsById),
    checked: {
      assets: assets.length,
      visual: visual.length,
      cached,
      skipped: assets.length - visual.length,
    },
    threshold,
    truncated,
  };
}
