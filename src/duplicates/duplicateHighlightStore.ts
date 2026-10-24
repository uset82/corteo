// Timeline highlight for the duplicate-shot detector (Phase 3.4).
//
// The scan runs inside a modal, but the yellow outline should survive closing
// it, so the id set lives outside React and every TrackLane subscribes.
import { useSyncExternalStore } from 'react';

let duplicateIds: ReadonlySet<string> = new Set();
const subscribers = new Set<() => void>();

export function getDuplicateIds(): ReadonlySet<string> {
  return duplicateIds;
}

export function setDuplicateIds(ids: Iterable<string>): void {
  const next = new Set(ids);
  if (next.size === duplicateIds.size && [...next].every((id) => duplicateIds.has(id))) return;
  duplicateIds = next;
  subscribers.forEach((notify) => notify());
}

export function clearDuplicateIds(): void {
  setDuplicateIds([]);
}

export function useDuplicateIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => { subscribers.delete(onChange); };
    },
    getDuplicateIds,
    getDuplicateIds,
  );
}
