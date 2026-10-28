// ASS/SSA → TranscriptWord[]. A karaoke line carries its timing inside the
// override blocks: \k, \kf, \K and \ko each give the length of the syllable that
// follows, in CENTISECONDS, and the syllables run back to back from the line
// start. Text before the first tag belongs to the line and is never dropped;
// every other override block ({\b1}, {\pos(..)}, {\an8}) is markup and is
// stripped. \N, \n and \h are line breaks, so they separate words.
import type { TranscriptWord } from '../transcript/types';

/** \k, \kf, \ko (and the uppercase \K): the number is a duration in centiseconds. */
const KARAOKE = /\\([kK])([fo])?(\d+)/g;
/** h:mm:ss.cc — the fraction is centiseconds, so it is padded to milliseconds. */
const TIME = /^(\d+):([0-5]\d):([0-5]\d)(?:[.:](\d{1,3}))?$/;
const TOKEN = /\{[^}]*\}|[^{}]+/g;
const LINE_BREAK = /\\[Nnh]/g;
/** ASS v4+ / SSA v4 event order, used when the file carries no Format: line. */
const DEFAULT_COLUMNS = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];

interface Segment {
  text: string;
  /** Karaoke length in centiseconds; null for text before the first tag. */
  cs: number | null;
}

function parseTime(raw: string): number | null {
  const match = raw.trim().match(TIME);
  if (!match) return null;
  return ((Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3])) * 1000
    + Number((match[4] ?? '').padEnd(3, '0'));
}

/** The line as a sequence of karaoke syllables, in reading order. */
function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let current: Segment = { text: '', cs: null };
  for (const token of text.match(TOKEN) ?? []) {
    if (token.startsWith('{')) {
      for (const tag of token.matchAll(KARAOKE)) {
        out.push(current);
        current = { text: '', cs: Number(tag[3]) };
      }
      continue;
    }
    current.text += token.replace(LINE_BREAK, ' ');
  }
  out.push(current);
  return out;
}

/**
 * One Dialogue line → words. A syllable with no tag of its own (the text before
 * the first \k) has no length in the file, so it is weighed like the average
 * syllable: that keeps it on the timeline without pushing the karaoke run past
 * the end of the cue.
 */
function lineWords(start: number, end: number, raw: string): TranscriptWord[] {
  const parts = segments(raw)
    .map((segment) => ({ text: segment.text.replace(/\s+/g, ' ').trim(), cs: segment.cs }))
    .filter((segment) => segment.text);
  if (!parts.length) return [];
  const tagged = parts.flatMap((part) => (part.cs === null ? [] : [part.cs]));
  // A plain line (no karaoke tags at all) is one caption, timed by its own cue.
  if (!tagged.length) return [{ text: parts.map((part) => part.text).join(' '), start, end }];
  const average = tagged.reduce((total, cs) => total + cs, 0) / tagged.length;
  const weights = parts.map((part) => (part.cs === null ? average : part.cs));
  const totalMs = weights.reduce((total, cs) => total + cs * 10, 0);
  // Shrink an over-long karaoke run to the cue, but never stretch a short one:
  // a gap at the end of the line is authored silence, not something to fill.
  const scale = totalMs > end - start ? (end - start) / totalMs : 1;
  const words: TranscriptWord[] = [];
  let at = start;
  for (const [index, part] of parts.entries()) {
    const length = Math.max(1, Math.round(weights[index]! * 10 * scale));
    words.push({ text: part.text, start: at, end: at + length });
    at += length;
  }
  return words;
}

/** Split an event payload into `count` fields; the last one keeps its commas. */
function splitFields(raw: string, count: number): string[] {
  let rest = raw.replace(/^ /, '');
  const fields: string[] = [];
  for (let index = 1; index < count; index += 1) {
    const comma = rest.indexOf(',');
    if (comma < 0) break;
    fields.push(rest.slice(0, comma).trim());
    rest = rest.slice(comma + 1);
  }
  fields.push(rest);
  return fields;
}

export function parseAss(source: string): TranscriptWord[] {
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let columns = DEFAULT_COLUMNS;
  let inEvents = false;
  const words: TranscriptWord[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const section = trimmed.match(/^\[(.+)\]$/);
    if (section) {
      inEvents = section[1]!.trim().toLowerCase() === 'events';
      continue;
    }
    if (!inEvents) continue;
    const field = trimmed.match(/^([A-Za-z]+):(.*)$/);
    if (!field) continue;
    const key = field[1]!.toLowerCase();
    if (key === 'format') {
      columns = field[2]!.split(',').map((column) => column.trim().toLowerCase());
      continue;
    }
    // Comment: lines are authoring notes; only Dialogue: carries captions.
    if (key !== 'dialogue') continue;
    const values = splitFields(field[2]!, columns.length);
    const column = (name: string): string => {
      const index = columns.indexOf(name);
      return index >= 0 ? (values[index] ?? '') : '';
    };
    const start = parseTime(column('start'));
    const end = parseTime(column('end'));
    const text = column('text') || values[values.length - 1] || '';
    if (start === null || end === null || end <= start) continue;
    words.push(...lineWords(start, end, text));
  }
  if (!words.length) throw new Error('ASS 文件中没有有效字幕。');
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}
