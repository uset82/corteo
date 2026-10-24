// Runnable check: `npx tsx src/editor/historyLabels.verify.ts`.
//
// The history panel is only useful if each snapshot carries a readable name and
// the labels stay aligned with past/present/future while the user undoes and
// redoes. Both halves are pure data, so they are checked here rather than
// through the UI.
import assert from 'node:assert/strict';
import { historyReduce, type History } from './reduce';
import { actionLabel, historyRows, GENERIC_HISTORY_LABEL } from './historyLabels';
import type { ProjectDoc, TimelineItem } from './types';

const item = (volume: number): TimelineItem => ({
  id: 'a', track: 'A1', startFrame: 0, durationInFrames: 60,
  kind: 'audio', name: 'a', src: '/m/a.wav', volume,
} as TimelineItem);

const docOf = (volume: number): ProjectDoc => ({
  version: 3, assets: [], mediaFolders: [], activeTimelineId: 'tl1',
  timelines: [{
    id: 'tl1', name: 'main', order: 0, fps: 30, width: 1920, height: 1080, selectedId: null,
    tracks: { A1: { kind: 'audio' } }, trackOrder: ['A1'], items: [item(volume)],
  }],
} as unknown as ProjectDoc);

const start = (): History => ({ past: [], present: docOf(1), future: [] });
const setVolume = (h: History, volume: number) => historyReduce(h, { type: 'setVolume', id: 'a', volume });

// ── labels ────────────────────────────────────────────────────────────────
assert.equal(actionLabel({ type: 'setVolume' }), '调整音量');
assert.equal(actionLabel({ type: 'split' }), '分割片段');
assert.equal(actionLabel({ type: 'tl.setFps' }), '修改帧率');
assert.equal(actionLabel({ type: 'select' }), undefined, 'selection is not a step');
assert.equal(actionLabel({ type: 'selectAll' }), undefined);
assert.equal(actionLabel({ type: 'tl.switch' }), undefined, 'switching timelines is navigation');
assert.equal(actionLabel({ type: 'undo' }), undefined);
assert.equal(actionLabel({ type: 'history.beginGesture' }), undefined);
assert.equal(actionLabel({ type: 'someFutureAction' }), GENERIC_HISTORY_LABEL, 'unknown mutating action degrades gracefully');

// A batch is named after its first labelled sub-action, so grouped edits read
// as one step instead of "batch".
assert.equal(actionLabel({ type: 'batch', actions: [{ type: 'select' }, { type: 'setFade' }] }), '调整淡入淡出');
assert.equal(actionLabel({ type: 'batch', actions: [] }), GENERIC_HISTORY_LABEL);

// ── label bookkeeping across push / undo / redo ───────────────────────────
{
  let h = start();
  assert.deepEqual(h.pastLabels, undefined, 'opening history carries no labels');

  h = setVolume(h, 2);
  assert.deepEqual(h.pastLabels, [''], 'the opening state has no producing action');
  assert.equal(h.presentLabel, '调整音量');
  assert.equal(h.past.length, 1);

  h = historyReduce(h, { type: 'setFade', id: 'a', fadeInFrames: 5 });
  assert.deepEqual(h.pastLabels, ['', '调整音量'], 'labels track the snapshot they describe');
  assert.equal(h.presentLabel, '调整淡入淡出');

  // Undo: the state we land on is named by the label of the entry leaving past.
  h = historyReduce(h, { type: 'undo' });
  assert.equal(h.past.length, 1);
  assert.equal(h.presentLabel, '调整音量', 'undo restores that state\'s own label');
  assert.deepEqual(h.futureLabels, ['调整淡入淡出'], 'the undone step becomes the redo label');

  // Undo to the very start: present has no producing action again.
  h = historyReduce(h, { type: 'undo' });
  assert.equal(h.past.length, 0);
  assert.equal(h.presentLabel, undefined);
  assert.deepEqual(h.futureLabels, ['调整音量', '调整淡入淡出'], 'redo order is nearest-first');

  // Redo twice: labels must walk back in the same order.
  h = historyReduce(h, { type: 'redo' });
  assert.equal(h.presentLabel, '调整音量');
  assert.deepEqual(h.pastLabels, ['']);
  assert.deepEqual(h.futureLabels, ['调整淡入淡出']);
  h = historyReduce(h, { type: 'redo' });
  assert.equal(h.presentLabel, '调整淡入淡出');
  assert.deepEqual(h.pastLabels, ['', '调整音量']);
  assert.deepEqual(h.futureLabels, []);
  assert.equal(h.future.length, 0);
}

// A new edit after undo drops the redo branch AND its labels.
{
  let h = start();
  h = setVolume(h, 2);
  h = historyReduce(h, { type: 'undo' });
  assert.equal(h.futureLabels?.length, 1);
  h = setVolume(h, 5);
  assert.deepEqual(h.futureLabels, [], 'branch dropped');
  assert.deepEqual(h.future, []);
  assert.equal(h.presentLabel, '调整音量');
}

// ── panel rows ────────────────────────────────────────────────────────────
{
  const rows = historyRows({ past: ['', '调整音量'], present: '调整淡入淡出', future: ['添加标记'] });
  assert.deepEqual(rows.map((row) => row.state), ['past', 'past', 'present', 'future']);
  assert.deepEqual(rows.map((row) => row.distance), [-2, -1, 0, 1], 'distance is the undo/redo count to that row');
  assert.equal(rows[0]!.label, '', 'opening state renders as unnamed (panel shows "initial state")');
  assert.equal(rows[2]!.label, '调整淡入淡出');

  // A fresh project: one row, the current state, nothing clickable.
  const fresh = historyRows({ past: [], future: [] });
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0]!.distance, 0);
}

// ── the 100-entry cap trims snapshots and labels together ────────────────
{
  let h = start();
  for (let index = 0; index < 105; index += 1) h = setVolume(h, 1 + index / 100);
  assert.equal(h.past.length, 100, 'snapshots are capped');
  assert.equal(h.pastLabels?.length, 100, 'labels are capped identically');
  const rows = historyRows({ past: h.pastLabels ?? [], present: h.presentLabel, future: [] });
  assert.equal(rows.length, 101);
  assert.equal(rows[rows.length - 1]!.distance, 0);
  assert.equal(rows[0]!.distance, -100, 'oldest visible step is 100 undos away');
}

console.log('historyLabels.verify: step naming, undo/redo label alignment and panel rows');
