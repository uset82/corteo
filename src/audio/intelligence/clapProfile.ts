import prototypeJson from './clap-prototypes.json';
import { normalizedMeanVector } from '../../../shared/music-inference/clapWindows';
import {
  CLAP_EMBEDDING_DIMENSION,
} from './clapTypes';
import type { MusicSection, MusicTag, MusicTagKind } from './types';

const TAG_KINDS = ['genre', 'mood', 'instrument', 'usage'] as const satisfies readonly MusicTagKind[];
const SCORE_DECIMALS = 4;
const UNIT_TOLERANCE = 1e-3;

/**
 * Display names for the prototype labels. The record keeps the canonical
 * English label (one vocabulary for every client); Spanish is applied where a
 * person reads it, so a stored analysis never depends on the UI language.
 */
const SPANISH_LABELS: Readonly<Record<string, string>> = {
  energetic: 'enérgica',
  calm: 'serena',
  tense: 'tensa',
  romantic: 'romántica',
  dreamy: 'soñadora',
  playful: 'juguetona',
  melancholic: 'melancólica',
  epic: 'épica',
  nostalgic: 'nostálgica',
  hopeful: 'esperanzadora',
  festive: 'festiva',
  sensual: 'sensual',
  spiritual: 'espiritual',
  electronic: 'electrónica',
  rock: 'rock',
  'hip-hop': 'hip-hop',
  pop: 'pop',
  orchestral: 'orquestal',
  acoustic: 'acústica',
  jazz: 'jazz',
  ambient: 'ambiental',
  cumbia: 'cumbia',
  salsa: 'salsa',
  bolero: 'bolero',
  reggaeton: 'reguetón',
  huayno: 'huayno',
  flamenco: 'flamenco',
  'latin rock': 'rock latino',
  vocal: 'voz',
  instrumental: 'instrumental',
  guitar: 'guitarra',
  piano: 'piano',
  strings: 'cuerdas',
  drums: 'batería',
  synth: 'sintetizador',
  brass: 'metales',
  vlog: 'videoblog',
  travel: 'viajes',
  trailer: 'tráiler',
  corporate: 'corporativo',
  wedding: 'boda',
  sports: 'deportes',
  suspense: 'suspenso',
  background: 'fondo',
  unknown: 'desconocido',
};

export function displayMusicLabel(label: string): string {
  return SPANISH_LABELS[label] ?? label;
}

export const DEFAULT_CLAP_TAG_THRESHOLDS: Readonly<Record<MusicTagKind, number>> = {
  genre: 0.2,
  mood: 0.2,
  instrument: 0.2,
  usage: 0.2,
};

export interface ClapPrototypeLabel {
  readonly kind: MusicTagKind;
  readonly label: string;
  readonly vector: readonly number[];
}

export interface ClapPrototypeProfile {
  readonly labels: readonly ClapPrototypeLabel[];
}

export interface ClapTagOptions {
  readonly thresholds?: Partial<Record<MusicTagKind, number>>;
}

interface ScoredPrototype {
  readonly label: string;
  readonly score: number;
}

const checkedInProfile = parseClapPrototypeProfile(prototypeJson);

export function tagsFromClapEmbedding(
  embedding: readonly number[],
  options: ClapTagOptions = {},
): MusicTag[] {
  return classifyClapEmbedding(embedding, checkedInProfile, options);
}

export function classifyClapEmbedding(
  embedding: readonly number[],
  profile: ClapPrototypeProfile,
  options: ClapTagOptions = {},
): MusicTag[] {
  const normalizedEmbedding = normalizeEmbedding(embedding, 'CLAP embedding');
  const parsedProfile = parseClapPrototypeProfile(profile);
  const thresholds = validatedThresholds(options.thresholds);
  return TAG_KINDS.map((kind) => {
    const candidates = parsedProfile.labels
      .filter((prototype) => prototype.kind === kind)
      .map((prototype) => ({
        label: prototype.label,
        score: dotProduct(normalizedEmbedding, prototype.vector),
      }))
      .sort(compareScores);
    const best = candidates[0]!;
    return {
      kind,
      label: best.score >= thresholds[kind] ? best.label : 'unknown',
      score: roundScore(best.score),
    };
  });
}

export interface SectionWindow {
  readonly startMs: number;
  readonly vector: readonly number[];
}

// The CLAP processor looks at 10 s of audio per embedding; a section shorter
// than that still gets a mood from the windows it overlaps.
const DEFAULT_SECTION_WINDOW_MS = 10_000;
const DEFAULT_SECTION_MOOD_THRESHOLD = 0.15;

/**
 * Scores each section against the mood prototypes using the embeddings of the
 * windows it covers, weighted by overlap. A section scores its own audio
 * instead of inheriting the whole song's label.
 */
