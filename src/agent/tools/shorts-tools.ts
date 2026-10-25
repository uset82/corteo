export { SHORTS_TOOL_SCHEMAS, SHORTS_TOOL_NAMES } from './schemas/shorts-tools';
export { setRubricScorer } from '../shorts/rubric';
import type { AgentContext } from '../context';
import { msToFrame } from '../../transcript/types';
import { buildCandidates } from '../shorts/candidates';
import { segmentChapters } from '../shorts/chapters';
import { modelVerdicts } from '../shorts/rubric';
import { corpusStats, deterministicScores } from '../shorts/signals';
import { PUBLISH_THRESHOLD, dedupeByOverlap, rankMoments, selectForReview } from '../shorts/score';
import { pickTranscribedItem } from '../shorts/transcript-item';
import { GENRES, type Genre, type ScoredMoment } from '../shorts/types';

// score_moments — the OpusClip-style rubric, local.
//
// OpusClip ranks clips with a model trained on (clip, performance) pairs. We cannot copy
// that, so this returns an honest rubric: measured signals (60 %) plus a free-model
// judgement of hook/flow/value (40 %), with gates that drop candidates that cannot stand
// alone. The word "rubric" is load-bearing: do not describe the score as a prediction.
//
// Read-only. The cut itself is find_highlights (OP-02) and make_shorts (OP-03).

const DEFAULT_COUNT = 8;
const MAX_COUNT = 20;
const DEFAULT_MIN_SECONDS = 12;
const DEFAULT_MAX_SECONDS = 90;
/** Candidates asked about per run; bounded so a 2-hour source does not become 40 model calls. */
const REVIEW_LIMIT = 24;
const MAX_REJECTS = 5;

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

function readGenre(value: unknown): Genre {
  const hit = typeof value === 'string' ? GENRES.find((g) => g === value) : undefined;
  return hit ?? 'auto';
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
  const stats = corpusStats(words);
  const chapters = segmentChapters(words);
  const candidates = buildCandidates(words, chapters, { minMs, maxMs });
  if (!candidates.length) {
    return {
      error: 'La transcripción es demasiado corta para sacar momentos con esa duración: baja minSeconds '
        + `o usa un clip más largo (hay ${words.length} palabras).`,
    };
  }

  const inputs = candidates.map((candidate) => ({ candidate, deterministic: deterministicScores(words, candidate, stats) }));
  const review = selectForReview(inputs, REVIEW_LIMIT);
  const { verdicts, genre: detectedGenre, failedBatches } = await modelVerdicts(
    review.map((r) => r.candidate),
    {
      genre: readGenre(args.genre),
      direction: typeof args.direction === 'string' ? args.direction : undefined,
      topic: typeof args.topic === 'string' ? args.topic : undefined,
    },
  );

  const ranked = rankMoments(
    review.map((input, index) => ({
      candidate: input.candidate,
      deterministic: input.deterministic,
      verdict: verdicts.get(index) ?? null,
    })),
    { minMs, maxMs },
  );

  const passing = dedupeByOverlap(ranked.filter((m) => m.gate === 'pass'));
  const moments = passing.slice(0, count).map((m) => toMoment(m, item.startFrame, state.fps));
  const rejected = ranked
    .filter((m) => m.gate === 'rejected')
    .slice(0, MAX_REJECTS)
    .map((m) => toMoment(m, item.startFrame, state.fps));
  const modelUsed = verdicts.size > 0;

  const note = moments.length
    ? `Puntuación orientativa (0-99), no una predicción: ${PUBLISH_THRESHOLD}+ suele merecer publicarse. `
      + 'Lee el motivo y las alertas antes de elegir; descarta cualquier momento que necesite contexto.'
    : `Ningún momento llegó a ${PUBLISH_THRESHOLD}. Baja minSeconds, prueba otra dirección o revisa la transcripción.`;

  return {
    ok: true,
    sourceItemId: item.id,
    sourceName: item.name ?? item.id,
    chapters: chapters.length,
    candidates: candidates.length,
    reviewed: review.length,
    threshold: PUBLISH_THRESHOLD,
    modelUsed,
    failedBatches,
    genre: detectedGenre ?? readGenre(args.genre),
    durationBounds: { minSeconds, maxSeconds },
    moments,
    rejected,
    alternates: Math.max(0, passing.length - moments.length),
    note,
  };
}
