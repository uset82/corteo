// listen_to_song: the whole listening pass in one call. Model analysis first
// (cached when possible), DSP measurements always, two pictures, and one
// bounded text result. Without the model packs the same call still answers
// with the fallback pulse, energy sections and pictures.
import { BEAT_THIS_SAMPLE_RATE } from '../../src/audio/intelligence/beatThisPreprocess.ts';
import {
  MUSIC_ANALYSIS_SCHEMA_VERSION,
  type MusicAnalysis,
} from '../../src/audio/intelligence/types.ts';
import {
  buildSongMap,
  measureSong,
  type SongLyricWord,
  type SongMap,
} from '../../src/audio/listen/index.ts';
import { fallbackListening } from '../../src/audio/listen/fallback.ts';
import { sourceRevisionOf } from '../../src/editor/mediaSourceRevision.ts';
import type { MediaAsset } from '../../src/editor/types.ts';
import {
  buildListenSnapshot,
  normalizeListenRange,
  type ListenRange,
} from '../../shared/music-inference/listen-snapshot.ts';
import { songMapCacheKey, songMapRemoteKey } from '../../shared/music-inference/song-map-record.ts';
import { decodeAudioFile } from './decode.ts';
import { MAX_MUSIC_ANALYSIS_SECONDS } from './limits.ts';
import { resolveMusicMediaPath } from './media-path.ts';
import {
  renderSongMapPng,
  renderSpectrogramPng,
  type SongPictureInput,
} from './pictures.ts';
import { analyzeServerMusicAsset, MissingMusicPacksError } from './runner.ts';
import { saveStoredSongMap } from './song-map-cache.ts';

export interface ListenSongOptions {
  readonly fromMs?: number;
  readonly toMs?: number;
  /** Defaults to true; text data is still returned when a picture cannot be drawn. */
  readonly pictures?: boolean;
  readonly transcriptWords?: readonly SongLyricWord[];
  readonly onProgress?: (phase: string, progress: number) => void;
  /** Verification seams; production calls use the runner, ffmpeg and sharp. */
  readonly analyze?: (asset: MediaAsset) => Promise<MusicAnalysis>;
  readonly decode?: typeof decodeAudioFile;
  readonly mediaPath?: (src: string) => string | undefined;
  readonly renderMap?: (input: SongPictureInput) => Promise<Buffer>;
  readonly renderSpectrogram?: (file: string) => Promise<Buffer>;
}

