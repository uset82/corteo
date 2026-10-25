// The headless half of the shared music-analysis cache. The browser writes the
// same record through src/audio/intelligence/store.ts (remote-first), so a server
// analysis is what the media-card badge reads once an editor tab opens.
import { getStoredEntry, setStoredEntry } from '../plugins/project-store.ts';
import {
  isMusicAnalysis,
  musicAnalysisCacheKey,
  musicAnalysisRemoteKey,
  storedMusicAnalysis,
  validStoredMusicAnalysis,
} from '../../shared/music-inference/analysis-record.ts';
import type { MusicAnalysis } from '../../src/audio/intelligence/types.ts';

export async function loadStoredMusicAnalysis(
  assetId: string,
  sourceRevision: string,
): Promise<MusicAnalysis | null> {
  const key = musicAnalysisCacheKey(assetId, sourceRevision);
  const row = await getStoredEntry(await musicAnalysisRemoteKey(key));
  if (!row.found) return null;
  if (!validStoredMusicAnalysis(row.value, key, assetId, sourceRevision)) return null;
  return (row.value as { analysis: MusicAnalysis }).analysis;
}

export async function saveStoredMusicAnalysis(analysis: MusicAnalysis): Promise<void> {
  if (!isMusicAnalysis(analysis)) throw new Error('Refusing to cache invalid music analysis');
  const stored = storedMusicAnalysis(analysis);
  await setStoredEntry(await musicAnalysisRemoteKey(stored.key), stored);
}
