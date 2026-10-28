import type { TranscriptWord } from '../transcript/types';

const VTT_TIME = /^(?:(\d{1,3}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/;

/** VTT allows both HH:MM:SS.mmm and MM:SS.mmm. */
export function parseVttTime(value: string): number | null {
  const match = VTT_TIME.exec(value.trim());
  if (!match) return null;
  return ((Number(match[1] ?? 0) * 3600) + (Number(match[2]) * 60) + Number(match[3])) * 1000
    + Number(match[4]);
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    const key = entity.slice(1, -1).toLowerCase();
    if (key in named) return named[key]!;
    const numeric = key.startsWith('#x') ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity;
  });
}

function cueText(lines: string[]): string {
  return decodeEntities(lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' '))
    .trim();
}

/** Parse a WebVTT file into one word per cue, matching how SRT import behaves. */
export function parseVtt(source: string): TranscriptWord[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const words: TranscriptWord[] = [];
  for (const block of normalized ? normalized.split(/\n[ \t]*\n+/) : []) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length || /^(?:NOTE|STYLE|REGION)\b/i.test(lines[0]!)) continue;
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [startRaw, endRaw] = lines[timingIndex]!.split('-->').map((part) => part.trim());
    const start = parseVttTime(startRaw ?? '');
    const end = parseVttTime((endRaw ?? '').split(/\s+/)[0] ?? '');
    const text = cueText(lines.slice(timingIndex + 1));
    if (start === null || end === null || end <= start || !text) continue;
    words.push({ text, start, end });
  }
  if (!words.length) throw new Error('VTT 文件中没有有效字幕。');
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}
