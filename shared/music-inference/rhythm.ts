import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute } from 'node:path';
import * as ort from 'onnxruntime-node';
import { RHYTHM_INFERENCE_CONTRACT } from '../vector-inference-contract.ts';
import type { DesktopInferenceBackend } from '../desktop-inference.ts';
import {
  BEAT_THIS_BORDER_FRAMES,
  BEAT_THIS_CHUNK_FRAMES,
  BEAT_THIS_EMPTY_LOGIT,
  BEAT_THIS_MEL_BINS,
  beatThisFrameCount,
  beatThisWindowStarts,
  preprocessBeatThisWindow,
  type BeatThisLogits,
  type BeatThisWindow,
  type BeatThisWindowLogits,
} from '../../src/audio/intelligence/beatThisPreprocess.ts';
import { analyzeBeatThisPeaks } from './beatThisAnalysis.ts';
import type { BeatThisAnalysis } from '../../src/audio/intelligence/types.ts';

export interface RhythmRuntimeConfig {
  readonly platform: 'darwin' | 'win32' | 'linux';
  readonly preferredBackend: DesktopInferenceBackend;
  readonly modelPath: string;
  readonly filterbankPath: string;
}

export interface RhythmRunOptions {
  readonly onProgress?: (progress: number) => void;
  /** Throws to abort between windows; the desktop worker routes cancellation here. */
  readonly checkpoint?: () => void;
}

export interface RhythmRunResult {
  readonly backend: DesktopInferenceBackend;
  readonly logits: BeatThisLogits;
}

export interface RhythmAnalysisResult extends RhythmRunResult {
  readonly analysis: BeatThisAnalysis;
}

interface LoadedRhythmModel {
  readonly backend: DesktopInferenceBackend;
  readonly session: ort.InferenceSession;
  readonly filterbank: Float32Array;
}

function isNativeRhythmBackend(value: unknown): value is DesktopInferenceBackend {
  return value === 'coreml' || value === 'cuda' || value === 'directml' || value === 'native-cpu';
}

/** Accepts the desktop worker's initialize payload and the server's own config alike. */
export function normalizeRhythmRuntimeConfig(value: unknown): RhythmRuntimeConfig {
  if (typeof value !== 'object' || value === null) throw new Error('invalid native rhythm configuration');
  const config = value as Partial<RhythmRuntimeConfig>;
  if ((config.platform !== 'darwin' && config.platform !== 'win32' && config.platform !== 'linux')
    || !isNativeRhythmBackend(config.preferredBackend)
    || typeof config.modelPath !== 'string' || !isAbsolute(config.modelPath)
    || typeof config.filterbankPath !== 'string' || !isAbsolute(config.filterbankPath)
    || basename(config.modelPath) !== RHYTHM_INFERENCE_CONTRACT.files.model.path
    || basename(config.filterbankPath) !== RHYTHM_INFERENCE_CONTRACT.files.filterbank.path
    || dirname(config.modelPath) !== dirname(config.filterbankPath)) {
    throw new Error('invalid native rhythm configuration');
  }
  return config as RhythmRuntimeConfig;
}

function executionProvider(backend: DesktopInferenceBackend): 'coreml' | 'cuda' | 'dml' | 'cpu' {
  if (backend === 'coreml' || backend === 'cuda') return backend;
  if (backend === 'directml') return 'dml';
  return 'cpu';
}

function backendForProvider(provider: 'coreml' | 'cuda' | 'dml' | 'cpu'): DesktopInferenceBackend {
  return provider === 'coreml'
    ? 'coreml'
    : provider === 'cuda' ? 'cuda'
      : provider === 'dml' ? 'directml' : 'native-cpu';
}

function report(options: RhythmRunOptions, progress: number): void {
  const onProgress = options.onProgress;
  if (!onProgress) return;
  onProgress(Math.max(0, Math.min(1, progress)));
}

function outputData(tensor: ort.Tensor, expected: number): Float32Array {
  if (!(tensor.data instanceof Float32Array) || tensor.data.length !== expected) {
    throw new Error(`native rhythm output shape mismatch: expected ${expected}`);
  }
  for (const value of tensor.data) {
    if (!Number.isFinite(value)) throw new Error('native rhythm model returned a non-finite logit');
  }
  return tensor.data;
}

function writeWindowLogits(
  logits: BeatThisLogits,
  window: BeatThisWindow,
  prediction: BeatThisWindowLogits,
): void {
  for (let frame = BEAT_THIS_BORDER_FRAMES; frame < window.frames - BEAT_THIS_BORDER_FRAMES; frame += 1) {
    const target = window.start + frame;
    if (target < 0 || target >= logits.beat.length) continue;
    logits.beat[target] = prediction.beat[frame]!;
    logits.downbeat[target] = prediction.downbeat[frame]!;
  }
}

