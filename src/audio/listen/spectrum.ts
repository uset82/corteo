import { fftInPlace } from '../beats.ts';
import type { EnergyFrame } from './types.ts';

export const FRAME_MS = 50;

const BASS_HZ = [20, 250] as const;
const MID_HZ = [250, 2000] as const;
const BRIGHT_HZ = [2000, 8000] as const;
const CHROMA_LOW_HZ = 55;
const CHROMA_HIGH_HZ = 2000;

export interface SpectrumAnalysis {
  readonly frames: EnergyFrame[];
  /** Power per pitch class, index 0 = A (440 Hz folds to 0). */
  readonly chroma: number[];
}

function nextPowerOfTwo(value: number): number {
  let size = 256;
  while (size < value) size <<= 1;
  return size;
}

function bandBins(range: readonly [number, number], fftSize: number, sampleRate: number): [number, number] {
  const bins = fftSize / 2;
  const from = Math.max(0, Math.floor((range[0] * fftSize) / sampleRate));
  const to = Math.min(bins - 1, Math.ceil((range[1] * fftSize) / sampleRate));
  return [from, to];
}

export function spectrumFrames(samples: Float32Array, sampleRate: number): SpectrumAnalysis {
  const frameSamples = Math.max(256, Math.round((sampleRate * FRAME_MS) / 1000));
  const fftSize = nextPowerOfTwo(frameSamples);
  const bins = fftSize / 2;
  const hann = new Float64Array(frameSamples);
  for (let i = 0; i < frameSamples; i += 1) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, frameSamples - 1)));
  }
  const bass = bandBins(BASS_HZ, fftSize, sampleRate);
  const mid = bandBins(MID_HZ, fftSize, sampleRate);
  const bright = bandBins(BRIGHT_HZ, fftSize, sampleRate);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const power = new Float64Array(bins);
  const chroma = new Array<number>(12).fill(0);
  const frames: EnergyFrame[] = [];
  const count = Math.floor(samples.length / frameSamples);
  for (let index = 0; index < count; index += 1) {
    const at = index * frameSamples;
    let energy = 0;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < frameSamples; i += 1) {
      const value = samples[at + i]!;
      energy += value * value;
      re[i] = value * hann[i]!;
    }
    fftInPlace(re, im);
    let powerSum = 0;
    let weighted = 0;
    for (let k = 0; k < bins; k += 1) {
      const value = re[k]! * re[k]! + im[k]! * im[k]!;
      power[k] = value;
      powerSum += value;
      weighted += value * ((k * sampleRate) / fftSize);
      const frequency = (k * sampleRate) / fftSize;
      if (frequency >= CHROMA_LOW_HZ && frequency <= CHROMA_HIGH_HZ) {
        const semitones = Math.round(12 * Math.log2(frequency / 440));
        chroma[((semitones % 12) + 12) % 12]! += value;
      }
    }
    const mean = (range: readonly [number, number]): number => {
      let sum = 0;
      for (let k = range[0]; k <= range[1]; k += 1) sum += power[k]!;
      return Math.sqrt(sum / Math.max(1, range[1] - range[0] + 1));
    };
    frames.push({
      timeMs: index * FRAME_MS,
      rms: Math.sqrt(energy / frameSamples),
      bass: mean(bass),
      mid: mean(mid),
      brightness: mean(bright),
      centroid: powerSum > 0 ? weighted / powerSum : 0,
    });
  }
  return { frames, chroma };
}
