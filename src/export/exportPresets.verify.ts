// exportPresets.verify — Phase 3.6 file-size estimation.
import assert from 'node:assert/strict';
import { bytesPerSecond, estimateFileSize, formatFileSize } from './exportPresets';

assert.equal(bytesPerSecond(8_000_000), 1_000_000);
assert.equal(bytesPerSecond(-5), 0);

// 10 Mbps for 60 s = 75 MB.
assert.deepEqual(estimateFileSize(10_000_000, 60), { megabytes: 75, label: '75.0 MB' });
// 20 Mbps for 120 s = 300 MB.
assert.equal(estimateFileSize(20_000_000, 120)?.megabytes, 300);
// 40 Mbps for 30 min = 9 GB → gigabyte label.
const long = estimateFileSize(40_000_000, 1800);
assert.ok(long);
assert.equal(long.label, '8.79 GB');
assert.equal(long.megabytes, 9000);

// No bitrate (ProRes) or no duration → nothing to show.
assert.equal(estimateFileSize(undefined, 60), null);
assert.equal(estimateFileSize(0, 60), null);
assert.equal(estimateFileSize(Number.NaN, 60), null);
assert.equal(estimateFileSize(10_000_000, 0), null);
assert.equal(estimateFileSize(10_000_000, Number.POSITIVE_INFINITY), null);

assert.equal(formatFileSize(0), '0 MB');
assert.equal(formatFileSize(-3), '0 MB');
assert.equal(formatFileSize(0.04), '0.0 MB');
assert.equal(formatFileSize(999.94), '999.9 MB');
assert.equal(formatFileSize(1000), '0.98 GB');
assert.equal(formatFileSize(2048), '2.00 GB');

console.log('exportPresets.verify: bitrate → size estimate and labels');
