export { CENSOR_TOOL_SCHEMAS, CENSOR_TOOL_NAMES } from './schemas/censor-tools';
import type { AgentContext } from '../context';
import type { Action } from '../../editor/reducerActions';
import { msToFrame } from '../../transcript/types';
import { findCensorHits } from '../shorts/censor';
import { pickTranscribedItem } from '../shorts/transcript-item';

// censor_words — OpusClip's create_censor_job, as volume keyframes.
//
// Review first, like tighten_speech: deleting or muting audio is destructive and the user
// should see the hits before it happens. The mute is a keyframe envelope, not a cut, so the
// video stays frame-aligned with the rest of the timeline and the decision is reversible.

type Args = Record<string, unknown>;

export async function execCensorTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'censor_words') return { error: `unknown tool ${name}` };

  const state = ctx.getState();
  const item = pickTranscribedItem(state.items, typeof args.itemId === 'string' ? args.itemId : undefined);
  if (!item || !item.transcript?.length) {
    return {
      error: 'No hay ningún clip transcrito en esta secuencia. Transcribe primero con transcribe_track '
        + 'y vuelve a pedir la censura.',
    };
  }
  if (item.kind !== 'audio' && item.kind !== 'video') {
    return { error: `El clip ${item.id} no tiene audio que censurar.` };
  }

  const extraWords = Array.isArray(args.extraWords)
    ? args.extraWords.filter((word): word is string => typeof word === 'string')
    : [];
  const padMs = Number.isFinite(Number(args.padMs)) ? Math.max(0, Math.min(500, Number(args.padMs))) : 0;
  const words = item.transcript.map((word) => ({ text: word.text, start: word.start, end: word.end }));
  const hits = findCensorHits(words, extraWords);

  const summary = hits.map((hit) => ({
    word: hit.word,
    at: Number((hit.startMs / 1000).toFixed(2)),
    muteMs: Math.round(hit.endMs - hit.startMs + padMs * 2),
  }));

  if (args.apply !== true) {
    return {
      ok: true,
      applied: false,
      itemId: item.id,
      hits: summary,
      note: hits.length
        ? `Se silenciarían ${hits.length} palabras. Muéstrale la lista al usuario y, si la aprueba, repite con apply:true.`
        : 'No se encontraron palabrotas con ese diccionario.',
    };
  }

  if (!hits.length) {
    return { ok: true, applied: false, itemId: item.id, hits: [], note: 'No hay nada que censurar.' };
  }

  const fps = state.fps;
  const baseVolume = typeof item.volume === 'number' ? item.volume : 1;
  const actions: Action[] = [];
  for (const hit of hits) {
    const startFrame = Math.max(0, item.startFrame + msToFrame(Math.max(0, hit.startMs - padMs), fps));
    const endFrame = Math.max(startFrame + 1, item.startFrame + msToFrame(hit.endMs + padMs, fps));
    actions.push({ type: 'setKeyframe', id: item.id, prop: 'volume', frame: startFrame, value: 0 });
    actions.push({ type: 'setKeyframe', id: item.id, prop: 'volume', frame: endFrame, value: baseVolume });
  }
  ctx.commands.batch(actions, 'Censurar palabras');

  return {
    ok: true,
    applied: true,
    itemId: item.id,
    hits: summary,
    keyframes: actions.length,
    note: `Censuradas ${hits.length} palabras con un solo paso de deshacer.`,
  };
}
