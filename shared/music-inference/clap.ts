import {
  AutoProcessor,
  ClapAudioModelWithProjection,
  env,
  type Processor,
} from '@huggingface/transformers';
import { CLAP_INFERENCE_CONTRACT } from '../vector-inference-contract.ts';
import type { DesktopInferenceBackend } from '../desktop-inference.ts';

export type ClapRuntimeBackend = 'cuda' | 'directml' | 'native-cpu';

export interface ClapRuntimeConfig {
  readonly cacheDir: string;
  readonly platform: NodeJS.Platform;
  readonly preferredBackend: ClapRuntimeBackend;
}

export interface ClapRunOptions {
  readonly onLoadProgress?: (progress: number, file?: string) => void;
  readonly checkpoint?: () => void;
}

export function isClapRuntimeBackend(value: unknown): value is ClapRuntimeBackend {
  return value === 'cuda' || value === 'directml' || value === 'native-cpu';
}

/** Validate the shared part of the native CLAP configuration (origin stays in the desktop worker). */
export function normalizeClapRuntimeConfig(value: unknown): ClapRuntimeConfig {
  if (typeof value !== 'object' || value === null) throw new Error('invalid native CLAP configuration');
  const config = value as Partial<ClapRuntimeConfig>;
  if (typeof config.cacheDir !== 'string' || config.cacheDir.length === 0
    || (config.platform !== 'win32' && config.platform !== 'darwin' && config.platform !== 'linux')
    || !isClapRuntimeBackend(config.preferredBackend)) {
    throw new Error('invalid native CLAP configuration');
  }
  return config as ClapRuntimeConfig;
}

function backendDevice(backend: ClapRuntimeBackend): 'cpu' | 'cuda' | 'dml' {
  if (backend === 'directml') return 'dml';
  if (backend === 'cuda') return 'cuda';
  return 'cpu';
}

function progressInfo(value: unknown): { progress: number | null; file?: string } {
  if (typeof value !== 'object' || value === null) return { progress: null };
  const candidate = value as { progress?: unknown; file?: unknown };
  const raw = candidate.progress;
  const normalized = typeof raw === 'number' && Number.isFinite(raw)
    ? Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw))
    : null;
  return {
    progress: normalized,
    ...(typeof candidate.file === 'string' ? { file: candidate.file } : {}),
  };
}

function normalizedVector(values: ArrayLike<number>): number[] {
  if (values.length !== CLAP_INFERENCE_CONTRACT.embeddingDimension) {
    throw new Error(`CLAP returned ${values.length} dimensions; expected ${CLAP_INFERENCE_CONTRACT.embeddingDimension}`);
  }
  let squaredLength = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!Number.isFinite(value)) throw new Error('CLAP returned a non-finite embedding');
    squaredLength += value * value;
  }
  const length = Math.sqrt(squaredLength);
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    throw new Error('CLAP returned a zero-length embedding');
  }
  return Array.from(values, (value) => value / length);
}

function embeddingData(output: unknown): ArrayLike<number> {
  if (!output || typeof output !== 'object') throw new Error('CLAP returned an invalid response');
  const tensor = (output as Record<string, unknown>).audio_embeds;
  if (!tensor || typeof tensor !== 'object') throw new Error('CLAP returned no audio embedding');
  const data = (tensor as Record<string, unknown>).data;
  const numericView = ArrayBuffer.isView(data) && !(data instanceof DataView) && 'length' in data;
  if (!Array.isArray(data) && !numericView) throw new Error('CLAP returned invalid embedding data');
  return data as ArrayLike<number>;
}

/** One local CLAP model shared by the desktop worker and the server runner. */
export class ClapInference {
  private readonly config: ClapRuntimeConfig;
  private processor: Processor | null = null;
  private model: ClapAudioModelWithProjection | null = null;
  private backend: DesktopInferenceBackend | null = null;
  private loading: Promise<void> | null = null;

  constructor(config: ClapRuntimeConfig) {
    this.config = normalizeClapRuntimeConfig(config);
    env.localModelPath = this.config.cacheDir;
    env.cacheDir = this.config.cacheDir;
    env.useFSCache = true;
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
  }

  private openReporter(options: ClapRunOptions): (value: unknown) => void {
    let reported = 0;
    return (value) => {
      options.checkpoint?.();
      const info = progressInfo(value);
      if (info.progress === null) return;
      reported = Math.max(reported, info.progress);
      options.onLoadProgress?.(reported, info.file);
    };
  }

  private async ensureProcessor(report: (value: unknown) => void): Promise<Processor> {
    if (this.processor) return this.processor;
    this.processor = await AutoProcessor.from_pretrained(CLAP_INFERENCE_CONTRACT.modelId, {
      revision: CLAP_INFERENCE_CONTRACT.revision,
      progress_callback: report,
    });
    return this.processor;
  }

  private loadModel(backend: ClapRuntimeBackend, report: (value: unknown) => void): Promise<ClapAudioModelWithProjection> {
    return ClapAudioModelWithProjection.from_pretrained(CLAP_INFERENCE_CONTRACT.modelId, {
      revision: CLAP_INFERENCE_CONTRACT.revision,
      device: backendDevice(backend),
      dtype: CLAP_INFERENCE_CONTRACT.dtype,
      progress_callback: report,
    });
  }

  private async loadPreferredModel(options: ClapRunOptions): Promise<void> {
    const report = this.openReporter(options);
    await this.ensureProcessor(report);
    const preferred = this.config.preferredBackend;
    try {
      this.model = await this.loadModel(preferred, report);
      this.backend = preferred;
    } catch (error) {
      if (preferred === 'native-cpu') throw error;
      this.model = await this.loadModel('native-cpu', report);
      this.backend = 'native-cpu';
    }
  }

  async load(options: ClapRunOptions = {}): Promise<DesktopInferenceBackend> {
    if (this.model && this.processor && this.backend) return this.backend;
    if (!this.loading) {
      this.loading = this.loadPreferredModel(options).finally(() => {
        this.loading = null;
      });
    }
    await this.loading;
    if (!this.model || !this.processor || !this.backend) throw new Error('native CLAP model failed to load');
    return this.backend;
  }

  /** Embed one already-resampled 48 kHz mono window; returns a unit vector. */
  async embed(samples: Float32Array, options: ClapRunOptions = {}): Promise<number[]> {
    await this.load(options);
    if (!this.model || !this.processor) throw new Error('native CLAP model is not loaded');
    options.checkpoint?.();
    const inputs = await this.processor(samples);
    const vector = normalizedVector(embeddingData(await this.model(inputs)));
    options.checkpoint?.();
    return vector;
  }

  async dispose(): Promise<void> {
    const model = this.model as (ClapAudioModelWithProjection & { dispose?: () => Promise<void> }) | null;
    this.model = null;
    this.processor = null;
    this.backend = null;
    await model?.dispose?.().catch(() => undefined);
  }
}
