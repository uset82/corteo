// Advanced SubStation Alpha (.ass) interchange with karaoke timing.
//
// The editor stores caption timing as word-level `TranscriptWord`s, so ASS maps
// onto it directly: every page becomes one Dialogue line, and each word becomes
// a `{\k<centiseconds>}` syllable. That is the same information a karaoke
// player (mpv, VLC, Aegisub) needs, so an export can be re-imported without
// losing the sweep timing, and third-party karaoke files can be imported with
// their per-word timings intact.
//
// Round-trip contract: captionsToAss → parseAss preserves each word's text and
// timing to within one centisecond (the resolution ASS itself stores).

import type { CaptionPage, CaptionsData } from './types';
import type { TranscriptWord } from '../transcript/types';
import type { TimelineItem } from '../editor/types';
import { buildCaptionPages } from './captionPages';
import { effectivePreset } from './renderStyles';
import type { CaptionStyle } from './styles';
import { joinCaptionWords } from './types';

const CJK = /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/;

/** ASS stores colours as &HAABBGGRR with an INVERTED alpha channel. */
export function assColor(hex: string, opacity = 1): string {
  const match = /^#([\da-f]{3,8})$/i.exec(hex.trim());
  const digits = match?.[1];
  let r = 255;
  let g = 255;
  let b = 255;
  let a = 0;
  if (digits) {
    const expanded = digits.length === 3 || digits.length === 4
      ? [...digits].map((part) => `${part}${part}`).join('')
      : digits;
    r = Number.parseInt(expanded.slice(0, 2), 16);
    g = Number.parseInt(expanded.slice(2, 4), 16);
    b = Number.parseInt(expanded.slice(4, 6), 16);
    const sourceAlpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    a = Math.round((1 - sourceAlpha * Math.max(0, Math.min(1, opacity))) * 255);
  }
  const pad = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');
  return `&H${pad(a)}${pad(b)}${pad(g)}${pad(r)}`;
}

