// Lane-level drag & drop: external files, pool assets and library payloads
// (fx / lut / zoom / transition) all land on a track lane. Kept apart from the
// clip pointer machine in TrackLane so the lane body stays readable.
import type { DragEvent } from 'react';
import type { EditorCommands } from '../../editor/store';
import type { TimelineItem, TimelineState, TrackId } from '../../editor/types';
import type { LibraryDragPayload } from '../../library/drag';
import { hasLibraryDrag, parseLibraryDrag } from '../../library/drag';
import { canDropMediaAsset, hasCompatibleMediaDrag, parseMediaAssetDrag } from '../../media/drag';
import { droppedFiles, hasExternalFiles } from '../../media/externalFileDrop';

type LaneKind = Parameters<typeof hasCompatibleMediaDrag>[1];
type DropTargetSetter = (value: string | null | ((current: string | null) => string | null)) => void;

interface LaneDropOptions {
  state: TimelineState;
  commands: EditorCommands;
  trackId: TrackId;
  laneKind: LaneKind;
  locked: boolean;
  items: readonly TimelineItem[];
  rippleOnDrop: boolean;
  overwriteOnDrop: boolean;
  setLibDropTarget: DropTargetSetter;
  frameFromClientX: (clientX: number) => number;
  onDropExternalFiles?: (files: File[], trackId: TrackId, startFrame: number) => void;
  applyLibraryToClip: (payload: LibraryDragPayload, item: TimelineItem) => boolean;
  applyLibraryToTrack: (payload: LibraryDragPayload, trackId: TrackId, startFrame: number) => boolean;
}

/** Drag handlers for one lane: highlight on drag-over, route the drop by payload kind. */
export function laneDragHandlers({
  state, commands, trackId, laneKind, locked, items, rippleOnDrop, overwriteOnDrop,
  setLibDropTarget, frameFromClientX, onDropExternalFiles, applyLibraryToClip, applyLibraryToTrack,
}: LaneDropOptions) {
  return {
    onDragOver: (e: DragEvent) => {
      if (locked || (!hasLibraryDrag(e)
        && !hasCompatibleMediaDrag(e, laneKind)
        && !hasExternalFiles(e.dataTransfer))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setLibDropTarget(`track:${trackId}`);
    },
    onDragLeave: () => setLibDropTarget((t: string | null) => (t === `track:${trackId}` ? null : t)),
    onDrop: (e: DragEvent) => {
      const files = droppedFiles(e.dataTransfer);
      if (files.length) {
        setLibDropTarget(null);
        if (locked || !onDropExternalFiles) return;
        e.preventDefault();
        e.stopPropagation();
        onDropExternalFiles(files, trackId, frameFromClientX(e.clientX));
        return;
      }
      const mediaAssetId = parseMediaAssetDrag(e);
      if (mediaAssetId) {
        setLibDropTarget(null);
        e.preventDefault();
        e.stopPropagation();
        const asset = (state.assets ?? []).find((item) => item.id === mediaAssetId);
        if (!locked && asset && canDropMediaAsset(asset, laneKind)) {
          commands.addMediaItem(asset, {
            track: trackId,
            startFrame: frameFromClientX(e.clientX),
            ripple: rippleOnDrop,
            overwrite: overwriteOnDrop,
          });
        }
        return;
      }
      const payload = parseLibraryDrag(e);
      setLibDropTarget(null);
      if (!payload || locked) return;
      e.preventDefault();
      e.stopPropagation();
      // Prefer the clip under the cursor for clip-scoped payloads.
      const f = frameFromClientX(e.clientX);
      const hit = items.find((it) => f >= it.startFrame && f < it.startFrame + it.durationInFrames);
      if (hit && (payload.kind === 'fx' || payload.kind === 'lut' || payload.kind === 'zoom' || payload.kind === 'transition')) {
        applyLibraryToClip(payload, hit);
        return;
      }
      applyLibraryToTrack(payload, trackId, f);
    },
  };
}
