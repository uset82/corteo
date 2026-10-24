// Source Monitor is opened from the media pool and docked above the Program
// Monitor. A module store keeps the pool and the preview workspace coupled
// without threading another callback through every panel layer.
import { useSyncExternalStore } from 'react';
import type { MediaAsset } from '../editor/types';

let asset: MediaAsset | null = null;
const subscribers = new Set<() => void>();

export function getSourceMonitorAsset(): MediaAsset | null {
  return asset;
}

export function openSourceMonitor(next: MediaAsset): void {
  asset = next;
  subscribers.forEach((notify) => notify());
}

export function closeSourceMonitor(): void {
  if (!asset) return;
  asset = null;
  subscribers.forEach((notify) => notify());
}

export function useSourceMonitorAsset(): MediaAsset | null {
  return useSyncExternalStore(
    (onChange) => { subscribers.add(onChange); return () => { subscribers.delete(onChange); }; },
    getSourceMonitorAsset,
    getSourceMonitorAsset,
  );
}
