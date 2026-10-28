import type { TranscriptWord } from '../transcript/types';

// WebVTT → timed words. Plain cues become one word-bearing cue per block (the
// same contract as SRT); cues with inline `<00:00:02.500>` timestamps split
// into per-word timings so karaoke pacing survives the import.
// Styling tags (`<v>`, `<b>`, `<c.class>`) are dropped — the caption template
// owns the look.

const TIMING = /^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})(?:\s+.*)?$/;
const INLINE_STAMP = /<((?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{1,3})>/;

function milliseconds(hours: string | undefined, minutes: string, seconds: string, fraction: string): number {
  return ((hours ? Number(hours) * 60 * 60 : 0) + Number(minutes) * 60 + Number(seconds)) * 1000
    + Number(fraction.padEnd(3, '0'));
}

function stampMs(value: string): number | null {
  const match = value.trim().match(/^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})$/);
  return match ? milliseconds(match[1], match[2]!, match[3]!, match[4]!) : null;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', '#39': "'" };
  return text.replace(/&(?:amp|apos|gt|lt|nbsp|quot|#39|#\d+|#x[\da-f]+);/gi, (entity) => {
    const key = entity.slice(1, -1).toLowerCase();
    if (key in named) return named[key]!;
    const numeric = key.startsWith('#x')
      ? Number.parseInt(key.slice(2), 16)
      : key.startsWith('#') ? Number.parseInt(key.slice(1), 10) : Number.NaN;
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff
      ? String.fromCodePoint(numeric)
      : entity;
  });
}

function cleanText(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Split one timed segment into words, sharing its span by character count. */
function wordsInSegment(text: string, start: number, end: number): TranscriptWord[] {
  const clean = cleanText(text);
  if (!clean) return [];
  const parts = clean.split(/\s+/).filter(Boolean);
  const total = parts.reduce((sum, part) => sum + part.length, 0) || 1;
  let cursor = start;
  return parts.map((part) => {
    const span = end - start;
    const partStart = cursor;
    const partEnd = cursor + (span * part.length) / total;
    cursor = partEnd;
    return { text: part, start: Math.round(partStart), end: Math.max(Math.round(partStart) + 1, Math.round(partEnd)) };
  });
}

function cueWords(lines: string[], start: number, end: number): TranscriptWord[] {
  const raw = lines.map((line) => line.trim()).filter(Boolean).join(' ');
  if (!raw) return [];
  const parts = raw.split(INLINE_STAMP);
  if (parts.length === 1) {
    const text = cleanText(raw);
    return text ? [{ text, start, end }] : [];
  }
  const words: TranscriptWord[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const text = parts[index] ?? '';
    const segmentStart = index === 0 ? start : stampMs(parts[index - 1] ?? '') ?? start;
    const segmentEnd = stampMs(parts[index + 1] ?? '') ?? end;
    if (segmentEnd <= segmentStart) continue;
    words.push(...wordsInSegment(text, segmentStart, segmentEnd));
  }
  return words;
}

export function parseVtt(source: string): TranscriptWord[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const words: TranscriptWord[] = [];
  for (const block of normalized ? normalized.split(/\n[ \t]*\n+/) : []) {
    const lines = block.split('\n');
    // Header/comment/style blocks carry no timing line and fall through.
    const timingAt = lines.findIndex((line) => TIMING.test(line.trim()));
    if (timingAt < 0) continue;
    const match = lines[timingAt]!.trim().match(TIMING);
    if (!match) continue;
    const start = milliseconds(match[1], match[2]!, match[3]!, match[4]!);
    const end = milliseconds(match[5], match[6]!, match[7]!, match[8]!);
    if (end <= start) continue;
    words.push(...cueWords(lines.slice(timingAt + 1), start, end));
  }
  if (!words.length) throw new Error('VTT 文件中没有有效字幕。');
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}
