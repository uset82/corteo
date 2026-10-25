// Child-process entry for headless music inference. One process serves exactly
// one core: the rhythm core loads onnxruntime-node directly while the CLAP core
// loads @huggingface/transformers, which nests a different onnxruntime-node.
// Both export the same libonnxruntime.so soname, so the two cores cannot share
// an address space — worker_threads would still collide, which is why the
// desktop app forks its native workers as separate processes too. Decoding,
// tags, sections and caching stay in the parent, where JSON imports and the
// project store are available.
import type { BeatThisAnalysis } from '../../src/audio/intelligence/types.ts';

export type MusicInferenceWorkerKind = 'rhythm' | 'clap';

export interface MusicInferenceWorkerInit {
  readonly type: 'init';
  readonly kind: MusicInferenceWorkerKind;
  readonly config: unknown;
}

export interface MusicInferenceWorkerRequest {
  readonly type: 'analyze' | 'embed';
  readonly requestId: number;
  readonly samples?: Float32Array;
  readonly sampleRate?: number;
  readonly window?: Float32Array;
}

type Job = (message: MusicInferenceWorkerRequest) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function send(message: Record<string, unknown>): void {
  if (typeof process.send === 'function') process.send(message);
}

function progress(requestId: number, value: number): void {
  send({
    type: 'progress',
    requestId,
    progress: Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)),
  });
}

async function rhythmJob(config: unknown): Promise<Job> {
  const { RhythmInference, normalizeRhythmRuntimeConfig } = await import('../../shared/music-inference/rhythm.ts');
  const rhythm = new RhythmInference(normalizeRhythmRuntimeConfig(config));
  return (message) => {
    if (message.type !== 'analyze' || !Number.isSafeInteger(message.requestId)) return;
    const { requestId, samples, sampleRate } = message;
    if (!(samples instanceof Float32Array) || samples.length === 0 || typeof sampleRate !== 'number') {
      send({ type: 'error', requestId, message: 'rhythm inference requires decoded samples' });
      return;
    }
    void rhythm.analyze(samples, { onProgress: (value) => progress(requestId, value) })
      .then((result) => {
        const analysis: BeatThisAnalysis = result.analysis;
        send({ type: 'rhythm', requestId, analysis, backend: result.backend });
      })
      .catch((error: unknown) => {
        send({ type: 'error', requestId, message: errorMessage(error) });
      });
  };
}

async function clapJob(config: unknown): Promise<Job> {
  const { ClapInference, normalizeClapRuntimeConfig } = await import('../../shared/music-inference/clap.ts');
  const clap = new ClapInference(normalizeClapRuntimeConfig(config));
  let backend: string | undefined;
  return (message) => {
    if (message.type !== 'embed' || !Number.isSafeInteger(message.requestId)) return;
    const { requestId, window } = message;
    if (!(window instanceof Float32Array) || window.length === 0) {
      send({ type: 'error', requestId, message: 'semantic inference requires a decoded window' });
      return;
    }
    void clap.embed(window)
      .then(async (vector) => {
        backend ??= await clap.load();
        send({ type: 'embedding', requestId, vector, backend });
      })
      .catch((error: unknown) => {
        send({ type: 'error', requestId, message: errorMessage(error) });
      });
  };
}

let job: Job | null = null;
let initializing = false;

process.on('message', (message: unknown) => {
  if (!message || typeof message !== 'object') return;
  const value = message as Record<string, unknown>;
  if (value.type === 'init') {
    if (initializing || job) return;
    initializing = true;
    const kind = value.kind;
    if (kind !== 'rhythm' && kind !== 'clap') {
      send({ type: 'fatal', message: 'music inference worker requires a rhythm or clap kind' });
      process.exit(1);
    }
    const start = kind === 'rhythm' ? rhythmJob : clapJob;
    void start(value.config)
      .then((ready) => {
        job = ready;
        send({ type: 'ready', kind });
      })
      .catch((error: unknown) => {
        send({ type: 'fatal', message: errorMessage(error) });
        process.exit(1);
      });
    return;
  }
  if (!job) {
    send({
      type: 'error',
      requestId: value.requestId,
      message: 'music inference worker is not initialized',
    });
    return;
  }
  job(value as unknown as MusicInferenceWorkerRequest);
});

// The parent owns the lifetime of this process.
process.on('disconnect', () => process.exit(0));
