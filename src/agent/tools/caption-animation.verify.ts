import assert from 'node:assert/strict';
import { makeDraft } from '../../editor/store';
import { docFromTimeline } from '../../persist/projectStore';
import type { AgentContext } from '../context';
import { __resetCaptionPresetMemory } from '../../captions/presetStore';
import { MUSIC_MODEL_PACK_FINGERPRINTS } from '../../audio/intelligence/analysis';
import { saveMusicAnalysis } from '../../audio/intelligence/store';
import type { MusicAnalysis } from '../../audio/intelligence/types';
import { CAPTIONS_TOOL_SCHEMAS } from './schemas/captions-tools';
import { execCaptionsTool } from './captions-tools';

const draft = makeDraft(docFromTimeline({
  fps: 30,
  width: 1_920,
  height: 1_080,
  selectedId: null,
  assets: [],
  items: [],
  trackOrder: ['C1'],
  tracks: { C1: { kind: 'caption' } },
  captions: { enabled: true, template: 'plain', pacing: 'phrase' },
}));
const ctx: AgentContext = {
  commands: draft.commands,
  getState: draft.getState,
  getDoc: draft.getDoc,
  getCreativeMode: () => null,
  templates: [],
  audio: [],
};

const schema = CAPTIONS_TOOL_SCHEMAS.find((tool) => tool.name === 'edit_captions')!;
const actionSchema = schema.input_schema.properties?.action as { enum?: string[] };
const motionSchema = schema.input_schema.properties?.motionPreset as { enum?: string[] };
assert.ok(actionSchema.enum?.includes('animation'));
assert.deepEqual(motionSchema.enum, ['none', 'fade-up', 'pop', 'word-pop', 'karaoke-pulse', 'latido']);

for (const motionPreset of motionSchema.enum?.filter((id) => id !== 'latido') ?? []) {
  const result = await execCaptionsTool('edit_captions', { action: 'animation', motionPreset }, ctx) as {
    ok?: boolean;
    motionPreset?: string;
  };
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.motionPreset, motionPreset);
  assert.equal(draft.getState().captions?.motionPreset, motionPreset);
}

const beforeInvalid = draft.getDoc();
const invalid = await execCaptionsTool(
  'edit_captions',
  { action: 'animation', motionPreset: 'spin-forever' },
  ctx,
) as { error?: string };
assert.match(invalid.error ?? '', /animation needs motionPreset/);
assert.deepEqual(draft.getDoc(), beforeInvalid, 'invalid motion must not mutate the project');

const read = await execCaptionsTool('read_captions', {}, ctx) as { motionPreset?: string };
assert.equal(read.motionPreset, 'karaoke-pulse');

// Plan 2 › L-10: latido stores the timeline beat grid it pulses on, and another
// preset drops it so a stale grid never outlives the motion that used it.
const latido = await execCaptionsTool('edit_captions', {
  action: 'animation',
  motionPreset: 'latido',
  json: { beatsMs: [1_500, 500, 1_000, 1_000, -5, Number.NaN] },
}, ctx) as { ok?: boolean; beats?: number; beatsSource?: string };
assert.equal(latido.ok, true, JSON.stringify(latido));
assert.equal(latido.beats, 3);
assert.equal(latido.beatsSource, 'argument');
assert.deepEqual(draft.getState().captions?.motionBeatsMs, [500, 1_000, 1_500]);
const noSong = await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: 'latido' }, ctx) as { error?: string };
assert.match(noSong.error ?? '', /Latido necesita la canción/);
await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: 'pop' }, ctx);
assert.equal(draft.getState().captions?.motionBeatsMs, undefined, 'another preset drops the grid');

__resetCaptionPresetMemory();
await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: 'pop' }, ctx);
const saved = await execCaptionsTool(
  'edit_captions',
  { action: 'preset_save', presetName: 'motion look' },
  ctx,
) as { presetId?: string };
assert.ok(saved.presetId);
await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: 'none' }, ctx);
await execCaptionsTool('edit_captions', { action: 'preset_apply', presetId: saved.presetId }, ctx);
assert.equal(draft.getState().captions?.motionPreset, 'pop', 'saved caption looks include motion');

// Plan 2 › L-10: over the tool, latido resolves its grid from the cached song
// analysis (memory store here, SQLite/IndexedDB in the editor) and a saved look
// re-resolves it on apply instead of freezing the old grid.
const songAnalysis: MusicAnalysis = {
  schemaVersion: 1,
  assetId: 'asset_song',
  sourceRevision: 'sha256:cap',
  createdAt: 1,
  durationMs: 10_000,
  modelPacks: { ...MUSIC_MODEL_PACK_FINGERPRINTS },
  bpm: 120,
  meter: 4,
  beatConfidence: 0.9,
  beatsMs: [1_000, 2_000, 9_000],
  downbeatsMs: [1_000],
  sections: [{ fromMs: 0, toMs: 10_000, role: 'steady', energy: 0.6, boundaryConfidence: 0.9 }],
  tags: [{ kind: 'mood', label: 'calm', score: 0.8 }],
  embedding: Array.from({ length: 512 }, (_, index) => (index === 0 ? 1 : 0)),
};
await saveMusicAnalysis(songAnalysis);
const songDraft = makeDraft(docFromTimeline({
  fps: 30,
  width: 1_920,
  height: 1_080,
  selectedId: null,
  assets: [{
    id: 'asset_song', name: 'Song', kind: 'audio', src: '/m/song.wav',
    durationInFrames: 300, sourceRevision: 'sha256:cap',
  }],
  items: [{
    id: 'song', kind: 'audio', track: 'A1', name: 'song', startFrame: 0,
    durationInFrames: 300, src: '/m/song.wav', srcInFrame: 0, playbackRate: 1, sourceAssetId: 'asset_song',
  }],
  trackOrder: ['A1', 'C1'],
  tracks: { A1: { kind: 'audio' }, C1: { kind: 'caption' } },
  captions: { enabled: true, template: 'plain', pacing: 'phrase', sourceItemId: 'song' },
}));
const songCtx: AgentContext = {
  commands: songDraft.commands,
  getState: songDraft.getState,
  getDoc: songDraft.getDoc,
  getCreativeMode: () => null,
  templates: [],
  audio: [],
};
const resolved = await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: 'latido' }, songCtx) as {
  ok?: boolean; beats?: number; bpm?: number; itemId?: string; beatsSource?: string;
};
assert.equal(resolved.ok, true, JSON.stringify(resolved));
assert.equal(resolved.beats, 3);
assert.equal(resolved.bpm, 120);
assert.equal(resolved.itemId, 'song');
assert.equal(resolved.beatsSource, 'analysis');
assert.deepEqual(songDraft.getState().captions?.motionBeatsMs, [1_000, 2_000, 9_000]);
const latidoLook = await execCaptionsTool('edit_captions', { action: 'preset_save', presetName: 'latido look' }, songCtx) as { presetId?: string };
await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: 'none' }, songCtx);
assert.equal(songDraft.getState().captions?.motionBeatsMs, undefined);
await execCaptionsTool('edit_captions', { action: 'preset_apply', presetId: latidoLook.presetId }, songCtx);
assert.equal(songDraft.getState().captions?.motionPreset, 'latido');
assert.deepEqual(songDraft.getState().captions?.motionBeatsMs, [1_000, 2_000, 9_000], 'applying the look re-resolves the grid');

console.log('caption-animation.verify: Agent motion action and preset persistence passed');
