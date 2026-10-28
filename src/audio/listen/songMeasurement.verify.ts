// Runnable check: `npx tsx src/audio/listen/songMeasurement.verify.ts`.
// The song dialog shows a loudness number, so the browser path must turn frame
// RMS into a dBFS value that moves the way amplitude does.
import assert from 'node:assert/strict';
import { measureFromSamples, songLoudnessDb } from './songMeasurement';
import type { EnergyFrame } from './types';

const SR = 22_050;

function frames(rms: number, count: number): EnergyFrame[] {
  return Array.from({ length: count }, (_, index) => ({
    timeMs: index * 50, rms, bass: rms, mid: rms, brightness: rms, centroid: 1_000,
  }));
}

function triad(amplitude: number): Float32Array {
  const samples = new Float32Array(SR * 3);
  const tones = [440, 523.25, 659.25];
  for (const hz of tones) {
    for (let index = 0; index < samples.length; index += 1) {
      samples[index]! += amplitude * Math.sin((2 * Math.PI * hz * index) / SR);
    }
  }
  return samples;
}

// A flat 0.1 RMS reads as -20 dBFS, and mixing two levels averages the power.
assert.equal(songLoudnessDb(frames(0.1, 20)), -20);
assert.equal(songLoudnessDb([...frames(0.1, 10), ...frames(0.2, 10)]), Math.round(10 * Math.log10((0.01 + 0.04) / 2) * 10) / 10);

// Silence and non-finite frames give no number instead of -Infinity.
assert.equal(songLoudnessDb(frames(0, 5)), null);
assert.equal(songLoudnessDb([{ timeMs: 0, rms: Number.NaN, bass: 0, mid: 0, brightness: 0, centroid: 0 }]), null);
assert.equal(songLoudnessDb([]), null);

// The composed measurement keeps the A-minor triad and doubles it 6 dB up.
const quiet = measureFromSamples(triad(0.1), SR);
const loud = measureFromSamples(triad(0.2), SR);
assert.equal(quiet.key?.tonic, 'A', `tonic ${quiet.key?.tonic}`);
assert.equal(quiet.key?.mode, 'minor', `mode ${quiet.key?.mode}`);
assert.ok(Math.abs(quiet.durationMs - 3_000) <= 5, `duration ${quiet.durationMs}`);
assert.ok(quiet.loudnessDb !== null && loud.loudnessDb !== null, 'both measurements report a loudness');
assert.ok(Math.abs((loud.loudnessDb ?? 0) - (quiet.loudnessDb ?? 0) - 6) <= 0.3,
  `doubling the amplitude moved ${quiet.loudnessDb} dB to ${loud.loudnessDb} dB`);
assert.ok(Array.isArray(loud.moments), 'moments come back for the drop markers');

console.log(`songMeasurement.verify: loudness ${quiet.loudnessDb} → ${loud.loudnessDb} dB and the ${quiet.key?.tonic} ${quiet.key?.mode} key passed`);
