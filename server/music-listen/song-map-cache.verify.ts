// The song-map cache lives beside the music-analysis cache and must not be
// readable through a stale fingerprint or a hand-edited record.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixture = await mkdtemp(join(tmpdir(), 'occ-song-map-'));
process.env.OPENCHATCUT_DATA_DIR = join(fixture, 'data');
await mkdir(process.env.OPENCHATCUT_DATA_DIR, { recursive: true });

const { getStoredEntry, setStoredEntry } = await import('../plugins/project-store.ts');
const { loadStoredSongMap, saveStoredSongMap } = await import('./song-map-cache.ts');
const { buildSongMap, SONG_MAP_ANALYZER_FINGERPRINT } = await import('../../src/audio/listen/songMap.ts');
const {
  isSongMap,
  songMapCacheKey,
  songMapRemoteKey,
  storedSongMap,
} = await import('../../shared/music-inference/song-map-record.ts');

const analysis = {
  schemaVersion: 1 as const,
  assetId: 'asset-song',
  sourceRevision: 'rev-song',
  createdAt: 1,
  durationMs: 3_000,
  modelPacks: { rhythm: 'rhythm', semantic: 'semantic' },
  bpm: 120,
  meter: 4,
  beatConfidence: 0.9,
  beatsMs: [0, 500, 1_000, 1_500, 2_000, 2_500],
  downbeatsMs: [0, 2_000],
  sections: [
    { fromMs: 0, toMs: 1_000, role: 'intro-like' as const, energy: 0.3, boundaryConfidence: 0.5 },
    { fromMs: 1_000, toMs: 2_000, role: 'peak' as const, energy: 0.9, boundaryConfidence: 0.5,
      mood: { kind: 'mood' as const, label: 'festive', score: 0.8 } },
    { fromMs: 2_000, toMs: 3_000, role: 'outro-like' as const, energy: 0.4, boundaryConfidence: 0.5 },
  ],
  tags: [],
  embedding: new Array(512).fill(0),
};

const map = buildSongMap({
  analysis,
  transcriptWords: [
    { text: 'la', startMs: 0, endMs: 100 },
    { text: 'noche', startMs: 120, endMs: 300 },
    { text: 'otra', startMs: 1_000, endMs: 1_100 },
    { text: 'la', startMs: 2_000, endMs: 2_100 },
    { text: 'noche', startMs: 2_120, endMs: 2_300 },
  ],
  createdAt: 42,
});
assert.equal(isSongMap(map), true, 'a freshly built map is valid');
assert.equal(map.chorusGroups.length, 1);

// 1. The key is per asset, revision and grouping fingerprint, not per analysis.
assert.deepEqual(JSON.parse(songMapCacheKey('asset-song', 'rev-song')), ['asset-song', 'rev-song', SONG_MAP_ANALYZER_FINGERPRINT]);
assert.notEqual(songMapCacheKey('asset-song', 'rev-song'), songMapCacheKey('asset-song', 'rev-other'));

// 2. Round trip through the project store the server and the browser share.
await saveStoredSongMap(map);
const loaded = await loadStoredSongMap('asset-song', 'rev-song');
assert.ok(loaded);
assert.deepEqual(loaded.lines, map.lines);
assert.deepEqual(loaded.chorusGroups, map.chorusGroups);
assert.equal(loaded.sections[1]!.mood?.label, 'festive');
assert.equal(await loadStoredSongMap('asset-song', 'rev-other'), null, 'a different revision must miss');
assert.equal(await loadStoredSongMap('asset-other', 'rev-song'), null, 'a different asset must miss');

const remoteKey = await songMapRemoteKey(songMapCacheKey('asset-song', 'rev-song'));
assert.ok(remoteKey.startsWith('song-map:'));
const row = await getStoredEntry(remoteKey);
assert.equal(row.found, true);
const record = row.value as { key: string; analyzerFingerprint: string; map: unknown };
assert.equal(record.analyzerFingerprint, SONG_MAP_ANALYZER_FINGERPRINT);
assert.equal(isSongMap(record.map, 'asset-song', 'rev-song'), true);

// 3. A stale fingerprint, a tampered line and a broken chorus group all miss.
await setStoredEntry(remoteKey, { ...record, analyzerFingerprint: 'stale' });
assert.equal(await loadStoredSongMap('asset-song', 'rev-song'), null, 'a stale fingerprint must miss');

await setStoredEntry(remoteKey, {
  ...record,
  map: { ...map, lines: map.lines.map((line, index) => index === 0 ? { ...line, text: ' ' } : line) },
});
assert.equal(await loadStoredSongMap('asset-song', 'rev-song'), null, 'untidy line text must miss');

await setStoredEntry(remoteKey, {
  ...record,
  map: { ...map, lines: map.lines.map((line, index) => index === 0 ? { ...line, sectionIndex: 9 } : line) },
});
assert.equal(await loadStoredSongMap('asset-song', 'rev-song'), null, 'a section index outside the map must miss');

await setStoredEntry(remoteKey, {
  ...record,
  map: { ...map, lines: map.lines.map(({ chorusGroup: _group, ...line }) => line) },
});
assert.equal(await loadStoredSongMap('asset-song', 'rev-song'), null,
  'a line listed in a chorus group must carry its group number');

await assert.rejects(
  saveStoredSongMap({ ...map, schemaVersion: 2 as never }),
  /invalid song map/,
  'invalid maps are never written',
);

// 4. The stored record is the exact tuple the loader validates.
const stored = storedSongMap(map);
assert.equal(stored.key, songMapCacheKey('asset-song', 'rev-song'));
assert.equal(stored.analyzerFingerprint, SONG_MAP_ANALYZER_FINGERPRINT);

console.log('song-map-cache.verify: keyed by revision and grouping fingerprint, stale or tampered records miss');
