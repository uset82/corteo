import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { resolveLyrics } from '../../src/audio/listen/lyricsInput.ts';
import type { SongLyricWord } from '../../src/audio/listen/songMap.ts';
import { planSongFilm } from '../../src/editor/songFilm.ts';
import { CliError } from '../errors.ts';
import { runToolSession } from '../session.ts';
import { createProject, readProjectDoc } from '../store.ts';

export interface SongFilmOptions {
  audio: string;
  stills: string[];
  lyricsText?: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  fromFrame: number;
  toFrame: number;
}

interface ImportResult { imported?: { id: string }[] }
interface PlaceResult { results?: { placed?: { itemId?: string } }[] }
interface BeatResult { bpm?: number; timelineDownbeatFrames?: number[]; error?: string }
interface ListenResult {
  error?: string;
  sections?: { fromMs: number; toMs: number; role: string; energy: number }[];
  curves?: { stepMs: number; energy: number[] } | null;
  lyrics?: { lines?: { atMs: number; text: string; chorusGroup?: number }[] };
}

function importedId(result: unknown): string {
  const id = (result as ImportResult)?.imported?.[0]?.id;
  if (!id) throw new CliError('song-film import did not return an asset');
  return id;
}

function placedIds(result: unknown): string[] {
  const rows = (result as PlaceResult)?.results;
  if (!rows?.length || rows.some((row) => !row.placed?.itemId)) throw new CliError('song-film placement did not return item ids');
  return rows.map((row) => row.placed!.itemId!);
}

function adjacent(audio: string, extension: string): string | undefined {
  const path = join(dirname(audio), basename(audio, extname(audio)) + extension);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

export async function placeSongFilm(options: SongFilmOptions) {
  const { width, height, fps } = options;
  const project = await createProject({ name: options.name, width, height, fps });
  const imported = await runToolSession(project.id, [options.audio, ...options.stills].map((path) => ({
    tool: 'import_asset', args: { path },
  })), { apply: true, summary: 'Película de la canción: importar' });
  const [audioId, ...stillIds] = imported.executions.map((execution) => importedId(execution.result));
  if (!audioId) throw new CliError('song-film has no audio asset');
  const doc = await readProjectDoc(project.id);
  const audio = doc.assets.find((asset) => asset.id === audioId);
  if (!audio || audio.kind !== 'audio') throw new CliError('song-film needs an audio asset');
  const toFrame = Math.min(options.toFrame, audio.durationInFrames);
  if (toFrame <= options.fromFrame) throw new CliError('song-film range is outside the song');
  const audioPlacement = await runToolSession(project.id, [{
    tool: 'edit_item', args: { adds: [{ type: 'audio', assetId: audioId, fromFrame: 0 }] },
  }], { apply: true, summary: 'Película de la canción: audio' });
  const audioItemId = placedIds(audioPlacement.executions[0]?.result)[0]!;
  const fromMs = options.fromFrame * 1000 / fps;
  const toMs = toFrame * 1000 / fps;
  // CLI probes: ops[0].result.timelineDownbeatFrames and
  // ops[0].result.{sections,curves,lyrics.lines}; the direct session exposes that result.
  const beats = await runToolSession(project.id, [{ tool: 'detect_beats', args: { itemId: audioItemId } }], { apply: false });
  const beatResult = beats.executions[0]?.result as BeatResult;
  if (beatResult?.error) throw new CliError(beatResult.error);
  const downbeats = beatResult?.timelineDownbeatFrames ?? [];
  const listening = await runToolSession(project.id, [{
    tool: 'listen_to_song', args: { itemId: audioItemId, pictures: false, fromMs, toMs },
  }], { apply: false });
  const listen = listening.executions[0]?.result as ListenResult;
  if (listen?.error) throw new CliError(listen.error);
  const transcript: SongLyricWord[] = (listen?.lyrics?.lines ?? []).map((line, index, lines) => ({
    text: line.text, startMs: line.atMs, endMs: lines[index + 1]?.atMs ?? Math.min(toMs, line.atMs + 4000),
    ...(line.chorusGroup === undefined ? {} : { chorusGroup: line.chorusGroup }),
  }));
  const lyrics = resolveLyrics({ pasted: options.lyricsText, besideLrc: adjacent(options.audio, '.lrc'),
    besideTxt: adjacent(options.audio, '.txt'), transcriptLines: transcript,
    downbeatsMs: downbeats.map((frame) => frame * 1000 / fps), fromMs, toMs });
  const stepMs = listen?.curves?.stepMs ?? 1000;
  const padding = Math.max(0, Math.floor(fromMs / stepMs));
  const energy = [...Array<number>(padding).fill(0), ...(listen?.curves?.energy ?? []).map((v) => v / 100)];
  const plan = planSongFilm({ fps, width, height, fromFrame: options.fromFrame, toFrame,
    downbeatFrames: downbeats, sections: listen?.sections ?? [], energy: { stepMs, values: energy },
    lyrics: lyrics.lines, stills: stillIds });
  const adds = [
    ...plan.visuals.map((visual) => ({ type: visual.kind, fromFrame: visual.fromFrame,
      durationInFrames: visual.durationInFrames, ...(visual.kind === 'image'
        ? { assetId: visual.assetId } : { color: visual.color }) })),
    ...plan.texts.map((text) => ({ type: 'text', text: text.text, fromFrame: text.fromFrame,
      durationInFrames: text.durationInFrames, fontSize: text.fontSize, color: text.color,
      fontWeight: text.fontWeight, align: text.align, position: text.position })),
  ];
  const placement = await runToolSession(project.id, [{ tool: 'edit_item', args: { adds } }],
    { apply: true, summary: 'Película de la canción: colocar' });
  const ids = placedIds(placement.executions[0]?.result);
  if (ids.length !== adds.length) throw new CliError('song-film did not place every requested item');
  return { ok: true, stage: 'placed', projectId: project.id, audioItemId, bpm: beatResult.bpm ?? 0,
    lyricsSource: lyrics.source, lines: lyrics.lines, cutGrid: plan.cutGrid, cuts: plan.cutFrames,
    visualIds: ids.slice(0, plan.visuals.length), textIds: ids.slice(plan.visuals.length) };
}
