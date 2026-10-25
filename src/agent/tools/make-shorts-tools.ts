export { MAKE_SHORTS_TOOL_SCHEMAS, MAKE_SHORTS_TOOL_NAMES } from './schemas/make-shorts-tools';
import type { AgentContext } from '../context';
import { ASPECT_PRESETS } from '../../editor/types';
import { analyzeMoments } from '../shorts/analyze';
import { computeCalibration } from '../shorts/calibration';
import { PUBLISH_THRESHOLD } from '../shorts/score';
import { readGenre } from '../shorts/score-ranges';
import { pickTranscribedItem } from '../shorts/transcript-item';
import { execCaptionsTool } from './captions-tools';
import { execExportTool } from './export-tools';
import { assembleShorts, type Highlight, type Short } from './highlight-tool';
import { execReframeTool } from './reframe-tools';

// make_shorts — OpusClip's `submit_project` shape, composed from what already exists.
//
// This tool deliberately contains no editing logic of its own: analysis comes from
// `shorts/analyze.ts`, the cut from `assembleShorts`, captions from `edit_captions`, the
// crop from `auto_reframe`, the render from `submit_render_job`. If a step needs behaviour
// the individual tool lacks, that behaviour belongs in the individual tool first.
//
// It is one undoable batch per clip (the same commands `find_highlights` uses), not a new
// project type: every clip is an ordinary sequence with ordinary keyframes.

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const DEFAULT_MIN_SECONDS = 12;
const DEFAULT_MAX_SECONDS = 90;
/** Analyzed beyond `count` so the caller still gets alternates it can promote. */
const ANALYSIS_SPREAD = 3;

type Args = Record<string, unknown>;

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' ? value as Record<string, unknown> : {});

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const clampScore = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(99, n));
};

interface ClipOut {
  sequenceId: string;
  title: string;
  startFrame: number;
  endFrame: number;
  seconds: number;
  score: number;
  subscores: unknown;
  reason: string;
  risks: string[];
  captions: 'applied' | 'failed' | 'skipped';
  reframe: 'applied' | 'skipped';
  renderId?: string;
  note?: string;
}

async function applyCaptions(
  ctx: AgentContext,
  preset: string,
  motion: string | undefined,
): Promise<ClipOut['captions']> {
  try {
    const enabled = asRecord(await execCaptionsTool('edit_captions', { action: 'enable', preset }, ctx));
    if (enabled.error) return 'failed';
    if (motion) await execCaptionsTool('edit_captions', { action: 'animation', motionPreset: motion }, ctx);
    return 'applied';
  } catch {
    return 'failed';
  }
}

