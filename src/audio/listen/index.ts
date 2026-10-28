// One entry point for the listening measurements. `measureSong` deliberately
// takes decoded mono samples only: the server hands it ffmpeg's 22.05 kHz mono
// output, the browser can reuse it, and every verify can synthesize input.
import { FRAME_MS, spectrumFrames } from './spectrum.ts';
import { detectOnsets, pickAccents } from './onsets.ts';
import { deriveMoments } from './moments.ts';
import { estimateKey } from './key.ts';
import type { SongMeasurements } from './types.ts';

export { parseLrc, resolveLyrics, splitPlainLyrics, timeUntimedLines } from './lyricsInput.ts';
export type { LyricsInput } from './lyricsInput.ts';
export { FRAME_MS, spectrumFrames } from './spectrum.ts';
export { detectOnsets, pickAccents } from './onsets.ts';
export { deriveMoments } from './moments.ts';
export { estimateKey } from './key.ts';
export { fallbackListening } from './fallback.ts';
export type { ListeningFallback } from './fallback.ts';
export { buildEbur128Args, parseEbur128 } from './ebur128.ts';
export type { LoudnessPoint, LoudnessReport } from './ebur128.ts';
export {
  SONG_MAP_ANALYZER_FINGERPRINT,
  SONG_MAP_SCHEMA_VERSION,
  attachLinesToSections,
  buildSongMap,
  displaySectionRole,
  groupWordsIntoLines,
  markChorusLines,
  normalizedLineText,
} from './songMap.ts';
export type {
  BuildSongMapInput,
  LineGroupingOptions,
  SongLyricWord,
  SongMap,
  SongMapChorusGroup,
  SongMapLine,
  SongMapSection,
} from './songMap.ts';
export type {
  EnergyFrame,
  KeyEstimate,
  Moment,
  MomentKind,
  OnsetPoint,
  SongMeasurements,
} from './types.ts';

export function measureSong(samples: Float32Array, sampleRate: number): SongMeasurements {
  const { frames, chroma } = spectrumFrames(samples, sampleRate);
  const onsets = detectOnsets(samples, sampleRate);
  return {
    durationMs: sampleRate > 0 ? (samples.length / sampleRate) * 1000 : 0,
    frameMs: FRAME_MS,
    frames,
    onsets,
    accents: pickAccents(onsets),
    moments: deriveMoments(frames),
    key: estimateKey(chroma),
  };
}
