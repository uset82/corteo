// Contract check for the publish calendar (Plan 5, OP-13). Static, like the other panel checks:
// the promises are that it is translated, that it groups by the server's clock, and that it
// talks to the same route the agent does.
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { EN } from '../../i18n/dict/en';

const source = await readFile(new URL('./PublishCalendar.tsx', import.meta.url), 'utf8');

const keys = [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]);
assert.ok(keys.length >= 8, `the calendar is translated, found ${keys.length} strings`);
for (const key of new Set(keys)) {
  assert.ok(key in EN, `missing English dictionary entry for "${key}"`);
}

// It reads and cancels through the queue route, not through a second client.
assert.ok(source.includes("fetch('/api/publish-schedule')"), 'reads the queue from the route');
assert.ok(source.includes('/api/publish-schedule?id='), 'cancels through the same route');

// Grouping uses the clock the server reported, never the browser's.
assert.ok(source.includes('body.now'), 'takes the server clock');
assert.ok(/useMemo\(\(\) => \{[\s\S]*new Date\(now\)/.test(source), 'groups by the server clock');
assert.ok(!source.includes('Date.now() }), '), 'does not fall back to a browser-only clock for grouping');

// Seven days, and cancelled entries are not shown as scheduled.
assert.ok(source.includes('offset < 7'), 'a week is seven days');
assert.ok(source.includes("entry.state === 'cancelled'"), 'cancelled entries are filtered out');

console.log('publish/publish-calendar.verify: ok');
