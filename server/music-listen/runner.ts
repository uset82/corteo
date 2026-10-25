// Headless music analysis: decode with ffmpeg, run the shared model cores in a
// worker thread, tag/section in-process, then write the same cache record the
// browser badge reads. No editor tab, Web Audio, or IndexedDB is involved.
import { sourceRevisionOf } from '../../src/editor/mediaSourceRevision.ts';
import { BEAT_THIS_SAMPLE_RATE } from '../../src/audio/intelligence/beatThisPreprocess.ts';
import { tagsFromClapEmbedding } from '../../src/audio/intelligence/clapProfile.ts';
import type { MediaAsset } from '../../src/editor/types.ts';
import type { MusicAnalysis } from '../../src/audio/intelligence/types.ts';
import {
  CLAP_WINDOW_SECONDS,
  sourceWindowStarts,
} from '../../shared/music-inference/clapWindows.ts';
import { composeMusicAnalysis, normalizeMusicEmbedding } from '../../shared/music-inference/compose.ts';
import { CLAP_INFERENCE_CONTRACT } from '../../shared/vector-inference-contract.ts';
import { decodeAudioFile, type DecodeAudioOptions } from './decode.ts';
import { loadStoredMusicAnalysis, saveStoredMusicAnalysis } from './cache.ts';
import { resolveMusicMediaPath } from './media-path.ts';
import { inspectMusicPacks, type MusicPackId } from './packs.ts';
import {
  defaultMusicInference,
  type MusicInference,
  type MusicInferenceOutput,
} from './inference.ts';
import { MAX_MUSIC_ANALYSIS_SECONDS } from './limits.ts';

export type MusicAnalysisPhase = 'decode' | 'rhythm' | 'semantic';

export interface MusicAnalysisStore {
  read(assetId: string, sourceRevision: string): Promise<MusicAnalysis | null>;
  write(analysis: MusicAnalysis): Promise<void>;
}

export interface AnalyzeServerMusicOptions {
  readonly force?: boolean;
  readonly onProgress?: (phase: MusicAnalysisPhase, progress: number) => void;
  /** Verification seams: when supplied, flights and model-pack checks are skipped. */
  readonly inference?: MusicInference;
  readonly decode?: (file: string, sampleRate: number, options: DecodeAudioOptions) => Promise<Float32Array>;
  readonly store?: MusicAnalysisStore;
  readonly mediaPath?: (src: string) => string | undefined;
  readonly cacheDir?: string;
}

const DEFAULT_STORE: MusicAnalysisStore = {
  read: loadStoredMusicAnalysis,
  write: saveStoredMusicAnalysis,
};

export class MissingMusicPacksError extends Error {
  readonly missing: readonly { readonly id: MusicPackId; readonly status: 'absent' }[];

  constructor(missing: readonly { readonly id: MusicPackId; readonly status: 'absent' }[]) {
    super(`music model pack(s) are not installed: ${missing.map((pack) => pack.id).join(', ')}`);
    this.name = 'MissingMusicPacksError';
    this.missing = missing;
  }
}

function report(
  options: AnalyzeServerMusicOptions,
  phase: MusicAnalysisPhase,
  progress: number,
): void {
  options.onProgress?.(phase, Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)));
}

/** The CLAP processor resamples/truncates to its 10 s context; pad a short tail to keep every call uniform. */
function paddedWindow(samples: Float32Array, expected: number): Float32Array {
  if (samples.length >= expected) return samples.slice(0, expected);
  const padded = new Float32Array(expected);
  padded.set(samples);
  return padded;
}

