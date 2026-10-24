// Lane drop routing: which drag payload wins, and what it does to the track.
//
// The handlers were lifted out of TrackLane verbatim; these cases pin the
// precedence (external files > pool asset > library payload) and the two
// rejection gates (locked lane, payload incompatible with the lane kind), so a
// future edit cannot silently reorder them.
import assert from 'node:assert/strict';
import type { MediaAsset, TimelineItem, TimelineState } from '../../editor/types';
import { laneDragHandlers } from './laneDrop';

type DropEvent = Parameters<ReturnType<typeof laneDragHandlers>['onDrop']>[0];
type DragOverEvent = Parameters<ReturnType<typeof laneDragHandlers>['onDragOver']>[0];

const LIBRARY_MIME = 'application/x-openchatcut-library';
const MEDIA_MIME = 'application/x-openchatcut-media-asset';
const MEDIA_VIDEO_MIME = 'application/x-openchatcut-media-video';
const MEDIA_AUDIO_MIME = 'application/x-openchatcut-media-audio';

const videoAsset: MediaAsset = {
  id: 'asset_video',
  name: 'B-roll',
  kind: 'video',
  src: '/media/uploads/b-roll.mp4',
  durationInFrames: 120,
  sourceRevision: 'rev-video',
};
const audioAsset: MediaAsset = { ...videoAsset, id: 'asset_audio', name: 'Bed', kind: 'audio', src: '/media/uploads/bed.wav' };
const clip: TimelineItem = {
  id: 'clip_1',
  track: 'V1',
  startFrame: 0,
  durationInFrames: 90,
  name: 'B-roll',
  kind: 'video',
  src: videoAsset.src,
};
const state: TimelineState = {
  fps: 30,
  width: 1920,
  height: 1080,
  items: [clip],
  assets: [videoAsset, audioAsset],
  selectedId: null,
  tracks: { V1: { kind: 'video' } },
  trackOrder: ['V1'],
};

interface FakeDragOptions {
  types?: string[];
  data?: Record<string, string>;
  files?: Array<{ name: string; type: string }>;
  clientX?: number;
}

/** Minimal DragEvent stand-in: only the surface the handlers actually read. */
function fakeDrag({ types = [], data = {}, files = [], clientX = 0 }: FakeDragOptions = {}) {
  const calls = { preventDefault: 0, stopPropagation: 0 };
  const event = {
    clientX,
    dataTransfer: {
      types,
      files,
      dropEffect: 'none',
      getData: (mime: string) => data[mime] ?? '',
    },
    preventDefault: () => { calls.preventDefault += 1; },
    stopPropagation: () => { calls.stopPropagation += 1; },
  };
  return { event, calls };
}

interface Harness {
  handlers: ReturnType<typeof laneDragHandlers>;
  dropTarget: () => string | null;
  dropped: Array<{ files: unknown[]; trackId: string; startFrame: number }>;
  added: Array<{ assetId: string; track: string; startFrame: number; ripple: boolean; overwrite: boolean }>;
  appliedToClip: Array<{ kind: string; id: string; itemId: string }>;
  appliedToTrack: Array<{ kind: string; id: string; trackId: string; startFrame: number }>;
}

function harness(overrides: {
  locked?: boolean;
  laneKind?: 'video' | 'audio';
  items?: readonly TimelineItem[];
} = {}): Harness {
  let dropTarget: string | null = null;
  const dropped: Harness['dropped'] = [];
  const added: Harness['added'] = [];
  const appliedToClip: Harness['appliedToClip'] = [];
  const appliedToTrack: Harness['appliedToTrack'] = [];
  const items = overrides.items ?? state.items;
  const handlers = laneDragHandlers({
    state,
    commands: {
      addMediaItem: (asset: MediaAsset, options: { track: string; startFrame: number; ripple: boolean; overwrite: boolean }) => {
        added.push({ assetId: asset.id, ...options });
      },
    } as unknown as Parameters<typeof laneDragHandlers>[0]['commands'],
    trackId: 'V1' as Parameters<typeof laneDragHandlers>[0]['trackId'],
    laneKind: overrides.laneKind ?? 'video',
    locked: overrides.locked ?? false,
    items,
    rippleOnDrop: true,
    overwriteOnDrop: false,
    setLibDropTarget: (value) => { dropTarget = typeof value === 'function' ? value(dropTarget) : value; },
    frameFromClientX: () => 45,
    onDropExternalFiles: (files, trackId, startFrame) => { dropped.push({ files, trackId, startFrame }); },
    applyLibraryToClip: (payload, item) => { appliedToClip.push({ kind: payload.kind, id: payload.id, itemId: item.id }); return true; },
    applyLibraryToTrack: (payload, trackId, startFrame) => { appliedToTrack.push({ kind: payload.kind, id: payload.id, trackId, startFrame }); return true; },
  });
  return { handlers, dropTarget: () => dropTarget, dropped, added, appliedToClip, appliedToTrack };
}

