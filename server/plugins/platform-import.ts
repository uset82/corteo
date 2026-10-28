// POST /api/import-platform — download a YouTube/Vimeo/Bilibili page with the
// pinned yt-dlp and stream progress as newline-delimited JSON. The browser tool
// turns the final file into a media-pool asset; the route never touches the
// project document, and non-allowlisted hosts are rejected before download.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { downloadPlatformMedia, platformTarget, type PlatformSection } from '../platform-import.ts';

const MAX_JSON = 64 * 1024;

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
      if (size > MAX_JSON) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

interface ImportPlatformRequest {
  url: string;
  knownHashes: string[];
  section: PlatformSection;
  name?: string;
}

export function parseImportPlatformRequest(value: unknown): ImportPlatformRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body must be a JSON object');
  const input = value as Record<string, unknown>;
  const target = platformTarget(input.url);
  const hashes = Array.isArray(input.knownHashes)
    ? input.knownHashes.filter((hash): hash is string => typeof hash === 'string' && hash.length > 0).slice(0, 500)
    : [];
  const startSeconds = typeof input.startSeconds === 'number' && Number.isFinite(input.startSeconds) ? input.startSeconds : undefined;
  const endSeconds = typeof input.endSeconds === 'number' && Number.isFinite(input.endSeconds) ? input.endSeconds : undefined;
  return {
    url: target.url,
    knownHashes: hashes,
    section: { ...(startSeconds === undefined ? {} : { startSeconds }), ...(endSeconds === undefined ? {} : { endSeconds }) },
    ...(typeof input.name === 'string' && input.name.trim() ? { name: input.name.trim() } : {}),
  };
}

export function platformImportPlugin(): Plugin {
  return {
    name: 'openchatcut-platform-import',
    configureServer(server) {
      server.middlewares.use('/api/import-platform', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed — use POST' });
          return;
        }
        void (async () => {
          let request: ImportPlatformRequest;
          try {
            request = parseImportPlatformRequest(await readJson(req));
          } catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.flushHeaders?.();
          const write = (body: unknown) => res.write(`${JSON.stringify(body)}\n`);
          const controller = new AbortController();
          const abort = () => controller.abort();
          req.once('aborted', abort);
          res.once('close', abort);
          try {
            const result = await downloadPlatformMedia(request.url, {
              knownHashes: request.knownHashes,
              section: request.section,
              ...(request.name ? { name: request.name } : {}),
              signal: controller.signal,
              onProgress: (percent) => write({ type: 'progress', percent }),
            });
            write({ type: 'done', ...result });
          } catch (error) {
            if (!res.writableEnded) write({ type: 'error', error: error instanceof Error ? error.message : String(error) });
          } finally {
            req.removeListener('aborted', abort);
            res.removeListener('close', abort);
            if (!res.writableEnded) res.end();
          }
        })();
      });
    },
  };
}
