// Contract check for apply_ken_burns (Plan 1, Phase 2 / P2-1).
//
// Scope: the tool's wiring, refusals and the undo contract. The motion maths live in
// src/editor/kenBurns.verify.ts; here we prove that the tool targets the right clip,
// commits everything as ONE history entry, and refuses what Ken Burns cannot move.
import assert from 'node:assert';
import { makeDraft } from '../../editor/store';
import { docFromTimeline } from '../../persist/projectStore';
import { historyReduce, type History } from '../../editor/reduce';
import { kenBurnsActions } from '../../editor/kenBurns';
import type { TimelineState } from '../../editor/types';
import type { AgentContext } from '../context';
import { execKenBurnsTool } from './ken-burns-tools';

function timeline(trackLocked = false): TimelineState {
  return {
    fps: 30, width: 1920, height: 1080, selectedId: 'foto',
    tracks: { V1: { kind: 'video', locked: trackLocked } },
    trackOrder: ['V1'],
    items: [
      { id: 'foto', track: 'V1', startFrame: 0, durationInFrames: 90, kind: 'image', name: 'Foto', src: '/m/foto.jpg' },
      { id: 'clima', track: 'V1', startFrame: 90, durationInFrames: 90, kind: 'video', name: 'Toma', src: '/m/toma.mp4' },
      { id: 'corta', track: 'V1', startFrame: 180, durationInFrames: 1, kind: 'image', name: 'Corta', src: '/m/corta.jpg' },
    ],
  };
}

function context(trackLocked = false): { draft: ReturnType<typeof makeDraft>; ctx: AgentContext; state: TimelineState } {
  const state = timeline(trackLocked);
  const draft = makeDraft(docFromTimeline(state));
  return {
    draft,
    state,
    ctx: {
      commands: draft.commands, getState: draft.getState, getDoc: draft.getDoc,
      getCreativeMode: () => null, templates: [], audio: [],
    },
  };
}

interface Result { ok?: boolean; error?: string; itemId?: string; direction?: string; keyframes?: number; note?: string }

// ── 1) The selected still gets the move ───────────────────────────────────────────
{
  const { draft, ctx } = context();
  const result = await execKenBurnsTool('apply_ken_burns', { direction: 'in' }, ctx) as Result;
  assert.strictEqual(result.ok, true, 'the tool answers ok');
  assert.strictEqual(result.itemId, 'foto', 'defaults to the selected clip');
  assert.strictEqual(result.direction, 'in');
  assert.strictEqual(result.keyframes, 2, 'two scale keyframes');
  const after = draft.getState().items.find((item) => item.id === 'foto')!;
  assert.deepEqual(after.keyframes?.scale?.map((k) => k.value), [1, 1.12], 'the values reached the reducer');
}

// ── 1b) The batch is one history entry: a single undo restores the document ──────
{
  const initial = docFromTimeline(timeline());
  const plan = kenBurnsActions({ itemId: 'foto', durationInFrames: 90, direction: 'in' })!;
  let history: History = { past: [], present: initial, future: [] };
  history = historyReduce(history, { type: 'batch', actions: plan.actions, label: 'Ken Burns' });
  assert.equal(history.past.length, 1, 'the whole move is one past state');
  const timelineOf = (doc: { timelines: { id: string; items: { id: string; keyframes?: unknown }[] }[]; activeTimelineId: string }) => doc.timelines.find((entry) => entry.id === doc.activeTimelineId)!;
  const moved = timelineOf(history.present).items.find((item) => item.id === 'foto')!;
  assert.equal((moved.keyframes as { scale?: unknown[] } | undefined)?.scale?.length, 2, 'the batch applied the keyframes');
  history = historyReduce(history, { type: 'undo' });
  const undone = timelineOf(history.present).items.find((item) => item.id === 'foto')!;
  assert.strictEqual(undone.keyframes, undefined, 'one undo removes the whole move');
}

// ── 2) An explicit itemId wins over the selection ─────────────────────────────────
{
  const { draft, ctx } = context();
  const result = await execKenBurnsTool('apply_ken_burns', { itemId: 'foto', direction: 'left' }, ctx) as Result;
  assert.strictEqual(result.ok, true);
  assert.strictEqual((draft.getState().items[0]!.keyframes?.x?.length ?? 0), 2, 'the pan wrote x');
}

// ── 3) Refusals: missing clip, non-image, locked track, short clip, bad direction ─
{
  const { ctx } = context();
  assert.match(String((await execKenBurnsTool('apply_ken_burns', { itemId: 'nope' }, ctx) as Result).error), /itemId/i, 'unknown id explains how to target');
  assert.match(String((await execKenBurnsTool('apply_ken_burns', { itemId: 'clima' }, ctx) as Result).error), /fotos/i, 'video is refused');
  assert.match(String((await execKenBurnsTool('apply_ken_burns', { itemId: 'corta' }, ctx) as Result).error), /no hay recorrido/i, '1 frame has no travel');
  assert.match(String((await execKenBurnsTool('apply_ken_burns', { direction: 'diagonal' }, ctx) as Result).error), /Dirección desconocida/, 'unknown direction is named');
  assert.ok((await execKenBurnsTool('apply_ken_burns_extra', {}, ctx) as Result).error, 'unknown tool name errors');
}
{
  const { draft, ctx } = context(true);
  assert.match(String((await execKenBurnsTool('apply_ken_burns', {}, ctx) as Result).error), /bloqueada/i, 'locked track is refused');
  assert.strictEqual(draft.getState().items[0]!.keyframes, undefined, 'nothing is written on a locked track');
}

// ── 4) Random is stable per seed and reports the chosen move ──────────────────────
{
  const first = await execKenBurnsTool('apply_ken_burns', { direction: 'random', seed: 7 }, context().ctx) as Result;
  assert.strictEqual(first.ok, true);
  const picked = first.direction;
  const again = await execKenBurnsTool('apply_ken_burns', { direction: 'random', seed: 7 }, context().ctx) as Result;
  assert.strictEqual(again.direction, picked, 'the same seed picks the same direction');
}

console.log('ken-burns-tools.verify: ok');
