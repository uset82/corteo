// Pointer gestures owned by the timeline surface itself, in Premiere's tool
// vocabulary: hand = drag to pan, zoom = click to zoom (Alt = zoom out), text =
// click a video track to drop a title at that frame.
//
// The listeners are captured on the scroller so they run before the React
// pointer machine — clips and the playhead never see the gesture.
import { useEffect, useRef, type RefObject } from 'react';
import { trackKind, type TrackId } from '../../editor/types';
import type { TimelineState } from '../../editor/types';
import type { EditorCommands } from '../../editor/store';
import { HEADER_W, RULER_H } from './timelineUtil';

interface ToolModeOptions {
  editMode: string;
  state: TimelineState;
  commands: EditorCommands;
  scrollRef: RefObject<HTMLDivElement | null>;
  innerRef: RefObject<HTMLDivElement | null>;
  seekTo: (clientX: number) => void;
  zoomBy: (factor: number) => void;
  frameFromClientX: (clientX: number) => number;
  trackFromClientY: (clientY: number) => TrackId | null;
}

/** Attach the hand/zoom/text gestures for as long as one of those tools is active. */
export function useTimelineToolModes({
  editMode, state, commands, scrollRef, innerRef, seekTo, zoomBy, frameFromClientX, trackFromClientY,
}: ToolModeOptions): void {
  const handPanRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || (editMode !== 'hand' && editMode !== 'zoom' && editMode !== 'text')) return;
    el.style.cursor = editMode === 'hand' ? 'grab' : editMode === 'zoom' ? 'zoom-in' : 'text';
    const inTrackArea = (event: PointerEvent) => {
      const rect = innerRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return event.clientY - rect.top >= RULER_H && event.clientX - rect.left >= HEADER_W;
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (editMode === 'hand') {
        handPanRef.current = {
          pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          left: el.scrollLeft, top: el.scrollTop,
        };
        el.setPointerCapture?.(event.pointerId);
        el.style.cursor = 'grabbing';
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!inTrackArea(event)) return;
      if (editMode === 'zoom') {
        seekTo(event.clientX);
        zoomBy(event.altKey ? 1 / 1.4 : 1.4);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const track = trackFromClientY(event.clientY);
      if (!track || trackKind(state, track) !== 'video' || state.tracks?.[track]?.locked) return;
      const id = commands.addTextClip({ track, startFrame: frameFromClientX(event.clientX) });
      commands.selectItem(id);
      event.preventDefault();
      event.stopPropagation();
    };
    const onMove = (event: PointerEvent) => {
      const pan = handPanRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      el.scrollLeft = pan.left - (event.clientX - pan.x);
      el.scrollTop = pan.top - (event.clientY - pan.y);
      event.preventDefault();
      event.stopPropagation();
    };
    const onUp = (event: PointerEvent) => {
      if (!handPanRef.current || handPanRef.current.pointerId !== event.pointerId) return;
      handPanRef.current = null;
      el.releasePointerCapture?.(event.pointerId);
      el.style.cursor = editMode === 'hand' ? 'grab' : el.style.cursor;
    };
    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointermove', onMove, true);
    el.addEventListener('pointerup', onUp, true);
    el.addEventListener('pointercancel', onUp, true);
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointermove', onMove, true);
      el.removeEventListener('pointerup', onUp, true);
      el.removeEventListener('pointercancel', onUp, true);
      el.style.cursor = '';
      handPanRef.current = null;
    };
  }, [editMode, zoomBy, seekTo, frameFromClientX, trackFromClientY, commands, state, scrollRef, innerRef]);
}
