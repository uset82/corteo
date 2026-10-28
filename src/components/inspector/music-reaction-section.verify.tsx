import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AgentContext } from '../../agent/context';
import type { MusicAnalysis } from '../../audio/intelligence/types';
import type { Action } from '../../editor/reduce';
import type { TimelineItem, TimelineState } from '../../editor/types';
import { ensureLocaleDict, setLocale, t } from '../../i18n/locale';
import { applyMusicReaction, MusicReactionView } from './MusicReactionSection';

await ensureLocaleDict('es');
setLocale('es');
const audio: TimelineItem = { id: 'music', kind: 'audio', track: 'A1', startFrame: 0, durationInFrames: 600, name: 'music', src: '/song.wav', sourceAssetId: 'song' };
const visual: TimelineItem = { id: 'video', kind: 'video', track: 'V1', startFrame: 0, durationInFrames: 600, name: 'video' };
const asset = { id: 'song', kind: 'audio' as const, name: 'Canción', src: '/song.wav', durationInFrames: 600, sourceRevision: 'sha256:song' };
const analysis: MusicAnalysis = {
  schemaVersion: 1, assetId: 'song', sourceRevision: 'sha256:song', createdAt: 1, durationMs: 20000,
  modelPacks: { rhythm: 'fixture', semantic: 'fixture' }, bpm: 120, meter: 4, beatConfidence: 0.9,
  beatsMs: [2000, 4000], downbeatsMs: [2000], sections: [{ fromMs: 0, toMs: 20000, role: 'build', energy: 0.7, boundaryConfidence: 0.9 }], tags: [], embedding: [],
};
const noop = () => undefined;
const props = { hasAudio: true, analysis, reaction: 'pulso' as const, timing: 'beats' as const, intensity: 60, busy: false,
  translate: t, onReaction: noop, onTiming: noop, onIntensity: noop, onApply: noop, onClear: noop };
const markup = renderToStaticMarkup(<MusicReactionView {...props} />);
for (const label of ['Reaccionar a la música', 'Pulso', 'Golpe', 'Temblor', 'Destello', 'Respirar', 'Ken Burns al ritmo', 'Pulsos', 'Compases', 'Acentos', 'Caídas', 'Secciones', 'Energía', 'Intensidad', 'Aplicar', 'Quitar']) assert.ok(markup.includes(label), label);
assert.match(markup, /type="range"[^>]*value="60"/);
assert.match(markup, /aria-label="Energía musical"/);
assert.doesNotMatch(markup, /disabled=""/);
const noAnalysis = renderToStaticMarkup(<MusicReactionView {...props} analysis={null} />);
assert.match(noAnalysis, /Analiza la canción primero/);
assert.equal((noAnalysis.match(/disabled=""/g) ?? []).length, 2);
const noAudio = renderToStaticMarkup(<MusicReactionView {...props} hasAudio={false} analysis={null} />);
assert.match(noAudio, /No hay canción en la línea de tiempo/);
assert.equal((noAudio.match(/disabled=""/g) ?? []).length, 2);

const state: TimelineState = { fps: 30, width: 1920, height: 1080, selectedId: 'video', items: [audio, visual], tracks: { A1: { kind: 'audio' }, V1: { kind: 'video' } }, trackOrder: ['A1', 'V1'] };
const batches: Action[][] = [];
const ctx = { getState: () => state, getDoc: () => ({ assets: [asset] }), commands: { batch: (actions: Action[]) => batches.push(actions) } } as unknown as AgentContext;
const result = await applyMusicReaction(ctx, 'music', ['video'], 'pulso', 'beats', 0.6, {
  loadAnalysis: async () => analysis, unavailableAnalysis: async () => ({ error: 'missing' }),
});
assert.equal(result.ok, true);
assert.equal(result.changed, true);
assert.equal(batches.length, 1, 'one apply must produce one undo batch');
assert.ok(batches[0].some((action) => action.type === 'setMusicReactions'));
console.log('music-reaction-section.verify: Spanish controls and one-batch apply passed');
