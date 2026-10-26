// Runnable check: `npx tsx src/agent/tools/music-reactions-tools.verify.ts`.
// Plan 2 › L-09: the three music-reaction tools through the public executor —
// read-only plan, songMapRef staleness, one batch per apply/clear, locked tracks,
// metadata round-trip and the policy/routing registration.
import assert from 'node:assert/strict';
import { MUSIC_MODEL_PACK_FINGERPRINTS } from '../../audio/intelligence/analysis';
import { saveMusicAnalysis } from '../../audio/intelligence/store';
import type { MusicAnalysis } from '../../audio/intelligence/types';
import { reduce, type Action } from '../../editor/reduce';
import { MAX_REACTION_KEYFRAMES_PER_CLIP, MUSIC_REACTIONS } from '../../editor/musicReactions';
import type { TimelineItem, TimelineState } from '../../editor/types';
import type { AgentContext } from '../context';
import { ASK_MODE_TOOL_SCHEMAS } from '../ask-mode-tools';
import { policyForTool } from '../execution-policy';
import {
  isExternalDraftTool,
  isExternalReadTool,
  isExternalRealTool,
  isExternalServerDirectTool,
} from '../external-tool-policy';
import { ToolActivation } from '../tool-activation';
import { TOOL_SCHEMAS } from '../tools';
import { MUSIC_INTELLIGENCE_TOOL_SCHEMAS } from './schemas/music-intelligence-tools';
import { execMusicIntelligenceTool } from './music-intelligence-tools';
import { MUSIC_REACTION_TOOL_NAMES, musicSongMapRef } from './music-reactions-tools';

const item = (
  id: string,
  kind: TimelineItem['kind'],
  track: string,
  startFrame: number,
  durationInFrames: number,
  patch: Partial<TimelineItem> = {},
): TimelineItem => ({ id, kind, track, startFrame, durationInFrames, name: id, ...patch });

const music = item('music', 'audio', 'A1', 0, 600, { src: '/m/song.wav', sourceAssetId: 'asset_music' });
const video = item('video', 'video', 'V1', 0, 600, { src: '/m/a.mp4', sourceAssetId: 'asset_a' });
const assets = [
  { id: 'asset_music', name: 'Canción', kind: 'audio', src: '/m/song.wav', durationInFrames: 600, sourceRevision: 'sha256:music' },
  { id: 'asset_a', name: 'A', kind: 'video', src: '/m/a.mp4', durationInFrames: 600, sourceRevision: 'sha256:a' },
];

const analysis: MusicAnalysis = {
  schemaVersion: 1,
  assetId: 'asset_music',
  sourceRevision: 'sha256:music',
  createdAt: 1,
  durationMs: 60_000,
  modelPacks: { ...MUSIC_MODEL_PACK_FINGERPRINTS },
  bpm: 120,
  meter: 4,
  beatConfidence: 0.9,
  beatsMs: [4_000, 6_000],
  downbeatsMs: [4_000],
  sections: [{ fromMs: 0, toMs: 60_000, role: 'build', energy: 0.5, boundaryConfidence: 0.9 }],
  tags: [{ kind: 'mood', label: 'energetic', score: 0.9 }],
  embedding: Array.from({ length: 512 }, (_, index) => (index === 0 ? 1 : 0)),
};
await saveMusicAnalysis(analysis);

const stateWith = (items: TimelineItem[], lockedVideo = false): TimelineState => ({
  fps: 30,
  width: 1920,
  height: 1080,
  selectedId: null,
  items,
  tracks: {
    A1: { kind: 'audio' },
    V1: { kind: 'video', ...(lockedVideo ? { locked: true } : {}) },
    V2: { kind: 'video' },
  },
  trackOrder: ['A1', 'V1', 'V2'],
});

type Batch = { actions: Action[]; label?: string };

const makeCtx = (state: TimelineState) => {
  const batches: Batch[] = [];
  const ctx = {
    getState: () => state,
    getDoc: () => ({ schemaVersion: 7, assets }),
    commands: { batch: (actions: Action[], label?: string) => { batches.push({ actions, label }); } },
  } as unknown as AgentContext;
  return { ctx, batches };
};

const run = (name: string, args: Record<string, unknown>, ctx: AgentContext) =>
  execMusicIntelligenceTool(name, args, ctx) as Promise<Record<string, unknown>>;

