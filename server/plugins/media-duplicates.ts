// POST /api/media-duplicates — read-only duplicate report for the media pool
// dialog. Exact copies group by SHA-256; visual matches come from three dHash
// frames per clip; reused timeline source ranges are reported too. It writes
// nothing, and the global request-shape gate protects the POST like every
// other /api mount.
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  analyzeMediaDuplicates,
  resolveUploadAssetPath,
  type DuplicateAnalysisOptions,
  type DuplicateMediaAsset,
  type DuplicateTimelineItem,
} from '../media-duplicates.ts';

const MAX_JSON = 1024 * 1024;
const MAX_ASSETS = 80;
const MAX_ITEMS = 1000;

export interface DuplicateRouteRequest {
  readonly assets: DuplicateMediaAsset[];
  readonly items: DuplicateTimelineItem[];
  readonly options: DuplicateAnalysisOptions;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_JSON) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max = 300): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Pure body validation; exported so the route verify does not need HTTP. */
export function parseDuplicateRouteBody(body: unknown): DuplicateRouteRequest {
  const root = record(body);
  if (!root) throw new Error('body must be a JSON object');
  const rawAssets = Array.isArray(root.assets) ? root.assets.slice(0, MAX_ASSETS) : [];
  const assets: DuplicateMediaAsset[] = [];
  for (const value of rawAssets) {
    const row = record(value);
    if (!row) continue;
    const id = text(row.id, 120);
    const name = text(row.name);
    const kind = text(row.kind, 40);
    const path = resolveUploadAssetPath(row.src);
    if (!id || !name || !kind || !path) continue;
    const contentHash = text(row.contentHash, 64);
    const durationSeconds = finite(row.durationSeconds);
    assets.push({
      id, name, kind, path,
      ...(contentHash ? { contentHash } : {}),
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
    });
  }
  const rawItems = Array.isArray(root.items) ? root.items.slice(0, MAX_ITEMS) : [];
  const items: DuplicateTimelineItem[] = [];
  for (const value of rawItems) {
    const row = record(value);
    if (!row) continue;
    const id = text(row.id, 120);
    const assetId = text(row.assetId, 120);
    if (!id || !assetId) continue;
    items.push({
      id,
      assetId,
      name: text(row.name) ?? id,
      startFrame: finite(row.startFrame) ?? 0,
      srcInFrame: finite(row.srcInFrame) ?? 0,
      durationInFrames: Math.max(0, finite(row.durationInFrames) ?? 0),
    });
  }
  const threshold = finite(root.threshold);
  return {
    assets,
    items,
    options: {
      includeThumbnails: root.includeThumbnails !== false,
      ...(threshold === undefined ? {} : { threshold }),
    },
  };
}

export function mediaDuplicatesPlugin(): Plugin {
  return {
    name: 'openchatcut-media-duplicates',
    configureServer(server) {
      server.middlewares.use('/api/media-duplicates', (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        void (async () => {
          try {
            const request = parseDuplicateRouteBody(await readJson(req));
            sendJson(res, 200, await analyzeMediaDuplicates(request.assets, request.items, request.options));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(res, /body too large/.test(message) ? 413 : 400, { error: message });
          }
        })();
      });
    },
  };
}
