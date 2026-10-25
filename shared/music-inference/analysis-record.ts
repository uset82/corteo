import {
  MUSIC_ANALYSIS_SCHEMA_VERSION,
  MUSIC_ANALYZER_FINGERPRINT,
  MUSIC_MODEL_PACK_FINGERPRINTS,
} from '../../src/audio/intelligence/types.ts';
import type {
  MusicAnalysis,
  MusicSection,
  MusicTag,
} from '../../src/audio/intelligence/types.ts';

const TAG_KINDS: Record<MusicTag['kind'], true> = {
  genre: true,
  mood: true,
  instrument: true,
  usage: true,
};
const SECTION_ROLES: Record<MusicSection['role'], true> = {
  'intro-like': true,
  build: true,
  peak: true,
  break: true,
  steady: true,
  'outro-like': true,
};

export interface StoredMusicAnalysis {
  key: string;
  analyzerFingerprint: string;
  analysis: MusicAnalysis;
}

const inRange = (value: unknown, low: number, high: number): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high
);

/** The browser IndexedDB cache and the server store share this exact key. */
export function musicAnalysisCacheKey(assetId: string, sourceRevision: string): string {
  return JSON.stringify([assetId, sourceRevision, MUSIC_ANALYZER_FINGERPRINT]);
}

/** URL-safe server key: the cache key contains JSON punctuation, so hash it. */
export async function musicAnalysisRemoteKey(cacheKeyValue: string): Promise<string> {
  return `music-analysis:${await sha256Hex(cacheKeyValue)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validTimes(value: unknown, durationMs: number): value is number[] {
  if (!Array.isArray(value) || value.length > 1_000_000) return false;
  let previous = -1;
  for (const time of value) {
    if (!inRange(time, 0, durationMs) || time <= previous) return false;
    previous = time;
  }
  return true;
}

function validEmbedding(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 512) return false;
  let squaredNorm = 0;
  for (const component of value) {
    if (!inRange(component, -1, 1)) return false;
    squaredNorm += component * component;
  }
  const norm = Math.sqrt(squaredNorm);
  return norm >= 0.98 && norm <= 1.02;
}

function validTag(value: unknown): value is MusicTag {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const tag = value as Partial<Record<keyof MusicTag, unknown>>;
  return typeof tag.kind === 'string'
    && Object.hasOwn(TAG_KINDS, tag.kind)
    && typeof tag.label === 'string'
    && tag.label.length > 0
    && tag.label.trim() === tag.label
    && tag.label.length <= 120
    && inRange(tag.score, 0, 1);
}

function validTags(value: unknown): value is MusicTag[] {
  if (!Array.isArray(value) || value.length > 64) return false;
  for (const tag of value) if (!validTag(tag)) return false;
  return true;
}

function validSection(value: unknown, durationMs: number): value is MusicSection {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const section = value as Partial<Record<keyof MusicSection, unknown>>;
  return inRange(section.fromMs, 0, durationMs)
    && inRange(section.toMs, 0, durationMs)
    && section.toMs > section.fromMs
    && typeof section.role === 'string'
    && Object.hasOwn(SECTION_ROLES, section.role)
    && inRange(section.energy, 0, 1)
    && inRange(section.boundaryConfidence, 0, 1);
}

function validSections(value: unknown, durationMs: number): value is MusicSection[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  let previousEnd = 0;
  for (const section of value) {
    if (!validSection(section, durationMs) || section.fromMs !== previousEnd) return false;
    previousEnd = section.toMs;
  }
  return value.length === 0 ? durationMs === 0 : previousEnd === Math.round(durationMs);
}

function validIdentity(
  value: Partial<Record<keyof MusicAnalysis, unknown>>,
  assetId?: string,
  sourceRevision?: string,
): boolean {
  return value.schemaVersion === MUSIC_ANALYSIS_SCHEMA_VERSION
    && typeof value.assetId === 'string'
    && value.assetId.length > 0
    && value.assetId.length <= 512
    && (!assetId || value.assetId === assetId)
    && typeof value.sourceRevision === 'string'
    && value.sourceRevision.length > 0
    && value.sourceRevision.length <= 512
    && (!sourceRevision || value.sourceRevision === sourceRevision)
    && inRange(value.createdAt, 0, Number.MAX_SAFE_INTEGER);
}

function validModels(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const models = value as Partial<MusicAnalysis['modelPacks']>;
  return models.rhythm === MUSIC_MODEL_PACK_FINGERPRINTS.rhythm
    && models.semantic === MUSIC_MODEL_PACK_FINGERPRINTS.semantic;
}

export function isMusicAnalysis(value: unknown, assetId?: string, sourceRevision?: string): value is MusicAnalysis {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const analysis = value as Partial<Record<keyof MusicAnalysis, unknown>>;
  if (!validIdentity(analysis, assetId, sourceRevision)) return false;
  if (!inRange(analysis.durationMs, 0, Number.MAX_SAFE_INTEGER) || !validModels(analysis.modelPacks)) return false;
  if (!inRange(analysis.bpm, 0, 400) || !inRange(analysis.meter, 1, 16) || !Number.isInteger(analysis.meter)) return false;
  return inRange(analysis.beatConfidence, 0, 1)
    && validTimes(analysis.beatsMs, analysis.durationMs)
    && validTimes(analysis.downbeatsMs, analysis.durationMs)
    && validSections(analysis.sections, analysis.durationMs)
    && validTags(analysis.tags)
    && validEmbedding(analysis.embedding);
}

export function validStoredMusicAnalysis(
  value: unknown,
  key: string,
  assetId: string,
  sourceRevision: string,
): value is StoredMusicAnalysis {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const stored = value as Partial<Record<keyof StoredMusicAnalysis, unknown>>;
  return stored.key === key
    && stored.analyzerFingerprint === MUSIC_ANALYZER_FINGERPRINT
    && isMusicAnalysis(stored.analysis, assetId, sourceRevision);
}

export function storedMusicAnalysis(analysis: MusicAnalysis): StoredMusicAnalysis {
  return {
    key: musicAnalysisCacheKey(analysis.assetId, analysis.sourceRevision),
    analyzerFingerprint: MUSIC_ANALYZER_FINGERPRINT,
    analysis,
  };
}

function referenceDigest(analysis: MusicAnalysis): string {
  const content = JSON.stringify([
    analysis.createdAt,
    analysis.durationMs,
    analysis.bpm,
    analysis.meter,
    analysis.beatConfidence,
    analysis.beatsMs,
    analysis.downbeatsMs,
    analysis.sections,
    analysis.tags,
  ]);
  let hash = 14_695_981_039_346_656_037n;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= BigInt(content.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function musicAnalysisRef(analysis: MusicAnalysis): string {
  if (!isMusicAnalysis(analysis)) throw new Error('Cannot reference invalid music analysis');
  const identity = [
    encodeURIComponent(analysis.assetId),
    encodeURIComponent(analysis.sourceRevision),
    encodeURIComponent(MUSIC_ANALYZER_FINGERPRINT),
    referenceDigest(analysis),
  ];
  return `music-analysis:v2:${identity.join(':')}`;
}
