/**
 * Scheduled publish — the queue maths (Plan 5, OP-13).
 *
 * The server owns the timer and the storage; this module owns the *decisions*, so the tool
 * (which schedules), the tick (which fires) and the UI (which lists) cannot disagree about
 * what "due" means. Shared on purpose: the browser and the Vite server import the same file.
 *
 * Two rules carry most of the value:
 * - a publish is only due when it is `planned` and its slot has passed;
 * - a missed slot is published late ONCE, never retried forever, and never silently dropped.
 */

export type PublishState = 'planned' | 'running' | 'published' | 'failed' | 'cancelled';

export interface ScheduledPublish {
  id: string;
  /** ISO instant the user picked. */
  scheduledFor: string;
  /** Download URL of the finished render, as `publish_to_social` expects. */
  source: string;
  platforms: string[];
  title: string;
  description?: string;
  /** The approved preview this entry is allowed to publish (the confirm gate's token). */
  previewId: string;
  /**
   * The exact publish request the preview was issued for. The preview id is derived from it
   * (platforms, title, description, privacy flags, aiGenerated), so a queue that kept only the
   * fields the calendar shows could never re-derive the id it must prove. Opaque here on
   * purpose: this module does not know the upload shape.
   */
  request?: Record<string, unknown>;
  state: PublishState;
  attempts: number;
  lastError?: string;
  /** Filled when the tick publishes it. */
  publishedAt?: string;
}

export interface QueueOptions {
  /** Attempts before an entry is parked as failed. Default 3. */
  maxAttempts?: number;
  /** Minutes to wait between attempts, multiplied by the attempt number. Default 10. */
  backoffMinutes?: number;
  /** How late a slot may be and still publish. Default 12 h. */
  graceMinutes?: number;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = 10;
const GRACE_MINUTES = 12 * 60;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function parseInstant(iso: string): number | null {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

/**
 * A slot has to be in the future and inside a sane horizon. A past slot is a mistake worth
 * refusing at scheduling time, not a publish that fires immediately.
 */
export function validateSlot(
  iso: string,
  now: number,
  maxAheadDays = 365,
): { ok: true; at: number } | { ok: false; reason: string } {
  const at = parseInstant(iso);
  if (at === null) return { ok: false, reason: 'La fecha no es válida (se espera ISO 8601).' };
  if (at <= now + 60_000) return { ok: false, reason: 'La fecha tiene que ser al menos un minuto en el futuro.' };
  if (at > now + maxAheadDays * 86_400_000) return { ok: false, reason: `La fecha está a más de ${maxAheadDays} días.` };
  return { ok: true, at };
}

/** Planned entries whose slot has passed, oldest slot first. */
export function dueEntries(entries: readonly ScheduledPublish[], now: number): ScheduledPublish[] {
  return entries
    .filter((entry) => entry.state === 'planned')
    .filter((entry) => {
      const at = parseInstant(entry.scheduledFor);
      return at !== null && at <= now;
    })
    .sort((a, b) => (parseInstant(a.scheduledFor) ?? 0) - (parseInstant(b.scheduledFor) ?? 0));
}

/** True when the slot is so old that publishing now would be a surprise. */
export function isMissed(entry: ScheduledPublish, now: number, opts: QueueOptions = {}): boolean {
  if (entry.state !== 'planned') return false;
  const at = parseInstant(entry.scheduledFor);
  if (at === null) return false;
  const grace = clamp(opts.graceMinutes ?? GRACE_MINUTES, 0, 7 * 24 * 60);
  return at + grace * 60_000 < now;
}

/**
 * Whether this entry may be attempted now. A running entry is locked (a tick that crashed
 * leaves it running; the caller decides how to recover, this module does not guess), a
 * failed-too-often entry is parked, and the backoff grows with the attempt count.
 */
export function canAttempt(entry: ScheduledPublish, now: number, opts: QueueOptions = {}): boolean {
  if (entry.state !== 'planned') return false;
  const maxAttempts = clamp(Math.trunc(opts.maxAttempts ?? MAX_ATTEMPTS), 1, 10);
  if (entry.attempts >= maxAttempts) return false;
  const at = parseInstant(entry.scheduledFor);
  if (at === null) return false;
  if (at > now) return false;
  const backoff = clamp(opts.backoffMinutes ?? BACKOFF_MINUTES, 0, 24 * 60) * entry.attempts;
  return now >= at + backoff * 60_000;
}

/** The entry with its next state applied. Pure: the caller persists the result. */
export function advance(
  entry: ScheduledPublish,
  outcome: { ok: true; at: number } | { ok: false; at: number; error: string },
  opts: QueueOptions = {},
): ScheduledPublish {
  const maxAttempts = clamp(Math.trunc(opts.maxAttempts ?? MAX_ATTEMPTS), 1, 10);
  if (outcome.ok) {
    return { ...entry, state: 'published', attempts: entry.attempts + 1, publishedAt: new Date(outcome.at).toISOString(), lastError: undefined };
  }
  const attempts = entry.attempts + 1;
  return {
    ...entry,
    attempts,
    state: attempts >= maxAttempts ? 'failed' : 'planned',
    lastError: outcome.error.slice(0, 300),
  };
}

export interface QueueSummary {
  planned: number;
  due: number;
  missed: number;
  running: number;
  published: number;
  failed: number;
  cancelled: number;
}

/* ── Persistence payload ────────────────────────────────────────────────────────────
 * A stored queue is untrusted input: an older build wrote it, or a hand-edited file did.
 * Parsing drops entries it cannot use and reports how many, rather than throwing away the
 * whole schedule or letting a malformed row crash the tick.
 */

export const SCHEDULE_PAYLOAD_VERSION = 1;

export interface SchedulePayload {
  version: number;
  entries: ScheduledPublish[];
}

const STATES: readonly PublishState[] = ['planned', 'running', 'published', 'failed', 'cancelled'];

function parseEntry(raw: unknown): ScheduledPublish | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return null;
  if (typeof o.scheduledFor !== 'string' || parseInstant(o.scheduledFor) === null) return null;
  if (typeof o.source !== 'string' || !o.source) return null;
  if (typeof o.previewId !== 'string' || !o.previewId) return null;
  if (typeof o.title !== 'string') return null;
  const state = STATES.find((candidate) => candidate === o.state);
  if (!state) return null;
  const platforms = Array.isArray(o.platforms)
    ? o.platforms.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];
  if (!platforms.length) return null;
  const attempts = Number.isFinite(Number(o.attempts)) ? Math.max(0, Math.trunc(Number(o.attempts))) : 0;
  const entry: ScheduledPublish = {
    id: o.id,
    scheduledFor: o.scheduledFor,
    source: o.source,
    platforms,
    title: o.title.slice(0, 200),
    previewId: o.previewId,
    state,
    attempts,
  };
  // Optional fields are omitted, never set to undefined: a stored entry has to round-trip to
  // exactly the object that was written, and `{ lastError: undefined }` is not `{}`.
  if (typeof o.description === 'string') entry.description = o.description.slice(0, 5000);
  if (o.request && typeof o.request === 'object' && !Array.isArray(o.request)) {
    entry.request = { ...(o.request as Record<string, unknown>) };
  }
  if (typeof o.lastError === 'string') entry.lastError = o.lastError.slice(0, 300);
  if (typeof o.publishedAt === 'string' && parseInstant(o.publishedAt) !== null) entry.publishedAt = o.publishedAt;
  return entry;
}