export function withSectionMoods(
  sections: readonly MusicSection[],
  windows: readonly SectionWindow[],
  options: { windowMs?: number; threshold?: number; profile?: ClapPrototypeProfile } = {},
): MusicSection[] {
  if (!windows.length) return [...sections];
  const windowMs = options.windowMs ?? DEFAULT_SECTION_WINDOW_MS;
  const threshold = options.threshold ?? DEFAULT_SECTION_MOOD_THRESHOLD;
  const profile = parseClapPrototypeProfile(options.profile ?? checkedInProfile);
  const normalized = windows.map((window) => ({
    startMs: window.startMs,
    vector: normalizeEmbedding(window.vector, 'CLAP window embedding'),
  }));
  return sections.map((section) => {
    const overlap = normalized
      .map((window) => ({
        vector: window.vector,
        weight: Math.min(section.toMs, window.startMs + windowMs) - Math.max(section.fromMs, window.startMs),
      }))
      .filter((window) => window.weight > 0);
    if (!overlap.length) return section;
    const sum = new Float64Array(CLAP_EMBEDDING_DIMENSION);
    let total = 0;
    for (const window of overlap) {
      total += window.weight;
      for (let dimension = 0; dimension < sum.length; dimension += 1) {
        sum[dimension] += window.vector[dimension]! * window.weight;
      }
    }
    const mean = normalizedMeanVector(sum, total);
    const mood = classifyClapEmbedding(mean, profile, {
      thresholds: { mood: threshold, genre: 1, instrument: 1, usage: 1 },
    }).find((tag) => tag.kind === 'mood');
    return mood && mood.label !== 'unknown' ? { ...section, mood } : section;
  });
}

export function parseClapPrototypeProfile(value: unknown): ClapPrototypeProfile {
  if (!value || typeof value !== 'object' || !('labels' in value) || !Array.isArray(value.labels)) {
    throw new Error('CLAP prototype profile must contain a labels array');
  }
  const labels = value.labels.map((entry, index) => parsePrototype(entry, index));
  if (labels.length === 0) throw new Error('CLAP prototype profile has no labels');
  const seen = new Set<string>();
  for (const label of labels) {
    const key = `${label.kind}:${label.label}`;
    if (seen.has(key)) throw new Error(`CLAP prototype profile contains duplicate label ${key}`);
    seen.add(key);
  }
  for (const kind of TAG_KINDS) {
    if (!labels.some((label) => label.kind === kind)) {
      throw new Error(`CLAP prototype profile has no ${kind} labels`);
    }
  }
  return { labels };
}

function isMusicTagKind(value: unknown): value is MusicTagKind {
  return typeof value === 'string' && TAG_KINDS.some((kind) => kind === value);
}

function parsePrototype(value: unknown, index: number): ClapPrototypeLabel {
  if (!value || typeof value !== 'object') {
    throw new Error(`CLAP prototype label ${index} is invalid`);
  }
  const entry = value as Record<string, unknown>;
  if (!isMusicTagKind(entry.kind)) {
    throw new Error(`CLAP prototype label ${index} has an invalid kind`);
  }
  if (typeof entry.label !== 'string' || entry.label.trim() !== entry.label || entry.label.length === 0) {
    throw new Error(`CLAP prototype label ${index} has an invalid label`);
  }
  if (!Array.isArray(entry.vector)) {
    throw new Error(`CLAP prototype ${entry.label} has no vector`);
  }
  const vector = normalizeEmbedding(entry.vector, `CLAP prototype ${entry.label}`, false);
  return { kind: entry.kind, label: entry.label, vector };
}

function normalizeEmbedding(
  values: readonly unknown[],
  name: string,
  normalize = true,
): number[] {
  if (values.length !== CLAP_EMBEDDING_DIMENSION) {
    throw new Error(`${name} has ${values.length} dimensions; expected ${CLAP_EMBEDDING_DIMENSION}`);
  }
  let squaredLength = 0;
  const vector = values.map((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${name} contains a non-finite value`);
    }
    squaredLength += value * value;
    return value;
  });
  const length = Math.sqrt(squaredLength);
  if (!Number.isFinite(length) || length <= Number.EPSILON) throw new Error(`${name} has zero length`);
  if (!normalize && Math.abs(length - 1) > UNIT_TOLERANCE) {
    throw new Error(`${name} is not unit-normalized`);
  }
  return normalize ? vector.map((value) => value / length) : vector;
}

function validatedThresholds(
  overrides: Partial<Record<MusicTagKind, number>> | undefined,
): Readonly<Record<MusicTagKind, number>> {
  const thresholds = { ...DEFAULT_CLAP_TAG_THRESHOLDS, ...overrides };
  for (const kind of TAG_KINDS) {
    const threshold = thresholds[kind];
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
      throw new Error(`CLAP ${kind} threshold must be between -1 and 1`);
    }
  }
  return thresholds;
}

function dotProduct(left: readonly number[], right: readonly number[]): number {
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result += left[index]! * right[index]!;
  return result;
}

function compareScores(left: ScoredPrototype, right: ScoredPrototype): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.label === right.label) return 0;
  return left.label < right.label ? -1 : 1;
}

function roundScore(score: number): number {
  const scale = 10 ** SCORE_DECIMALS;
  const rounded = Math.round((score + Number.EPSILON) * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
}
