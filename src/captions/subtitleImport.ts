import type { TranscriptWord } from '../transcript/types';
import { parseSrt } from './srt';
import { parseAss } from './ass';
import { parseVtt } from './vtt';

/** Subtitle containers the importer understands; SSA is the older ASS dialect. */
export type SubtitleFormat = 'srt' | 'ass' | 'ssa' | 'vtt';

export interface ParsedSubtitles {
  format: SubtitleFormat;
  words: TranscriptWord[];
}

const EXTENSIONS: readonly SubtitleFormat[] = ['srt', 'ass', 'ssa', 'vtt'];

/**
 * Extension first (that is what the picker promised), then a content sniff so
 * pasted text or a misnamed file still lands in the right parser.
 */
export function detectSubtitleFormat(filename: string, source: string): SubtitleFormat {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const known = EXTENSIONS.find((format) => format === extension);
  if (known) return known;
  const head = source.replace(/^\uFEFF/, '').trimStart();
  if (/^WEBVTT\b/i.test(head)) return 'vtt';
  if (/^\[script info\]/i.test(head) || /^\[events\]/i.test(head) || /^\s*dialogue\s*:/im.test(head)) return 'ass';
  return 'srt';
}

export function parseSubtitleFile(filename: string, source: string): ParsedSubtitles {
  const format = detectSubtitleFormat(filename, source);
  const words = format === 'srt'
    ? parseSrt(source)
    : format === 'vtt' ? parseVtt(source) : parseAss(source);
  return { format, words };
}