// --- drag-over gate -------------------------------------------------------
{
  const h = harness();
  const { event, calls } = fakeDrag();
  h.handlers.onDragOver(event as unknown as DragOverEvent);
  assert.equal(calls.preventDefault, 0, 'an unrelated drag must not be accepted');
  assert.equal(h.dropTarget(), null);
}
{
  const h = harness();
  const { event, calls } = fakeDrag({ types: [LIBRARY_MIME] });
  h.handlers.onDragOver(event as unknown as DragOverEvent);
  assert.equal(calls.preventDefault, 1, 'a library drag is accepted');
  assert.equal(event.dataTransfer.dropEffect, 'copy');
  assert.equal(h.dropTarget(), 'track:V1', 'the lane highlights itself');
}
{
  const h = harness({ laneKind: 'video' });
  const { event, calls } = fakeDrag({ types: [MEDIA_VIDEO_MIME] });
  h.handlers.onDragOver(event as unknown as DragOverEvent);
  assert.equal(calls.preventDefault, 1, 'a video asset is accepted on a video lane');
}
{
  const h = harness({ laneKind: 'video' });
  const { event, calls } = fakeDrag({ types: [MEDIA_AUDIO_MIME] });
  h.handlers.onDragOver(event as unknown as DragOverEvent);
  assert.equal(calls.preventDefault, 0, 'an audio asset must not be accepted on a video lane');
}
{
  const h = harness();
  const { event, calls } = fakeDrag({ types: ['Files'], files: [{ name: 'a.mp4', type: 'video/mp4' }] });
  h.handlers.onDragOver(event as unknown as DragOverEvent);
  assert.equal(calls.preventDefault, 1, 'Finder files are accepted');
}
{
  const h = harness({ locked: true });
  const { event, calls } = fakeDrag({ types: [LIBRARY_MIME] });
  h.handlers.onDragOver(event as unknown as DragOverEvent);
  assert.equal(calls.preventDefault, 0, 'a locked lane accepts nothing');
  assert.equal(h.dropTarget(), null);
}

// --- drag-leave only clears its own lane ----------------------------------
{
  const h = harness();
  h.handlers.onDragOver(fakeDrag({ types: [LIBRARY_MIME] }).event as unknown as DragOverEvent);
  assert.equal(h.dropTarget(), 'track:V1');
  h.handlers.onDragLeave();
  assert.equal(h.dropTarget(), null);
}

// --- drop precedence: external files beat everything ----------------------
{
  const h = harness();
  const { event, calls } = fakeDrag({
    types: ['Files', LIBRARY_MIME],
    files: [{ name: 'a.mp4', type: 'video/mp4' }],
    data: { [LIBRARY_MIME]: JSON.stringify({ v: 1, kind: 'fx', id: 'fx_glow' }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.dropped.length, 1, 'files win over a library payload in the same drop');
  assert.equal(h.dropped[0]!.trackId, 'V1');
  assert.equal(h.dropped[0]!.startFrame, 45, 'the drop lands at the pointer frame');
  assert.equal(h.appliedToClip.length + h.appliedToTrack.length, 0);
  assert.equal(calls.stopPropagation, 1);
  assert.equal(h.dropTarget(), null, 'the highlight clears on drop');
}
{
  const h = harness({ locked: true });
  const { event } = fakeDrag({ types: ['Files'], files: [{ name: 'a.mp4', type: 'video/mp4' }] });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.dropped.length, 0, 'a locked lane drops no files');
  assert.equal(h.dropTarget(), null);
}

// --- pool asset: added to the lane, gated by kind -------------------------
{
  const h = harness();
  const { event } = fakeDrag({
    types: [MEDIA_VIDEO_MIME],
    data: { [MEDIA_MIME]: JSON.stringify({ v: 1, assetId: 'asset_video' }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.deepEqual(h.added, [{ assetId: 'asset_video', track: 'V1', startFrame: 45, ripple: true, overwrite: false }]);
  assert.equal(h.appliedToTrack.length, 0, 'a pool asset is not routed as a library payload');
}
{
  const h = harness({ laneKind: 'video' });
  const { event } = fakeDrag({
    types: [MEDIA_AUDIO_MIME],
    data: { [MEDIA_MIME]: JSON.stringify({ v: 1, assetId: 'asset_audio' }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.added.length, 0, 'an audio asset cannot land on a video lane');
}

// --- library payload: clip-scoped kinds hit the clip under the cursor -----
for (const kind of ['fx', 'lut', 'zoom', 'transition']) {
  const h = harness();
  const { event } = fakeDrag({
    types: [LIBRARY_MIME],
    data: { [LIBRARY_MIME]: JSON.stringify({ v: 1, kind, id: `${kind}_1` }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.appliedToClip.length, 1, `${kind} prefers the clip under the cursor`);
  assert.equal(h.appliedToClip[0]!.itemId, 'clip_1');
  assert.equal(h.appliedToTrack.length, 0);
}
for (const kind of ['sound', 'template', 'music']) {
  const h = harness();
  const { event } = fakeDrag({
    types: [LIBRARY_MIME],
    data: { [LIBRARY_MIME]: JSON.stringify({ v: 1, kind, id: `${kind}_1` }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.appliedToTrack.length, 1, `${kind} lands on the track, not a clip`);
  assert.equal(h.appliedToTrack[0]!.trackId, 'V1');
  assert.equal(h.appliedToTrack[0]!.startFrame, 45);
  assert.equal(h.appliedToClip.length, 0);
}
{
  // No clip under the cursor: a clip-scoped kind has to fall back to the track.
  const h = harness({ items: [{ ...clip, startFrame: 500, durationInFrames: 90 }] });
  const { event } = fakeDrag({
    types: [LIBRARY_MIME],
    data: { [LIBRARY_MIME]: JSON.stringify({ v: 1, kind: 'fx', id: 'fx_glow' }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.appliedToClip.length, 0, 'nothing to attach the effect to');
  assert.equal(h.appliedToTrack.length, 1, 'so it lands on the track instead');
}
{
  const h = harness({ locked: true });
  const { event } = fakeDrag({
    types: [LIBRARY_MIME],
    data: { [LIBRARY_MIME]: JSON.stringify({ v: 1, kind: 'fx', id: 'fx_glow' }) },
  });
  h.handlers.onDrop(event as unknown as DropEvent);
  assert.equal(h.appliedToClip.length + h.appliedToTrack.length, 0, 'a locked lane applies nothing');
}

console.log('laneDrop.verify: drop precedence, lane-kind gates and clip-vs-track routing');
