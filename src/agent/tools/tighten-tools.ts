export { TIGHTEN_TOOL_SCHEMAS, TIGHTEN_TOOL_NAMES } from './schemas/tighten-tools';
import type { AgentContext } from '../context';
import { previewTighten } from '../shorts/tighten';
import { pickTranscribedItem } from '../shorts/transcript-item';
import { execTranscriptTool } from './transcript-tools';

// tighten_speech — OpusClip's Speech Cleanup, review-first.
//
// The engine already exists: `clean_script` removes fillers and compresses pauses in one
// undoable batch. What was missing is a Spanish-first review step, because deleting words is
// destructive and the user should see the list before it happens. So this tool previews with
// its own pure matcher, and only delegates the actual edit.

type Args = Record<string, unknown>;

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' ? value as Record<string, unknown> : {});

export async function execTightenTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'tighten_speech') return { error: `unknown tool ${name}` };

  const state = ctx.getState();
  const item = pickTranscribedItem(state.items, typeof args.itemId === 'string' ? args.itemId : undefined);
  if (!item || !item.transcript?.length) {
    return {
      error: 'No hay ningún clip transcrito en esta secuencia. Transcribe primero con transcribe_track '
        + 'y vuelve a pedir que apriete el habla.',
    };
  }

  const minPauseMs = Number.isFinite(Number(args.minPauseMs)) ? Math.max(120, Number(args.minPauseMs)) : 400;
  const extraFillers = Array.isArray(args.extraFillers)
    ? args.extraFillers.filter((f): f is string => typeof f === 'string')
    : [];
  const words = item.transcript.map((w) => ({ text: w.text, start: w.start, end: w.end }));

  const preview = previewTighten(words, { minPauseMs, extraFillers });
  const summary = {
    itemId: item.id,
    fillers: preview.fillers.map((hit) => ({
      word: hit.word,
      at: Number((hit.atMs / 1000).toFixed(2)),
      reason: hit.reason,
    })),
    pauses: preview.pauses.map((hit) => ({
      after: item.transcript?.[hit.afterWordIndex]?.text ?? '',
      seconds: Number((hit.gapMs / 1000).toFixed(2)),
    })),
    savedSeconds: Number((preview.savedMs / 1000).toFixed(1)),
    hidden: preview.hidden,
  };

  if (args.apply !== true) {
    return {
      ok: true,
      applied: false,
      preview: summary,
      note: preview.fillers.length || preview.pauses.length
        ? `Se quitarían ${preview.fillers.length} muletillas y se acortarían ${preview.pauses.length} pausas `
          + `(≈${summary.savedSeconds} s). Muéstrale la lista al usuario y, si la aprueba, repite con apply:true.`
        : 'No se encontraron muletillas ni pausas largas con esos ajustes.',
    };
  }

  const cleanScript = await execTranscriptTool('clean_script', {
    itemId: item.id,
    only: 'fillers,silence',
    silence: `compress:${minPauseMs}`,
    removeFillers: true,
    ...(Number.isFinite(Number(args.cutPadMs)) ? { cutPadMs: Math.max(0, Math.min(500, Number(args.cutPadMs))) } : {}),
  }, ctx);
  const applied = asRecord(cleanScript);

  return {
    ok: applied.error === undefined,
    applied: true,
    preview: summary,
    cleanScript,
    note: applied.error === undefined
      ? `Apretado en un solo paso de deshacer: ≈${summary.savedSeconds} s menos.`
      : 'clean_script no pudo aplicar el recorte; revisa su mensaje.',
  };
}
