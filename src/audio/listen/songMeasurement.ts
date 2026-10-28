// Song facts the browser can measure by itself (Plan 2 › Part D): the tonal key
// and the loudness come from the decoded audio, so the song dialog never has to
// claim a number the local ears cannot produce.
import { measureSong } from './index';
import type { EnergyFrame, KeyEstimate, Moment } from './types';

export interface SongMeasurement {
  readonly durationMs: number;
  readonly key: KeyEstimate | null;
  /** Wide-band RMS in dBFS, or null when the audio is digital silence. */
  readonly loudnessDb: number | null;
  readonly moments: readonly Moment[];
}

/** Power-average of the frame RMS values, in dBFS with one decimal. */
export function songLoudnessDb(frames: readonly EnergyFrame[]): number | null {
  let power = 0;
  let used = 0;
  for (const frame of frames) {
    if (!Number.isFinite(frame.rms) || frame.rms <= 0) continue;
    power += frame.rms * frame.rms;
    used += 1;
  }
  if (used === 0) return null;
  const db = 10 * Math.log10(power / used);
  return Number.isFinite(db) ? Math.round(db * 10) / 10 : null;
}

export function measureFromSamples(samples: Float32Array, sampleRate: number): SongMeasurement {
  const measured = measureSong(samples, sampleRate);
  return {
    durationMs: measured.durationMs,
    key: measured.key,
    loudnessDb: songLoudnessDb(measured.frames),
    moments: measured.moments,
  };
}
