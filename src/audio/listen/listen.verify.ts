// Runnable check: `npx tsx src/audio/listen/listen.verify.ts`.
// Every signal is synthesized here: no audio fixtures live in git.
// Covers Plan 2 › Verification: click onsets, band separation, stop, key,
// drop, the ebur128 parser and the measureSong composition.
import assert from 'node:assert/strict';
import {
  buildEbur128Args,
  detectOnsets,
  measureSong,
  parseEbur128,
  spectrumFrames,
} from './index.ts';

const SR = 22_050;

function makeRand(seedInit: number): () => number {
  let seed = seedInit | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

function tone(buffer: Float32Array, startSeconds: number, seconds: number, hz: number, amplitude: number): void {
  const start = Math.round(startSeconds * SR);
  const length = Math.round(seconds * SR);
  for (let i = 0; i < length && start + i < buffer.length; i += 1) {
    buffer[start + i]! += amplitude * Math.sin((2 * Math.PI * hz * i) / SR);
  }
}

function noise(buffer: Float32Array, startSeconds: number, seconds: number, amplitude: number, seed: number): void {
  const rand = makeRand(seed);
  const start = Math.round(startSeconds * SR);
  const length = Math.round(seconds * SR);
  for (let i = 0; i < length && start + i < buffer.length; i += 1) {
    buffer[start + i]! += amplitude * rand() * 2;
  }
}

// ── 120 BPM clicks: an onset every 500 ms, within 10 ms ──
{
  const seconds = 4;
  const samples = new Float32Array(SR * seconds);
  for (let beat = 0; beat < 8; beat += 1) {
    const start = Math.round(beat * 0.5 * SR);
    for (let i = 0; i < Math.round(0.03 * SR); i += 1) {
      const t = i / SR;
      samples[start + i]! += 0.9 * Math.exp(-t * 90) * Math.sin(2 * Math.PI * 1000 * t);
    }
  }
  const onsets = detectOnsets(samples, SR);
  // The click at 0 s has no earlier window to rise from, so the flux pass
  // cannot see it; beats 1..7 are the measurable grid.
  for (let beat = 1; beat < 8; beat += 1) {
    const expected = beat * 500;
    const nearest = onsets.reduce(
      (best, onset) => (Math.abs(onset.timeMs - expected) < Math.abs(best - expected) ? onset.timeMs : best),
      Number.POSITIVE_INFINITY,
    );
    assert.ok(
      Math.abs(nearest - expected) <= 10,
      `onset ${beat} at ${nearest.toFixed(1)} ms, expected ${expected} ms (±10)`,
    );
  }
  const strays = onsets.filter((onset) => {
    const grid = Math.round(onset.timeMs / 500) * 500;
    return Math.abs(onset.timeMs - grid) > 60;
  });
  assert.equal(strays.length, 0, `off-grid onsets: ${strays.map((o) => o.timeMs.toFixed(0)).join(', ')}`);
}

// ── A 60 Hz burst is a bass event, not a bright one ──
{
  const samples = new Float32Array(SR * 1.5);
  tone(samples, 0.5, 0.6, 60, 0.8);
  const { frames } = spectrumFrames(samples, SR);
  const frame = frames[Math.round(750 / 50)]!;
  assert.ok(frame.bass > frame.mid * 3, `bass ${frame.bass.toFixed(4)} vs mid ${frame.mid.toFixed(4)}`);
  assert.ok(frame.brightness * 3 < frame.bass, `bass ${frame.bass.toFixed(4)} vs bright ${frame.brightness.toFixed(4)}`);
  assert.ok(frame.centroid < 200, `centroid ${frame.centroid.toFixed(1)} Hz should stay low`);
}

// ── One second of silence between two loud stretches reads as a stop ──
{
  const samples = new Float32Array(SR * 4);
  noise(samples, 0, 1.5, 0.3, 7);
  noise(samples, 2.5, 1.5, 0.3, 8);
  const { moments } = measureSong(samples, SR);
  const stops = moments.filter((moment) => moment.kind === 'stop');
  assert.ok(stops.length >= 1, 'expected a stop inside the silent gap');
  assert.ok(
    stops.some((stop) => Math.abs(stop.timeMs - 1500) <= 200),
    `stop at ${stops.map((stop) => stop.timeMs.toFixed(0)).join(', ')} ms, expected ~1500`,
  );
}

// ── An A-minor triad reads as A minor ──
{
  const samples = new Float32Array(SR * 3);
  tone(samples, 0, 3, 440, 0.25);
  tone(samples, 0, 3, 523.25, 0.25);
  tone(samples, 0, 3, 659.25, 0.25);
  const { key } = measureSong(samples, SR);
  assert.equal(key?.tonic, 'A', `tonic ${key?.tonic}`);
  assert.equal(key?.mode, 'minor', `mode ${key?.mode}`);
}

// ── A quiet-to-loud step reads as a drop near the step ──
{
  const samples = new Float32Array(SR * 5);
  noise(samples, 0, 2.5, 0.03, 11);
  noise(samples, 2.5, 2.5, 0.4, 12);
  const { moments } = measureSong(samples, SR);
  const drops = moments.filter((moment) => moment.kind === 'drop');
  assert.ok(
    drops.some((drop) => Math.abs(drop.timeMs - 2500) <= 300),
    `drops at ${drops.map((drop) => drop.timeMs.toFixed(0)).join(', ') || '(none)'} ms, expected ~2500`,
  );
}

// ── measureSong frames the whole clip on a 50 ms grid ──
{
  const samples = new Float32Array(SR * 3);
  tone(samples, 0, 0.05, 880, 0.8);
  tone(samples, 1, 0.05, 880, 0.8);
  const measured = measureSong(samples, SR);
  assert.equal(measured.frameMs, 50);
  assert.equal(measured.durationMs, 3000);
  // 3 s of 22.05 kHz audio is 59 whole 1102.5-sample frames; the sub-frame tail
  // is dropped rather than padded with invented silence.
  assert.equal(measured.frames.length, 59);
  assert.equal(measured.frames[58]!.timeMs, 2900);
  assert.ok(measured.onsets.length >= 1, 'a burst should produce an onset');
  assert.ok(measured.accents.length <= measured.onsets.length, 'accents are a subset of onsets');
  assert.ok(measured.key !== null, 'a tonal clip should produce a key');
}

// ── The ebur128 summary survives; `-v error` would have hidden it ──
{
  const stderr = [
    '[Parsed_ebur128_0 @ 0x55d3] t: 0.1    TARGET:-23 LUFS    M: -120.7 S:-120.7     I: -120.7 LUFS     LRA:   0.0 LU',
    '[Parsed_ebur128_0 @ 0x55d3] t: 3.0    TARGET:-23 LUFS    M: -18.4 S: -19.2     I: -21.8 LUFS     LRA:   1.1 LU',
    '[Parsed_ebur128_0 @ 0x55d3] Summary:',
    '',
    '  Integrated loudness:',
    '    I:         -23.0 LUFS',
    '    Threshold: -33.1 LUFS',
    '',
    '  Loudness range:',
    '    LRA:         5.0 LU',
    '    Threshold: -43.0 LUFS',
    '    LRA low:   -26.2 LUFS',
    '    LRA high:  -21.2 LUFS',
    '',
    '  True peak:',
    '    Peak:         -9.3 dBFS',
    '',
  ].join('\n');
  const report = parseEbur128(stderr);
  assert.equal(report.integratedLufs, -23);
  assert.equal(report.loudnessRangeLu, 5);
  assert.equal(report.truePeakDbfs, -9.3);
  assert.equal(report.shortTerm.length, 2);
  assert.equal(report.shortTerm[1]!.timeMs, 3000);
  assert.equal(report.shortTerm[1]!.shortTermLufs, -19.2);

  assert.equal(parseEbur128('').integratedLufs, null, 'an empty log is a missing measurement, not a throw');

  const args = buildEbur128Args('/media/song.mp3');
  assert.ok(args.includes('-hide_banner'), 'the banner is noise');
  assert.ok(args.includes('-nostats'), 'progress stats are noise');
  assert.ok(args.includes('ebur128=peak=true'), 'true peak must be on');
  assert.ok(!args.includes('-v'), '-v error hides the summary this parser reads');
  assert.ok(args.includes('/media/song.mp3'), 'the input path reaches ffmpeg');
  assert.deepEqual(args.slice(-2), ['null', '-'], 'sink is null output, not a file');
}

console.log('listen.verify: synthetic onsets, bands, moments, key, ebur128 all agree');
