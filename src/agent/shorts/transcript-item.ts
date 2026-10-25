import type { TimelineItem } from '../../editor/types';
import { hasOperationalTranscript } from '../../transcript/types';

/**
 * The clip the score is computed on: the transcribed video/audio item with the most words,
 * or the one the caller named. Video wins ties because a talking head carries the picture
 * as well as the words.
 */
export function pickTranscribedItem(
  items: readonly TimelineItem[],
  itemId?: string,
): TimelineItem | null {
  if (itemId) {
    const hit = items.find(
      (it) => (it.id === itemId || it.id.startsWith(itemId))
        && (it.kind === 'video' || it.kind === 'audio')
        && hasOperationalTranscript(it),
    );
    if (hit) return hit;
  }
  const scored = items
    .filter((it) => (it.kind === 'video' || it.kind === 'audio') && hasOperationalTranscript(it))
    .map((it) => ({ it, score: it.transcript!.length + (it.kind === 'video' ? 100000 : 0) }));
  if (!scored.length) return null;
  return scored.reduce((best, cur) => (cur.score > best.score ? cur : best)).it;
}
