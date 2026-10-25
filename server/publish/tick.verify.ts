// Runnable contract check for the scheduled-publish tick (Plan 5, OP-13). No timers and no
// server: a fake clock and a fake uploader, which is the only way to test retry and crash
// behaviour honestly.
import assert from 'node:assert';
import { runTick } from './tick';
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

const ok = async () => ({ ok: true as const });

// ── 1) A due entry publishes once and is marked published ───────────────────────────
{
  const outcome = await runTick([entry()], NOW, ok);
  assert.deepStrictEqual(outcome.fired, ['e1']);
  assert.deepStrictEqual(outcome.failed, []);
  const published = outcome.queue[0];
  assert.strictEqual(published.state, 'published');
  assert.strictEqual(published.publishedAt, new Date(NOW).toISOString());
}

// ── 2) A future entry, and a locked one, are not touched ────────────────────────────
{
  const outcome = await runTick([
    entry({ id: 'future', scheduledFor: iso(30) }),
    entry({ id: 'running', state: 'running' }),
    entry({ id: 'cancelled', state: 'cancelled' }),
  ], NOW, ok);
  assert.deepStrictEqual(outcome.fired, [], 'nothing fires');
  assert.deepStrictEqual(outcome.skipped, [], 'and nothing is reported as skipped-by-backoff either');
  assert.deepStrictEqual(outcome.queue.map((e) => e.state), ['planned', 'running', 'cancelled']);
}

// ── 3) A failure keeps the entry scheduled, with the error recorded ─────────────────
{
  const outcome = await runTick([entry()], NOW, async () => ({ ok: false as const, error: 'upload 500' }));
  assert.deepStrictEqual(outcome.failed, ['e1']);
  const retried = outcome.queue[0];
  assert.strictEqual(retried.state, 'planned', 'it is retried, not lost');
  assert.strictEqual(retried.attempts, 1);
  assert.strictEqual(retried.lastError, 'upload 500');
}

// ── 4) The chain: fail, fail, fail → parked, and the cap stops further attempts ─────
{
  const failing = async () => ({ ok: false as const, error: 'boom' });
  let queue: ScheduledPublish[] = [entry()];
  let clock = NOW;
  for (let round = 0; round < 3; round += 1) {
    const outcome = await runTick(queue, clock, failing);
    queue = outcome.queue;
    clock += 60 * 60_000; // an hour later each round
  }
  assert.strictEqual(queue[0].state, 'failed', 'after the cap it is parked');
  const after = await runTick(queue, clock, ok);
  assert.deepStrictEqual(after.fired, [], 'a parked entry never fires again');
}

// ── 5) A throw from the uploader is a failure, not a crash of the tick ──────────────
{
  const outcome = await runTick([entry()], NOW, async () => { throw new Error('connection reset'); });
  assert.deepStrictEqual(outcome.failed, ['e1']);
  assert.strictEqual(outcome.queue[0].lastError, 'connection reset');
}

// ── 6) Two due entries fire in slot order, and one failure does not stop the other ──
{
  const seen: string[] = [];
  const outcome = await runTick([
    entry({ id: 'second', scheduledFor: iso(-1) }),
    entry({ id: 'first', scheduledFor: iso(-20) }),
  ], NOW, async (e) => {
    seen.push(e.id);
    return e.id === 'first' ? { ok: false as const, error: 'no' } : { ok: true as const };
  });
  assert.deepStrictEqual(seen, ['first', 'second'], 'oldest slot first, and the failure does not abort the rest');
  assert.deepStrictEqual(outcome.failed, ['first']);
  assert.strictEqual(outcome.queue.find((e) => e.id === 'second')!.state, 'published');
}

// ── 7) A very late slot still publishes, and the tick records it as late ────────────
{
  const outcome = await runTick([entry({ id: 'late', scheduledFor: iso(-20 * 60) })], NOW, ok);
  assert.deepStrictEqual(outcome.late, ['late'], 'a missed slot publishes late and is flagged');
  assert.strictEqual(outcome.queue[0].state, 'published');
}

// ── 8) An entry is marked running before the upload, so a crash leaves evidence ─────
{
  let stateDuringUpload: string | null = null;
  await runTick([entry()], NOW, async (e) => {
    stateDuringUpload = e.state;
    return { ok: true as const };
  });
  assert.strictEqual(stateDuringUpload, 'running', 'the uploader sees the entry as running');
}

console.log('server/publish/tick.verify: ok');
