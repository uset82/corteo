import { runTick, type PublishFn, type TickOutcome } from './tick.ts';
import { commitScheduled, loadSchedule } from './schedule-store.ts';
import type { ScheduledPublish } from '../../shared/publish-schedule.ts';

/**
 * The 30-second loop (Plan 5, OP-13).
 *
 * `runTick` decides what to publish; this decides *when* to ask, and it is the only place
 * with a timer. Two properties matter more than the interval:
 *
 * - **no re-entrancy:** a tick that is still uploading must not be joined by another one, or
 *   the same entry would be attempted twice;
 * - **a failed tick is not a dead scheduler:** an exception is reported and the loop
 *   continues, because the next slot may be fine.
 *
 * The store is injected so the loop can be tested with an array instead of SQLite; production
 * passes the real one by default.
 */

export interface SchedulerStore {
  load: () => Promise<ScheduledPublish[]>;
  commit: (queue: readonly ScheduledPublish[]) => Promise<void>;
}

export interface SchedulerDeps {
  publish: PublishFn;
  store?: SchedulerStore;
  intervalMs?: number;
  now?: () => number;
  onError?: (error: unknown) => void;
}

export interface Scheduler {
  /** One pass. Returns null when a pass was already in flight. */
  tickOnce: () => Promise<TickOutcome | null>;
  start: () => void;
  stop: () => void;
  ticking: () => boolean;
}

const DEFAULT_INTERVAL_MS = 30_000;

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const store: SchedulerStore = deps.store ?? { load: loadSchedule, commit: commitScheduled };
  const intervalMs = Math.max(1000, deps.intervalMs ?? DEFAULT_INTERVAL_MS);
  const now = deps.now ?? (() => Date.now());
  let inFlight: Promise<TickOutcome | null> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tickOnce = async (): Promise<TickOutcome | null> => {
    if (inFlight) return null;
    const pass = (async (): Promise<TickOutcome | null> => {
      try {
        const queue = await store.load();
        const outcome = await runTick(queue, now(), deps.publish);
        if (outcome.fired.length) await store.commit(outcome.queue);
        return outcome;
      } catch (error) {
        deps.onError?.(error);
        return null;
      } finally {
        inFlight = null;
      }
    })();
    inFlight = pass;
    return pass;
  };

  return {
    tickOnce,
    ticking: () => inFlight !== null,
    start: () => {
      if (timer) return;
      timer = setInterval(() => { void tickOnce(); }, intervalMs);
      // Do not hold the process open just for the scheduler (Node timers).
      (timer as unknown as { unref?: () => void }).unref?.();
    },
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
