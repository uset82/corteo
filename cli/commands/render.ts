// `occ render` — render the saved project to a file with the server's own export
// pipeline: the same plan builder, media materialization and Remotion render the
// /export job route drives. Only the transport differs — no HTTP, no browser
// dialog, no render queue. Nothing here modifies the project.
import { flagBoolean, flagText, rejectUnknownFlags, type CommandLine } from '../args.ts';
import { CliError, UsageError } from '../errors.ts';
import { printJson, writeStdout } from '../output.ts';
import { readProjectDoc, resolveProject } from '../store.ts';
import { startRenderJob } from '../jobs.ts';
import { renderProjectToFile } from '../render-file.ts';
import { GLOBAL_FLAGS, parseFrames, projectReference } from './common.ts';

const FLAGS = [
  ...GLOBAL_FLAGS,
  'out', 'timeline', 'format', 'codec', 'resolution', 'fps', 'bitrate', 'from', 'to', 'to-audio', 'quiet', 'dry-run',
  // 'job-id' is internal: the detached child reports through it.
  'detach', 'job-id',
] as const;

const FORMATS = ['video', 'audio'] as const;
const CODECS = ['h264', 'vp8', 'prores', 'mp3', 'wav'] as const;
const RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const;

function oneOf<T extends string>(value: string, allowed: readonly T[], flag: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new UsageError(`--${flag} must be one of ${allowed.join(', ')}`);
}

function positiveNumber(input: string, flag: string): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UsageError(`--${flag} expects a positive number, got "${input}"`);
  }
  return value;
}

export async function runRenderCommand(commandLine: CommandLine, json: boolean): Promise<void> {
  rejectUnknownFlags(commandLine, FLAGS);
  const outPath = flagText(commandLine, 'out');
  if (outPath === undefined || !outPath.trim()) {
    throw new UsageError('render needs --out <file> (for example: occ render --out cut.mp4)');
  }
  const quiet = flagBoolean(commandLine, 'quiet');
  const detach = flagBoolean(commandLine, 'detach');
  const project = await resolveProject(projectReference(commandLine));
  if (detach) {
    // Everything cheap is checked here so a typo fails in the caller's face.
    // The render, and every remaining validation, happens in the child.
    const job = await startRenderJob({
      projectId: project.id,
      projectName: project.name,
      output: outPath,
      args: process.argv.slice(2).filter((token) => token !== '--detach'),
    });
    if (json) {
      printJson({
        jobId: job.id,
        state: job.state,
        projectId: job.projectId,
        projectName: job.projectName,
        output: job.output,
        pid: job.pid,
        log: job.log,
      });
    } else {
      writeStdout(`render started as ${job.id}\n  ${outPath}\n  follow: occ job wait ${job.id}`);
    }
    return;
  }
  const doc = await readProjectDoc(project.id);
  const timelineId = flagText(commandLine, 'timeline') ?? doc.activeTimelineId;
  const timeline = doc.timelines.find((candidate) => candidate.id === timelineId);
  if (!timeline) {
    throw new CliError(`Project ${project.name} has no timeline ${timelineId}.\n${
      doc.timelines.map((candidate) => `  ${candidate.id}  ${candidate.name}`).join('\n')}`);
  }
  const format = oneOf(flagText(commandLine, 'format') ?? 'video', FORMATS, 'format');
  const codecFlag = flagText(commandLine, 'codec');
  const resolutionFlag = flagText(commandLine, 'resolution');
  const fpsFlag = flagText(commandLine, 'fps');
  const bitrateFlag = flagText(commandLine, 'bitrate');
  const fromFlag = flagText(commandLine, 'from');
  const toFlag = flagText(commandLine, 'to');
  const result = await renderProjectToFile({
    projectId: project.id, output: outPath, timelineId, format, quiet,
    toAudio: flagBoolean(commandLine, 'to-audio'), dryRun: flagBoolean(commandLine, 'dry-run'),
    ...(codecFlag === undefined ? {} : { codec: oneOf(codecFlag, CODECS, 'codec') }),
    ...(resolutionFlag === undefined ? {} : { resolution: oneOf(resolutionFlag, RESOLUTIONS, 'resolution') }),
    ...(fpsFlag === undefined ? {} : { fps: positiveNumber(fpsFlag, 'fps') }),
    ...(bitrateFlag === undefined ? {} : { bitrate: positiveNumber(bitrateFlag, 'bitrate') }),
    ...(fromFlag === undefined ? {} : { fromFrame: parseFrames(fromFlag, timeline.fps, 'from') }),
    ...(toFlag === undefined ? {} : { endFrameExclusive: parseFrames(toFlag, timeline.fps, 'to') }),
  });
  if (result.dryRun) {
    const summary = {
      projectId: result.projectId, timelineId: result.timelineId, output: result.output,
      codec: result.codec, extension: result.extension, scale: result.scale,
      frameRange: result.frameRange, totalFrames: result.frames,
      durationSeconds: result.durationSeconds, filename: result.filename,
    };
    if (json) printJson(summary);
    else writeStdout(`plan: ${result.codec} ${result.frames} frames → ${outPath}`);
    return;
  }
  if (json) {
    printJson({ projectId: result.projectId, timelineId: result.timelineId, output: result.output,
      bytes: result.bytes, codec: result.codec, frames: result.frames, durationSeconds: result.durationSeconds });
    return;
  }
  writeStdout(`${outPath}  ${(result.bytes / (1024 * 1024)).toFixed(1)}MB  ${result.codec}  ${
    result.durationSeconds.toFixed(2)}s  ${result.frames} frames`);
}
