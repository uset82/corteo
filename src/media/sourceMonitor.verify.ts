import assert from 'node:assert/strict';
import {
  canPreviewInSourceMonitor,
  clampSourceFrame,
  normalizeSourceRange,
  sourceFrameFromSeconds,
  sourceSeconds,
  sourceTotalFrames,
} from './sourceMonitor';

assert.equal(canPreviewInSourceMonitor({ kind: 'video', src: '/media/uploads/a.mp4' }), true);
assert.equal(canPreviewInSourceMonitor({ kind: 'audio', src: '/media/uploads/a.mp3' }), true);
assert.equal(canPreviewInSourceMonitor({ kind: 'image', src: '/media/uploads/a.png' }), true);
assert.equal(canPreviewInSourceMonitor({ kind: 'document', src: '/media/uploads/a.pdf' }), false);
assert.equal(canPreviewInSourceMonitor({ kind: 'video', src: '' }), false);

assert.equal(sourceTotalFrames(120, 30, 'video'), 120);
assert.equal(sourceTotalFrames(0, 30, 'video'), 1);
assert.equal(sourceTotalFrames(0, 30, 'image'), 150);
assert.equal(sourceTotalFrames(0, 24, 'svg'), 120);
assert.equal(sourceTotalFrames(-4, 30, 'audio'), 1);

assert.deepEqual(normalizeSourceRange(100, -5, 120), { inFrame: 0, outFrame: 100 });
assert.deepEqual(normalizeSourceRange(100, 90, 20), { inFrame: 90, outFrame: 91 });
assert.deepEqual(normalizeSourceRange(1, 0, 0), { inFrame: 0, outFrame: 1 });
assert.deepEqual(normalizeSourceRange(100, 40, 60), { inFrame: 40, outFrame: 60 });

assert.equal(clampSourceFrame(-3, 100), 0);
assert.equal(clampSourceFrame(42.4, 100), 42);
assert.equal(clampSourceFrame(500, 100), 99);
assert.equal(clampSourceFrame(Number.NaN, 100), 0);

assert.equal(sourceSeconds(45, 30), 1.5);
assert.equal(sourceFrameFromSeconds(1.5, 30, 100), 45);
assert.equal(sourceFrameFromSeconds(10, 30, 100), 99);

console.log('source monitor verification passed');