const freshState = stateWith([music, video]);
const expectedRef = await musicSongMapRef(assets[0] as never);

// ── 1) music_reaction_plan is read-only and returns the current songMapRef ────
{
  const { ctx, batches } = makeCtx(freshState);
  const plan = await run('music_reaction_plan', { itemId: 'music', reaction: 'pulso' }, ctx);
  assert.equal(plan.ok, true);
  assert.equal(plan.reaction, 'pulso');
  assert.equal(plan.timing, 'beats');
  assert.equal(plan.songMapRef, expectedRef);
  assert.match(expectedRef, /^song-map:[0-9a-f]+$/, 'songMapRef is the deterministic song-map remote key');
  assert.equal(plan.keyframeCap, MAX_REACTION_KEYFRAMES_PER_CLIP);
  assert.equal(plan.targetCount, 1);
  assert.equal(plan.keyframeCount, 6);
  assert.equal(plan.truncated, false);
  const targets = plan.targets as Array<{ itemId: string; props: string[]; samples: unknown[] }>;
  assert.equal(targets[0]!.itemId, 'video');
  assert.deepEqual(targets[0]!.props, ['scale']);
  assert.ok(targets[0]!.samples.length > 0, 'the plan shows sample frames without writing anything');
  assert.equal('reactions' in targets[0]!, false, 'the compact plan never ships full metadata');
  assert.equal(JSON.stringify(plan).includes('embedding'), false, 'the plan never exposes CLAP embeddings');
  assert.equal(batches.length, 0, 'a reaction plan must not touch the timeline');
}

// ── 2) apply needs the exact songMapRef, then writes one batch ────────────────
{
  const { ctx, batches } = makeCtx(freshState);
  const missing = await run('apply_music_reaction', { itemId: 'music', reaction: 'pulso' }, ctx);
  assert.equal(missing.missingSongMapRef, true);
  assert.equal(missing.currentSongMapRef, expectedRef);
  assert.equal(batches.length, 0, 'a missing ref must reject before mutation');

  const stale = await run('apply_music_reaction', {
    itemId: 'music', reaction: 'pulso', songMapRef: 'song-map:stale',
  }, ctx);
  assert.equal(stale.staleSongMapRef, true);
  assert.equal(stale.currentSongMapRef, expectedRef);
  assert.equal(batches.length, 0, 'a stale ref must reject before mutation');

  const applied = await run('apply_music_reaction', {
    itemId: 'music', reaction: 'pulso', songMapRef: expectedRef,
  }, ctx);
  assert.equal(applied.ok, true);
  assert.equal(applied.changed, true);
  assert.equal(applied.keyframeCount, 6);
  assert.equal(applied.targetCount, 1);
  assert.match(String(applied.note), /un solo paso de deshacer/);
  assert.equal(batches.length, 1, 'one apply is one EditorCommands batch');
  assert.equal(batches[0]!.label, 'Reacción musical: pulso');
  const actions = batches[0]!.actions;
  assert.equal(actions.length, 8);
  assert.deepEqual(actions[0], { type: 'clearKeyframes', id: 'video', prop: 'scale' });
  assert.equal(actions.at(-1)?.type, 'setMusicReactions');

  const appliedState = actions.reduce(reduce, freshState);
  const clip = appliedState.items.find((candidate) => candidate.id === 'video')!;
  assert.deepEqual(clip.musicReactions?.map((entry) => entry.reaction), ['pulso']);
  assert.equal(clip.keyframes?.scale?.length, 6, 'the batch survives the real reducer');

  // A second apply replaces the same reaction instead of stacking metadata.
  const { ctx: second, batches: secondBatches } = makeCtx(appliedState);
  const again = await run('apply_music_reaction', {
    itemId: 'music', reaction: 'pulso', songMapRef: expectedRef, intensity: 1,
  }, second);
  assert.equal(again.changed, true);
  const twice = secondBatches[0]!.actions.reduce(reduce, appliedState);
  const twiceClip = twice.items.find((candidate) => candidate.id === 'video')!;
  assert.equal(twiceClip.musicReactions?.length, 1, 're-applying must not duplicate the metadata');
  assert.equal(twiceClip.musicReactions?.[0]?.intensity, 1);
  assert.equal(twiceClip.keyframes?.scale?.length, 6, 'the old curve is cleared and rewritten');
}

