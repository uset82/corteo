import type { AgentToolSchema } from '../../tool-schema';

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'threads', 'pinterest', 'bluesky'];

export const SCHEDULE_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'schedule_publish',
    description:
      'Queue a finished render to be published at a future time (Plan 5, OP-13). '
      + 'Always in two steps, like publishing now: first call publish_to_social WITHOUT confirm for the platform you '
      + 'want, show the user its preview, and — because someone approved it — pass that previewId here with the ISO time. '
      + 'Nothing is queued without an approved previewId; the server refuses it. '
      + 'The server publishes while it runs: a slot that passes while the editor is closed publishes late, once, and the '
      + 'result is recorded rather than retried forever. Use `list_scheduled_publishes` to see the queue and '
      + '`cancel_scheduled_publish` to take one back.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'downloadUrl of a completed render (/media/uploads/...).' },
        platforms: { type: 'array', items: { type: 'string', enum: PLATFORMS }, minItems: 1 },
        title: { type: 'string', description: 'Caption/title used on every platform. YouTube allows 100 characters.' },
        description: { type: 'string', description: 'Optional longer text for YouTube, LinkedIn, Facebook and Pinterest.' },
        when: {
          type: 'string',
          description: 'ISO 8601 instant WITH an offset or Z (for example 2026-10-26T18:30:00+01:00). '
            + 'At least one minute in the future and at most a year ahead.',
        },
        previewId: {
          type: 'string',
          description: 'The requestId returned by the publish_to_social preview the user approved. Required: it is the confirm gate.',
        },
      },
      required: ['source', 'platforms', 'title', 'when', 'previewId'],
    },
  },
  {
    name: 'list_scheduled_publishes',
    description:
      'List the scheduled-publish queue with the server clock: which entries are planned, running, published, failed or '
      + 'cancelled, when each slot is, and how many attempts it took. Read-only. '
      + 'Use it when the user asks "¿qué tengo programado?", "what is queued", or before rescheduling something.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'cancel_scheduled_publish',
    description:
      'Remove one entry from the scheduled-publish queue by id, before its slot. It does not touch an upload that is '
      + 'already running. Returns 404-equivalent when the id is unknown, so a double cancel is harmless. '
      + 'Use when the user says "cancela la publicación del martes".',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entry id from list_scheduled_publishes.' },
      },
      required: ['id'],
    },
  },
];

export const SCHEDULE_TOOL_NAMES = new Set(SCHEDULE_TOOL_SCHEMAS.map((t) => t.name));
