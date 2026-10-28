import type { TranscriptWord } from '../transcript/types';

const ASS_TIME = /^(\d{1,3}):([0-5]\d):([0-5]\d)(?:[.,](\d{1,3}))?$/;

/** ASS/SSA timestamps are h:mm:ss.cc (centiseconds), but .mmm appears in the wild. */
export function parseAssTime(value: string): number | null {
  const match = ASS_TIME.exec(value.trim());
  if (!match) return null;
  const fraction = (match[4] ?? '').padEnd(3, '0').slice(0, 3);
  return ((Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3])) * 1000
    + Number(fraction);
}

function splitFields(value: string, count: number): string[] {
  const fields: string[] = [];
  let rest = value;
  for (let index = 0; index < count - 1; index += 1) {
    const comma = rest.indexOf(',');
    if (comma < 0) { fields.push(rest); rest = ''; }
    else { fields.push(rest.slice(0, comma)); rest = rest.slice(comma + 1); }
  }
  fields.push(rest);
  while (fields.length < count) fields.push('');
  return fields;
}

function cleanText(value: string): string {
  return value
    .replace(/\\[Nn]/g, ' ')
    .replace(/\\h/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type KaraokePart = { text: string; duration: number | null };

/**
 * Split an ASS Dialogue text into plain chunks paired with the \k/\kf/\ko
 * duration (centiseconds → ms) that precedes each chunk. Other override blocks
 * are discarded; a drawing block (\p1 … \p0) carries no words.
 */
function karaokeParts(text: string): KaraokePart[] {
  const parts: KaraokePart[] = [];
  let karaoke: number | null = null;
  let drawing = false;
  const token = /\{([^}]*)\}|([^{]+)/g;
  for (const match of text.matchAll(token)) {
    if (match[1] !== undefined) {
      const tags = match[1];
      const timing = /\\k([fo]?)(\d+)/i.exec(tags);
      if (timing) karaoke = Number(timing[2]) * 10;
      if (/\\p1\b/i.test(tags)) drawing = true;
      if (/\\p0\b/i.test(tags)) drawing = false;
      continue;
    }
    if (drawing) continue;
    const plain = cleanText(match[2] ?? '');
    if (plain) {
      parts.push({ text: plain, duration: karaoke });
      karaoke = null;
    }
  }
  return parts;
}

function wordsForCue(text: string, start: number, end: number): TranscriptWord[] {
  const parts = karaokeParts(text);
  if (!parts.length) return [];
  const tagged = parts.some((part) => part.duration !== null);
  if (!tagged) return [{ text: cleanText(parts.map((part) => part.text).join(' ')), start, end }];
  const words: TranscriptWord[] = [];
  let cursor = start;
  for (const part of parts) {
    const tokens = part.text.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const total = tokens.reduce((sum, word) => sum + word.length, 0);
    const available = part.duration === null
      ? 0
      : Math.min(part.duration, Math.max(0, end - cursor));
    let used = 0;
    for (const [index, word] of tokens.entries()) {
      const last = index === tokens.length - 1;
      const share = last ? available - used : Math.round((available * word.length) / Math.max(1, total));
      const wordEnd = Math.max(cursor, Math.min(end, cursor + share));
      words.push({ text: word, start: cursor, end: wordEnd });
      used += share;
      cursor = wordEnd;
    }
  }
  const last = words[words.length - 1];
  if (last && last.end < end) words[words.length - 1] = { ...last, end };
  return words.filter((word) => word.end > word.start);
}

/**
 * Parse ASS/SSA Dialogue lines into word-timed captions. Karaoke tags make the
 * word-level timing; a Dialogue line without them becomes one cue word, like an
 * SRT cue. Tags `\k`, `\kf` and `\ko` all use their centisecond duration.
 */
export function parseAss(source: string): TranscriptWord[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let inEvents = false;
  let fields: string[] | null = null;
  const words: TranscriptWord[] = [];
  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    const section = /^\[(.+)\]$/.exec(trimmed);
    if (section) {
      inEvents = section[1]!.trim().toLowerCase() === 'events';
      fields = null;
      continue;
    }
    if (!inEvents) continue;
    if (/^Format:/i.test(trimmed)) {
      fields = trimmed.slice(trimmed.indexOf(':') + 1).split(',').map((field) => field.trim().toLowerCase());
      continue;
    }
    if (!/^Dialogue:/i.test(trimmed)) continue;
    const columns = fields ?? ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
    const values = splitFields(trimmed.slice(trimmed.indexOf(':') + 1).trim(), columns.length);
    const index = (name: string, fallback: number) => {
      const found = columns.indexOf(name);
      return found >= 0 ? found : fallback;
    };
    const start = parseAssTime(values[index('start', 1)] ?? '');
    const end = parseAssTime(values[index('end', 2)] ?? '');
    const text = values[index('text', columns.length - 1)] ?? '';
    if (start === null || end === null || end <= start || !text.trim()) continue;
    words.push(...wordsForCue(text, start, end));
  }
  if (!words.length) throw new Error('ASS 文件中没有有效字幕。');
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}
