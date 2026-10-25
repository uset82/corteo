import {
  initializeSqliteProjectStore,
  sqliteReadEntry,
  sqliteWriteEntry,
} from '../storage/sqlite-store.ts';
import {
  findEntry,
  parseSchedulePayload,
  recoverInterrupted,
  removeEntry,
  serializeSchedulePayload,
  upsertEntry,
  type ScheduledPublish,
} from '../../shared/publish-schedule.ts';

/**
 * Where the scheduled-publish queue lives (Plan 5, OP-13).
 *
 * Same KV row the generation jobs use, so there is one storage mechanism, one migration story
 * and one place to look when something is stuck. The queue is small (dozens of rows), so a
 * single JSON value is honest here; it is not a table of events.
 *
 * This file is glue on purpose: every decision — what is due, what is missed, what backs off,
 * what a stored payload may contain — lives in `shared/publish-schedule.ts` and is tested
 * there without a database.
 */

export const PUBLISH_SCHEDULE_KV_KEY = 'publish.schedule.v1';

/** In-memory mirror of the row. The tick reads this; every mutation rewrites the row. */
export const scheduleQueue: ScheduledPublish[] = [];
let loaded = false;

export function scheduleLoaded(): boolean {
  return loaded;
}

export function scheduleSnapshot(): ScheduledPublish[] {
  return scheduleQueue.map((entry) => ({ ...entry, platforms: [...entry.platforms] }));
}

function replace(entries: readonly ScheduledPublish[]): void {
  scheduleQueue.length = 0;
  scheduleQueue.push(...entries);
}

/**
 * Read the queue once, recovering anything a crash left `running`. Loading is idempotent: a
 * second call returns the mirror without touching the database again.
 */
export async function loadSchedule(now = Date.now()): Promise<ScheduledPublish[]> {
  if (loaded) return scheduleSnapshot();
  await initializeSqliteProjectStore();
  const row = await sqliteReadEntry(PUBLISH_SCHEDULE_KV_KEY);
  const parsed = row.found ? parseSchedulePayload(row.value) : { entries: [], dropped: 0, version: null };
  const recovered = recoverInterrupted(parsed.entries, now);
  replace(recovered.entries);
  loaded = true;
  if (recovered.recovered > 0 || parsed.dropped > 0) await persistSchedule();
  return scheduleSnapshot();
}

export async function persistSchedule(): Promise<void> {
  await initializeSqliteProjectStore();
  await sqliteWriteEntry(PUBLISH_SCHEDULE_KV_KEY, serializeSchedulePayload(scheduleQueue));
}

export async function addScheduled(entry: ScheduledPublish): Promise<ScheduledPublish[]> {
  replace(upsertEntry(scheduleQueue, entry));
  await persistSchedule();
  return scheduleSnapshot();
}

export async function removeScheduled(id: string): Promise<boolean> {
  const result = removeEntry(scheduleQueue, id);
  if (!result.removed) return false;
  replace(result.entries);
  await persistSchedule();
  return true;
}

/** Used by the tick: it computes the next queue and hands it over in one write. */
export async function commitScheduled(entries: readonly ScheduledPublish[]): Promise<void> {
  replace(entries);
  await persistSchedule();
}

export function scheduledById(id: string): ScheduledPublish | null {
  return findEntry(scheduleQueue, id);
}
