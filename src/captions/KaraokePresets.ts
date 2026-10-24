// Karaoke caption presets (Phase 3.2) + plain-cue SRT interchange.
//
// The three presets are ordinary CaptionTemplates, so preview and Remotion
// export render them through the existing style pipeline; their "karaoke"
// character is the dim base colour that the bright per-word highlight
// (`highlightColor`) covers as the line is sung.
//
// ASS karaoke interchange lives in `./ass` (word-level `{\k}` timing, import and
// export). This module only adds the preset registry and the SRT cue helpers the
// karaoke panel needs for plain subtitle round-trips.
import type { CaptionAnchor, CaptionTemplate } from './types';
import { srtTimestamp } from './exportCaptions';

export const KARAOKE_TEMPLATES = ['karaoke-verse', 'karaoke-chant', 'karaoke-fill'] as const;
export type KaraokeTemplate = (typeof KARAOKE_TEMPLATES)[number];

export function isKaraokeTemplate(id: unknown): id is KaraokeTemplate {
  return typeof id === 'string' && (KARAOKE_TEMPLATES as readonly string[]).includes(id);
}

/** Template id when it is a karaoke preset, otherwise null. */
export function karaokeTemplateOf(template: CaptionTemplate | undefined): KaraokeTemplate | null {
  return isKaraokeTemplate(template) ? template : null;
}

/** Where each preset sits on the title-safe grid when it is applied. */
export const KARAOKE_LAYOUT: Record<KaraokeTemplate, { anchor: CaptionAnchor }> = {
  'karaoke-verse': { anchor: 'bottom-center' },
  'karaoke-chant': { anchor: 'middle-center' },
  'karaoke-fill': { anchor: 'bottom-center' },
};

export interface KaraokeCue {
  startMs: number;
  endMs: number;
  text: string;
}

/** Cues from SubRip blocks (`HH:MM:SS,mmm --> HH:MM:SS,mmm` + text lines). */
export function parseSrtCues(content: string): KaraokeCue[] {
  return content.split(/\r?\n\s*\r?\n/).flatMap((block) => {
    const lines = block.split(/\r?\n/);
    const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeLineIndex < 0) return [];
    const match = lines[timeLineIndex]!.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return [];
    const toMs = (hour: string, minute: string, second: string, milli: string): number =>
      Number(hour) * 3_600_000 + Number(minute) * 60_000 + Number(second) * 1000 + Number(milli);
    const text = lines.slice(timeLineIndex + 1).join('\n').trim();
    if (!text) return [];
    return [{
      startMs: toMs(match[1]!, match[2]!, match[3]!, match[4]!),
      endMs: toMs(match[5]!, match[6]!, match[7]!, match[8]!),
      text,
    }];
  });
}

/** SubRip document from plain cues. */
export function cuesToSrt(cues: readonly KaraokeCue[]): string {
  return `${cues
    .map((cue, index) => `${index + 1}\n${srtTimestamp(cue.startMs)} --> ${srtTimestamp(cue.endMs)}\n${cue.text}`)
    .join('\n\n')}\n`;
}
