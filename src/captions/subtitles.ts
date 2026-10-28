// One entry point for the three subtitle formats the editor reads. The UI
// import, the drag-and-drop path and the import_subtitles tool all come through
// here, so a file type is supported in exactly one place.
import type { TranscriptWord } from '../transcript/types';
import { parseAss } from './ass';
import { parseSrt } from './srt';
import { parseVtt } from './vtt';

export type SubtitleFormat = 'srt' | 'ass' | 'vtt';

const EXTENSIONS: Record<string, SubtitleFormat> = {
  '.srt': 'srt',
  // .ssa is the older name for the same container and the same karaoke tags.
  '.ass': 'ass',
  '.ssa': 'ass',
  '.vtt': 'vtt',
};

export function subtitleFormatFromName(name: string): SubtitleFormat | null {
  const match = name.trim().toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? EXTENSIONS[match[0]] ?? null : null;
}

/** An explicit `format` wins; otherwise the extension decides. */
export function parseSubtitles(
  name: string,
  source: string,
  format?: SubtitleFormat,
): TranscriptWord[] {
  const resolved = format ?? subtitleFormatFromName(name);
  if (resolved === 'srt') return parseSrt(source);
  if (resolved === 'ass') return parseAss(source);
  if (resolved === 'vtt') return parseVtt(source);
  throw new Error('无法识别的字幕格式（支持 SRT、ASS、VTT）。');
}