/** One ONNX Beat This session shared by the desktop worker and the server runner. */
export class RhythmInference {
  private readonly config: RhythmRuntimeConfig;
  private loaded: LoadedRhythmModel | null = null;
  private loading: Promise<LoadedRhythmModel> | null = null;

  constructor(config: RhythmRuntimeConfig) {
    this.config = normalizeRhythmRuntimeConfig(config);
  }

  private async loadWithProvider(
    provider: 'coreml' | 'cuda' | 'dml' | 'cpu',
    filterbank: Float32Array,
  ): Promise<LoadedRhythmModel> {
    const session = await ort.InferenceSession.create(this.config.modelPath, {
      executionProviders: [provider],
      graphOptimizationLevel: 'all',
      logSeverityLevel: 3,
    });
    return { backend: backendForProvider(provider), session, filterbank };
  }

  private async createLoaded(options: RhythmRunOptions): Promise<LoadedRhythmModel> {
    const bytes = await readFile(this.config.filterbankPath);
    if (bytes.byteLength !== RHYTHM_INFERENCE_CONTRACT.files.filterbank.sizeBytes) {
      throw new Error('native rhythm filterbank size changed after verification');
    }
    const copied = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const filterbank = new Float32Array(copied);
    options.checkpoint?.();
    report(options, 0.1);
    const preferred = executionProvider(this.config.preferredBackend);
    if (preferred === 'cpu') return this.loadWithProvider(preferred, filterbank);
    try {
      return await this.loadWithProvider(preferred, filterbank);
    } catch {
      return this.loadWithProvider('cpu', filterbank);
    }
  }

  async load(options: RhythmRunOptions = {}): Promise<DesktopInferenceBackend> {
    if (!this.loaded) {
      if (!this.loading) {
        this.loading = this.createLoaded(options).then((result) => {
          this.loaded = result;
          return result;
        }).finally(() => {
          this.loading = null;
        });
      }
      await this.loading;
    }
    report(options, 0.4);
    return this.loaded!.backend;
  }

  private async runWindow(session: ort.InferenceSession, window: BeatThisWindow): Promise<BeatThisWindowLogits> {
    const input = new ort.Tensor('float32', window.values, [1, window.frames, BEAT_THIS_MEL_BINS]);
    const result = await session.run({ spect: input });
    if (!result.beat || !result.downbeat) {
      throw new Error('native rhythm model returned no beat/downbeat tensors');
    }
    return {
      beat: outputData(result.beat, window.frames),
      downbeat: outputData(result.downbeat, window.frames),
    };
  }

  private async runWindowWithFallback(
    active: LoadedRhythmModel,
    window: BeatThisWindow,
  ): Promise<{ active: LoadedRhythmModel; prediction: BeatThisWindowLogits }> {
    try {
      return { active, prediction: await this.runWindow(active.session, window) };
    } catch (error) {
      if (active.backend === 'native-cpu') throw error;
      await active.session.release().catch(() => undefined);
      const cpu = await this.loadWithProvider('cpu', active.filterbank);
      this.loaded = cpu;
      return { active: cpu, prediction: await this.runWindow(cpu.session, window) };
    }
  }

  async runLogits(samples: Float32Array, options: RhythmRunOptions = {}): Promise<RhythmRunResult> {
    await this.load(options);
    let active = this.loaded!;
    options.checkpoint?.();
    const fullFrames = beatThisFrameCount(samples);
    const starts = beatThisWindowStarts(fullFrames);
    const logits: BeatThisLogits = {
      beat: new Float32Array(fullFrames).fill(BEAT_THIS_EMPTY_LOGIT),
      downbeat: new Float32Array(fullFrames).fill(BEAT_THIS_EMPTY_LOGIT),
    };
    for (let index = starts.length - 1; index >= 0; index -= 1) {
      options.checkpoint?.();
      const completed = starts.length - index - 1;
      const window = preprocessBeatThisWindow(samples, active.filterbank, starts[index]!);
      if (window.frames > BEAT_THIS_CHUNK_FRAMES) throw new Error('native rhythm chunk exceeds model limit');
      report(options, 0.4 + (completed / starts.length) * 0.59);
      const result = await this.runWindowWithFallback(active, window);
      active = result.active;
      writeWindowLogits(logits, window, result.prediction);
      options.checkpoint?.();
    }
    report(options, 1);
    return { backend: active.backend, logits };
  }

  async analyze(samples: Float32Array, options: RhythmRunOptions = {}): Promise<RhythmAnalysisResult> {
    const result = await this.runLogits(samples, options);
    return {
      ...result,
      analysis: analyzeBeatThisPeaks(samples, RHYTHM_INFERENCE_CONTRACT.sampleRate, result.logits.beat, result.logits.downbeat),
    };
  }

  async dispose(): Promise<void> {
    const active = this.loaded;
    this.loaded = null;
    if (active) await active.session.release().catch(() => undefined);
  }
}
