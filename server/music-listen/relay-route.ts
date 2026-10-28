// The song dialog's "Escuchar con oído real" door (Plan 2 › Part D). The relay
// itself lives in relay.ts and stays off unless both switches are set; this
// module only exposes its status and one bounded listen call, text only, so the
// browser never sees a key and never triggers a paid request by itself.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, sendJson } from '../plugins/export-http.ts';
import type { MediaAsset } from '../../src/editor/types.ts';
import { listenToSong, type ListenSongOptions } from './listen.ts';
import { listenRelayConfig, type ListenRelayConfig } from './relay.ts';
import { resolveMusicMediaPath } from './media-path.ts';

export const MUSIC_RELAY_PATH = '/api/music-listen/relay';

export interface MusicRelayRouteDeps {
  config?: () => ListenRelayConfig | null;
  resolvePath?: (src: string) => string | undefined;
  listen?: (asset: MediaAsset, options: ListenSongOptions) => Promise<Record<string, unknown>>;
  log?: (message: string) => void;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

export function relayStatus(config: ListenRelayConfig | null): Record<string, unknown> {
  if (!config) return { ok: true, enabled: false };
  return { ok: true, enabled: true, provider: 'openrouter', model: config.model };
}

/** GET answers with the switches; POST runs one relayed listen of a local file. */
export async function handleMusicRelayRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: MusicRelayRouteDeps = {},
): Promise<void> {
  const config = (deps.config ?? listenRelayConfig)();
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      sendJson(res, 200, relayStatus(config));
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' });
      return;
    }
    if (!config) {
      sendJson(res, 409, { error: 'relay-not-configured' });
      return;
    }
    const body = await readJsonBody(req) as Record<string, unknown>;
    const supplied = (body.asset ?? {}) as Record<string, unknown>;
    const src = text(supplied.src, 2_048) || text(body.src, 2_048);
    const resolvePath = deps.resolvePath ?? ((value: string) => resolveMusicMediaPath(value));
    const file = src ? resolvePath(src) : undefined;
    if (!file) {
      sendJson(res, 404, { error: 'the song file is not reachable from this server' });
      return;
    }
    const asset: MediaAsset = {
      id: text(supplied.id, 120) || src,
      kind: 'audio',
      name: text(supplied.name, 240) || src.split('/').pop() || 'song',
      src,
      durationInFrames: finiteCount(supplied.durationInFrames),
      ...(typeof supplied.sourceRevision === 'string'
        ? { sourceRevision: supplied.sourceRevision.slice(0, 120) } : {}),
      ...(typeof supplied.sourceContentHash === 'string'
        ? { sourceContentHash: supplied.sourceContentHash.slice(0, 120) } : {}),
      ...((typeof supplied.sourceSize === 'number' || typeof supplied.sourceModifiedAt === 'number')
        ? {
          ...(Number.isFinite(supplied.sourceSize) ? { sourceSize: supplied.sourceSize as number } : {}),
          ...(Number.isFinite(supplied.sourceModifiedAt) ? { sourceModifiedAt: supplied.sourceModifiedAt as number } : {}),
        } : {}),
    };
    const result = await (deps.listen ?? listenToSong)(asset, { relay: true, pictures: false });
    const relay = result.relay ?? null;
    sendJson(res, 200, {
      ok: result.ok === true,
      src,
      summary: typeof result.summary === 'string' ? result.summary : '',
      relay,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (deps.log ?? ((value: string) => console.error(value)))(`[music-listen-relay] ${message}`);
    sendJson(res, 502, { error: message.slice(0, 300) });
  }
}
