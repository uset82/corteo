// P4-2: render fresh 480p H.264 previews of every sequence in a variant group.
// The files live under the profile's variant-previews directory and are served
// by /api/variant-previews, so the comparison grid can play them without
// downloading the masters. Rendering uses the same Remotion pipeline and export
// permit as a normal export; the project is never modified.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectDoc, Timeline } from '../src/editor/types.ts';
import { resolveTimelineRenderPlan } from '../src/editor/sequenceGraph.ts';
import { findVariantGroup } from '../src/agent/tools/variant-tools.ts';
import { serverScaledExportDimensions } from '../src/export/mediaSettings.ts';
import { ffmpegBin } from './media-binaries.ts';
import { runtimeProfile } from './runtime-profile.ts';
import { withExportPermit } from './plugins/export-runtime.ts';
import { h264RenderOptions } from './plugins/export-rendering.ts';

// @ts-expect-error - the plain .mjs render pipeline has no .d.ts.
import { renderTimeline as realRenderTimeline } from '../remotion/render.mjs';

export interface VariantPreview {
  timelineId: string;
  name: string;
  label: string;
  note: string;
  status: string;
  active: boolean;
  url: string;
  path: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  bytes: number;
}

export interface VariantPreviewManifest {
  ok: true;
  groupId: string;
  generatedAt: number;
  previews: VariantPreview[];
}

type RenderFn = (options: Record<string, unknown>) => Promise<unknown>;

export interface VariantPreviewOptions {
  rootDir?: string;
  signal?: AbortSignal;
  /** Test seam; the server passes the real Remotion renderer. */
  render?: RenderFn;
}

export interface ParsedVariantPreviewRequest {
  project: ProjectDoc;
  selector: { groupId?: string; timelineId?: string };
}

const PREVIEW_ID = /^[A-Za-z0-9_-]{1,120}$/;
const PREVIEW_DIR = 'variant-previews';
const MANIFEST = 'manifest.json';

export function variantPreviewRoot(rootDir: string = runtimeProfile().rootDir): string {
  return join(rootDir, PREVIEW_DIR);
}

function previewId(value: string, label: string): string {
  if (!PREVIEW_ID.test(value)) throw new Error(`invalid ${label}`);
  return value;
}

export function variantPreviewPath(groupId: string, timelineId: string, rootDir?: string): string {
  return join(variantPreviewRoot(rootDir), previewId(groupId, 'groupId'), `${previewId(timelineId, 'timelineId')}.mp4`);
}

export function variantPreviewUrl(groupId: string, timelineId: string): string {
  return `/api/variant-previews/${encodeURIComponent(groupId)}/${encodeURIComponent(timelineId)}.mp4`;
}

function previewValue(value: unknown): value is VariantPreview {
  const preview = value as Partial<VariantPreview>;
  return !!preview && typeof preview.timelineId === 'string'
    && typeof preview.url === 'string' && typeof preview.path === 'string'
    && typeof preview.label === 'string' && typeof preview.status === 'string';
}

