import { normalizedLineText } from '../audio/listen/songMap.ts';
import type { SongLyricWord } from '../audio/listen/songMap.ts';
import type { ItemKeyframes, Keyframe } from './clipTypes.ts';

export interface SongFilmInput {
  fps: number;
  width: number;
  height: number;
  fromFrame: number;
  toFrame: number;
  downbeatFrames: readonly number[];
  sections: readonly { fromMs: number; toMs: number; role: string; energy: number }[];
  energy: { stepMs: number; values: readonly number[] };
  lyrics: readonly (SongLyricWord & { chorusGroup?: number })[];
  stills: readonly string[];
  palette?: readonly string[];
}

export interface FilmVisual {
  kind: 'image' | 'solid';
  assetId?: string;
  color?: string;
  fromFrame: number;
  durationInFrames: number;
  sectionIndex: number;
  keyframes: ItemKeyframes;
}

export interface FilmText {
  text: string;
  fromFrame: number;
  durationInFrames: number;
  chorus: boolean;
  position: 'center';
  align: 'center';
  color: '#ffffff';
  fontSize: number;
  fontWeight: 400 | 700;
  keyframes: ItemKeyframes;
}

const DEFAULT_PALETTE = ['#1b1a30', '#302038', '#1c3035', '#342125', '#202e25', '#2a263d', '#332b1d', '#192b3b'];
const round2 = (n: number) => Math.round(n * 100) / 100;

function energyAt(input: SongFilmInput, frame: number): number {
  const values = input.energy.values;
  if (!values.length || input.energy.stepMs <= 0) return 0;
  const index = Math.max(0, frame * 1000 / input.fps / input.energy.stepMs);
  const low = Math.min(values.length - 1, Math.floor(index));
  const high = Math.min(values.length - 1, low + 1);
  const fraction = Math.min(1, index - low);
  const value = (values[low] ?? 0) * (1 - fraction) + (values[high] ?? 0) * fraction;
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function curve(input: SongFilmInput, fromFrame: number, duration: number, interval: number,
  map: (energy: number) => number): Keyframe[] {
  const step = Math.max(1, Math.round(interval), Math.ceil(Math.max(0, duration - 1) / 63));
  const result: Keyframe[] = [];
  for (let frame = 0; frame < duration; frame += step) {
    result.push({ frame, value: round2(map(energyAt(input, fromFrame + frame))) });
  }
  const last = duration - 1;
  if (last > 0 && result.length < 64 && result[result.length - 1]?.frame !== last) {
    result.push({ frame: last, value: round2(map(energyAt(input, fromFrame + last))) });
  }
  return result;
}

function fades(duration: number): Keyframe[] {
  if (duration <= 1) return [{ frame: 0, value: 0 }];
  const last = duration - 1;
  const fade = Math.min(6, Math.floor(last / 2));
  const points = [{ frame: 0, value: 0 }, { frame: fade, value: 1 },
    { frame: last - fade, value: 1 }, { frame: last, value: 0 }];
  return points.filter((point, index) => index === 0 || point.frame > points[index - 1]!.frame);
}

export function planSongFilm(input: SongFilmInput): {
  cutGrid: 'fixed-2s' | 'downbeat';
  cutFrames: number[];
  visuals: FilmVisual[];
  texts: FilmText[];
} {
  const { fps, fromFrame, toFrame } = input;
  if (fps <= 0 || toFrame <= fromFrame) return { cutGrid: 'fixed-2s', cutFrames: [], visuals: [], texts: [] };
  const beats = [...new Set(input.downbeatFrames.filter(Number.isFinite).map(Math.round))]
    .sort((a, b) => a - b);
  const inRange = beats.filter((frame) => frame >= fromFrame && frame < toFrame);
  const boundaries = new Set<number>([fromFrame, toFrame]);
  const cutGrid = inRange.length ? 'downbeat' : 'fixed-2s';
  if (cutGrid === 'fixed-2s') {
    for (let frame = fromFrame + Math.max(1, Math.round(2 * fps)); frame < toFrame; frame += Math.max(1, Math.round(2 * fps))) boundaries.add(frame);
  } else {
    for (let index = 4; index < inRange.length; index += 4) boundaries.add(inRange[index]!);
    const gaps = beats.slice(1).map((beat, index) => beat - beats[index]!).filter((gap) => gap > 0).sort((a, b) => a - b);
    const bar = gaps[Math.floor(gaps.length / 2)] ?? Math.round(2 * fps);
    for (const section of input.sections) {
      const target = Math.round(section.fromMs * fps / 1000);
      const nearest = inRange.reduce((best, beat) => Math.abs(beat - target) < Math.abs(best - target) ? beat : best, inRange[0]!);
      if (Math.abs(nearest - target) <= bar && nearest > fromFrame) boundaries.add(nearest);
    }
  }
  const cutFrames = [...boundaries].sort((a, b) => a - b);
  const palette = input.palette?.length ? input.palette : DEFAULT_PALETTE;
  const visuals = cutFrames.slice(0, -1).map((start, index): FilmVisual => {
    const end = cutFrames[index + 1]!;
    const ms = start * 1000 / fps;
    let sectionIndex = input.sections.findIndex((section) => section.fromMs <= ms && ms < section.toMs);
    if (sectionIndex < 0) sectionIndex = 0;
    const durationInFrames = end - start;
    const kind = input.stills.length ? 'image' : 'solid';
    const prop = kind === 'image' ? 'saturate' : 'brightness';
    const values = curve(input, start, durationInFrames, fps,
      (e) => kind === 'image' ? 0.8 + 0.6 * e : 0.7 + 0.5 * e);
    return { kind, ...(kind === 'image' ? { assetId: input.stills[index % input.stills.length]! }
      : { color: palette[sectionIndex % palette.length]! }), fromFrame: start, durationInFrames,
    sectionIndex, keyframes: { [prop]: values } };
  });
  const frequencies = new Map<string, number>();
  for (const line of input.lyrics) {
    const key = normalizedLineText(line.text);
    if (key) frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }
  const texts = input.lyrics.flatMap((line): FilmText[] => {
    const originalStart = Math.round(line.startMs * fps / 1000);
    const originalDuration = Math.max(Math.round(fps / 2), Math.round((line.endMs - line.startMs) * fps / 1000));
    const start = Math.max(fromFrame, originalStart);
    const end = Math.min(toFrame, originalStart + originalDuration);
    if (end <= start || !line.text.trim()) return [];
    const chorus = Boolean(line.chorusGroup) || (frequencies.get(normalizedLineText(line.text)) ?? 0) > 1;
    const durationInFrames = end - start;
    return [{ text: line.text, fromFrame: start, durationInFrames, chorus, position: 'center', align: 'center',
      color: '#ffffff', fontSize: Math.round(input.height * 0.045), fontWeight: chorus ? 700 : 400,
      keyframes: { scale: curve(input, start, durationInFrames, fps / 2, (e) => 1 + 0.12 * e),
        opacity: fades(durationInFrames) } }];
  });
  return { cutGrid, cutFrames, visuals, texts };
}