interface EmbeddedPicture {
  readonly frame: number;
  readonly base64: string;
  readonly mimeType: 'image/png';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function listenToSong(
  asset: MediaAsset,
  options: ListenSongOptions = {},
): Promise<Record<string, unknown>> {
  const sourceRevision = sourceRevisionOf(asset);
  const resolvePath = options.mediaPath ?? ((src: string) => resolveMusicMediaPath(src));
  const file = asset.src ? resolvePath(asset.src) : undefined;
  const notes: string[] = [];

  // 1. The model pass. A cached analysis answers even when the media file is gone.
  let analysis: MusicAnalysis | null = null;
  try {
    options.onProgress?.('modelo', 0.05);
    const analyze = options.analyze
      ?? ((target: MediaAsset) => analyzeServerMusicAsset(target, { onProgress: options.onProgress }));
    analysis = await analyze(asset);
  } catch (error) {
    if (error instanceof MissingMusicPacksError) {
      notes.push(`Faltan los paquetes de modelos (${error.missing.map((pack) => pack.id).join(', ')}); el pulso y las secciones son estimaciones DSP.`);
    } else {
      notes.push(`El análisis con modelos falló (${errorMessage(error).slice(0, 160)}); se usan medidas DSP.`);
    }
  }

  // 2. Physical measurements for the curves, moments, key and pictures.
  let samples: Float32Array | null = null;
  let decodeError: string | undefined;
  if (file) {
    try {
      options.onProgress?.('medidas', 0.7);
      const decode = options.decode ?? decodeAudioFile;
      samples = await decode(file, BEAT_THIS_SAMPLE_RATE, { maxSeconds: MAX_MUSIC_ANALYSIS_SECONDS });
    } catch (error) {
      decodeError = errorMessage(error);
    }
  }
  if (!analysis && !samples) {
    throw new Error([
      'no se pudo escuchar el audio',
      decodeError ? `decodificación: ${decodeError}` : '',
      ...notes,
    ].filter(Boolean).join(' · '));
  }
  if (analysis && decodeError) {
    notes.push(`No se pudieron medir curvas ni momentos (${decodeError.slice(0, 160)}).`);
  }

  const measurements = samples ? measureSong(samples, BEAT_THIS_SAMPLE_RATE) : null;
  const durationMs = Math.round(analysis?.durationMs ?? measurements?.durationMs ?? 0);
  if (!(durationMs > 0)) throw new Error('the song has no measurable duration');
  const range: ListenRange = normalizeListenRange(options.fromMs, options.toMs, durationMs);

  // 3. Without the packs the beat tracker and energy sections answer instead.
  const fallback = !analysis && samples && measurements
    ? fallbackListening(samples, BEAT_THIS_SAMPLE_RATE, measurements)
    : null;
  const sections = analysis?.sections ?? fallback?.sections ?? [];
  const beatsMs = analysis?.beatsMs ?? fallback?.beatsMs ?? [];
  const downbeatsMs = analysis?.downbeatsMs ?? fallback?.downbeatsMs ?? [];
  const bpm = analysis?.bpm ?? fallback?.bpm;
  const beatConfidence = analysis?.beatConfidence ?? fallback?.beatConfidence;
  const meter = analysis?.meter;

  // 4. The song map. Only a model map is cached: a DSP map must not shadow the
  //    real one once the packs are installed.
  let songMap: SongMap | null = null;
  if (sections.length) {
    const mapAnalysis: MusicAnalysis = analysis ?? {
      schemaVersion: MUSIC_ANALYSIS_SCHEMA_VERSION,
      assetId: asset.id,
      sourceRevision,
      createdAt: 0,
      durationMs,
      modelPacks: { rhythm: 'dsp-fallback', semantic: 'dsp-fallback' },
      bpm: bpm ?? 0,
      meter: 0,
      beatConfidence: beatConfidence ?? 0,
      beatsMs: [...beatsMs],
      downbeatsMs: [...downbeatsMs],
      sections: [...sections],
      tags: [],
      embedding: [],
    };
    songMap = buildSongMap({ analysis: mapAnalysis, transcriptWords: options.transcriptWords ?? [] });
  }
  let songMapRef: string | null = null;
  if (analysis && songMap) {
    try {
      await saveStoredSongMap(songMap);
      songMapRef = await songMapRemoteKey(songMapCacheKey(asset.id, sourceRevision));
    } catch (error) {
      notes.push(`No se pudo guardar el mapa de la canción (${errorMessage(error).slice(0, 160)}).`);
    }
  }

  // 5. The two pictures. Each one may fail alone.
  const pictures = { map: false, spectrogram: false };
  const images: EmbeddedPicture[] = [];
  if (options.pictures !== false) {
    if (sections.length) {
      try {
        options.onProgress?.('mapa', 0.85);
        const png = await (options.renderMap ?? renderSongMapPng)({
          analysis: { durationMs, beatsMs, downbeatsMs, sections },
          measurements: measurements ?? undefined,
          songMap: songMap ?? undefined,
          title: asset.name,
        });
        images.push({ frame: 0, base64: png.toString('base64'), mimeType: 'image/png' });
        pictures.map = true;
      } catch (error) {
        notes.push(`No se pudo dibujar el mapa (${errorMessage(error).slice(0, 160)}).`);
      }
    }
    if (file) {
      try {
        options.onProgress?.('espectrograma', 0.9);
        const png = await (options.renderSpectrogram ?? renderSpectrogramPng)(file);
        images.push({ frame: 0, base64: png.toString('base64'), mimeType: 'image/png' });
        pictures.spectrogram = true;
      } catch (error) {
        notes.push(`No se pudo dibujar el espectrograma (${errorMessage(error).slice(0, 160)}).`);
      }
    }
  }

  // 6. One Spanish summary plus compact JSON, deterministically under the limit.
  const snapshot = buildListenSnapshot({
    assetName: asset.name,
    durationMs,
    range,
    analysisSource: analysis ? 'model' : 'dsp',
    analysisNote: notes.length ? notes.join(' ') : undefined,
    bpm,
    meter,
    beatConfidence,
    sections,
    beatsMs,
    downbeatsMs,
    measurements,
    songMap,
    songMapRef,
    pictures,
  });
  options.onProgress?.('listo', 1);
  return {
    ok: true,
    summary: snapshot.summaryEs,
    ...snapshot.data,
    ...(images.length ? { __images: images } : {}),
  };
}
