// /api/variant-previews — POST renders 480p previews for a variant group;
// GET lists the manifest or streams one MP4. POST is protected by the global
// request-shape gate; the project document is never written here.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  parseVariantPreviewRequest,
  readVariantPreviewFile,
  readVariantPreviewManifest,
  renderVariantPreviews,
} from '../variant-previews.ts';

const MAX_JSON = 16 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
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

function sendPreviewFile(res: ServerResponse, data: Buffer): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', String(data.length));
  res.setHeader('Cache-Control', 'no-store');
  res.end(data);
}

export function variantPreviewsPlugin(): Plugin {
  return {
    name: 'openchatcut-variant-previews',
    configureServer(server) {
      server.middlewares.use('/api/variant-previews', (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        void (async () => {
          try {
            if (req.method === 'POST') {
              const request = parseVariantPreviewRequest(await readJson(req));
              sendJson(res, 200, await renderVariantPreviews(request.project, request.selector));
              return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              sendJson(res, 405, { error: 'method not allowed' });
              return;
            }
            const file = url.pathname.match(/^\/([^/]+)\/([^/]+)\.mp4$/);
            if (file) {
              const preview = await readVariantPreviewFile(decodeURIComponent(file[1]!), decodeURIComponent(file[2]!));
              if (!preview) {
                sendJson(res, 404, { error: 'preview not found' });
                return;
              }
              if (req.method === 'HEAD') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Length', String(preview.data.length));
                res.end();
                return;
              }
              sendPreviewFile(res, preview.data);
              return;
            }
            const groupId = url.searchParams.get('groupId') ?? '';
            const manifest = await readVariantPreviewManifest(groupId);
            if (!manifest) {
              sendJson(res, 404, { error: 'no previews for this group' });
              return;
            }
            sendJson(res, 200, manifest);
          } catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          }
        })();
      });
    },
  };
}
