import { sequenceReferenceError, type SequenceGraphError, type SequenceGraphErrorCode } from '../editor/sequenceGraph';
import { timelineDuration, type ProjectDoc } from '../editor/types';

export interface SequenceLibraryOption {
  id: string;
  name: string;
  durationInFrames: number;
  disabledReason?: string;
  /** Set when the option is disabled; LibraryPanel turns it into a translated title. */
  disabledReasonCode?: SequenceGraphErrorCode;
  disabledReasonParams?: Record<string, string | number>;
}

function reasonParams(error: SequenceGraphError): Record<string, string | number> {
  switch (error.code) {
    case 'SEQUENCE_TIMELINE_MISSING':
      return { id: error.referencedTimelineId ?? error.timelineId ?? '—' };
    case 'SEQUENCE_FPS_MISMATCH':
      return {
        parent: error.timelineId ?? '—',
        parentFps: error.parentFps ?? '—',
        child: error.referencedTimelineId ?? '—',
        childFps: error.childFps ?? '—',
      };
    case 'SEQUENCE_CYCLE':
      return { path: error.path.join(' -> ') };
    case 'SEQUENCE_DEPTH_LIMIT':
    case 'SEQUENCE_NODE_LIMIT':
      return { limit: error.limit ?? '—' };
    case 'SEQUENCE_DUPLICATE_TIMELINE_ID':
      return { id: error.timelineId ?? '—' };
  }
}

/** List presentation needs duration and edge validation, not an expanded render plan. */
export function sequenceLibraryOptions(doc: Pick<ProjectDoc, 'timelines' | 'activeTimelineId'>): SequenceLibraryOption[] {
  return [...doc.timelines].sort((a, b) => a.order - b.order).map((timeline) => {
    const error = sequenceReferenceError(doc, doc.activeTimelineId, timeline.id);
    return {
      id: timeline.id,
      name: timeline.name,
      durationInFrames: Math.max(1, timelineDuration(timeline)),
      disabledReason: error?.message,
      disabledReasonCode: error?.code,
      disabledReasonParams: error ? reasonParams(error) : undefined,
    };
  });
}