// ── 3) Locked tracks and empty ranges answer without mutating ────────────────
{
  const { ctx, batches } = makeCtx(stateWith([music, video], true));
  const locked = await run('apply_music_reaction', {
    itemId: 'music', reaction: 'pulso', songMapRef: expectedRef,
  }, ctx);
  assert.equal(locked.changed, false);
  assert.deepEqual(locked.lockedTargetIds, ['video']);
  assert.match(String(locked.reason), /locked/);
  assert.equal(batches.length, 0);

  const late = stateWith([music, item('late', 'video', 'V1', 2_000, 600)]);
  const { ctx: lateCtx, batches: lateBatches } = makeCtx(late);
  const empty = await run('apply_music_reaction', {
    itemId: 'music', reaction: 'pulso', songMapRef: expectedRef,
  }, lateCtx);
  assert.equal(empty.changed, false);
  assert.match(String(empty.reason), /no beats or sections/);
  assert.equal(lateBatches.length, 0);
}

// ── 4) clear removes the reaction in one batch and can target one reaction ────
{
  const { ctx, batches } = makeCtx(freshState);
  await run('apply_music_reaction', { itemId: 'music', reaction: 'pulso', songMapRef: expectedRef }, ctx);
  const appliedState = batches[0]!.actions.reduce(reduce, freshState);

  const { ctx: clearCtx, batches: clearBatches } = makeCtx(appliedState);
  const stale = await run('clear_music_reaction', {
    itemId: 'music', songMapRef: 'song-map:old',
  }, clearCtx);
  assert.equal(stale.staleSongMapRef, true);
  assert.equal(clearBatches.length, 0, 'a stale clear ref must reject');

  const cleared = await run('clear_music_reaction', { itemId: 'music' }, clearCtx);
  assert.equal(cleared.changed, true);
  assert.deepEqual(cleared.clearedProps, ['scale']);
  assert.match(String(cleared.note), /un solo paso de deshacer/);
  assert.equal(clearBatches.length, 1);
  assert.deepEqual(clearBatches[0]!.actions.map((action) => action.type), ['clearKeyframes', 'setMusicReactions']);
  assert.equal(clearBatches[0]!.label, 'Quitar reacciones musicales');
  const emptied = clearBatches[0]!.actions.reduce(reduce, appliedState);
  const clip = emptied.items.find((candidate) => candidate.id === 'video')!;
  assert.equal(clip.musicReactions, undefined);
  assert.equal(clip.keyframes, undefined);

  const { ctx: emptyCtx, batches: emptyBatches } = makeCtx(emptied);
  const none = await run('clear_music_reaction', { itemId: 'music' }, emptyCtx);
  assert.equal(none.changed, false);
  assert.match(String(none.reason), /no music reactions/);
  assert.equal(emptyBatches.length, 0, 'a no-op clear must not batch');

  const plan = await run('music_reaction_plan', { itemId: 'music', reaction: 'destello' }, clearCtx);
  const appliedFlash = (await run('apply_music_reaction', {
    itemId: 'music', reaction: 'destello', songMapRef: plan.songMapRef,
  }, clearCtx) as { changed?: boolean }).changed;
  assert.equal(appliedFlash, true);
  const flashState = clearBatches[1]!.actions.reduce(reduce, appliedState);
  const { ctx: partialCtx, batches: partialBatches } = makeCtx(flashState);
  const partial = await run('clear_music_reaction', { itemId: 'music', reaction: 'pulso' }, partialCtx);
  assert.equal(partial.changed, true);
  assert.deepEqual(partial.clearedProps, ['scale'], 'only the cleared reaction props go away');
  const flashKept = partialBatches[0]!.actions.reduce(reduce, flashState).items
    .find((candidate) => candidate.id === 'video')!;
  assert.deepEqual(flashKept.musicReactions?.map((entry) => entry.reaction), ['destello']);
  assert.equal(flashKept.keyframes?.brightness?.length, 4, 'the surviving flash keeps its curve');
  const absent = await run('clear_music_reaction', { itemId: 'music', reaction: 'temblor' }, partialCtx);
  assert.equal(absent.changed, false, 'clearing an absent reaction leaves the clip alone');
  assert.equal(partialBatches.length, 1);
}

