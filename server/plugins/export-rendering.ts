import { dirname } from 'node:path';
import { mkdir, rename, unlink } from 'node:fs/promises';
import {
  resolveH264RenderOptions,
  resolveH264TargetBitrate,
  type H264EncoderOutcome,
} from '../media-acceleration.ts';
import { ffmpegBin } from '../media-binaries.ts';
import {
  createExportFailure,
  exportFailureFrom,
  ExportFailureError,
  type ExportCleanupStatus,
  type ExportFailureStage,
} from '../../src/export/exportFailure.ts';
import type { ExportPlan } from './export-plan.ts';
import {
  createRenderProgress,
  encodeTwoPass,
  exportOutputSize,
  finalH264EncoderOutcome,
  removeTwoPassLogs,
  retimeFps,
} from './export-runtime.ts';
import type { UpdateGenerationJob } from './generation-jobs.ts';
import { TWO_PASS_INTERMEDIATE_CRF, type TwoPassCodec } from '../../src/export/twoPass.ts';

// @ts-expect-error — plain .mjs render pipeline has no .d.ts
import * as remotionRender from '../../remotion/render.mjs';

export const {
  currentRenderConcurrency,
  remotionHardwareFfmpegPath,
  renderTimeline,
  renderTimelineStills,
  renderClip,
  setUploadsDirProvider,
} = remotionRender;

export async function cleanupExportOutputs(paths: Array<string | null>): Promise<ExportCleanupStatus> {
  let cleanupStatus: ExportCleanupStatus = 'succeeded';
  await Promise.all(paths.filter((path): path is string => path !== null).map(async (path) => {
    try {
      await unlink(path);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) cleanupStatus = 'failed';
    }
  }));
  return cleanupStatus;
}

export async function h264RenderOptions(codec: string) {
  return codec === 'h264'
    ? resolveH264RenderOptions(ffmpegBin(), remotionHardwareFfmpegPath())
    : {};
}

export async function renderExportPlan(
  plan: ExportPlan,
  filepath: string,
  update: UpdateGenerationJob,
  signal?: AbortSignal,
): Promise<H264EncoderOutcome | undefined> {
  signal?.throwIfAborted();
  // Two-pass renders a high-quality intermediate first and then encodes it
  // twice against the bitrate target. When the fps also changes, the retime
  // filter folds into the two-pass chain instead of running as a third pass.
  const twoPass = plan.twoPass && plan.videoBitrate !== undefined;
  const intermediate = twoPass ? `${filepath}.intermediate.${plan.media.ext}` : null;
  const retimed = !twoPass && plan.retimeFps ? `${filepath}.retimed.${plan.media.ext}` : null;
  const passLogFile = twoPass ? `${filepath}.twopass` : null;
  const renderTarget = intermediate ?? filepath;
  let failureStage: ExportFailureStage = 'render';
  try {
    update({ phase: 'preparing', progress: 4, processedFrames: 0, totalFrames: plan.totalFrames });
    await mkdir(dirname(filepath), { recursive: true });
    signal?.throwIfAborted();
    update({ phase: 'rendering', progress: 8 });
    const rendered = await renderTimeline({
      state: plan.state,
      project: plan.project,
      timelineId: plan.timelineId,
      outputLocation: renderTarget,
      codec: plan.media.codec,
      frameRange: plan.frameRange,
      scale: plan.scale,
      // The intermediate is judged only by the two passes that follow it, so it
      // is rendered at a near-lossless CRF rather than the user's target.
      videoBitrate: twoPass ? undefined : plan.videoBitrate,
      crf: twoPass ? TWO_PASS_INTERMEDIATE_CRF : plan.crf,
      audioBitrate: plan.audioBitrate ? `${plan.audioBitrate}k` : undefined,
      ...await h264RenderOptions(plan.media.codec),
      onProgress: createRenderProgress(update, plan.totalFrames, plan.retimeFps || twoPass ? 84 : 90),
      signal,
    }) as Partial<H264EncoderOutcome>;
    signal?.throwIfAborted();
    let outcome = rendered.encoder ? { encoder: rendered.encoder, ...(rendered.encoderFallbackReason ? { encoderFallbackReason: rendered.encoderFallbackReason } : {}) } : undefined;
    if (twoPass && intermediate && passLogFile && plan.videoBitrate !== undefined) {
      failureStage = 'encode';
      update({ phase: 'finalizing', progress: 93, processedFrames: plan.totalFrames });
      await encodeTwoPass({
        input: intermediate,
        output: filepath,
        codec: plan.media.codec as TwoPassCodec,
        bitrate: plan.videoBitrate,
        passLogFile,
        ...(plan.retimeFps ? { filters: [`fps=${plan.retimeFps}`] } : {}),
        signal,
      });
      signal?.throwIfAborted();
      await unlink(intermediate).catch(() => {});
      await removeTwoPassLogs(passLogFile);
      // The second pass is software x264/x265, so no hardware encoder survives it.
      outcome = undefined;
      signal?.throwIfAborted();
    }
    if (retimed && plan.retimeFps) {
      failureStage = 'encode';
      update({ phase: 'finalizing', progress: 93, processedFrames: plan.totalFrames });
      const outputSize = exportOutputSize(plan.state, plan.scale);
      outcome = finalH264EncoderOutcome(outcome, await retimeFps(
        filepath,
        retimed,
        plan.retimeFps,
        plan.media.codec as 'h264' | 'vp8' | 'h265',
        plan.videoBitrate ?? resolveH264TargetBitrate({ ...outputSize, fps: plan.retimeFps }),
        outputSize,
        signal,
        plan.crf,
      ));
      signal?.throwIfAborted();
      await unlink(filepath).catch(() => {});
      await rename(retimed, filepath);
      signal?.throwIfAborted();
    }
    update({ phase: 'finalizing', progress: 99, processedFrames: plan.totalFrames });
    return outcome;
  } catch (error) {
    const cleanupStatus = await cleanupExportOutputs([filepath, retimed, intermediate]);
    if (passLogFile) await removeTwoPassLogs(passLogFile);
    const existing = exportFailureFrom(error);
    if (existing) {
      throw new ExportFailureError({ ...existing, cleanupStatus, targetPath: filepath });
    }
    const aborted = signal?.aborted === true;
    const timedOut = error instanceof Error && /(?:timed?\s*out|timeout)/i.test(error.message);
    const message = error instanceof Error ? error.message : String(error);
    const oom = /(?:out of memory|heap|insufficient memory|memory)/i.test(message);
    throw new ExportFailureError(createExportFailure({
      stage: aborted ? 'cancel' : timedOut ? 'timeout' : failureStage,
      code: aborted ? 'export_cancelled' : timedOut ? 'export_timeout'
        : failureStage === 'encode' ? 'export_encode_failed' : 'export_render_failed',
      retryable: !aborted && !oom,
      cleanupStatus,
      targetPath: filepath,
      message: oom
        ? '导出时内存不足。请关闭其他程序、缩短导出范围或降低分辨率后重试；若仍失败，重启应用后再试。'
        : message,
    }));
  }
}

export async function exportCapabilities() {
  const { h264Profile } = await resolveH264RenderOptions(ffmpegBin(), remotionHardwareFfmpegPath());
  return { h264: h264Profile, renderConcurrency: currentRenderConcurrency() };
}