async function decodeWindows(
  file: string,
  starts: readonly number[],
  decode: NonNullable<AnalyzeServerMusicOptions['decode']>,
  options: AnalyzeServerMusicOptions,
): Promise<Float32Array[]> {
  const expected = CLAP_INFERENCE_CONTRACT.sampleRate * CLAP_WINDOW_SECONDS;
  const windows: Float32Array[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const decoded = await decode(file, CLAP_INFERENCE_CONTRACT.sampleRate, {
      startSeconds: starts[index]! / BEAT_THIS_SAMPLE_RATE,
      durationSeconds: CLAP_WINDOW_SECONDS,
      maxSeconds: CLAP_WINDOW_SECONDS + 1,
    });
    windows.push(paddedWindow(decoded, expected));
    report(options, 'decode', 0.6 + (0.4 * (index + 1)) / starts.length);
  }
  return windows;
}

async function runInference(
  file: string,
  options: AnalyzeServerMusicOptions,
): Promise<{ output: MusicInferenceOutput; durationMs: number }> {
  let inference = options.inference;
  if (!inference) {
    // Fail before paying for a full decode when the packs are not installed.
    const packs = await inspectMusicPacks(options.cacheDir);
    if (!packs.installed || !packs.files) throw new MissingMusicPacksError(packs.missing);
    inference = defaultMusicInference(packs.files);
  }
  const decode = options.decode ?? decodeAudioFile;
  report(options, 'decode', 0);
  const samples = await decode(file, BEAT_THIS_SAMPLE_RATE, { maxSeconds: MAX_MUSIC_ANALYSIS_SECONDS });
  const durationMs = Math.round((samples.length / BEAT_THIS_SAMPLE_RATE) * 1000);
  if (!samples.length || !durationMs) throw new Error('Decoded media contains no audio samples');
  report(options, 'decode', 0.3);

  const starts = sourceWindowStarts(samples.length, BEAT_THIS_SAMPLE_RATE);
  const windows = await decodeWindows(file, starts, decode, options);

  report(options, 'rhythm', 0);
  const output = await inference.analyze({
    samples,
    sampleRate: BEAT_THIS_SAMPLE_RATE,
    windows,
    onProgress: (phase, progress) => report(options, phase, progress),
  });
  return { output, durationMs };
}

async function analyzeOnce(
  asset: MediaAsset,
  options: AnalyzeServerMusicOptions,
): Promise<MusicAnalysis> {
  const sourceRevision = sourceRevisionOf(asset);
  const store = options.store ?? DEFAULT_STORE;
  if (!options.force) {
    const cached = await store.read(asset.id, sourceRevision);
    if (cached) return cached;
  }
  if (!asset.src) throw new Error('music analysis requires a ready media source');
  const resolvePath = options.mediaPath ?? ((src: string) => resolveMusicMediaPath(src));
  const file = resolvePath(asset.src);
  if (!file) {
    throw new Error(`media source ${asset.src.slice(0, 200)} is not available on this machine; re-import the file before analyzing`);
  }
  const { output, durationMs } = await runInference(file, options);
  const embedding = normalizeMusicEmbedding(output.embedding);
  const analysis = composeMusicAnalysis({
    assetId: asset.id,
    sourceRevision,
    durationMs,
    rhythm: output.rhythm,
    tags: tagsFromClapEmbedding(embedding),
    embedding,
  });
  report(options, 'semantic', 1);
  await store.write(analysis);
  return analysis;
}

const flights = new Map<string, Promise<MusicAnalysis>>();

/** Deduplicates concurrent tool calls for one asset; injected verifies always run fresh. */
export function analyzeServerMusicAsset(
  asset: MediaAsset,
  options: AnalyzeServerMusicOptions = {},
): Promise<MusicAnalysis> {
  if (options.inference || options.decode || options.store) return analyzeOnce(asset, options);
  const key = `${asset.id}\0${sourceRevisionOf(asset)}\0${options.force === true ? 'force' : 'cached'}`;
  const current = flights.get(key);
  if (current) return current;
  const flight = analyzeOnce(asset, options).finally(() => {
    if (flights.get(key) === flight) flights.delete(key);
  });
  flights.set(key, flight);
  return flight;
}
