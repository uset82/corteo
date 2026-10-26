// Song-map half of the listening cache. It sits next to the music-analysis
// cache in the project store, but has its own key: a line-grouping change must
// not throw away an expensive analysis.
import { getStoredEntry, setStoredEntry } from '../plugins/project-store.ts';
import {
  isSongMap,
  songMapCacheKey,
  songMapRemoteKey,
  storedSongMap,
  validStoredSongMap,
} from '../../shared/music-inference/song-map-record.ts';
import type { SongMap } from '../../src/audio/listen/songMap.ts';

export async function loadStoredSongMap(
  assetId: string,
  sourceRevision: string,
): Promise<SongMap | null> {
  const key = songMapCacheKey(assetId, sourceRevision);
  const row = await getStoredEntry(await songMapRemoteKey(key));
  if (!row.found) return null;
  if (!validStoredSongMap(row.value, key, assetId, sourceRevision)) return null;
  return (row.value as { map: SongMap }).map;
}

export async function saveStoredSongMap(map: SongMap): Promise<void> {
  if (!isSongMap(map)) throw new Error('Refusing to cache an invalid song map');
  const stored = storedSongMap(map);
  await setStoredEntry(await songMapRemoteKey(stored.key), stored);
}
