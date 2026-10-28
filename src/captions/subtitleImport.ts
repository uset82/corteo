// A parsed subtitle file becomes one manual caption lane. The panel import adds
// the lane to the caption track that is already selected, the library import
// puts it on a new track, and the import_subtitles tool does both headlessly —
// all three go through withSubtitleLane so the lane shape (the `manual:` item
// sentinel, stable cue ids, the single-lane layout fix) is decided once.
import type { TimelineItem } from '../editor/types';
import type { TranscriptWord } from '../transcript/types';
import {
  identifyManualCues,
  isManualCaptionEntry,
  newManualCaptions,
  newManualEntry,
  promoteCaptionEntries,
} from './manualCaptions';
import { normalizeCaptionSourceEntries } from './sourceOrder';
import type { CaptionsData } from './types';

export interface SubtitleLanePlan {
  captions: CaptionsData;
  laneId: string;
}

/** `coro.ass` → `coro`: the lane and the track are named after the file. */
export function subtitleTrackName(fileName: string): string {
  const base = fileName.trim().replace(/\.[a-z0-9]+$/i, '');
  return base || fileName.trim();
}

export function withSubtitleLane(
  captions: CaptionsData | null,
  items: TimelineItem[],
  fileName: string,
  words: readonly TranscriptWord[],
): SubtitleLanePlan {
  const base = captions ?? newManualCaptions();
  const entries = promoteCaptionEntries(base, items);
  const label = subtitleTrackName(fileName);
  // A fresh manual track (or a lane the user emptied) is the one to fill: adding
  // a second lane next to an empty one would show an empty row in the panel.
  const empty = entries.find((entry) => isManualCaptionEntry(entry) && !entry.words?.length);
  const lane = empty ? { ...empty, label } : newManualEntry(entries.filter(isManualCaptionEntry).length + 1);
  const lanes = entries.some((entry) => entry.id === lane.id) ? entries : [...entries, lane];
  const filled = lanes.map((entry) => (entry.id === lane.id
    ? { ...entry, label, words: [...(entry.words ?? []), ...identifyManualCues(words)] }
    : entry));
  return {
    captions: {
      ...base,
      enabled: true,
      sourceEntries: normalizeCaptionSourceEntries(filled),
      sources: undefined,
      sourceMode: 'item',
      words: undefined,
      // A single-lane policy would hide every other lane the import just kept.
      ...(base.layoutPolicy?.mode === 'single-lane' ? { layoutPolicy: { mode: 'auto-stack' as const } } : {}),
    },
    laneId: lane.id,
  };
}
