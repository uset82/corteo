// Beat grid for the `latido` caption motion (Plan 2 › L-10). The grid is
// captured once, in absolute timeline ms, and stored on the captions item, so
// the Remotion preview and the export pulse on the same beats without reading
// any cache at render time.
import type { MediaAsset, TimelineItem } from '../editor/types';
import { localFrameForSourceMs } from '../editor/sourceLimit';
import type { MusicAnalysis } from '../audio/intelligence/types';
import { loadMusicAnalysisForAsset } from '../audio/intelligence/store';

export interface LatidoBeats {
  readonly beatsMs: readonly number[];
  readonly bpm: number;
  /** Timeline item whose song supplied the beats. */
  readonly itemId: string;
}

export interface ResolveLatidoBeatsOptions {
  readonly items: readonly TimelineItem[];
  readonly assets: readonly MediaAsset[];
  readonly fps: number;
  readonly sourceItemId?: string | null;
  /** Test seam; defaults to the shared analysis cache. */
  readonly loadAnalysis?: (asset: MediaAsset) => Promise<Pick<MusicAnalysis, 'bpm' | 'beatsMs'> | null>;
}

export const LATIDO_NO_SONG = 'Latido necesita la canción en la timeline: añade el audio y analízalo antes.';
export const LATIDO_NO_ANALYSIS = 'Sin análisis musical: ejecuta analyze_music o listen_to_song y vuelve a elegir Latido.';

/** The caption source item when it carries sound; otherwise the first audio clip. */
function songItem(items: readonly TimelineItem[], sourceItemId: string | null | undefined): TimelineItem | undefined {
  const source = sourceItemId ? items.find((item) => item.id === sourceItemId) : undefined;
  if (source && (source.kind === 'audio' || source.kind === 'video')) return source;
  return items.find((item) => item.kind === 'audio');
}

/** Source ms → absolute timeline ms through the clip's trim and speed; deduped and sorted. */
export function mapBeatsToTimeline(item: TimelineItem, beatsMs: readonly number[], fps: number): number[] {
  const mapped = new Set<number>();
  for (const beatMs of beatsMs) {
    const local = localFrameForSourceMs(item, beatMs, fps);
    if (local === null) continue;
    mapped.add(Math.round(((item.startFrame + local) / fps) * 1000));
  }
  return [...mapped].sort((left, right) => left - right);
}

export async function resolveLatidoBeats(
  options: ResolveLatidoBeatsOptions,
): Promise<LatidoBeats | { readonly error: string }> {
  const item = songItem(options.items, options.sourceItemId);
  if (!item) return { error: LATIDO_NO_SONG };
  const asset = item.sourceAssetId
    ? options.assets.find((candidate) => candidate.id === item.sourceAssetId)
    : undefined;
  if (!asset) return { error: LATIDO_NO_ANALYSIS };
  const load = options.loadAnalysis ?? loadMusicAnalysisForAsset;
  const analysis = await load(asset);
  if (!analysis || !analysis.beatsMs.length) return { error: LATIDO_NO_ANALYSIS };
  const beatsMs = mapBeatsToTimeline(item, analysis.beatsMs, options.fps);
  if (!beatsMs.length) return { error: 'El análisis no deja pulsos dentro de ese clip.' };
  return { beatsMs, bpm: analysis.bpm, itemId: item.id };
}
