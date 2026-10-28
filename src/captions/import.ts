import type { TranscriptWord } from '../transcript/types';
import { parseAss } from './ass';
import { parseSrt } from './srt';
import { parseVtt } from './vtt';

export type SubtitleFormat = 'srt' | 'ass' | 'vtt';

export interface ParsedSubtitles {
  format: SubtitleFormat;
  words: TranscriptWord[];
}

export function subtitleFormatFromName(name: string): SubtitleFormat | null {
  const match = /\.(srt|ass|ssa|vtt)$/i.exec(name.trim());
  if (!match) return null;
  return match[1]!.toLowerCase() === 'ssa' ? 'ass' : match[1]!.toLowerCase() as SubtitleFormat;
}

export function inferSubtitleFormat(source: string): SubtitleFormat | null {
  const head = source.replace(/^\uFEFF/, '').trimStart();
  if (/^WEBVTT\b/i.test(head)) return 'vtt';
  if (/\[events\]/i.test(source)) return 'ass';
  if (/-->/.test(source)) return 'srt';
  return null;
}

function requestedFormat(value: unknown): SubtitleFormat | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ssa') return 'ass';
  return normalized === 'srt' || normalized === 'ass' || normalized === 'vtt' ? normalized : null;
}

/** One entry point for the transcript import button and the MCP import_subtitles tool. */
export function parseSubtitles(source: string, format?: unknown): ParsedSubtitles {
  const resolved = requestedFormat(format) ?? inferSubtitleFormat(source);
  if (!resolved) throw new Error('无法识别字幕格式，请使用 SRT、ASS 或 VTT。');
  const words = resolved === 'ass'
    ? parseAss(source)
    : resolved === 'vtt'
      ? parseVtt(source)
      : parseSrt(source);
  return { format: resolved, words };
}
