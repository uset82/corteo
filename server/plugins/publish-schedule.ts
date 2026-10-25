import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { sendJson } from './export-http.ts';
import { validateSlot, type ScheduledPublish } from '../../shared/publish-schedule.ts';
import { previewMatches } from '../publish/preview-gate.ts';
import {
  addScheduled,
  loadSchedule,
  removeScheduled,
} from '../publish/schedule-store.ts';
import type { PublishRequest } from './upload-post.ts';

/**
 * HTTP surface for the scheduled-publish queue (Plan 5, OP-13).
 *
 * The confirm gate is enforced here, by **derivation**, not by the presence of a string:
 * `previewMatches` recomputes the preview id from the request and the resolved source, using
 * the same function the publish route uses. A caller cannot schedule a post nobody approved,
 * because the id it must supply is a hash of the post it is asking for.
 *
 * The commands are exported apart from the route plumbing and take an injected store and
 * checker, so they are tested without SQLite, without an API key and without a file on disk.
 */

export interface ScheduleStoreAdapter {
  add: (entry: ScheduledPublish) => Promise<unknown>;
  remove: (id: string) => Promise<boolean>;
  load: (now: number) => Promise<ScheduledPublish[]>;
}

export interface PreviewChecker {
  matches: boolean;
  ok: boolean;
  derived: string;
  error?: string;
}

export interface CommandOptions {
  now?: number;
  store?: ScheduleStoreAdapter;
  /** Defaults to the real derivation; tests inject a stub. */
  checkPreview?: (request: PublishRequest, previewId: string) => Promise<PreviewChecker>;
}

export interface CommandResult {
  status: number;
  body: unknown;
}

export const defaultScheduleStore: ScheduleStoreAdapter = {
  add: addScheduled,
  remove: removeScheduled,
  load: loadSchedule,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

const defaultCheckPreview = async (request: PublishRequest, previewId: string): Promise<PreviewChecker> =>
  previewMatches(request, previewId);

export async function listScheduled(opts: CommandOptions = {}): Promise<CommandResult> {
  const store = opts.store ?? defaultScheduleStore;
  const now = opts.now ?? Date.now();
  const entries = await store.load(now);
  return { status: 200, body: { ok: true, now, entries } };
}

export async function scheduleOne(input: unknown, opts: CommandOptions = {}): Promise<CommandResult> {
  const store = opts.store ?? defaultScheduleStore;
  const now = opts.now ?? Date.now();
  const check = opts.checkPreview ?? defaultCheckPreview;
  const o = asRecord(input);

  const slot = validateSlot(typeof o.scheduledFor === 'string' ? o.scheduledFor : '', now);
  if (!slot.ok) return { status: 400, body: { error: slot.reason } };

  const previewId = typeof o.previewId === 'string' ? o.previewId.trim() : '';
  if (!previewId) {
    return { status: 400, body: { error: 'Falta la vista previa aprobada (previewId): nada se programa sin aprobación.' } };
  }

  const request = asRecord(o.request);
  if (!request.source || !Array.isArray(request.platforms) || !request.platforms.length) {
    return {
      status: 400,
      body: {
        error: 'Falta la petición de publicación completa (request): el id de la vista previa se deriva de ella.',
      },
    };
  }

  const source = typeof request.source === 'string' ? request.source.trim() : '';
  if (!source) return { status: 400, body: { error: 'Falta el vídeo a publicar (source).' } };

  const verdict = await check(request as unknown as PublishRequest, previewId);
  if (!verdict.ok) {
    return {
      status: 400,
      body: { error: verdict.error ?? 'La vista previa no corresponde a esta publicación.', derived: verdict.derived },
    };
  }

  const title = typeof request.title === 'string' ? request.title.trim() : '';
  if (!title) return { status: 400, body: { error: 'Falta el título de la publicación.' } };
  const platforms = request.platforms.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

  const entry: ScheduledPublish = {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `pub_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    scheduledFor: new Date(slot.at).toISOString(),
    source,
    platforms,
    title: title.slice(0, 200),
    previewId,
    request: { ...request },
    state: 'planned',
    attempts: 0,
    ...(typeof request.description === 'string' ? { description: request.description.slice(0, 5000) } : {}),
  };
  await store.add(entry);
  return { status: 201, body: { ok: true, entry } };
}

export async function cancelScheduled(id: string, opts: CommandOptions = {}): Promise<CommandResult> {
  const store = opts.store ?? defaultScheduleStore;
  const trimmed = typeof id === 'string' ? id.trim() : '';
  if (!trimmed) return { status: 400, body: { error: 'Falta el id de la publicación.' } };
  const removed = await store.remove(trimmed);
  return removed
    ? { status: 200, body: { ok: true, id: trimmed } }
    : { status: 404, body: { error: 'No existe esa publicación programada.' } };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export function publishSchedulePlugin(): Plugin {
  return {
    name: 'openchatcut-publish-schedule',
    configureServer(server) {
      server.middlewares.use('/api/publish-schedule', async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        try {
          if (req.method === 'GET') {
            const result = await listScheduled();
            sendJson(res, result.status, result.body);
            return;
          }
          if (req.method === 'POST') {
            const result = await scheduleOne(await readBody(req));
            sendJson(res, result.status, result.body);
            return;
          }
          if (req.method === 'DELETE') {
            const result = await cancelScheduled(url.searchParams.get('id') ?? '');
            sendJson(res, result.status, result.body);
            return;
          }
          sendJson(res, 405, { error: 'method not allowed' });
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
