import type { TranscriptWord } from '../transcript/types';

// ASS/SSA (Advanced SubStation Alpha) → timed words.
// Dialogue lines carry one cue per line; inline `\k`/`\kf`/`\ko` karaoke tags
// (centiseconds) split that line into per-syllable timings, which are merged
// back into whitespace-delimited words so the caption pager sees real words.
// Everything else inside `{…}` (position, fade, colors, drawing commands) is
// display styling this app re-applies from the caption template, so it is
// discarded.

const ASS_TIME = /^(\d+):([0-5]\d):([0-5]\d)[.,](\d{1,3})$/;
const KARAOKE = /\\(k|kf|ko)(\d+(?:\.\d+)?)/i;

function assMs(value: string): number | null {
  const match = value.trim().match(ASS_TIME);
  if (!match) return null;
  const fraction = match[4]!.padEnd(3, '0');
  return ((Number(match[1]) * 60 * 60) + (Number(match[2]) * 60) + Number(match[3])) * 1000
    + Number(fraction);
}

/** One dialogue line as text atoms: a karaoke tag set the duration of the text that follows it. */
interface Atom {
  text: string;
  /** Karaoke duration in centiseconds; null for text outside any `\k` run. */
  cs: number | null;
}

/**
 * Strip override blocks while recording karaoke durations. A `\k` tag applies
 * to the text after it up to the next karaoke tag — this is exactly how libass
 * animates syllables, so the same split yields word timing.
 */
function atomsOf(raw: string): Atom[] {
  const atoms: Atom[] = [];
  let pendingCs: number | null = null;
  let buffer = '';
  let index = 0;
  const flush = () => {
    if (buffer) atoms.push({ text: buffer, cs: pendingCs });
    buffer = '';
  };
  while (index < raw.length) {
    const open = raw.indexOf('{', index);
    if (open < 0) {
      buffer += raw.slice(index);
      break;
    }
    buffer += raw.slice(index, open);
    const close = raw.indexOf('}', open + 1);
    const block = raw.slice(open + 1, close < 0 ? raw.length : close);
    const karaoke = block.match(KARAOKE);
    if (karaoke) {
      flush();
      pendingCs = Number(karaoke[2]) * 10; // ASS stores centiseconds
    }
    index = close < 0 ? raw.length : close + 1;
  }
  flush();
  return atoms;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return text.replace(/&(?:amp|apos|gt|lt|nbsp|quot|#\d+|#x[\da-f]+);/gi, (entity) => {
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

/** Drop `{…}` override blocks, then make line breaks a boundary and `\h` a hard space. */
function visibleText(raw: string): string {
  return decodeEntities(
    raw.replace(/\{[^}]*(?:\}|$)/g, '').replace(/\\[Nn]/g, ' ').replace(/\\h/g, ' '),
  );
}

interface TimedAtom {
  text: string;
  start: number;
  end: number;
}

/**
 * Turn the atoms of one dialogue into timed text pieces. Karaoke atoms keep
 * their own duration; untagged text shares whatever time is left over
 * proportionally to its length, so a line never runs past its END stamp.
 */
function timedAtoms(atoms: Atom[], start: number, end: number): TimedAtom[] {
  const karaokeMs = atoms.reduce((sum, atom) => sum + (atom.cs ?? 0), 0);
  const plainChars = atoms.reduce((sum, atom) => sum + (atom.cs === null ? atom.text.length : 0), 0);
  const leftover = Math.max(0, end - start - karaokeMs);
  const perChar = plainChars > 0 ? leftover / plainChars : 0;
  let cursor = start;
  return atoms.map((atom) => {
    const duration = atom.cs ?? Math.round(perChar * atom.text.length);
    const piece = { text: atom.text, start: cursor, end: cursor + duration };
    cursor += duration;
    return piece;
  });
}

/** Split timed text pieces into whitespace-delimited words, keeping each word's span. */
function wordsOf(pieces: TimedAtom[]): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  let current: TranscriptWord | null = null;
  for (const piece of pieces) {
    const text = visibleText(piece.text);
    const parts = text.split(/(\s+)/);
    let offset = piece.start;
    for (const part of parts) {
      if (!part) continue;
      const share = text.length > 0 ? (piece.end - piece.start) * (part.length / text.length) : 0;
      const partStart = offset;
      const partEnd = offset + share;
      offset = partEnd;
      if (/^\s+$/.test(part)) {
        current = null;
        continue;
      }
      if (current) {
        current.text += part;
        current.end = Math.max(current.end, Math.round(partEnd));
      } else {
        current = { text: part, start: Math.round(partStart), end: Math.round(partEnd) };
        words.push(current);
      }
    }
  }
  return words;
}

/** Field positions from the `Format:` line, so reordered columns still parse. */
function formatIndexes(format: string): { start: number; end: number; text: number; count: number } {
  const fields = format.replace(/^format\s*:/i, '').split(',').map((field) => field.trim().toLowerCase());
  const at = (name: string, fallback: number) => {
    const found = fields.indexOf(name);
    return found >= 0 ? found : fallback;
  };
  return { start: at('start', 1), end: at('end', 2), text: at('text', 9), count: fields.length };
}

/** Text is the only free-form column, so commas beyond the format's field count belong to it. */
function dialogueFields(line: string, textIndex: number, fieldCount: number): string[] {
  const value = line.replace(/^dialogue\s*:/i, '');
  const parts = value.split(',');
  const extra = parts.length - fieldCount;
  if (extra <= 0) return parts;
  return [
    ...parts.slice(0, textIndex),
    parts.slice(textIndex, textIndex + extra + 1).join(','),
    ...parts.slice(textIndex + extra + 1),
  ];
}

export function parseAss(source: string): TranscriptWord[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let inEvents = false;
  let format = { start: 1, end: 2, text: 9, count: 10 };
  const words: TranscriptWord[] = [];
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (/^\[.*\]$/.test(line)) {
      inEvents = /^\[events\]$/i.test(line);
      continue;
    }
    if (!inEvents) continue;
    if (/^format\s*:/i.test(line)) {
      format = formatIndexes(line);
      continue;
    }
    if (!/^dialogue\s*:/i.test(line)) continue;
    const fields = dialogueFields(line, format.text, format.count);
    const start = assMs(fields[format.start] ?? '');
    const end = assMs(fields[format.end] ?? '');
    const text = fields[format.text] ?? '';
    if (start === null || end === null || end <= start || !text.trim()) continue;
    const atoms = atomsOf(text);
    if (!atoms.some((atom) => atom.cs !== null)) {
      // No karaoke tags: one cue per dialogue line, same contract as SRT.
      const cue = visibleText(text).replace(/\s+/g, ' ').trim();
      if (cue) words.push({ text: cue, start, end });
      continue;
    }
    words.push(...wordsOf(timedAtoms(atoms, start, end)));
  }
  if (!words.length) throw new Error('ASS 文件中没有有效字幕。');
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}