export async function readVariantPreviewManifest(
  groupId: string,
  rootDir?: string,
): Promise<VariantPreviewManifest | null> {
  if (!PREVIEW_ID.test(groupId)) return null;
  try {
    const raw = await readFile(join(variantPreviewRoot(rootDir), groupId, MANIFEST), 'utf8');
    const parsed = JSON.parse(raw) as VariantPreviewManifest;
    return parsed.ok === true && parsed.groupId === groupId && Array.isArray(parsed.previews)
      && parsed.previews.every(previewValue)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function readVariantPreviewFile(
  groupId: string,
  timelineId: string,
  rootDir?: string,
): Promise<{ data: Buffer; path: string } | null> {
  try {
    const path = variantPreviewPath(groupId, timelineId, rootDir);
    return { data: await readFile(path), path };
  } catch {
    return null;
  }
}

function renderOptions(timeline: Timeline): { width: number; height: number; scale: number; bitrate: number } {
  const dims = serverScaledExportDimensions(timeline, '480p');
  if (!dims.representable) {
    throw new Error(`480p cannot be rendered exactly for ${timeline.name} (${timeline.width}x${timeline.height})`);
  }
  const bitrate = Math.min(2_500_000, Math.max(800_000, Math.round(dims.width * dims.height * timeline.fps * 0.12)));
  return { width: dims.width, height: dims.height, scale: dims.scale, bitrate };
}

export async function renderVariantPreviews(
  project: ProjectDoc,
  selector: { groupId?: unknown; timelineId?: unknown },
  options: VariantPreviewOptions = {},
): Promise<VariantPreviewManifest> {
  const group = findVariantGroup(project, selector);
  if ('error' in group) throw new Error(group.error);
  const rootDir = options.rootDir ?? runtimeProfile().rootDir;
  const groupDir = join(variantPreviewRoot(rootDir), group.groupId);
  await mkdir(groupDir, { recursive: true });
  const render = options.render ?? (realRenderTimeline as unknown as RenderFn);
  const staged: Array<{ temp: string; final: string }> = [];
  let completed = false;
  try {
    await withExportPermit(async () => {
      for (const timeline of group.timelines) {
        options.signal?.throwIfAborted();
        const dims = renderOptions(timeline);
        const final = variantPreviewPath(group.groupId, timeline.id, rootDir);
        const temp = join(groupDir, `.${timeline.id}.${randomUUID()}.tmp.mp4`);
        await render({
          state: timeline,
          project,
          timelineId: timeline.id,
          outputLocation: temp,
          codec: 'h264',
          scale: dims.scale,
          videoBitrate: dims.bitrate,
          ffmpegBinary: ffmpegBin(),
          ...await h264RenderOptions('h264'),
          signal: options.signal,
        });
        staged.push({ temp, final });
      }
    }, options.signal);
    options.signal?.throwIfAborted();
    for (const entry of staged) await rename(entry.temp, entry.final);
    const previews: VariantPreview[] = [];
    for (const timeline of group.timelines) {
      const path = variantPreviewPath(group.groupId, timeline.id, rootDir);
      const info = await stat(path);
      const dims = renderOptions(timeline);
      previews.push({
        timelineId: timeline.id,
        name: timeline.name,
        label: timeline.variant?.label ?? timeline.name,
        note: timeline.variant?.note ?? '',
        status: timeline.variant?.status ?? 'borrador',
        active: timeline.id === project.activeTimelineId,
        url: variantPreviewUrl(group.groupId, timeline.id),
        path,
        width: dims.width,
        height: dims.height,
        fps: timeline.fps,
        durationInFrames: resolveTimelineRenderPlan(project, timeline.id).durationInFrames,
        bytes: info.size,
      });
    }
    const manifest: VariantPreviewManifest = {
      ok: true,
      groupId: group.groupId,
      generatedAt: Date.now(),
      previews,
    };
    const manifestPath = join(groupDir, MANIFEST);
    const tempManifest = `${manifestPath}.${randomUUID()}.tmp`;
    await writeFile(tempManifest, JSON.stringify(manifest), 'utf8');
    await rename(tempManifest, manifestPath);
    completed = true;
    return manifest;
  } finally {
    if (!completed) await Promise.all(staged.map((entry) => unlink(entry.temp).catch(() => undefined)));
  }
}

/** The browser tool posts the whole project; the route renders from that exact graph. */
export function parseVariantPreviewRequest(value: unknown): ParsedVariantPreviewRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body must be a JSON object');
  const input = value as Record<string, unknown>;
  const project = input.project as Partial<ProjectDoc> | undefined;
  if (!project || typeof project !== 'object' || !Array.isArray(project.timelines)
    || typeof project.activeTimelineId !== 'string') {
    throw new Error('project must be a ProjectDoc');
  }
  const groupId = typeof input.groupId === 'string' && input.groupId.trim() ? input.groupId.trim() : undefined;
  const timelineId = typeof input.timelineId === 'string' && input.timelineId.trim() ? input.timelineId.trim() : undefined;
  return { project: project as ProjectDoc, selector: { ...(groupId ? { groupId } : {}), ...(timelineId ? { timelineId } : {}) } };
}
