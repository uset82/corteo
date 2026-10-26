// Song map, lyrics half: the lines a song says and the sections that contain
// them. Pure functions only — the server cache, the pictures and the verifies
// all build the map from this module.
import { MUSIC_ANALYZER_FINGERPRINT } from '../intelligence/types.ts';
import type { MusicAnalysis, MusicSection, MusicTag } from '../intelligence/types.ts';

export const SONG_MAP_SCHEMA_VERSION = 1;
/** Separate from the analysis fingerprint so grouping changes drop only maps. */
export const SONG_MAP_ANALYZER_FINGERPRINT = `${MUSIC_ANALYZER_FINGERPRINT}+song-map-v1`;

export interface SongLyricWord {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface SongMapLine extends SongLyricWord {
  /** Index into `SongMap.sections`; the section that contains the line start. */
  readonly sectionIndex?: number;
  /** 1-based group shared by lines that repeat (chorus candidates). */
  readonly chorusGroup?: number;
}

export interface SongMapSection {
  readonly fromMs: number;
  readonly toMs: number;
  readonly role: MusicSection['role'];
  readonly energy: number;
  readonly mood?: MusicTag;
}

export interface SongMapChorusGroup {
  readonly index: number;
  /** Normalized text every line in the group reduces to. */
  readonly text: string;
  readonly lineIndexes: readonly number[];
}

export interface SongMap {
  readonly schemaVersion: number;
  readonly assetId: string;
  readonly sourceRevision: string;
  readonly createdAt: number;
  readonly analyzerFingerprint: string;
  readonly durationMs: number;
  readonly lyricsSource: 'transcript' | 'user' | 'none';
  readonly lines: readonly SongMapLine[];
  readonly chorusGroups: readonly SongMapChorusGroup[];
  readonly sections: readonly SongMapSection[];
}

export interface LineGroupingOptions {
  /** Silence that starts a new line; whisper keeps word gaps well under this. */
  readonly gapMs?: number;
  readonly maxLineMs?: number;
  readonly maxWords?: number;
}

const DEFAULT_GROUPING: Required<LineGroupingOptions> = {
  gapMs: 700,
  maxLineMs: 8_000,
  maxWords: 14,
};

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function cleanWord(word: SongLyricWord): SongLyricWord | null {
  const text = typeof word.text === 'string' ? word.text.replace(/\s+/g, ' ').trim() : '';
  if (!text) return null;
  if (!Number.isFinite(word.startMs) || !Number.isFinite(word.endMs)) return null;
  const startMs = Math.max(0, word.startMs);
  return { text, startMs, endMs: Math.max(startMs, word.endMs) };
}

/** Groups timed words into display lines: silence, sentence punctuation or length ends a line. */
export function groupWordsIntoLines(
  words: readonly SongLyricWord[],
  options: LineGroupingOptions = {},
): SongMapLine[] {
  const gapMs = positive(options.gapMs, DEFAULT_GROUPING.gapMs);
  const maxLineMs = positive(options.maxLineMs, DEFAULT_GROUPING.maxLineMs);
  const maxWords = Math.max(1, Math.round(positive(options.maxWords, DEFAULT_GROUPING.maxWords)));
  const sorted = words
    .map(cleanWord)
    .filter((word): word is SongLyricWord => word !== null)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  const lines: SongMapLine[] = [];
  let texts: string[] = [];
  let startMs = 0;
  let endMs = 0;
  const flush = () => {
    if (!texts.length) return;
    lines.push({ text: texts.join(' '), startMs, endMs });
    texts = [];
  };
  for (const word of sorted) {
    if (texts.length) {
      const tooLate = word.startMs - endMs >= gapMs;
      const tooLong = word.endMs - startMs > maxLineMs || texts.length >= maxWords;
      if (tooLate || tooLong) flush();
    }
    if (!texts.length) startMs = word.startMs;
    endMs = Math.max(endMs, word.endMs);
    texts.push(word.text);
    if (/[.!?…]$/.test(word.text)) flush();
  }
  flush();
  return lines;
}

/** Case, accents and punctuation must not hide a repeated line. */
export function normalizedLineText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lines that reduce to the same text become one chorus group; the rest stay unmarked. */
export function markChorusLines(lines: readonly SongMapLine[]): {
  lines: SongMapLine[];
  chorusGroups: SongMapChorusGroup[];
} {
  const byText = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const key = normalizedLineText(line.text);
    if (!key) return;
    byText.set(key, [...(byText.get(key) ?? []), index]);
  });
  const repeated = [...byText.entries()]
    .filter(([, indexes]) => indexes.length >= 2)
    .sort((left, right) => left[1][0]! - right[1][0]!);
  const groups: SongMapChorusGroup[] = repeated.map(([text, lineIndexes], index) => ({
    index: index + 1,
    text,
    lineIndexes,
  }));
  const groupOf = new Map<number, number>();
  for (const group of groups) {
    for (const lineIndex of group.lineIndexes) groupOf.set(lineIndex, group.index);
  }
  return {
    lines: lines.map((line, index) => {
      const group = groupOf.get(index);
      return group === undefined ? line : { ...line, chorusGroup: group };
    }),
    chorusGroups: groups,
  };
}

/** The song is contiguous, so a line outside every section clamps to the nearest one. */
export function attachLinesToSections(
  lines: readonly SongMapLine[],
  sections: readonly SongMapSection[],
): SongMapLine[] {
  if (!sections.length) return lines.map((line) => ({ ...line, sectionIndex: undefined }));
  return lines.map((line) => {
    const index = sections.findIndex((section) => line.startMs >= section.fromMs && line.startMs < section.toMs);
    if (index >= 0) return { ...line, sectionIndex: index };
    const sectionIndex = line.startMs < sections[0]!.fromMs ? 0 : sections.length - 1;
    return { ...line, sectionIndex };
  });
}

export interface BuildSongMapInput {
  readonly analysis: MusicAnalysis;
  readonly transcriptWords?: readonly SongLyricWord[];
  /** Timed lines the user typed; they replace the transcript lines entirely. */
  readonly userLines?: readonly SongLyricWord[];
  readonly createdAt?: number;
}

export function buildSongMap(input: BuildSongMapInput): SongMap {
  const { analysis } = input;
  const sections: SongMapSection[] = analysis.sections.map((section) => ({
    fromMs: section.fromMs,
    toMs: section.toMs,
    role: section.role,
    energy: section.energy,
    ...(section.mood ? { mood: section.mood } : {}),
  }));
  const userLines = input.userLines ?? [];
  const transcriptWords = input.transcriptWords ?? [];
  const lyricsSource: SongMap['lyricsSource'] = userLines.length
    ? 'user'
    : transcriptWords.length ? 'transcript' : 'none';
  const rawLines = lyricsSource === 'user'
    ? userLines.map(cleanWord).filter((word): word is SongLyricWord => word !== null)
      .sort((left, right) => left.startMs - right.startMs)
    : lyricsSource === 'transcript' ? groupWordsIntoLines(transcriptWords) : [];
  const marked = markChorusLines(attachLinesToSections(rawLines, sections));
  return {
    schemaVersion: SONG_MAP_SCHEMA_VERSION,
    assetId: analysis.assetId,
    sourceRevision: analysis.sourceRevision,
    createdAt: input.createdAt ?? Date.now(),
    analyzerFingerprint: SONG_MAP_ANALYZER_FINGERPRINT,
    durationMs: analysis.durationMs,
    lyricsSource,
    lines: marked.lines,
    chorusGroups: marked.chorusGroups,
    sections,
  };
}
