import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveTimelineRenderPlan, sequenceReferenceError } from '../editor/sequenceGraph';
import type { Timeline } from '../editor/types';
import { sequenceLibraryOptions } from './sequenceOptions';

const root: Timeline = { id: 'root', name: 'root', order: 2, fps: 30, width: 1920, height: 1080, selectedId: null, items: [] };
const child: Timeline = { ...root, id: 'child', name: 'child', order: 1, items: [
  { id: 'audio', name: 'audio', kind: 'audio', src: '/audio.wav', track: 'A1', startFrame: 25, durationInFrames: 120 },
] };
const nested: Timeline = { ...root, id: 'nested', name: 'nested', order: 0, items: [
  { id: 'sequence', name: 'sequence', kind: 'sequence', timelineId: 'child', track: 'V1', startFrame: 5, durationInFrames: 60 },
] };
const doc = { timelines: [root, child, nested], activeTimelineId: root.id, assets: [] };
const actual = sequenceLibraryOptions(doc);
assert.deepEqual(actual.map(({ id, name, durationInFrames, disabledReason }) => ({ id, name, durationInFrames, disabledReason })), [...doc.timelines].sort((a, b) => a.order - b.order).map((timeline) => ({
  id: timeline.id, name: timeline.name,
  durationInFrames: resolveTimelineRenderPlan(doc, timeline.id).durationInFrames,
  disabledReason: sequenceReferenceError(doc, doc.activeTimelineId, timeline.id)?.message,
})));
assert.ok(actual.find((option) => option.id === 'root')?.disabledReason, 'self-cycle remains disabled');
assert.equal(actual.find((option) => option.id === 'root')?.disabledReasonCode, 'SEQUENCE_CYCLE', 'cycle code reaches the translated title');
assert.equal(actual.find((option) => option.id === 'child')?.disabledReasonCode, undefined, 'valid sequence has no error code');
assert.equal(sequenceLibraryOptions({ ...doc, activeTimelineId: 'child' }).find((option) => option.id === 'nested')?.disabledReason,
  sequenceReferenceError(doc, 'child', 'nested')?.message, 'indirect cycle remains disabled');
const mismatchDoc = { ...doc, timelines: [...doc.timelines, { ...child, id: 'mismatch', fps: 24 }] };
const mismatch = sequenceLibraryOptions(mismatchDoc).find((option) => option.id === 'mismatch');
assert.equal(mismatch?.disabledReason, sequenceReferenceError(mismatchDoc, 'root', 'mismatch')?.message);
assert.equal(mismatch?.disabledReasonCode, 'SEQUENCE_FPS_MISMATCH');
assert.deepEqual(mismatch?.disabledReasonParams, { parent: 'root', parentFps: 30, child: 'mismatch', childFps: 24 });
const panel = readFileSync(new URL('./LibraryPanel.tsx', import.meta.url), 'utf8');
assert.match(panel, /useMemo\(\(\) => isSequences \? getSequenceOptions\(\) : \[\], \[isSequences, getSequenceOptions\]\)/,
  'expensive sequence candidates are evaluated only for the visible sequence tab');
assert.match(panel, /title=\{sequenceDisabledTitle\(t, option\)\}/, 'disabled title is translated, not the developer message');
assert.doesNotMatch(readFileSync(new URL('../editor/useEditorSelectionState.ts', import.meta.url), 'utf8'), /resolveTimelineRenderPlan/);
console.log('sequenceOptions.verify: lazy tab gate, duration parity, cycle and FPS disabled reasons passed');