// ── 5) Argument errors stay actionable ───────────────────────────────────────
{
  const { ctx, batches } = makeCtx(freshState);
  const badReaction = await run('apply_music_reaction', {
    itemId: 'music', reaction: 'vibrar', songMapRef: expectedRef,
  }, ctx);
  assert.match(String(badReaction.error), /reaction must be one of/);
  const badTiming = await run('music_reaction_plan', { itemId: 'music', reaction: 'pulso', timing: 'bars' }, ctx);
  assert.match(String(badTiming.error), /timing must be one of/);
  const noItem = await run('music_reaction_plan', { assetId: 'asset_music', reaction: 'pulso' }, ctx);
  assert.match(String(noItem.error), /itemId is required/);

  const twoVideos = stateWith([music, video, item('video-2', 'video', 'V2', 0, 600)]);
  const { ctx: twoCtx } = makeCtx(twoVideos);
  const ambiguous = await run('music_reaction_plan', {
    itemId: 'music', reaction: 'pulso', targetItemIds: ['vid'],
  }, twoCtx);
  assert.match(String(ambiguous.error), /ambiguous/);
  const prefixed = await run('music_reaction_plan', {
    itemId: 'music', reaction: 'pulso', targetItemIds: ['video-2'],
  }, twoCtx);
  assert.equal(prefixed.targetCount, 1);
  assert.equal((prefixed.targets as Array<{ itemId: string }>)[0]!.itemId, 'video-2');
  assert.equal(batches.length, 0);
}

// ── 6) Registration: schemas, policies, Q&A mode and routing ─────────────────
{
  assert.deepEqual([...MUSIC_REACTION_TOOL_NAMES].sort(), [
    'apply_music_reaction', 'clear_music_reaction', 'music_reaction_plan',
  ]);
  const byName = new Map(MUSIC_INTELLIGENCE_TOOL_SCHEMAS.map((schema) => [schema.name, schema]));
  const catalog = new Set(TOOL_SCHEMAS.map((schema) => schema.name));
  for (const name of MUSIC_REACTION_TOOL_NAMES) {
    assert.ok(byName.has(name), `${name} must be in the music-intelligence schema group`);
    assert.ok(catalog.has(name), `${name} must be in the master tool catalog`);
  }
  const applySchema = byName.get('apply_music_reaction')!;
  assert.deepEqual(applySchema.input_schema.required, ['itemId', 'reaction', 'songMapRef']);
  const applyProps = applySchema.input_schema.properties as Record<string, { enum?: string[] }>;
  assert.deepEqual(applyProps.reaction!.enum, [...MUSIC_REACTIONS]);
  assert.deepEqual(byName.get('clear_music_reaction')!.input_schema.required, ['itemId']);
  assert.deepEqual(byName.get('music_reaction_plan')!.input_schema.required, ['itemId', 'reaction']);

  assert.deepEqual(policyForTool('music_reaction_plan'), { effect: 'read', recovery: 'pure' });
  assert.deepEqual(policyForTool('apply_music_reaction'), { effect: 'reversible_edit', recovery: 'idempotent' });
  assert.deepEqual(policyForTool('clear_music_reaction'), { effect: 'reversible_edit', recovery: 'idempotent' });
  assert.equal(isExternalReadTool('music_reaction_plan'), true);
  assert.equal(isExternalDraftTool('apply_music_reaction'), true);
  assert.equal(isExternalServerDirectTool('music_reaction_plan'), true);
  assert.equal(isExternalServerDirectTool('apply_music_reaction'), true);
  assert.equal(isExternalServerDirectTool('clear_music_reaction'), true);
  assert.equal(isExternalRealTool('apply_music_reaction'), false, 'reactions run inside the draft, no approval gate');

  const ask = ASK_MODE_TOOL_SCHEMAS.map((schema) => schema.name);
  assert.ok(ask.includes('music_reaction_plan'), 'Q&A can preview a reaction');
  assert.equal(ask.includes('apply_music_reaction'), false, 'Q&A must not receive the mutating tool');
  assert.equal(ask.includes('clear_music_reaction'), false);

  const routed = new ToolActivation(TOOL_SCHEMAS, [{ role: 'user', content: '根据音乐节拍给画面加动感' }]).names();
  assert.ok(routed.includes('music_reaction_plan'));
  assert.ok(routed.includes('apply_music_reaction'));
  assert.ok(routed.includes('clear_music_reaction'));
}

console.log('music-reactions-tools.verify: ok');
