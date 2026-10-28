// P2-5: the toolbar timecode toggles between elapsed and a countdown.
// Run: npx tsx src/components/timeline/formatTimecode.verify.ts
import assert from 'node:assert/strict';

// The module reads localStorage at import time; install a fake first so the
// default and the persistence assertions are deterministic.
const storage = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fakeStorage });

const {
  fmt,
  formatTimecode,
  getTimecodeMode,
  setTimecodeMode,
  subscribeTimecodeMode,
  toggleTimecodeMode,
} = await import('./timelineUtil');

const FPS = 30;
const TOTAL = 900; // 30 s

// Elapsed: exactly the pair the toolbar has always shown.
assert.equal(formatTimecode(0, TOTAL, FPS, 'elapsed'), '00:00.00 / 00:30.00');
assert.equal(formatTimecode(150, TOTAL, FPS, 'elapsed'), '00:05.00 / 00:30.00');
assert.equal(formatTimecode(-5, TOTAL, FPS, 'elapsed'), '00:00.00 / 00:30.00', 'a negative frame clamps to 0');
for (const fps of [24, 25, 30, 60]) {
  const total = fps * 30;
  for (const frame of [0, Math.floor(total / 2), total - 1, total]) {
    assert.equal(
      formatTimecode(frame, total, fps, 'elapsed'),
      `${fmt(frame, fps)} / ${fmt(total, fps)}`,
      `elapsed at ${fps} fps matches the old fmt output`,
    );
  }
}

// Remaining: total minus the frame, as -hh:mm:ss:ff, clamped at zero.
assert.equal(formatTimecode(0, 2500, FPS, 'remaining'), '-00:01:23:10', 'the card example');
assert.equal(formatTimecode(0, TOTAL, FPS, 'remaining'), '-00:00:30:00', 'frame 0 counts the whole timeline');
assert.equal(formatTimecode(450, TOTAL, FPS, 'remaining'), '-00:00:15:00', 'middle');
assert.equal(formatTimecode(899, TOTAL, FPS, 'remaining'), '-00:00:00:01', 'last frame');
assert.equal(formatTimecode(TOTAL, TOTAL, FPS, 'remaining'), '00:00:00:00', 'zero carries no minus');
assert.equal(formatTimecode(TOTAL + 300, TOTAL, FPS, 'remaining'), '00:00:00:00', 'past the end is never negative');
assert.equal(formatTimecode(-5, TOTAL, FPS, 'remaining'), '-00:00:30:00', 'a negative frame clamps to 0');
assert.equal(formatTimecode(0, 360, 24, 'remaining'), '-00:00:15:00');
assert.equal(formatTimecode(120, 360, 24, 'remaining'), '-00:00:10:00');
assert.equal(formatTimecode(121, 360, 24, 'remaining'), '-00:00:09:23');
assert.equal(formatTimecode(0, 1500, 25, 'remaining'), '-00:01:00:00');
assert.equal(formatTimecode(0, 1800, 60, 'remaining'), '-00:00:30:00');
assert.equal(formatTimecode(0, FPS * (3600 + 5), FPS, 'remaining'), '-01:00:05:00');

// The mode is remembered in localStorage and every listener hears one change.
assert.equal(getTimecodeMode(), 'elapsed', 'elapsed is the default');
let notified = 0;
const unsubscribe = subscribeTimecodeMode(() => { notified += 1; });
assert.equal(toggleTimecodeMode(), 'remaining');
assert.equal(getTimecodeMode(), 'remaining');
assert.equal(storage.get('cc.timecodeMode'), 'remaining', 'the mode persists');
assert.equal(notified, 1, 'subscribers are notified once');
setTimecodeMode('remaining');
assert.equal(notified, 1, 'an unchanged mode does not notify');
unsubscribe();
assert.equal(toggleTimecodeMode(), 'elapsed');
assert.equal(notified, 1, 'unsubscribed listeners stop receiving');

// A browser that refuses storage must not break the toggle.
setTimecodeMode('remaining');
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: () => { throw new Error('storage denied'); },
    setItem: () => { throw new Error('storage denied'); },
  },
});
assert.doesNotThrow(() => setTimecodeMode('elapsed'), 'a throwing localStorage must not break the toggle');
assert.equal(getTimecodeMode(), 'elapsed', 'the in-memory mode still works without storage');

console.log('formatTimecode.verify: elapsed/remaining formatting, clamping and storage-safe persistence');
