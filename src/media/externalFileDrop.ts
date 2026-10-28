import type { TranscriptWord } from '../transcript/types';
import { parseSubtitleFile } from '../captions/subtitleImport';
import { kindOfDescriptor, type MediaKind } from './mediaProbe';

export type ExternalFileTarget =
  | { type: 'media'; mediaKind: MediaKind }
  | { type: 'caption'; format: 'srt' | 'vtt' | 'ass' | 'txt' };

type FileDescriptor = Pick<File, 'name' | 'type'>;

const CAPTION_FORMATS = new Map<string, 'srt' | 'vtt' | 'ass' | 'txt'>([
  ['.srt', 'srt'], ['.vtt', 'vtt'], ['.ass', 'ass'], ['.ssa', 'ass'], ['.txt', 'txt'],
]);

export function classifyExternalFile(file: FileDescriptor): ExternalFileTarget | null {
  const lowerName = file.name.toLowerCase();
  const caption = [...CAPTION_FORMATS].find(([extension]) => lowerName.endsWith(extension));
  if (caption) return { type: 'caption', format: caption[1] };
  const mediaKind = kindOfDescriptor(file.name, file.type);
  return mediaKind ? { type: 'media', mediaKind } : null;
}

export function hasExternalFiles(dataTransfer: DataTransfer): boolean {
  return dataTransfer.files.length > 0 || Array.from(dataTransfer.types).includes('Files');
}

export function droppedFiles(dataTransfer: DataTransfer): File[] {
  return Array.from(dataTransfer.files);
}

/** Parse a Finder-dropped caption file and make its first cue begin at the drop frame. */
export function parseDroppedCaptions(name: string, text: string, dropStartMs: number): TranscriptWord[] {
  const target = classifyExternalFile({ name, type: '' });
  let timed: TranscriptWord[] = [];
  if (target?.type === 'caption' && target.format !== 'txt') {
    // SRT/VTT/ASS share the subtitle importer, so karaoke timings survive a drop.
    try { timed = parseSubtitleFile(name, text).words; } catch { timed = []; }
  }
  if (timed.length) {
    const offset = Math.max(0, dropStartMs) - timed[0]!.start;
    return timed.map((word) => ({
      ...word,
      start: Math.max(0, word.start + offset),
      end: Math.max(1, word.end + offset),
    }));
  }
  const start = Math.max(0, dropStartMs);
  return text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean)
    .map((line, index) => ({
      text: line,
      start: start + index * 3000,
      end: start + (index + 1) * 3000,
    }));
}
