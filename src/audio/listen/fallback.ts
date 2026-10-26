// Listening without the model packs: the beat tracker in src/audio/beats.ts and
// the energy sections in src/audio/intelligence/sections.ts. Server and browser
// share this so "sin modelos" answers with the same pulse on both runtimes.
import { analyzeBeats } from '../beats.ts';
import { deriveMusicSections } from '../intelligence/sections.ts';
import type { MusicSection } from '../intelligence/types.ts';
import type { SongMeasurements } from './types.ts';

const ENERGY_WINDOW_MS = 120;

export interface ListeningFallback {
  readonly bpm: number;
  readonly beatConfidence: number;
  readonly beatsMs: number[];
  readonly downbeatsMs: number[];
  readonly beatEnergy: number[];
  readonly sections: MusicSection[];
}

function toMs(values: readonly number[], durationMs: number): number[] {
  const points: number[] = [];
  for (const value of values) {
    const ms = Math.round(value * 1000);
    if (ms < 0 || ms >= durationMs) continue;
    if (points.length && ms <= points[points.length - 1]!) continue;
    points.push(ms);
  }
  return points;
}

/** Mean frame RMS around each beat; deriveMusicSections normalizes it itself. */
function energyPerBeat(
  frames: Pick<SongMeasurements, 'frames'>['frames'],
  beatsMs: readonly number[],
): number[] {
  return beatsMs.map((beatMs) => {
    let total = 0;
    let count = 0;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const frame of frames) {
      const distance = Math.abs(frame.timeMs - beatMs);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = frame.rms;
      }
      if (distance <= ENERGY_WINDOW_MS) {
        total += frame.rms;
        count += 1;
      }
    }
    return count ? total / count : nearest;
  });
}

export function fallbackListening(
  samples: Float32Array,
  sampleRate: number,
  measurements: Pick<SongMeasurements, 'frames' | 'durationMs'>,
): ListeningFallback {
  const beats = analyzeBeats(samples, sampleRate);
  const durationMs = Math.max(0, Math.round(measurements.durationMs));
  const beatsMs = toMs(beats.beats, durationMs);
  const downbeatsMs = toMs(beats.downbeats, durationMs);
  const beatEnergy = energyPerBeat(measurements.frames, beatsMs);
  return {
    bpm: beats.bpm,
    beatConfidence: beats.confidence,
    beatsMs,
    downbeatsMs,
    beatEnergy,
    sections: deriveMusicSections({ durationMs, beatsMs, beatEnergy }),
  };
}
