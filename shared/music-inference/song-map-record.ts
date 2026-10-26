// Stored song-map record shared by the server cache and any future reader.
// The map is derived from a music analysis plus a transcript, so its key adds
// the grouping fingerprint on top of the analysis one.
import {
  SONG_MAP_ANALYZER_FINGERPRINT,
  SONG_MAP_SCHEMA_VERSION,
} from '../../src/audio/listen/songMap.ts';
import type {
  SongMap,
  SongMapChorusGroup,
  SongMapLine,
  SongMapSection,
} from '../../src/audio/listen/songMap.ts';
import type { MusicTag } from '../../src/audio/intelligence/types.ts';

export interface StoredSongMap {
  key: string;
  analyzerFingerprint: string;
  map: SongMap;
}

const SECTION_ROLES: Record<SongMapSection['role'], true> = {
  'intro-like': true,
  build: true,
  peak: true,
  break: true,
  steady: true,
  'outro-like': true,
};
const LYRICS_SOURCES: Record<SongMap['lyricsSource'], true> = {
  transcript: true,
  user: true,
  none: true,
};
const MAX_LINES = 10_000;
const MAX_TEXT_LENGTH = 500;

const inRange = (value: unknown, low: number, high: number): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high
);

export function songMapCacheKey(assetId: string, sourceRevision: string): string {
  return JSON.stringify([assetId, sourceRevision, SONG_MAP_ANALYZER_FINGERPRINT]);
}

export async function songMapRemoteKey(cacheKeyValue: string): Promise<string> {
  return `song-map:${await sha256Hex(cacheKeyValue)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validMood(value: unknown): value is MusicTag {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const tag = value as Partial<Record<keyof MusicTag, unknown>>;
  return tag.kind === 'mood'
    && typeof tag.label === 'string'
    && tag.label.length > 0
    && tag.label.length <= 120
    && inRange(tag.score, 0, 1);
}

function validText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_TEXT_LENGTH
    && value.trim() === value;
}

function validSections(value: unknown, durationMs: number): value is SongMapSection[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  let previousEnd = 0;
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const section = entry as Partial<Record<keyof SongMapSection, unknown>>;
    if (!inRange(section.fromMs, 0, durationMs) || section.fromMs !== previousEnd) return false;
    if (!inRange(section.toMs, 0, durationMs) || section.toMs <= section.fromMs) return false;
    if (typeof section.role !== 'string' || !Object.hasOwn(SECTION_ROLES, section.role)) return false;
    if (!inRange(section.energy, 0, 1)) return false;
    if (section.mood !== undefined && !validMood(section.mood)) return false;
    previousEnd = section.toMs;
  }
  return value.length === 0 ? durationMs === 0 : previousEnd === Math.round(durationMs);
}

function validLines(value: unknown, durationMs: number, sectionCount: number): value is SongMapLine[] {
  if (!Array.isArray(value) || value.length > MAX_LINES) return false;
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const line = entry as Partial<Record<keyof SongMapLine, unknown>>;
    if (!validText(line.text)) return false;
    if (!inRange(line.startMs, 0, durationMs) || !inRange(line.endMs, 0, durationMs)) return false;
    if (line.endMs < line.startMs) return false;
    if (line.sectionIndex !== undefined) {
      if (!Number.isInteger(line.sectionIndex) || !inRange(line.sectionIndex, 0, sectionCount - 1)) return false;
    }
    if (line.chorusGroup !== undefined) {
      if (!Number.isInteger(line.chorusGroup) || (line.chorusGroup as number) < 1) return false;
    }
  }
  return true;
}

function validGroups(
  value: unknown,
  lines: readonly SongMapLine[],
): value is SongMapChorusGroup[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  const seen = new Set<number>();
  const grouped = new Map<number, number>();
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const group = entry as Partial<Record<keyof SongMapChorusGroup, unknown>>;
    if (!Number.isInteger(group.index) || (group.index as number) < 1 || seen.has(group.index as number)) return false;
    seen.add(group.index as number);
    if (!validText(group.text)) return false;
    if (!Array.isArray(group.lineIndexes) || group.lineIndexes.length < 2) return false;
    let previous = -1;
    for (const lineIndex of group.lineIndexes) {
      if (!Number.isInteger(lineIndex) || lineIndex <= previous || lineIndex >= lines.length) return false;
      if (lines[lineIndex]!.chorusGroup !== group.index) return false;
      previous = lineIndex;
    }
    grouped.set(group.index as number, group.lineIndexes.length);
  }
  let marked = 0;
  for (const line of lines) if (line.chorusGroup !== undefined) marked += 1;
  let listed = 0;
  for (const count of grouped.values()) listed += count;
  return marked === listed;
}

export function isSongMap(value: unknown, assetId?: string, sourceRevision?: string): value is SongMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const map = value as Partial<Record<keyof SongMap, unknown>>;
  if (map.schemaVersion !== SONG_MAP_SCHEMA_VERSION) return false;
  if (typeof map.assetId !== 'string' || map.assetId.length === 0 || map.assetId.length > 512) return false;
  if (assetId !== undefined && map.assetId !== assetId) return false;
  if (typeof map.sourceRevision !== 'string' || map.sourceRevision.length === 0 || map.sourceRevision.length > 512) return false;
  if (sourceRevision !== undefined && map.sourceRevision !== sourceRevision) return false;
  if (map.analyzerFingerprint !== SONG_MAP_ANALYZER_FINGERPRINT) return false;
  if (!inRange(map.createdAt, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!inRange(map.durationMs, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (typeof map.lyricsSource !== 'string' || !Object.hasOwn(LYRICS_SOURCES, map.lyricsSource)) return false;
  if (!validSections(map.sections, map.durationMs)) return false;
  if (!validLines(map.lines, map.durationMs, map.sections.length)) return false;
  return validGroups(map.chorusGroups, map.lines);
}

export function validStoredSongMap(
  value: unknown,
  key: string,
  assetId: string,
  sourceRevision: string,
): value is StoredSongMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const stored = value as Partial<Record<keyof StoredSongMap, unknown>>;
  return stored.key === key
    && stored.analyzerFingerprint === SONG_MAP_ANALYZER_FINGERPRINT
    && isSongMap(stored.map, assetId, sourceRevision);
}

export function storedSongMap(map: SongMap): StoredSongMap {
  return {
    key: songMapCacheKey(map.assetId, map.sourceRevision),
    analyzerFingerprint: SONG_MAP_ANALYZER_FINGERPRINT,
    map,
  };
}
