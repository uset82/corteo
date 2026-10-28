export { SHORTS_TOOL_SCHEMAS, SHORTS_TOOL_NAMES } from './schemas/shorts-tools';
export { setRubricScorer } from '../shorts/rubric';
import type { AgentContext } from '../context';
import { msToFrame } from '../../transcript/types';
import { analyzeMoments } from '../shorts/analyze';
import { computeCalibration } from '../shorts/calibration';
import { PUBLISH_THRESHOLD } from '../shorts/score';
import { shortsReviewEs } from '../shorts/review-text';
import { readGenre } from '../shorts/score-ranges';
import { pickTranscribedItem } from '../shorts/transcript-item';
import type { ScoredMoment } from '../shorts/types';

// score_moments — the OpusClip-style rubric, local.
//
// OpusClip ranks clips with a model trained on (clip, performance) pairs. We cannot copy
// that, so this returns an honest rubric: measured signals (60 %) plus a free-model
// judgement of hook/flow/value (40 %), with gates that drop candidates that cannot stand
// alone. The word "rubric" is load-bearing: do not describe the score as a prediction.
//
// Read-only. The cut itself is find_highlights (OP-02) and make_shorts (OP-03). The analysis
// itself lives in `src/agent/shorts/analyze.ts` so both tools share one engine.

const DEFAULT_COUNT = 8;
const MAX_COUNT = 20;
const DEFAULT_MIN_SECONDS = 12;
const DEFAULT_MAX_SECONDS = 90;

type Args = Record<string, unknown>;

interface MomentOut {
  startWord: number;
  endWord: number;
  startFrame: number;
  endFrame: number;
  seconds: number;
  score: number;
  subscores: ScoredMoment['subscores'];
  gate: ScoredMoment['gate'];
  gateReasons: string[];
  title: string;
  reason: string;
  risks: string[];
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function toMoment(moment: ScoredMoment, itemStartFrame: number, fps: number): MomentOut {
  const startFrame = itemStartFrame + msToFrame(moment.startMs, fps);
  const endFrame = Math.max(startFrame + 1, itemStartFrame + msToFrame(moment.endMs, fps));
  return {
    startWord: moment.startWord,
    endWord: moment.endWord,
    startFrame,
    endFrame,
    seconds: Number(((moment.endMs - moment.startMs) / 1000).toFixed(1)),
    score: moment.score,
    subscores: moment.subscores,
    gate: moment.gate,
    gateReasons: moment.gateReasons,
    title: moment.model?.title || `Momento ${moment.startWord + 1}`,
    reason: moment.model?.reason ?? 'Solo señales medidas (sin modelo).',
    risks: moment.model?.risks ?? [],
  };
}

export async function execShortsTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name === 'calibrate_scores') {
    const calibration = computeCalibration();
    return {
      ok: true,
      ...calibration,
      applied: calibration.confident,
      note: calibration.confident
        ? calibration.note
        : `${calibration.note} Aprueba o descarta momentos en el panel de clips para que la puntuación aprenda.`,
    };
  }
  if (name !== 'score_moments') return { error: `unknown tool ${name}` };

  const state = ctx.getState();
  const item = pickTranscribedItem(state.items, typeof args.itemId === 'string' ? args.itemId : undefined);
  if (!item || !item.transcript?.length) {
    return {
      error: 'No hay ningún clip transcrito en esta secuencia. Transcribe primero con transcribe_track '
        + 'y vuelve a pedir la puntuación.',
    };
  }

  const count = clampInt(args.count, DEFAULT_COUNT, 1, MAX_COUNT);
  const minSeconds = Math.max(3, Number.isFinite(Number(args.minSeconds)) ? Number(args.minSeconds) : DEFAULT_MIN_SECONDS);
  const maxSeconds = Math.max(minSeconds, Number.isFinite(Number(args.maxSeconds)) ? Number(args.maxSeconds) : DEFAULT_MAX_SECONDS);
  const minMs = Math.round(minSeconds * 1000);
  const maxMs = Math.round(maxSeconds * 1000);

  const words = item.transcript.map((w) => ({ text: w.text, start: w.start, end: w.end }));
  const calibration = args.calibration === true ? computeCalibration() : null;
  const analysis = await analyzeMoments(words, {
    minMs,
    maxMs,
    count,
    genre: readGenre(args.genre),
    direction: typeof args.direction === 'string' ? args.direction : undefined,
    topic: typeof args.topic === 'string' ? args.topic : undefined,
    ...(calibration?.confident ? { weights: calibration.weights } : {}),
  });

  if (!analysis.candidates) {
    return {
      error: 'La transcripción es demasiado corta para sacar momentos con esa duración: baja minSeconds '
        + `o usa un clip más largo (hay ${words.length} palabras).`,
    };
  }

  const moments = analysis.moments.map((m) => toMoment(m, item.startFrame, state.fps));
  const rejected = analysis.rejected.map((m) => toMoment(m, item.startFrame, state.fps));
  const note = moments.length
    ? `Puntuación orientativa (0-99), no una predicción: ${PUBLISH_THRESHOLD}+ suele merecer publicarse. `
      + 'Lee el motivo y las alertas antes de elegir; descarta cualquier momento que necesite contexto.'
    : `Ningún momento llegó a ${PUBLISH_THRESHOLD}. Baja minSeconds, prueba otra dirección o revisa la transcripción.`;

  return {
    ok: true,
    sourceItemId: item.id,
    sourceName: item.name ?? item.id,
    chapters: analysis.chapters,
    candidates: analysis.candidates,
    reviewed: analysis.reviewed,
    threshold: PUBLISH_THRESHOLD,
    modelUsed: analysis.modelUsed,
    failedBatches: analysis.failedBatches,
    genre: analysis.detectedGenre ?? readGenre(args.genre),
    durationBounds: { minSeconds, maxSeconds },
    moments,
    reviewEs: shortsReviewEs(moments.map((moment) => ({ ...moment, startSeconds: moment.startFrame / state.fps, endSeconds: moment.endFrame / state.fps }))),
    rejected,
    alternates: Math.max(0, analysis.passing - moments.length),
    ...(calibration
      ? { calibration: { decisions: calibration.decisions, applied: calibration.confident } }
      : {}),
    note,
  };
}
