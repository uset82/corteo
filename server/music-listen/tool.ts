// analyze_music / inspect_music for the headless MCP and CLI hosts: same cache,
// same analysis record, same projection as the browser tools, so a call made
// with no editor tab open is visible to the media card afterwards.
import type { AgentContext } from '../../src/agent/context.ts';
import { inspectMusicAnalysis } from '../../src/audio/intelligence/inspect.ts';
import type { MusicAnalysis } from '../../src/audio/intelligence/types.ts';
import { resolveMusicTarget, type Args } from '../../src/agent/tools/music-target.ts';
import { sourceRevisionOf } from '../../src/editor/mediaSourceRevision.ts';
import type { MediaAsset } from '../../src/editor/types.ts';
import { musicAnalysisRef } from '../../shared/music-inference/analysis-record.ts';
import { modelPackInstallGuidance } from '../../shared/model-packs/index.ts';
import { loadStoredMusicAnalysis } from './cache.ts';
import { inspectMusicPacks, MUSIC_PACK_IDS } from './packs.ts';
import { analyzeServerMusicAsset, MissingMusicPacksError } from './runner.ts';

const MISSING_MODEL_PACKS_ACTION = 'missing-model-packs';
const MODEL_PACK_SETTINGS_ROUTE = 'local/music/packs';
const BEAT_FALLBACK_TOOL = 'detect_beats';

function missingPacksResult(
  assetId: string,
  missing: readonly { readonly id: string; readonly status: string }[],
): Record<string, unknown> {
  return {
    error: `music analysis is unavailable until the model pack(s) are installed. ${modelPackInstallGuidance(missing)}`,
    assetId,
    modelPacks: missing,
    action: MISSING_MODEL_PACKS_ACTION,
    settingsRoute: MODEL_PACK_SETTINGS_ROUTE,
    fallback: BEAT_FALLBACK_TOOL,
  };
}

async function unavailableAnalysis(asset: MediaAsset): Promise<Record<string, unknown>> {
  const packs = await inspectMusicPacks().catch(() => null);
  if (packs && !packs.installed) return missingPacksResult(asset.id, packs.missing);
  return {
    error: 'music has not been analyzed yet; call analyze_music for this asset, then retry',
    assetId: asset.id,
    requiredModelPacks: [...MUSIC_PACK_IDS],
    action: MISSING_MODEL_PACKS_ACTION,
    settingsRoute: MODEL_PACK_SETTINGS_ROUTE,
  };
}

function progressReporter(ctx: AgentContext): ((phase: string, progress: number) => void) | undefined {
  const note = ctx.onToolProgress;
  if (!note) return undefined;
  return (phase, progress) => {
    const percent = Math.round(Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 100);
    note(`music analysis: ${phase} ${percent}%`);
  };
}

async function analyzeMusic(args: Args, ctx: AgentContext): Promise<unknown> {
  const target = resolveMusicTarget(args, ctx);
  let analysis: MusicAnalysis;
  try {
    analysis = await analyzeServerMusicAsset(target.asset, {
      force: args.force === true,
      onProgress: progressReporter(ctx),
    });
  } catch (error) {
    if (!(error instanceof MissingMusicPacksError)) throw error;
    const unavailable = missingPacksResult(target.asset.id, error.missing);
    if (args.optional !== true) return unavailable;
    const { error: reason, ...details } = unavailable;
    return { ok: true, available: false, reason: 'analysis-unavailable', note: reason, ...details };
  }
  return inspectMusicAnalysis({
    analysis,
    analysisRef: musicAnalysisRef(analysis),
    args,
    item: target.item,
    fps: ctx.getState().fps,
  });
}

async function inspectMusic(args: Args, ctx: AgentContext): Promise<unknown> {
  const target = resolveMusicTarget(args, ctx);
  const analysis = await loadStoredMusicAnalysis(target.asset.id, sourceRevisionOf(target.asset));
  if (!analysis) return await unavailableAnalysis(target.asset);
  return inspectMusicAnalysis({
    analysis,
    analysisRef: musicAnalysisRef(analysis),
    args,
    item: target.item,
    fps: ctx.getState().fps,
  });
}

export async function execServerMusicTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  try {
    if (name === 'analyze_music') return await analyzeMusic(args, ctx);
    if (name === 'inspect_music') return await inspectMusic(args, ctx);
    return { error: `unknown tool ${name}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