/** ASS timecode `H:MM:SS.cc` — centisecond resolution. */
export function assTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10));
  const hh = Math.floor(total / 360_000);
  const mm = Math.floor((total % 360_000) / 6_000);
  const ss = Math.floor((total % 6_000) / 100);
  const cs = total % 100;
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${hh}:${pad(mm)}:${pad(ss)}.${pad(cs)}`;
}

/** Numpad alignment: 1-3 bottom, 4-6 middle, 7-9 top; 1/4/7 left, 2/5/8 centre. */
function assAlignment(anchor: string | undefined, preset: CaptionStyle): number {
  const source = anchor ?? (preset.textAlign === 'left' ? 'bottom-left' : preset.textAlign === 'right' ? 'bottom-right' : 'bottom-center');
  const row = source.startsWith('top') ? 6 : (source.startsWith('middle') || source === 'center') ? 3 : 0;
  const column = source.endsWith('left') ? 1 : source.endsWith('right') ? 3 : 2;
  return row + column;
}

/** Text that must not be read as an ASS override block or a hard line break. */
function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, '\\N');
}

function separator(previous: string, next: string): string {
  if (!previous) return '';
  return CJK.test(previous.slice(-1)) && CJK.test(next[0] ?? '') ? '' : ' ';
}

export interface AssExportOptions {
  /** Shown in the [Script Info] title. */
  title?: string;
  /** Canvas the font sizes are resolved against. Defaults to 1920×1080. */
  width?: number;
  height?: number;
  /** Karaoke syllable tags per word. Off → one plain line per page. */
  karaoke?: boolean;
}

function styleLine(name: string, preset: CaptionStyle, height: number): string {
  const fontSize = Math.max(1, Math.round(preset.fontSize * height));
  const bold = preset.fontWeight >= 600 ? -1 : 0;
  const italic = preset.fontStyle === 'italic' || preset.fontStyle === 'oblique' ? -1 : 0;
  const underline = preset.underline ? -1 : 0;
  const strike = preset.strike ? -1 : 0;
  const outline = Math.max(0, preset.strokeWidth);
  const shadow = Math.max(0, preset.textShadowSize ?? 0) > 0 ? 2 : 0;
  // Karaoke semantics: unsung text is SecondaryColour, the sweep paints PrimaryColour.
  const primary = assColor(preset.highlightColor);
  const secondary = assColor(preset.color);
  const outlineColour = assColor(preset.strokeColor, preset.strokeOpacity);
  const back = assColor('#000000', 0.4);
  return [
    `Style: ${name}`,
    preset.fontFamily.trim() || 'Arial',
    fontSize,
    primary,
    secondary,
    outlineColour,
    back,
    bold,
    italic,
    underline,
    strike,
    100,
    100,
    preset.letterSpacing ?? 0,
    0,
    1,
    outline,
    shadow,
    assAlignment(undefined, preset),
    40,
    40,
    Math.round(height * 0.06),
    1,
  ].join(',');
}

/** One Dialogue line: `{\k}` per word when karaoke is on, else the joined page. */
function dialogueText(page: CaptionPage, karaoke: boolean): string {
  if (!karaoke) return escapeAssText(joinCaptionWords(page.words));
  let out = '';
  let previous = '';
  for (const word of page.words) {
    const centiseconds = Math.max(1, Math.round((word.end - word.start) / 10));
    out += `{\\k${centiseconds}}${escapeAssText(separator(previous, word.text) + word.text)}`;
    previous = word.text;
  }
  return out;
}

/**
 * Serialize a caption track to ASS. Word-level timing is preserved as `\k`
 * syllables, so the file plays back as karaoke and re-imports losslessly.
 */
export function captionsToAss(
  captions: CaptionsData,
  items: TimelineItem[],
  fps: number,
  options: AssExportOptions = {},
): string {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const preset = effectivePreset(captions);
  const styleName = 'Karaoke';
  const pages = buildCaptionPages(captions, items, fps).map((identity) => identity.page);
  const karaoke = options.karaoke ?? true;
  const header = [
    '[Script Info]',
    `Title: ${options.title ?? 'Cortéo captions'}`,
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleLine(styleName, preset, height),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const events = pages.map((page) => [
    'Dialogue: 0',
    assTimestamp(page.start),
    assTimestamp(page.end),
    styleName,
    '',
    '0',
    '0',
    '0',
    '',
    dialogueText(page, karaoke),
  ].join(','));
  return `${[...header, ...events].join('\n')}\n`;
}

const ASS_DIALOGUE = /^Dialogue:\s*(.*)$/i;
const ASS_TIME = /^(\d{1,2}):([0-5]\d):([0-5]\d)[.,](\d{1,2})$/;

function assTimeToMs(value: string): number | null {
  const match = ASS_TIME.exec(value.trim());
  if (!match) return null;
  const centiseconds = Number(match[4]!.padEnd(2, '0'));
  return ((Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3])) * 1000 + centiseconds * 10;
}

/** Split an ASS dialogue body into its 10 comma-separated fields. */
function dialogueFields(body: string): string[] | null {
  const fields: string[] = [];
  let start = 0;
  for (let index = 0; index < body.length && fields.length < 9; index += 1) {
    if (body[index] === ',') {
      fields.push(body.slice(start, index));
      start = index + 1;
    }
  }
  fields.push(body.slice(start));
  return fields.length === 10 ? fields : null;
}

/**
 * Parse ASS dialogue into words. `\k`/`\K`/`\kt` syllables become individual
 * words with their own timing; a line without karaoke tags becomes one word.
 */
export function parseAss(source: string): TranscriptWord[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const words: TranscriptWord[] = [];
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    const dialogue = ASS_DIALOGUE.exec(line);
    if (!dialogue) continue;
    const fields = dialogueFields(dialogue[1]!);
    if (!fields) continue;
    const start = assTimeToMs(fields[1]!);
    const end = assTimeToMs(fields[2]!);
    if (start === null || end === null || end <= start) continue;
    const body = fields[9]!.trim();
    const syllables = splitKaraoke(body, start, end);
    for (const syllable of syllables) {
      if (syllable.text) words.push(syllable);
    }
  }
  if (!words.length) throw new Error('ASS 文件中没有有效字幕。');
  return words.sort((a, b) => a.start - b.start || a.end - b.end);
}

const KARAOKE_TAG = /\\[kK](?:t)?(\d+)/;

/**
 * Walk a dialogue body, cutting it at `{\k}` boundaries. Syllable duration is
 * carried by the tag that PRECEDES the text it times, matching how the format
 * is written (and read) by Aegisub. A body with override tags but no karaoke
 * timing is spread evenly across the line instead of collapsing to zero-width
 * words.
 */
function splitKaraoke(body: string, lineStart: number, lineEnd: number): TranscriptWord[] {
  const plain = () => {
    const text = body.replace(/\{[^}]*\}/g, '').replace(/\\N|\\n/gi, ' ').replace(/\\(.)/g, '$1').trim();
    return text ? [{ text, start: lineStart, end: lineEnd }] : [];
  };
  const segments: Array<{ text: string; durationCs: number }> = [];
  const pattern = /\{([^}]*)\}([^{]*)/g;
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    const tag = KARAOKE_TAG.exec(match[1]!);
    const text = match[2]!.replace(/\\N|\\n/gi, ' ').replace(/\\(.)/g, '$1').trim();
    if (text) segments.push({ text, durationCs: tag ? Number(tag[1]) : 0 });
  }
  if (!segments.length) return plain();
  const totalCs = segments.reduce((sum, segment) => sum + segment.durationCs, 0);
  const out: TranscriptWord[] = [];
  if (totalCs <= 0) {
    // No karaoke timing: split the line duration by character weight so the
    // sweep still lands on plausible word boundaries.
    const weights = segments.map((segment) => Math.max(1, [...segment.text].length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const span = Math.max(1, lineEnd - lineStart);
    let cursor = lineStart;
    segments.forEach((segment, index) => {
      const share = Math.round((weights[index]! / totalWeight) * span);
      const end = index === segments.length - 1 ? lineEnd : cursor + Math.max(1, share);
      out.push({ text: segment.text, start: cursor, end });
      cursor = end;
    });
    return out;
  }
  let cursor = lineStart;
  for (const segment of segments) {
    const span = segment.durationCs * 10;
    out.push({ text: segment.text, start: cursor, end: cursor + Math.max(1, span) });
    cursor += span;
  }
  return out;
}
