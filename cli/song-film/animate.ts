import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, isAbsolute, join } from 'node:path';
import { CliError } from '../errors.ts';
import { renderProjectToFile } from '../render-file.ts';
import { runToolSession, type ToolInvocation } from '../session.ts';
import type { placeSongFilm } from './run.ts';

type Placed = Awaited<ReturnType<typeof placeSongFilm>>;
interface Options {
  audio: string;
  output?: string;
  exportDir?: string;
  resolution: '480p' | '720p' | '1080p' | '4k';
  render: boolean;
  dryRun: boolean;
  reactions: boolean;
}

export async function animateSongFilm(placed: Placed, options: Options) {
  const { plan, report } = placed;
  const updates = [
    ...plan.visuals.map((visual, index) => ({
      type: visual.kind, itemId: report.visualIds[index], keyframes: visual.keyframes,
      ...(visual.kind === 'image' ? { fit: 'cover' } : {}),
    })),
    ...plan.texts.map((text, index) => ({
      type: 'text', itemId: report.textIds[index], keyframes: text.keyframes,
    })),
  ];
  const ken = plan.visuals.flatMap((visual, index): ToolInvocation[] => visual.kind === 'image'
    ? [{ tool: 'apply_ken_burns', args: { itemId: report.visualIds[index],
      direction: ['in', 'out', 'left', 'right'][index % 4] } }]
    : []);
  const animated = await runToolSession(report.projectId, [
    { tool: 'edit_item', args: { updates } }, ...ken,
  ], { apply: true, summary: 'Película de la canción: animar' });
  for (const execution of animated.executions) {
    const result = execution.result as { error?: string };
    if (result?.error) throw new CliError(result.error);
  }
  let reactions: { applied: boolean; reason?: string; reaction?: string; keyframes?: number } =
    { applied: false, reason: options.reactions ? 'no still images' : 'disabled' };
  const targetItemIds = plan.visuals.flatMap((visual, i) => visual.kind === 'image' ? [report.visualIds[i]!] : []);
  if (options.reactions && targetItemIds.length) {
    try {
      const args = { itemId: report.audioItemId, targetItemIds, reaction: 'destello', timing: 'downbeats',
        fromFrame: placed.fromFrame, toFrame: placed.toFrame };
      const probe = await runToolSession(report.projectId, [{ tool: 'music_reaction_plan', args }], { apply: false });
      const result = probe.executions[0]?.result as { error?: string; songMapRef?: string };
      if (result?.error || !result?.songMapRef) {
        reactions = { applied: false, reason: String(result?.error ?? 'no song map').slice(0, 120) };
      } else {
        const applied = await runToolSession(report.projectId, [{
          tool: 'apply_music_reaction', args: { ...args, songMapRef: result.songMapRef },
        }], { apply: true, summary: 'Película de la canción: reacción' });
        const outcome = applied.executions[0]?.result as { error?: string; changed?: boolean; reason?: string; keyframeCount?: number };
        reactions = outcome?.error || !outcome?.changed
          ? { applied: false, reason: String(outcome?.error ?? outcome?.reason ?? 'no reaction frames').slice(0, 120) }
          : { applied: true, reaction: 'destello', keyframes: outcome.keyframeCount ?? 0 };
      }
    } catch (error) {
      reactions = { applied: false, reason: (error instanceof Error ? error.message : String(error)).slice(0, 120) };
    }
  }
  const root = options.exportDir ?? process.env.CORTEO_EXPORT_DIR ?? join(homedir(), 'corteo-exports');
  if (!isAbsolute(root)) throw new CliError('CORTEO_EXPORT_DIR must be an absolute path');
  const slug = basename(options.audio, extname(options.audio)).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const exportPath = options.output ?? join(root, `${slug}-${stamp}.mp4`);
  if (!isAbsolute(exportPath)) throw new CliError('--out must be an absolute path');
  let render;
  if (options.render) {
    mkdirSync(join(exportPath, '..'), { recursive: true });
    process.env.CC_RENDER_GL ??= 'swangle';
    const rendered = await renderProjectToFile({ projectId: report.projectId, output: exportPath,
      resolution: options.resolution, fromFrame: placed.fromFrame, endFrameExclusive: placed.toFrame,
      dryRun: options.dryRun, quiet: true });
    render = { bytes: rendered.bytes, durationSeconds: rendered.durationSeconds, frames: rendered.frames, dryRun: rendered.dryRun };
  }
  return { ...report, stage: options.render ? 'rendered' : 'animated', exportPath, attachPath: exportPath,
    keyframedItems: updates.length, kenBurns: { applied: ken.length, skipped: false }, reactions,
    ...(render ? { render } : {}) };
}
