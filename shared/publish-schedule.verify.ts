// Runnable contract check for the scheduled-publish queue (Plan 5, OP-13, the pure half).
// No server, no timers: what "due", "missed" and "parked" mean, and when a retry may fire.
import assert from 'node:assert';
import {
  advance,
  canAttempt,
  dueEntries,
  findEntry,
  isMissed,
  parseInstant,
  parseSchedulePayload,
  recoverInterrupted,
  serializeSchedulePayload,
  removeEntry,
  summarize,
  upsertEntry,
  validateSlot,
  type ScheduledPublish,
} from './publish-schedule';

const NOW = Date.parse('2026-10-25T18:00:00Z');
const iso = (offsetMinutes: number): string => new Date(NOW + offsetMinutes * 60_000).toISOString();

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

// ── 1) Slot validation: future, parseable, inside the horizon ─────────────────────────
assert.strictEqual(validateSlot(iso(10), NOW).ok, true, 'ten minutes ahead is fine');
assert.strictEqual(validateSlot(iso(-10), NOW).ok, false, 'a past slot is refused, not fired at once');
assert.strictEqual(validateSlot('no-soy-fecha', NOW).ok, false, 'garbage is refused');
assert.strictEqual(validateSlot(new Date(NOW + 400 * 86_400_000).toISOString(), NOW).ok, false, 'beyond the horizon is refused');
assert.strictEqual(parseInstant('2026-10-25T18:05:00Z'), NOW + 5 * 60_000);

// ── 2) Due: only planned, only past the slot, oldest first ───────────────────────────
const queue = [
  entry({ id: 'late', scheduledFor: iso(-30) }),
  entry({ id: 'recent', scheduledFor: iso(-2) }),
  entry({ id: 'future', scheduledFor: iso(30) }),
  entry({ id: 'done', scheduledFor: iso(-60), state: 'published' }),
  entry({ id: 'cancelled', scheduledFor: iso(-60), state: 'cancelled' }),
];
assert.deepStrictEqual(dueEntries(queue, NOW).map((e) => e.id), ['late', 'recent'], 'due is planned + past, sorted by slot');
assert.deepStrictEqual(dueEntries([entry({ id: 'x', scheduledFor: 'basura' })], NOW), [], 'an unparseable slot is never due');

// ── 3) Missed: the grace window decides, not the mere lateness ───────────────────────
assert.strictEqual(isMissed(entry({ scheduledFor: iso(-60) }), NOW), false, 'an hour late is still on time');
assert.strictEqual(isMissed(entry({ scheduledFor: iso(-13 * 60) }), NOW), true, '13 h late is a missed slot');
assert.strictEqual(isMissed(entry({ scheduledFor: iso(-13 * 60), state: 'published' }), NOW), false, 'a published entry is not "missed"');
assert.strictEqual(isMissed(entry({ scheduledFor: iso(-13 * 60) }), NOW, { graceMinutes: 24 * 60 }), false, 'the grace window is configurable');

// ── 4) Attempts: backoff grows, the cap parks the entry ──────────────────────────────
assert.strictEqual(canAttempt(entry({ attempts: 0 }), NOW), true, 'first attempt is allowed once due');
assert.strictEqual(canAttempt(entry({ attempts: 1 }), NOW), false, 'after one failure it waits for the backoff');
assert.strictEqual(canAttempt(entry({ attempts: 1 }), NOW + 10 * 60_000), true, 'the backoff is 10 min × attempts');
assert.strictEqual(canAttempt(entry({ attempts: 2 }), NOW + 10 * 60_000), false, 'the second backoff is longer');
assert.strictEqual(canAttempt(entry({ attempts: 3 }), NOW + 10 * 60_000), false, 'at the cap it is parked');
assert.strictEqual(canAttempt(entry({ attempts: 0, scheduledFor: iso(10) }), NOW), false, 'not due yet, not attempted');
assert.strictEqual(canAttempt(entry({ state: 'running' }), NOW), false, 'a running entry is locked');

// ── 5) advance(): success publishes once, failure retries then parks ─────────────────
const published = advance(entry(), { ok: true, at: NOW });
assert.strictEqual(published.state, 'published');
assert.strictEqual(published.attempts, 1);
assert.strictEqual(published.publishedAt, new Date(NOW).toISOString(), 'the publication time is recorded');
assert.strictEqual(published.lastError, undefined);

const retry = advance(entry({ attempts: 0 }), { ok: false, at: NOW, error: 'upload 500' });
assert.strictEqual(retry.state, 'planned', 'a first failure keeps it scheduled');
assert.strictEqual(retry.lastError, 'upload 500');

