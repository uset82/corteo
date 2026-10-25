// Runnable contract check for the publish-schedule routes (Plan 5, OP-13). The commands are
// tested with an in-memory store; what matters is what they refuse before anything is queued.
import assert from 'node:assert';
import { cancelScheduled, listScheduled, scheduleOne, type ScheduleStoreAdapter } from './publish-schedule';
import type { ScheduledPublish } from '../../shared/publish-schedule';

const NOW = Date.parse('2026-10-25T18:00:00Z');
const inTen = new Date(NOW + 10 * 60_000).toISOString();

function memoryStore() {
  let entries: ScheduledPublish[] = [];
  const store: ScheduleStoreAdapter = {
    add: async (entry) => { entries = [...entries, entry]; },
    remove: async (id) => {
      const before = entries.length;
      entries = entries.filter((entry) => entry.id !== id);
      return entries.length !== before;
    },
    load: async () => entries,
  };
  return { store, entries: () => entries };
}

const valid = { scheduledFor: inTen, source: '/media/uploads/a.mp4', platforms: ['tiktok'], title: 'Clip', previewId: 'req_1' };

// ── 1) A complete request is queued ─────────────────────────────────────────────────
{
  const { store, entries } = memoryStore();
  const result = await scheduleOne(valid, { store, now: NOW });
  assert.strictEqual(result.status, 201);
  assert.strictEqual(entries().length, 1);
  assert.strictEqual(entries()[0].state, 'planned');
  assert.strictEqual(entries()[0].attempts, 0);
  assert.strictEqual(entries()[0].previewId, 'req_1');
}

// ── 2) Refusals: each one is a sentence the user can act on ────────────────────────
{
  const { store, entries } = memoryStore();
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ ...valid, scheduledFor: 'ayer' }, /fecha/i],
    [{ ...valid, scheduledFor: new Date(NOW - 60_000).toISOString() }, /futuro/i],
    [{ ...valid, source: '   ' }, /vídeo|video/i],
    [{ ...valid, previewId: '' }, /aprobaci/i],
    [{ ...valid, title: '' }, /título|titulo/i],
    [{ ...valid, platforms: [] }, /plataforma/i],
  ];
  for (const [input, pattern] of cases) {
    const result = await scheduleOne(input, { store, now: NOW });
    assert.strictEqual(result.status, 400, `refused: ${JSON.stringify(input).slice(0, 60)}`);
    assert.match(String((result.body as { error?: string }).error), pattern);
  }
  assert.strictEqual(entries().length, 0, 'nothing reached the queue through a refusal');
}

// ── 3) Listing reports the clock it used, so the UI and the server agree ───────────
{
  const { store } = memoryStore();
  await scheduleOne(valid, { store, now: NOW });
  const listed = await listScheduled({ store, now: NOW });
  assert.strictEqual(listed.status, 200);
  const body = listed.body as { now: number; entries: ScheduledPublish[] };
  assert.strictEqual(body.now, NOW, 'the response carries the clock, not the client');
  assert.strictEqual(body.entries.length, 1);
}

// ── 4) Cancelling: known id → 200, unknown → 404, empty → 400 ─────────────────────
{
  const { store } = memoryStore();
  const created = await scheduleOne(valid, { store, now: NOW });
  const id = (created.body as { entry: ScheduledPublish }).entry.id;
  assert.strictEqual((await cancelScheduled(id, { store })).status, 200);
  assert.strictEqual((await cancelScheduled(id, { store })).status, 404, 'cancelling twice is a 404, not a crash');
  assert.strictEqual((await cancelScheduled('', { store })).status, 400);
}

console.log('server/plugins/publish-schedule.verify: ok');
