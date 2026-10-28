// WebVTT → TranscriptWord[]. A cue is one caption: an optional id line, the
// timing line (`mm:ss.mmm` or `hh:mm:ss.mmm`, with optional cue settings after
// the end time), then the payload. NOTE / STYLE / REGION blocks carry no cue and
// are skipped; inline tags (<v Ana>, <c.yellow>, <00:00:01.000>) are markup.
import type { TranscriptWord } from '../transcript/types';

const TIMING = /^(?:(\d{1,2}):)?([0-5]\d):([0-5]\d)[.,](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?([0-5]\d):([0-5]\d)[.,](\d{1,3})(?:\s+.*)?$/;
const METADATA = /^(?:NOTE|STYLE|REGION)\b/i;

function decodeEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', '#39': "'",
  };
  const key = entity.slice(1, -1).toLowerCase();
  if (key in named) return named[key]!;
  const numeric = key.startsWith('#x')
    ? Number.parseInt(key.slice(2), 16)
    : key.startsWith('#')
      ? Number.parseInt(key.slice(1), 10)
      : Number.NaN;
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff
    ? String.fromCodePoint(numeric)
    : entity;
}

/** Hours are optional, so `01:02.500` is one minute two seconds. */
function milliseconds(hours: string | undefined, minutes: string, seconds: string, fraction: string): number {
  return ((Number(hours ?? 0) * 3600) + (Number(minutes) * 60) + Number(seconds)) * 1000
    + Number(fraction.padEnd(3, '0'));
}

function cueText(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|apos|gt|lt|nbsp|quot|#39|#\d+|#x[\da-f]+);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseVtt(source: string): TranscriptWord[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const cues: TranscriptWord[] = [];
  for (const block of normalized ? normalized.split(/\n[ \t]*\n+/) : []) {
    const lines = block.split('\n');
    // NOTE/STYLE/REGION blocks may carry their own text; none of it is a cue.
    if (METADATA.test(lines[0]!.trim())) continue;
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const match = lines[timingIndex]!.trim().match(TIMING);
    const text = cueText(lines.slice(timingIndex + 1));
    if (!match || !text) continue;
    const start = milliseconds(match[1], match[2]!, match[3]!, match[4]!);
    const end = milliseconds(match[5], match[6]!, match[7]!, match[8]!);
    if (end > start) cues.push({ text, start, end });
  }
  if (!cues.length) throw new Error('VTT 文件中没有有效字幕。');
  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}
