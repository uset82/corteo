import assert from 'node:assert/strict';
import type { MediaAsset, TimelineState } from '../../editor/types';
import {
  AUTHORED_ADD_KINDS,
  GENERIC_ADD_KINDS,
  validateAuthoredAdd,
  validateGenericAdd,
} from './edit-item-generic';
import { makeDraft } from '../../editor/store';
import { docFromTimeline } from '../../persist/projectStore';

assert.ok(AUTHORED_ADD_KINDS.has('text') && AUTHORED_ADD_KINDS.has('solid'));
assert.ok(!GENERIC_ADD_KINDS.has('text') && !GENERIC_ADD_KINDS.has('solid'));

const state = {
  items: [],
  fps: 30,
  trackOrder: ['V2', 'V1', 'A1'],
  tracks: { V1: { kind: 'video' }, V2: { kind: 'video' }, A1: { kind: 'audio' } },
  width: 1920,
  height: 1080,
  selectedId: null,
} as unknown as TimelineState;

const textPlan = validateAuthoredAdd(state, {
  type: 'text',
  text: '你好世界',
  color: '#ffcc00',
  fontSize: 72,
  align: 'center',
  track: 'V2',
  fromFrame: 30,
  durationInFrames: 120,
});
assert.equal(textPlan.error, undefined, String(textPlan.error));
assert.equal(textPlan.plan, 'addText');
assert.equal(textPlan.text, '你好世界');
assert.equal(textPlan.startFrame, 30);
assert.equal(textPlan.durationInFrames, 120);

const solidPlan = validateAuthoredAdd(state, { type: 'solid', color: '#101010', name: '黑底' });
assert.equal(solidPlan.plan, 'addSolid');
assert.equal(solidPlan.color, '#101010');

assert.ok(validateAuthoredAdd(state, { type: 'text', assetId: 'x', text: 'a' }).error);
assert.equal(validateGenericAdd(state, [] as MediaAsset[], { type: 'text', text: 'via generic' }).plan, 'addText');

// Commit via editor commands (same surface agent commit uses).
const base = docFromTimeline({
  fps: 30, width: 1920, height: 1080, items: [], selectedId: null, assets: [],
  trackOrder: ['V2', 'V1', 'A1'],
  tracks: { V1: { kind: 'video' }, V2: { kind: 'video' }, A1: { kind: 'audio' } },
});
const draft = makeDraft(base);
const itemId = draft.commands.addTextClip({
  track: String(textPlan.track),
  startFrame: Number(textPlan.startFrame),
  durationInFrames: Number(textPlan.durationInFrames),
  text: String(textPlan.text),
  color: String(textPlan.color),
  fontSize: Number(textPlan.fontSize),
  align: 'center',
});
const item = draft.getState().items.find((entry) => entry.id === itemId);
assert.equal(item?.kind, 'text');
assert.equal(item?.props?.text, '你好世界');
assert.equal(item?.props?.color, '#ffcc00');
assert.equal(item?.startFrame, 30);

const solidId = draft.commands.addSolidItem({
  color: String(solidPlan.color),
  name: String(solidPlan.name),
});
assert.equal(draft.getState().items.find((entry) => entry.id === solidId)?.kind, 'solid');

// Text with no track stays at fromFrame on an overlay, not at the end of V1.
const occupied = docFromTimeline({
  fps: 30, width: 1920, height: 1080, items: [{
    id: 'clip', track: 'v1', startFrame: 0, durationInFrames: 600, kind: 'solid', name: 'fondo',
  }], selectedId: null, assets: [],
  trackOrder: ['v1'],
  tracks: { v1: { kind: 'video' } },
});
const overlay = makeDraft(occupied);
const titleId = overlay.commands.addTextClip({ startFrame: 30, text: 'Hola', durationInFrames: 60, position: 'bottom' });
const title = overlay.getState().items.find((entry) => entry.id === titleId);
assert.equal(title?.startFrame, 30, 'fromFrame is kept');
assert.notEqual(title?.track, 'v1', 'text does not land on the clip track');
assert.equal(title?.props?.position, 'bottom');
assert.equal(title?.name, 'Texto');

const audioAsset = {
  id: 'tone', kind: 'audio', name: 'tono', src: '/tmp/tone.wav', durationInFrames: 180,
} as MediaAsset;
const audioPlan = validateGenericAdd(
  { items: [], fps: 30, trackOrder: ['v1'], tracks: { v1: { kind: 'video' } }, width: 1920, height: 1080, selectedId: null } as unknown as TimelineState,
  [audioAsset],
  { type: 'audio', assetId: 'tone', fromFrame: 12 },
);
assert.equal(audioPlan.error, undefined, String(audioPlan.error));
assert.equal(audioPlan.track, undefined, 'missing audio track is created at commit, not rejected');
const audioDraft = makeDraft(docFromTimeline({
  fps: 30, width: 1920, height: 1080, items: [], selectedId: null, assets: [audioAsset],
  trackOrder: ['v1'], tracks: { v1: { kind: 'video' } },
}));
const audioId = audioDraft.commands.addMediaItem(audioAsset, { startFrame: 12 });
const audioItem = audioDraft.getState().items.find((entry) => entry.id === audioId);
assert.equal(audioItem?.kind, 'audio');
assert.equal(audioItem?.startFrame, 12);
assert.equal(
  Object.values(audioDraft.getState().tracks ?? {}).filter((track) => track?.kind === 'audio').length,
  1,
);

console.log('edit-item-authored.verify: ok');
