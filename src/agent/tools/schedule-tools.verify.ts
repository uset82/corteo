// Runnable contract check for the scheduled-publish tools (Plan 5, OP-13). `fetch` is stubbed:
// what matters is the request each tool sends and how a refusal is reported, not the network.
import assert from 'node:assert';
import { execScheduleTool } from './schedule-tools';
import type { AgentContext } from '../context';

interface Call { url: string; method: string; body: unknown }
const calls: Call[] = [];
let nextResponse: { ok: boolean; status: number; body: unknown } = { ok: true, status: 200, body: {} };

globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push({
    url: String(url),
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  });
  return {
    ok: nextResponse.ok,
    status: nextResponse.status,
    json: async () => nextResponse.body,
  } as Response;
}) as typeof fetch;

const ctx = {} as AgentContext;
const NOW = Date.parse('2026-10-25T18:00:00Z');

// ── 1) Scheduling sends the slot and the approved preview ───────────────────────────
{
  calls.length = 0;
  nextResponse = { ok: true, status: 201, body: { ok: true, entry: { id: 'pub_1', scheduledFor: '2026-10-26T18:30:00.000Z' } } };
  const result = await execScheduleTool('schedule_publish', {
    source: '/media/uploads/a.mp4',
    platforms: ['tiktok', 'youtube'],
    title: 'Clip',
    when: '2026-10-26T18:30:00Z',
    previewId: 'req_1',
  }, ctx) as { ok: boolean; entry: { id: string }; note?: string };

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.entry.id, 'pub_1');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].method, 'POST');
  assert.strictEqual(calls[0].url, '/api/publish-schedule');
  assert.deepStrictEqual(calls[0].body, {
    source: '/media/uploads/a.mp4',
    platforms: ['tiktok', 'youtube'],
    title: 'Clip',
    scheduledFor: '2026-10-26T18:30:00Z',
    previewId: 'req_1',
  });
  assert.ok(/editor esté cerrado/.test(result.note ?? ''), 'the note warns that the server publishes without a tab');
}

// ── 2) A refusal from the server is passed through, not swallowed ───────────────────
{
  nextResponse = { ok: false, status: 400, body: { error: 'Falta la vista previa aprobada (previewId).' } };
  const refused = await execScheduleTool('schedule_publish', {
    source: '/media/uploads/a.mp4', platforms: ['tiktok'], title: 'Clip', when: '2026-10-26T18:30:00Z',
  }, ctx) as { ok: boolean; status: number; error: string };
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(refused.status, 400);
  assert.ok(/aprobada/.test(refused.error), 'the server sentence reaches the agent unchanged');
}

// ── 3) Listing reports the clock and the count ─────────────────────────────────────
{
  calls.length = 0;
  nextResponse = { ok: true, status: 200, body: { ok: true, now: NOW, entries: [{ id: 'a' }, { id: 'b' }] } };
  const listed = await execScheduleTool('list_scheduled_publishes', {}, ctx) as { ok: boolean; count: number; now: number };
  assert.strictEqual(listed.ok, true);
  assert.strictEqual(listed.count, 2);
  assert.strictEqual(listed.now, NOW);
  assert.strictEqual(calls[0].method, 'GET');
}

// ── 4) An empty queue says so instead of returning a bare list ──────────────────────
{
  nextResponse = { ok: true, status: 200, body: { ok: true, now: NOW, entries: [] } };
  const empty = await execScheduleTool('list_scheduled_publishes', {}, ctx) as { count: number; note?: string };
  assert.strictEqual(empty.count, 0);
  assert.ok(/nada programado/i.test(empty.note ?? ''));
}

// ── 5) Cancelling sends the id; a missing id never reaches the server ────────────────
{
  calls.length = 0;
  nextResponse = { ok: true, status: 200, body: { ok: true, id: 'pub_1' } };
  const cancelled = await execScheduleTool('cancel_scheduled_publish', { id: 'pub_1' }, ctx) as { ok: boolean };
  assert.strictEqual(cancelled.ok, true);
  assert.strictEqual(calls[0].method, 'DELETE');
  assert.strictEqual(calls[0].url, '/api/publish-schedule?id=pub_1');

  calls.length = 0;
  const missing = await execScheduleTool('cancel_scheduled_publish', { id: '  ' }, ctx) as { ok: boolean; error?: string };
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(calls.length, 0, 'an empty id is refused locally');
}

// ── 6) A 404 from the server is a normal answer, not a crash ───────────────────────
{
  nextResponse = { ok: false, status: 404, body: { error: 'No existe esa publicación programada.' } };
  const gone = await execScheduleTool('cancel_scheduled_publish', { id: 'nope' }, ctx) as { ok: boolean; status: number };
  assert.strictEqual(gone.ok, false);
  assert.strictEqual(gone.status, 404);
}

// ── 7) Unknown tool name ────────────────────────────────────────────────────────────
{
  const unknown = await execScheduleTool('schedule_everything', {}, ctx) as { error?: string };
  assert.ok(unknown.error);
}

console.log('schedule-tools.verify: ok');
