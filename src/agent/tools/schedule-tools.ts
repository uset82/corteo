export { SCHEDULE_TOOL_SCHEMAS, SCHEDULE_TOOL_NAMES } from './schemas/schedule-tools';
import type { AgentContext } from '../context';

// schedule_publish / list_scheduled_publishes / cancel_scheduled_publish (Plan 5, OP-13).
//
// The queue lives on the server because the tick has to run while no tab is open. These tools
// are therefore thin clients of /api/publish-schedule: they add no scheduling logic, which is
// the point — the due/missed/backoff rules are tested once, in shared/publish-schedule.ts.
//
// The confirm gate is enforced server-side: schedule_publish cannot queue anything without a
// previewId that publish_to_social already returned to an approving human.

type Args = Record<string, unknown>;

interface CallResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' ? value as Record<string, unknown> : {});

async function callQueue(method: 'GET' | 'POST' | 'DELETE', payload?: unknown, query = ''): Promise<CallResult> {
  const response = await fetch(`/api/publish-schedule${query}`, {
    method,
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = asRecord(await response.json().catch(() => ({})));
  return { ok: response.ok, status: response.status, body };
}

function failure(result: CallResult): unknown {
  return {
    ok: false,
    status: result.status,
    error: typeof result.body.error === 'string' ? result.body.error : `El servidor respondió ${result.status}.`,
  };
}

export async function execScheduleTool(name: string, args: Args, _ctx: AgentContext): Promise<unknown> {
  if (name === 'list_scheduled_publishes') {
    const result = await callQueue('GET');
    if (!result.ok) return failure(result);
    const entries = Array.isArray(result.body.entries) ? result.body.entries : [];
    return {
      ok: true,
      now: result.body.now,
      count: entries.length,
      entries,
      note: entries.length
        ? 'Las horas son del servidor; compáralas con now para saber qué está al caer.'
        : 'No hay nada programado.',
    };
  }

  if (name === 'schedule_publish') {
    // Optional keys are omitted, not set to undefined: the request body must be exactly what
    // the route validates, and JSON.stringify would silently drop an undefined anyway.
    const request: Record<string, unknown> = {
      source: args.source,
      platforms: args.platforms,
      title: args.title,
    };
    if (typeof args.description === "string") request.description = args.description;
    if (typeof args.youtubePrivacy === "string") request.youtubePrivacy = args.youtubePrivacy;
    if (typeof args.aiGenerated === "boolean") request.aiGenerated = args.aiGenerated;
    const result = await callQueue('POST', {
      request,
      scheduledFor: args.when,
      previewId: args.previewId,
    });
    if (!result.ok) return failure(result);
    const entry = asRecord(result.body.entry);
    return {
      ok: true,
      entry,
      note: `Programado para ${String(entry.scheduledFor ?? args.when)}. Se publicará aunque el editor esté cerrado.`,
    };
  }

  if (name === 'cancel_scheduled_publish') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    if (!id) return { ok: false, error: 'Falta el id de la publicación.' };
    const result = await callQueue('DELETE', undefined, `?id=${encodeURIComponent(id)}`);
    if (!result.ok) return failure(result);
    return { ok: true, id, note: 'Publicación quitada de la cola.' };
  }

  return { error: `unknown tool ${name}` };
}
