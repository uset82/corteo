// Timeline timecode display mode: elapsed, or countdown to the timeline end.
//
// The toolbar timecode span is painted imperatively by the playhead painter, so
// the mode lives in a tiny module store instead of React state: the painter
// reads getTimeDisplayMode() on every paint, and toggling repaints immediately.
// The choice is persisted per browser.
import { useSyncExternalStore } from 'react';
import { fmt } from './timelineUtil';

export type TimeDisplayMode = 'elapsed' | 'countdown';

const STORAGE_KEY = 'cc.timeDisplayMode';
const subscribers = new Set<() => void>();

function readStored(): TimeDisplayMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'countdown' ? 'countdown' : 'elapsed';
  } catch {
    return 'elapsed';
  }
}

let mode: TimeDisplayMode = readStored();

export function getTimeDisplayMode(): TimeDisplayMode {
  return mode;
}

export function setTimeDisplayMode(next: TimeDisplayMode): void {
  if (next === mode) return;
  mode = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
  for (const notify of subscribers) notify();
}

/** Flip the mode and return the new one, so callers can repaint immediately. */
export function toggleTimeDisplayMode(): TimeDisplayMode {
  setTimeDisplayMode(mode === 'elapsed' ? 'countdown' : 'elapsed');
  return mode;
}

export function subscribeTimeDisplayMode(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => { subscribers.delete(onChange); };
}

/**
 * Toolbar timecode text. Countdown counts down to the timeline end and carries a
 * leading minus while time remains; at or past the end it reads 00:00.00.
 */
export function formatTimecode(
  frame: number,
  total: number,
  fps: number,
  displayMode: TimeDisplayMode = mode,
): string {
  const safeTotal = Math.max(0, Math.round(total));
  const clamped = Math.max(0, Math.min(Math.round(frame), safeTotal));
  const totalText = fmt(safeTotal, fps);
  if (displayMode === 'countdown') {
    const remaining = safeTotal - clamped;
    return `${remaining > 0 ? '-' : ''}${fmt(remaining, fps)} / ${totalText}`;
  }
  return `${fmt(clamped, fps)} / ${totalText}`;
}

/** Subscribe a component to mode changes (toolbar label and tooltip). */
export function useTimeDisplayMode(): TimeDisplayMode {
  return useSyncExternalStore(subscribeTimeDisplayMode, getTimeDisplayMode, getTimeDisplayMode);
}
