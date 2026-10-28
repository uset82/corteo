import type { ProjectDoc, Timeline } from '../editor/types';
import { materializeTimelineExport } from './materializeBlobMedia';
import { submitRenderJob } from './renderJobClient';

/** 480p is enough to judge a cut in the compare grid; the master export stays full-res. */
export const VARIANT_PREVIEW_RESOLUTION = '480p';

export function variantPreviewName(timeline: Timeline): string {
  const label = timeline.variant?.label;
  return label ? `${timeline.name} · ${label}` : timeline.name;
}

/** The render body for one version: its own frozen snapshot, never the active sequence. */
export async function variantPreviewBody(project: ProjectDoc, timeline: Timeline): Promise<Record<string, unknown>> {
  const snapshot = await materializeTimelineExport(project, timeline.id);
  return {
    state: snapshot.state,
    project: snapshot.project,
    timelineId: snapshot.timelineId,
    format: 'video',
    codec: 'h264',
    resolution: VARIANT_PREVIEW_RESOLUTION,
    name: variantPreviewName(timeline),
  };
}

export interface VariantPreviewJob {
  timelineId: string;
  label: string;
  renderId: string;
}

/** One 480p job for one version; the agent tool and the compare dialog share it. */
export async function submitVariantPreviewJob(project: ProjectDoc, timeline: Timeline): Promise<VariantPreviewJob> {
  const renderId = await submitRenderJob(await variantPreviewBody(project, timeline));
  return { timelineId: timeline.id, label: timeline.variant?.label ?? timeline.name, renderId };
}
