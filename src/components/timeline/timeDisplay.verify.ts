// timeDisplay.verify — Phase 3.5: elapsed / countdown toolbar timecode.
// The toolbar timecode is painted imperatively, so the mode is a module store:
// formatting, persistence and subscriber notification are the whole contract.
import assert from 'node:assert/strict';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  },
});

const {
  formatTimecode, getTimeDisplayMode, setTimeDisplayMode, toggleTimeDisplayMode, subscribeTimeDisplayMode,
} = await import('./CountdownToggle');

const FPS = 30;
const TOTAL = 900; // 30 s

assert.equal(formatTimecode(150, TOTAL, FPS, 'elapsed'), '00:05.00 / 00:30.00');
assert.equal(formatTimecode(150, TOTAL, FPS, 'countdown'), '-00:25.00 / 00:30.00', 'countdown shows the remaining time');
assert.equal(formatTimecode(TOTAL, TOTAL, FPS, 'countdown'), '00:00.00 / 00:30.00', 'no minus sign at the end');
assert.equal(formatTimecode(TOTAL + 300, TOTAL, FPS, 'countdown'), '00:00.00 / 00:30.00', 'past the end clamps');
assert.equal(formatTimecode(-5, TOTAL, FPS, 'elapsed'), '00:00.00 / 00:30.00', 'negative frames clamp');

assert.equal(getTimeDisplayMode(), 'elapsed', 'elapsed is the default');
let notified = 0;
const unsubscribe = subscribeTimeDisplayMode(() => { notified += 1; });
assert.equal(toggleTimeDisplayMode(), 'countdown');
assert.equal(getTimeDisplayMode(), 'countdown');
assert.equal(storage.get('cc.timeDisplayMode'), 'countdown', 'the mode persists');
assert.equal(notified, 1, 'subscribers are notified once');
setTimeDisplayMode('countdown');
assert.equal(notified, 1, 'an unchanged mode does not notify');
unsubscribe();
assert.equal(toggleTimeDisplayMode(), 'elapsed');
assert.equal(notified, 1, 'unsubscribed listeners stop receiving');

console.log('timeDisplay.verify: elapsed/countdown formatting, persistence and toggle');
