import { randomUUID } from 'node:crypto';
import { rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { CliError, UsageError } from './errors.ts';
import { writeStderr } from './output.ts';
import { readProjectDoc, resolveProject } from './store.ts';
import { resolveH264TargetBitrate } from '../server/media-acceleration.ts';
import { ffmpegBin } from '../server/media-binaries.ts';
import { acceptExportSubmission } from '../server/plugins/export-submission.ts';
import { h264RenderOptions, renderTimeline, setUploadsDirProvider } from '../server/plugins/export-rendering.ts';
import { uploadDir } from '../server/media-dir.ts';
import { exportOutputSize, retimeFps, withExportPermit } from '../server/plugins/export-runtime.ts';

export interface RenderFileOptions {
  projectId: string;
  output: string;
  timelineId?: string;
  format?: 'video' | 'audio';
  codec?: 'h264' | 'h265' | 'vp8' | 'prores' | 'mp3' | 'wav';
  resolution?: '480p' | '720p' | '1080p' | '4k';
  fps?: number;
  bitrate?: number;
  fromFrame?: number;
  endFrameExclusive?: number;
  toAudio?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
}

export async function renderProjectToFile(options: RenderFileOptions) {
  setUploadsDirProvider(uploadDir);
  const project = await resolveProject(options.projectId);
  const doc = await readProjectDoc(project.id);
  const timelineId = options.timelineId ?? doc.activeTimelineId;
  const timeline = doc.timelines.find((candidate) => candidate.id === timelineId);
  if (!timeline) {
    throw new CliError(`Project ${project.name} has no timeline ${timelineId}.\n${
      doc.timelines.map((candidate) => `  ${candidate.id}  ${candidate.name}`).join('\n')}`);
  }
  let audioEnd: number | undefined;
  if (options.toAudio && options.endFrameExclusive === undefined) {
    const ends = timeline.items.filter((item) => item.kind === 'audio')
      .map((item) => item.startFrame + item.durationInFrames);
    if (ends.length === 0) throw new UsageError('render --to-audio needs an audio clip on the timeline');
    audioEnd = Math.max(...ends);
  }
  const submission = await acceptExportSubmission({
    state: { ...timeline, assets: doc.assets },
    project: doc,
    timelineId: timeline.id,
    format: options.format ?? 'video',
    ...(options.codec === undefined ? {} : { codec: options.codec }),
    ...(options.resolution === undefined ? {} : { resolution: options.resolution }),
    ...(options.fps === undefined ? {} : { fps: options.fps }),
    ...(options.bitrate === undefined ? {} : { videoBitrate: options.bitrate }),
    ...(options.fromFrame === undefined ? {} : { startFrame: options.fromFrame }),
    ...((options.endFrameExclusive ?? audioEnd) === undefined ? {} : { endFrameExclusive: options.endFrameExclusive ?? audioEnd }),
  });
  const plan = submission.plan;
  const common = {
    projectId: project.id, timelineId: timeline.id, output: options.output,
    codec: plan.media.codec, frames: plan.totalFrames, durationSeconds: plan.durationSeconds,
    dryRun: options.dryRun ?? false, scale: plan.scale, frameRange: plan.frameRange ?? null,
    extension: plan.media.ext, filename: plan.filename,
  };
  if (options.dryRun) {
    await submission.cleanup();
    return { ...common, bytes: 0 };
  }
  const extension = plan.media.ext;
  const partial = join(dirname(options.output), `${basename(options.output, `.${extension}`)}.partial-${randomUUID()}.${extension}`);
  try {
    await withExportPermit(async () => {
      await renderTimeline({
        state: plan.state, project: plan.project, timelineId: plan.timelineId,
        outputLocation: partial, codec: plan.media.codec, frameRange: plan.frameRange,
        scale: plan.scale, videoBitrate: plan.videoBitrate, ffmpegBinary: ffmpegBin(),
        ...await h264RenderOptions(plan.media.codec),
        ...(options.quiet ? {} : { onProgress: (progress: number) => {
          writeStderr(`rendering ${Math.round(progress * 100)}%`);
        } }),
      });
      if (plan.retimeFps !== undefined) {
        const outputSize = exportOutputSize(plan.state, plan.scale);
        const retimed = `${partial}.retimed.${extension}`;
        await retimeFps(partial, retimed, plan.retimeFps, plan.media.codec as 'h264' | 'vp8',
          plan.videoBitrate ?? resolveH264TargetBitrate({ ...outputSize, fps: plan.retimeFps }), undefined);
        await unlink(partial).catch(() => {});
        await rename(retimed, partial);
      }
    });
    await rename(partial, options.output);
  } catch (error) {
    await unlink(partial).catch(() => {});
    throw error;
  } finally {
    await submission.cleanup();
  }
  return { ...common, bytes: (await stat(options.output)).size };
}