export async function execMakeShortsTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'make_shorts') return { error: `unknown tool ${name}` };

  const state = ctx.getState();
  const originalActiveId = ctx.getDoc().activeTimelineId;
  const item = pickTranscribedItem(state.items, typeof args.itemId === 'string' ? args.itemId : undefined);
  if (!item || !item.transcript?.length) {
    return {
      error: 'No hay ningún clip transcrito en esta secuencia. Transcribe primero con transcribe_track '
        + 'y vuelve a pedir los shorts.',
    };
  }

  const ratio = typeof args.ratio === 'string' ? args.ratio : '9:16';
  const preset = ASPECT_PRESETS.find((p) => p.label === ratio);
  if (!preset) {
    return { error: `unknown ratio ${ratio} (可选 ${ASPECT_PRESETS.map((p) => p.label).join('/')})` };
  }

  const count = clampInt(args.count, DEFAULT_COUNT, 1, MAX_COUNT);
  const minSeconds = Math.max(3, Number.isFinite(Number(args.minSeconds)) ? Number(args.minSeconds) : DEFAULT_MIN_SECONDS);
  const maxSeconds = Math.max(minSeconds, Number.isFinite(Number(args.maxSeconds)) ? Number(args.maxSeconds) : DEFAULT_MAX_SECONDS);
  const minMs = Math.round(minSeconds * 1000);
  const maxMs = Math.round(maxSeconds * 1000);
  const minScore = clampScore(args.minScore, PUBLISH_THRESHOLD);
  const captionsPreset = typeof args.captionsPreset === 'string' && args.captionsPreset.trim() ? args.captionsPreset.trim() : '';
  const captionMotion = typeof args.captionMotion === 'string' ? args.captionMotion : undefined;
  const wantReframe = args.reframe !== false;
  const wantRender = args.render === 'previews';

  const words = item.transcript.map((w) => ({ text: w.text, start: w.start, end: w.end }));
  const calibration = args.calibration === true ? computeCalibration() : null;
  const analysis = await analyzeMoments(words, {
    minMs,
    maxMs,
    count: Math.min(MAX_COUNT * ANALYSIS_SPREAD, count * ANALYSIS_SPREAD),
    genre: readGenre(args.genre),
    direction: typeof args.direction === 'string' ? args.direction : undefined,
    topic: typeof args.topic === 'string' ? args.topic : undefined,
    ...(calibration?.confident ? { weights: calibration.weights } : {}),
  });

  if (!analysis.candidates) {
    return {
      error: 'La transcripción es demasiado corta para sacar clips con esa duración: baja minSeconds '
        + `o usa un clip más largo (hay ${words.length} palabras).`,
    };
  }

  const chosen = analysis.moments.filter((m) => m.score >= minScore).slice(0, count);
  const belowThreshold = analysis.moments.filter((m) => m.score < minScore).length;
  if (!chosen.length) {
    return {
      ok: true,
      count: 0,
      clips: [],
      analysisId: `${Date.now().toString(36)}-${item.id}`,
      threshold: minScore,
      rejected: analysis.rejected.map((m) => ({
        score: m.score,
        title: m.model?.title ?? `Momento ${m.startWord + 1}`,
        reasons: m.gateReasons,
      })),
      note: `Ningún momento llegó a ${minScore}. Baja minScore, cambia la dirección o revisa la transcripción.`,
    };
  }

  const highlights: Highlight[] = chosen.map((moment, index) => ({
    startWordIndex: moment.startWord,
    endWordIndex: moment.endWord,
    title: moment.model?.title || `Momento ${index + 1}`,
    reason: moment.model?.reason,
  }));

  const shorts: Short[] = assembleShorts(ctx, originalActiveId, item, highlights, preset);
  const clips: ClipOut[] = [];

  for (let index = 0; index < shorts.length; index += 1) {
    const short = shorts[index];
    const moment = chosen[index];
    ctx.commands.switchTimeline(short.timelineId);

    const captions = captionsPreset ? await applyCaptions(ctx, captionsPreset, captionMotion) : 'skipped';

    let reframe: ClipOut['reframe'] = 'skipped';
    let note: string | undefined;
    if (wantReframe) {
      const result = asRecord(await execReframeTool('auto_reframe', { itemId: item.id }, ctx));
      if (result.ok === true) reframe = 'applied';
      else {
        note = typeof result.error === 'string' ? result.error : 'auto_reframe no pudo muestrear vídeo sin pestaña.';
      }
    }

    let renderId: string | undefined;
    if (wantRender) {
      const result = asRecord(await execExportTool('submit_render_job', {
        format: 'video',
        resolution: '480p',
        name: `${short.title || `Clip ${index + 1}`}.mp4`,
      }, ctx));
      renderId = typeof result.renderId === 'string' ? result.renderId : undefined;
    }

    clips.push({
      sequenceId: short.timelineId,
      title: short.title,
      startFrame: short.startFrame,
      endFrame: short.endFrame,
      seconds: Number(((moment.endMs - moment.startMs) / 1000).toFixed(1)),
      score: moment.score,
      subscores: moment.subscores,
      reason: moment.model?.reason ?? '',
      risks: moment.model?.risks ?? [],
      captions,
      reframe,
      ...(renderId ? { renderId } : {}),
      ...(note ? { note } : {}),
    });
  }

  ctx.commands.switchTimeline(originalActiveId);
  const renderIds = clips.map((c) => c.renderId).filter((id): id is string => Boolean(id));

  return {
    ok: true,
    analysisId: `${Date.now().toString(36)}-${item.id}`,
    sourceItemId: item.id,
    sourceName: item.name ?? item.id,
    ratio,
    threshold: minScore,
    modelUsed: analysis.modelUsed,
    genre: analysis.detectedGenre ?? readGenre(args.genre),
    chapters: analysis.chapters,
    candidates: analysis.candidates,
    count: clips.length,
    clips,
    alternates: analysis.passing - clips.length,
    belowThreshold,
    rejected: analysis.rejected.map((m) => ({
      score: m.score,
      title: m.model?.title ?? `Momento ${m.startWord + 1}`,
      reasons: m.gateReasons,
    })),
    ...(renderIds.length ? { renderIds, next: 'Poll the queued renders with track_export.' } : {}),
    ...(clips.some((c) => c.reframe === 'skipped') && wantReframe
      ? { note: 'Algún clip no se pudo reencuadrar: hace falta una pestaña abierta con el editor para muestrear el vídeo.' }
      : {}),
  };
}
