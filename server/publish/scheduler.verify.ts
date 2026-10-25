// Runnable contract check for the publish loop (Plan 5, OP-13). No real timer and no SQLite:
// the store is an array and the clock is a number.
import assert from 'node:assert';
import { createScheduler } from './scheduler';
import type { ScheduledPublish } from '../../shared/publish-schedule';

const NOW = Date.parse('2026-10-25T18:00:00Z');
const iso = (minutes: number): string => new Date(NOW + minutes * 60_000).toISOString();

const entry = (over: Partial<ScheduledPublish> = {}): ScheduledPublish => ({
  id: 'e1',
  scheduledFor: iso(-5),
  source: '/media/uploads/a.mp4',
  platforms: ['tiktok'],
  title: 'Clip',
  previewId: 'req_1',
  state: 'planned',
  attempts: 0,
  ...over,
});

function storeWith(queue: ScheduledPublish[]) {
  let current = [...queue];
  let commitCount = 0;
  return {
    commits: () => commitCount,
    load: async () => [...current],
    commit: async (next: readonly ScheduledPublish[]) => { current = [...next]; commitCount += 1; },
    current: () => current,
  };
}

// ── 1) One pass publishes what is due and commits the result ──────────────────────────
{
  const store = storeWith([entry()]);
  const scheduler = createScheduler({ publish: async () => ({ ok: true as const }), store, now: () => NOW });
  const outcome = await scheduler.tickOnce();
  assert.ok(outcome, 'a pass returns its outcome');
  assert.deepStrictEqual(outcome!.fired, ['e1']);
  assert.strictEqual(store.current()[0].state, 'published', 'the committed queue is the published one');
  assert.ok(store.commits() >= 1, 'the result is persisted');
}

// ── 2) No due entries → nothing is written (no pointless database traffic) ────────────
{
  const store = storeWith([entry({ scheduledFor: iso(60) })]);
  const scheduler = createScheduler({ publish: async () => ({ ok: true as const }), store, now: () => NOW });
  const outcome = await scheduler.tickOnce();
  assert.deepStrictEqual(outcome!.fired, []);
  assert.strictEqual(store.commits(), 0, 'an idle tick does not rewrite the queue');
}

// ── 3) Re-entrancy: a second pass while one is in flight returns null ─────────────────
{
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const store = storeWith([entry()]);
  const scheduler = createScheduler({
    publish: async () => { await gate; return { ok: true as const }; },
    store,
    now: () => NOW,
  });
  const first = scheduler.tickOnce();
  assert.strictEqual(scheduler.ticking(), true, 'the loop knows a pass is running');
  const second = await scheduler.tickOnce();
  assert.strictEqual(second, null, 'a second pass is refused instead of double-publishing');
  release!();
  const firstOutcome = await first;
  assert.deepStrictEqual(firstOutcome!.fired, ['e1'], 'the first pass still completes');
  assert.strictEqual(scheduler.ticking(), false, 'and the loop is idle again');
}

// ── 4) A throwing store or publish is reported, not fatal ────────────────────────────
{
  const errors: unknown[] = [];
  const scheduler = createScheduler({
    publish: async () => ({ ok: true as const }),
    store: { load: async () => { throw new Error('db locked'); }, commit: async () => undefined },
    now: () => NOW,
    onError: (error) => errors.push(error),
  });
  const outcome = await scheduler.tickOnce();
  assert.strictEqual(outcome, null, 'a failed pass returns null');
  assert.strictEqual(errors.length, 1, 'and the error is reported to the caller');
  assert.strictEqual(scheduler.ticking(), false, 'the loop is free to try again next tick');
}

// ── 5) start/stop manage exactly one timer ───────────────────────────────────────────
{
  let received = 0;
  const store = storeWith([]);
  const scheduler = createScheduler({
    publish: async () => { received += 1; return { ok: true as const }; },
    store,
    now: () => NOW,
    intervalMs: 1000,
  });
  scheduler.start();
  scheduler.start(); // idempotent: a second start does not double the loop
  await new Promise((resolve) => setTimeout(resolve, 40));
  scheduler.stop();
  assert.strictEqual(scheduler.ticking(), false, 'stopped');
  assert.strictEqual(received, 0, 'an empty queue never calls the uploader, however many ticks run');
}

console.log('server/publish/scheduler.verify: ok');
