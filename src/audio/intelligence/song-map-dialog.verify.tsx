import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ensureLocaleDict, setLocale } from '../../i18n/locale';
import type { MusicAnalysis } from './types';
import { SongMapButton, SongMapDialog } from './SongMapDialog';

await ensureLocaleDict('es');
setLocale('es');
const analysis: MusicAnalysis = {
  schemaVersion: 1, assetId: 'song', sourceRevision: 'test', createdAt: 0, durationMs: 60000,
  modelPacks: { rhythm: 'test', semantic: 'test' }, bpm: 120, meter: 4, beatConfidence: 0.9,
  beatsMs: [1000, 3000], downbeatsMs: [1000], tags: [], embedding: [],
  sections: [
    { fromMs: 0, toMs: 30000, role: 'intro-like', energy: 0.3, boundaryConfidence: 1, mood: { kind: 'mood', label: 'calm', score: 0.9 } },
    { fromMs: 30000, toMs: 60000, role: 'peak', energy: 0.8, boundaryConfidence: 1, mood: { kind: 'mood', label: 'energetic', score: 0.9 } },
  ],
};
const relay = { provider: 'test', model: 'test', status: 'sin verificar' as const, audioTokens: 0, promptTokens: 0, completionTokens: 0, cached: false, note: 'Una voz suave' };
const html = renderToStaticMarkup(<SongMapDialog analysis={analysis} onClose={() => undefined}
  tonalKey={{ tonic: 'A', mode: 'minor', confidence: 0.9 }}
  lyrics={[{ text: 'Una luz', startMs: 1000, endMs: 2000 }]} relay={relay} />);
for (const text of ['Mapa de la canción', '120 BPM', '4/4', 'Tonalidad', 'menor', 'intro', 'serena', 'clímax', 'enérgica', '30%', '80%', '0:00–0:30', '0:30–1:00', 'Una luz', 'Sin verificar']) assert.ok(html.includes(text), text);
assert.equal((html.match(/<li>/g) ?? []).length, 2);
assert.match(html, /<svg/);
assert.match(html, /<polyline/);
assert.equal(renderToStaticMarkup(<SongMapButton analysis={null} onOpen={() => undefined} />), '');
assert.match(renderToStaticMarkup(<SongMapButton analysis={analysis} onOpen={() => undefined} />), /Mapa de la canción/);
const verified = renderToStaticMarkup(<SongMapDialog analysis={analysis} onClose={() => undefined} relay={{ ...relay, audioTokens: 8, status: 'verificado' }} />);
assert.match(verified, /Escuchado de verdad/);
console.log('song-map-dialog.verify: Spanish sections, map and optional listening evidence passed');
