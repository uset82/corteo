import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { sendJson } from './export-http.ts';
import {
  validateSlot,
  type ScheduledPublish,
} from '../../shared/publish-schedule.ts';
import {
  addScheduled,
  loadSchedule,
  removeScheduled,
} from '../publish/schedule-store.ts';

/**
 * HTTP surface for the scheduled-publish queue (Plan 5, OP-13).
 *
 * The commands are exported separately from the route plumbing so they can be tested with an
 * in-memory store: a route test would otherwise need SQLite, a profile directory and a server.
 * The rules themselves (a slot in the future, a preview id that exists) are enforced here,
 * before anything reaches the queue.
 */

export interface ScheduleStoreAdapter {
  add: (entry: ScheduledPublish) => Promise<unknown>;
  remove: (id: string) => Promise<boolean>;
  load: (now: number) => Promise<ScheduledPublish[]>;
}

export const defaultScheduleStore: ScheduleStoreAdapter = {
  add: addScheduled,
  remove: removeScheduled,
  load: loadSchedule,
};

export interface CommandOptions {
  now?: number;
  store?: ScheduleStoreAdapter;
}

export interface CommandResult {
  status: number;
  body: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' ? value as Record<string, unknown> : {});

export async function listScheduled(opts: CommandOptions = {}): Promise<CommandResult> {
  const store = opts.store ?? defaultScheduleStore;
  const now = opts.now ?? Date.now();
  const entries = await store.load(now);
  return { status: 200, body: { ok: true, now, entries } };
}

export async function scheduleOne(input: unknown, opts: CommandOptions = {}): Promise<CommandResult> {
  const store = opts.store ?? defaultScheduleStore;
  const now = opts.now ?? Date.now();
  const o = asRecord(input);

  const slot = validateSlot(typeof o.scheduledFor === 'string' ? o.scheduledFor : '', now);
  if (!slot.ok) return { status: 400, body: { error: slot.reason } };

  const source = typeof o.source === 'string' ? o.source.trim() : '';
  if (!source) return { status: 400, body: { error: 'Falta el vídeo a publicar (source).' } };
  const previewId = typeof o.previewId === 'string' ? o.previewId.trim() : '';
  if (!previewId) {
    return { status: 400, body: { error: 'Falta la vista previa aprobada (previewId): nada se programa sin aprobación.' } };
  }
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title) return { status: 400, body: { error: 'Falta el título de la publicación.' } };
  const platforms = Array.isArray(o.platforms)
    ? o.platforms.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];
  if (!platforms.length) return { status: 400, body: { error: 'Falta al menos una plataforma.' } };

  const entry: ScheduledPublish = {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `pub_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    scheduledFor: new Date(slot.at).toISOString(),
    source,
    platforms,
    title: title.slice(0, 200),
    previewId,
    state: 'planned',
    attempts: 0,
    ...(typeof o.description === 'string' ? { description: o.description.slice(0, 5000) } : {}),
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
