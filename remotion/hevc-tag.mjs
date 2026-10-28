// HEVC post-pass for the Remotion pipeline: ffmpeg muxes HEVC as hev1 by
// default and Apple players require the hvc1 tag, so the finished MP4 is
// remuxed. If the Remotion build has no HEVC encoder, the h264 render is
// transcoded with libx265 instead.
import { execFile } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function hevcEncoderUnavailable(error) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes('h265') || message.includes('hevc')
    || /(?:codec|encoder)[^.]*(?:not|unsupported|unavailable|unknown)/.test(message);
}

function ffmpegForHevc(ffmpegBinary) {
  if (!ffmpegBinary) {
    throw new Error('h265 export needs ffmpeg: pass ffmpegBinary (server/media-binaries.ts ffmpegBin())');
  }
  return ffmpegBinary;
}

async function runFfmpeg(ffmpegBinary, args) {
  await execFileAsync(ffmpegForHevc(ffmpegBinary), [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args,
  ], { maxBuffer: 8 * 1024 * 1024 });
}

/** Remux the HEVC MP4 so its codec tag is hvc1 instead of ffmpeg's default hev1. */
export async function retagHvc1(file, ffmpegBinary) {
  const tagged = `${file}.hvc1.mp4`;
  await runFfmpeg(ffmpegBinary, [
    '-i', file, '-map', '0', '-c', 'copy', '-tag:v', 'hvc1', '-f', 'mp4', tagged,
  ]);
  await rm(file, { force: true });
  await rename(tagged, file);
}

/** Fallback for a Remotion build without an HEVC encoder: render h264, then x265. */
export async function transcodeHevc(source, output, ffmpegBinary, videoBitrate) {
  const bitrateArgs = Number.isFinite(videoBitrate) && videoBitrate > 0
    ? ['-b:v', `${Math.round(videoBitrate / 1000)}k`]
    : ['-crf', '28'];
  await runFfmpeg(ffmpegBinary, [
    '-i', source, '-c:v', 'libx265', '-preset', 'medium', ...bitrateArgs,
    '-tag:v', 'hvc1', '-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', output,
  ]);
  await rm(source, { force: true });
}
