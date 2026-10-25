/**
 * The scheduled-publish tick (Plan 5, OP-13).
 *
 * The server owns the interval; this owns what one tick does, so the behaviour is testable
 * without waiting 30 seconds. It takes the queue, the clock and a publish function, and
 * returns the next queue — no storage, no timers, no globals.
 *
 * The important properties:
 * - an entry is attempted at most once per tick, and only when the shared rules allow it;
 * - an entry that is being attempted is marked `running` *before* the upload starts, so a
 *   crash mid-upload is visible as an interruption rather than as a quiet retry;
 * - a failure never loses the entry: it goes back to `planned` until the attempt cap parks it.
 */

import {
  advance,
  canAttempt,
  dueEntries,
  isMissed,
  upsertEntry,
  type QueueOptions,
  type ScheduledPublish,
} from '../../shared/publish-schedule.ts';

export interface TickOutcome {
  queue: ScheduledPublish[];
  /** Ids attempted in this tick, in order. */
  fired: string[];
  /** Due entries skipped by the backoff or the attempt cap. */
  skipped: string[];
  /** Entries published after their grace window; recorded, not blocked. */
  late: string[];
  /** Entries that failed in this tick (they stay in the queue unless parked). */
  failed: string[];
}

export type PublishFn = (entry: ScheduledPublish) => Promise<{ ok: true } | { ok: false; error: string }>;

/**
 * Process one tick. `publish` performs the actual upload and must be idempotent-safe: the
 * caller has already been told the entry is `running`.
 */
export async function runTick(
  queue: readonly ScheduledPublish[],
  now: number,
  publish: PublishFn,
  opts: QueueOptions = {},
): Promise<TickOutcome> {
  let next = [...queue];
  const fired: string[] = [];
  const skipped: string[] = [];
  const late: string[] = [];
  const failed: string[] = [];

  for (const candidate of dueEntries(queue, now)) {
    if (!canAttempt(candidate, now, opts)) {
      skipped.push(candidate.id);
      continue;
    }
    const wasLate = isMissed(candidate, now, opts);
    if (wasLate) late.push(candidate.id);

    // Mark it running before the upload, so an interrupted process leaves evidence.
    const running: ScheduledPublish = { ...candidate, state: 'running' };
    next = upsertEntry(next, running);
    fired.push(candidate.id);

    let outcome: { ok: true } | { ok: false; error: string };
    try {
      outcome = await publish(running);
    } catch (error) {
      outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }

    if (outcome.ok) {
      next = upsertEntry(next, advance(running, { ok: true, at: now }, opts));
    } else {
      next = upsertEntry(next, advance(running, { ok: false, at: now, error: outcome.error }, opts));
      failed.push(candidate.id);
    }
  }

  return { queue: next, fired, skipped, late, failed };
}