const parked = advance(entry({ attempts: 2 }), { ok: false, at: NOW, error: 'upload 500' });
assert.strictEqual(parked.state, 'failed', 'the third failure parks it instead of retrying forever');
assert.strictEqual(advance(parked, { ok: false, at: NOW, error: 'x' }).state, 'failed', 'a parked entry stays parked');

// ── 6) summarize(): what the calendar header shows ───────────────────────────────────
const summary = summarize(queue, NOW);
assert.deepStrictEqual(summary, { planned: 3, due: 2, missed: 0, published: 1, failed: 0, cancelled: 1 });
const withMissed = summarize([entry({ scheduledFor: iso(-20 * 60) })], NOW);
assert.strictEqual(withMissed.missed, 1, 'a slot past the grace window is counted as missed');

// ── 7) The list operations the store and the calendar share ──────────────────────────
const a = entry({ id: 'a', scheduledFor: iso(20) });
const b = entry({ id: 'b', scheduledFor: iso(10) });
const c = entry({ id: 'c', scheduledFor: iso(30) });
const ordered = upsertEntry(upsertEntry(upsertEntry([], c), a), b);
assert.deepStrictEqual(ordered.map((e) => e.id), ['b', 'a', 'c'], 'upsert keeps the list ordered by slot');

const replaced = upsertEntry(ordered, entry({ id: 'a', scheduledFor: iso(5), title: 'renombrado' }));
assert.strictEqual(replaced.length, 3, 'upsert replaces, it does not duplicate');
assert.strictEqual(replaced[0].id, 'a', 'the replacement moves to its new slot position');
assert.strictEqual(replaced[0].title, 'renombrado');

const removed = removeEntry(replaced, 'a');
assert.strictEqual(removed.removed, true);
assert.deepStrictEqual(removed.entries.map((e) => e.id), ['b', 'c']);
assert.strictEqual(removeEntry(removed.entries, 'nope').removed, false, 'removing an unknown id reports it');

assert.strictEqual(findEntry(removed.entries, 'b')?.id, 'b');
assert.strictEqual(findEntry(removed.entries, 'zzz'), null);

// ── 8) Recovery after a crash: an interrupted publish is not blindly re-posted ───────
const interrupted = recoverInterrupted([
  entry({ id: 'r', state: 'running', attempts: 1 }),
  entry({ id: 'p', state: 'planned' }),
], NOW);
assert.strictEqual(interrupted.recovered, 1, 'one interrupted entry is reported');
const recovered = interrupted.entries.find((e) => e.id === 'r')!;
assert.strictEqual(recovered.state, 'failed', 'a half-published entry becomes failed, not planned');
assert.ok(/interrump/i.test(recovered.lastError ?? ''), 'and it says why, so the user can check');
assert.strictEqual(interrupted.entries.find((e) => e.id === 'p')!.state, 'planned', 'untouched entries stay planned');

// ── 9) A stored payload is untrusted: bad rows are dropped and counted ───────────────
const good = entry({ id: 'ok', state: 'planned' });
const payload = serializeSchedulePayload([good]);
assert.strictEqual(payload.version, 1);
assert.strictEqual(payload.entries.length, 1);

const roundTrip = parseSchedulePayload(JSON.parse(JSON.stringify(payload)));
assert.strictEqual(roundTrip.version, 1);
assert.strictEqual(roundTrip.dropped, 0);
assert.deepStrictEqual(roundTrip.entries, [good], 'a stored entry survives serialization exactly');

const messy = parseSchedulePayload({
  version: 1,
  entries: [
    good,
    { ...good, id: 'no-source', source: '' },
    { ...good, id: 'no-preview', previewId: undefined },
    { ...good, id: 'bad-date', scheduledFor: 'ayer' },
    { ...good, id: 'bad-state', state: 'published-ish' },
    { ...good, id: 'no-platforms', platforms: [] },
    null,
    'basura',
  ],
});
assert.strictEqual(messy.entries.length, 1, 'only the valid row survives');
assert.strictEqual(messy.dropped, 7, 'every dropped row is counted, not swallowed');
assert.deepStrictEqual(parseSchedulePayload(null), { entries: [], dropped: 0, version: null }, 'no payload is empty, not fatal');
assert.deepStrictEqual(parseSchedulePayload({ version: 2 }), { entries: [], dropped: 0, version: 2 }, 'a future version is reported, not guessed at');

// Entries come back sorted by slot, so the calendar does not have to sort them again.
const unsorted = parseSchedulePayload({
  version: 1,
  entries: [entry({ id: 'z', scheduledFor: iso(30) }), entry({ id: 'a', scheduledFor: iso(-30) })],
});
assert.deepStrictEqual(unsorted.entries.map((e) => e.id), ['a', 'z']);

console.log('shared/publish-schedule.verify: ok');
