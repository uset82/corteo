import { deriveMusicSections } from '../../src/audio/intelligence/sections.ts';
import { withSectionMoods, type SectionWindow } from '../../src/audio/intelligence/clapProfile.ts';
import {
  MUSIC_ANALYSIS_SCHEMA_VERSION,
  MUSIC_MODEL_PACK_FINGERPRINTS,
} from '../../src/audio/intelligence/types.ts';
import type { BeatThisAnalysis, MusicAnalysis, MusicTag } from '../../src/audio/intelligence/types.ts';

const MUSIC_TAG_KINDS: Record<MusicTag['kind'], true> = {
  genre: true,
  mood: true,
  instrument: true,
  usage: true,
};

export interface MusicAnalysisIdentity {
  readonly assetId: string;
  readonly sourceRevision: string;
}

export interface ComposeMusicAnalysisInput extends MusicAnalysisIdentity {
  readonly durationMs: number;
  readonly rhythm: BeatThisAnalysis;
  readonly tags: readonly MusicTag[];
  readonly embedding: readonly number[];
  /** Per-window CLAP embeddings; each section is scored against the ones it covers. */
  readonly sectionWindows?: readonly SectionWindow[];
  readonly createdAt?: number;
}

export interface BeatSeries {
  beatsMs: number[];
  beatEnergy: number[];
}

/** The two clients must accept exactly the same embedding before either caches it. */
export function normalizeMusicEmbedding(values: readonly number[]): number[] {
  if (values.length !== 512 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('CLAP returned an invalid 512-dimensional embedding');
  }
  let squaredNorm = 0;
  for (const value of values) squaredNorm += value * value;
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm <= 1e-12) throw new Error('CLAP returned a zero embedding');
  return values.map((value) => value / norm);
}

export function normalizedMusicTags(tags: readonly MusicTag[]): MusicTag[] {
  return tags
    .filter((tag) => MUSIC_TAG_KINDS[tag.kind] && typeof tag.label === 'string' && tag.label.trim().length > 0 && Number.isFinite(tag.score))
    .slice(0, 64)
    .map((tag) => ({ ...tag, label: tag.label.trim().slice(0, 120), score: Math.max(0, Math.min(1, tag.score)) }));
}

export function beatSeries(beatsMs: readonly number[], energy: readonly number[], durationMs: number): BeatSeries {
  const times: number[] = [];
  const levels: number[] = [];
  for (let index = 0; index < beatsMs.length; index += 1) {
    const beat = beatsMs[index];
    if (typeof beat !== 'number' || !Number.isFinite(beat) || beat < 0 || beat > durationMs) continue;
    if (times.length && beat <= times[times.length - 1]!) continue;
    const level = energy[index];
    times.push(beat);
    levels.push(typeof level === 'number' && Number.isFinite(level) ? Math.max(0, level) : 0);
  }
  return { beatsMs: times, beatEnergy: levels };
}

function sortedTimes(values: readonly number[], durationMs: number): number[] {
  const result: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0 || value > durationMs) continue;
    if (!result.length || value > result[result.length - 1]!) result.push(value);
  }
  return result;
}

export function composeMusicAnalysis(input: ComposeMusicAnalysisInput): MusicAnalysis {
  const series = beatSeries(input.rhythm.beatsMs, input.rhythm.beatEnergy, input.durationMs);
  const sections = deriveMusicSections({ durationMs: input.durationMs, beatsMs: series.beatsMs, beatEnergy: series.beatEnergy });
  return {
    schemaVersion: MUSIC_ANALYSIS_SCHEMA_VERSION,
    assetId: input.assetId,
    sourceRevision: input.sourceRevision,
    createdAt: input.createdAt ?? Date.now(),
    durationMs: input.durationMs,
    modelPacks: MUSIC_MODEL_PACK_FINGERPRINTS,
    bpm: Number.isFinite(input.rhythm.bpm) ? Math.max(0, Math.min(400, input.rhythm.bpm)) : 0,
    meter: Number.isFinite(input.rhythm.meter) ? Math.max(1, Math.min(16, Math.round(input.rhythm.meter))) : 4,
    beatConfidence: Number.isFinite(input.rhythm.confidence) ? Math.max(0, Math.min(1, input.rhythm.confidence)) : 0,
    beatsMs: series.beatsMs,
    downbeatsMs: sortedTimes(input.rhythm.downbeatsMs, input.durationMs),
    sections: input.sectionWindows ? withSectionMoods(sections, input.sectionWindows) : sections,
    tags: normalizedMusicTags(input.tags),
    embedding: [...input.embedding],
  };
}