/** Parse a stored payload. Anything unusable is dropped and counted, never thrown. */
export function parseSchedulePayload(value: unknown): { entries: ScheduledPublish[]; dropped: number; version: number | null } {
  if (!value || typeof value !== 'object') return { entries: [], dropped: 0, version: null };
  const payload = value as { version?: unknown; entries?: unknown };
  const version = typeof payload.version === 'number' ? payload.version : null;
  if (!Array.isArray(payload.entries)) return { entries: [], dropped: 0, version };
  const entries: ScheduledPublish[] = [];
  let dropped = 0;
  for (const raw of payload.entries) {
    const entry = parseEntry(raw);
    if (entry) entries.push(entry);
    else dropped += 1;
  }
  entries.sort((a, b) => (parseInstant(a.scheduledFor) ?? 0) - (parseInstant(b.scheduledFor) ?? 0));
  return { entries, dropped, version };
}

export function serializeSchedulePayload(entries: readonly ScheduledPublish[]): SchedulePayload {
  return {
    version: SCHEDULE_PAYLOAD_VERSION,
    entries: entries.map((entry) => ({
      ...entry,
      platforms: [...entry.platforms],
      ...(entry.request ? { request: { ...entry.request } } : {}),
    })),
  };
}

/** Insert or replace by id, keeping the list ordered by slot so the calendar reads naturally. */
export function upsertEntry(
  entries: readonly ScheduledPublish[],
  entry: ScheduledPublish,
): ScheduledPublish[] {
  const next = entries.filter((existing) => existing.id !== entry.id);
  next.push(entry);
  next.sort((a, b) => (parseInstant(a.scheduledFor) ?? 0) - (parseInstant(b.scheduledFor) ?? 0));
  return next;
}

/** Remove one entry. Returns the list and whether anything was removed. */
export function removeEntry(
  entries: readonly ScheduledPublish[],
  id: string,
): { entries: ScheduledPublish[]; removed: boolean } {
  const next = entries.filter((entry) => entry.id !== id);
  return { entries: next, removed: next.length !== entries.length };
}

export function findEntry(
  entries: readonly ScheduledPublish[],
  id: string,
): ScheduledPublish | null {
  return entries.find((entry) => entry.id === id) ?? null;
}

/**
 * Anything left `running` when the process starts did not finish: the tick died mid-upload.
 * Marking it planned again would re-post a video that may already be live, so it becomes
 * `failed` with an explicit reason and the user decides. Idempotent resume, not blind resume.
 */
export function recoverInterrupted(
  entries: readonly ScheduledPublish[],
  _now: number,
): { entries: ScheduledPublish[]; recovered: number } {
  let recovered = 0;
  const next = entries.map((entry) => {
    if (entry.state !== 'running') return entry;
    recovered += 1;
    return {
      ...entry,
      state: 'failed' as const,
      lastError: 'Se interrumpió mientras publicaba; revisa si el vídeo llegó a salir antes de reintentar.',
      attempts: entry.attempts,
    };
  });
  return { entries: next, recovered };
}

/** Counts for the calendar's header: what is scheduled, what is late, what already went. */
export function summarize(entries: readonly ScheduledPublish[], now: number): QueueSummary {
  const summary: QueueSummary = { planned: 0, due: 0, missed: 0, running: 0, published: 0, failed: 0, cancelled: 0 };
  const dueIds = new Set(dueEntries(entries, now).map((entry) => entry.id));
  for (const entry of entries) {
    summary[entry.state] += 1;
    if (dueIds.has(entry.id)) summary.due += 1;
    if (isMissed(entry, now)) summary.missed += 1;
  }
  return summary;
}
