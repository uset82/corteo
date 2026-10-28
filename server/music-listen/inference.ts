// Host side of the music inference workers. Two forked child processes, one per
// core: the rhythm core and the CLAP core each nest a different
// onnxruntime-node, and both libraries export the same libonnxruntime.so
// soname, so they must live in separate address spaces — worker_threads share
// one, which is why the desktop app forks its native workers too. Each child is
// spawned on the first request and kept warm between calls; it is unref'd while
// idle so an MCP/CLI process can still exit without an explicit dispose.
import { fork, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClapRuntimeConfig } from '../../shared/music-inference/clap.ts';
import type { RhythmRuntimeConfig } from '../../shared/music-inference/rhythm.ts';
import { normalizedMeanVector } from '../../shared/music-inference/clapWindows.ts';
import { CLAP_INFERENCE_CONTRACT } from '../../shared/vector-inference-contract.ts';
import { musicInferenceLoaded } from './loaded.ts';
import type { BeatThisAnalysis } from '../../src/audio/intelligence/types.ts';
import type { MusicInferenceWorkerKind } from './inference-worker.ts';
import type { MusicPackFiles } from './packs.ts';

musicInferenceLoaded.value = true;

const REQUEST_TIMEOUT_MS = 20 * 60_000;
const START_TIMEOUT_MS = 60_000;
const STDERR_TAIL = 4_000;

export interface MusicInferenceConfig {
  readonly rhythm: RhythmRuntimeConfig;
  readonly clap: ClapRuntimeConfig;
}

export interface MusicInferenceInput {
  /** Mono PCM at `sampleRate`; copied into the rhythm worker. */
  readonly samples: Float32Array;
  readonly sampleRate: number;
  /** 48 kHz CLAP windows; copied into the CLAP worker one at a time. */
  readonly windows: Float32Array[];
  readonly onProgress?: (phase: 'rhythm' | 'semantic', progress: number) => void;
}

export interface MusicInferenceOutput {
  readonly rhythm: BeatThisAnalysis;
  /** Mean of the window embeddings, unit-normalized. */
  readonly embedding: number[];
  /** One unit vector per CLAP window, in input order; sections are scored from these. */
  readonly windowEmbeddings: number[][];
  readonly backends: { readonly rhythm: string; readonly semantic: string };
}

export interface MusicInference {
  analyze(input: MusicInferenceInput): Promise<MusicInferenceOutput>;
  dispose(): Promise<void>;
}

interface PendingRequest {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (reason: Error) => void;
  readonly onProgress?: (progress: number) => void;
  readonly timer: NodeJS.Timeout;
}

function importMetaDir(): string {
  const url = new URL(import.meta.url);
  url.search = '';
  url.hash = '';
  return dirname(fileURLToPath(url));
}

/** Bundled hosts ship inference-worker.mjs next to the server bundle; tsx/Vite dev runs the .ts source. */
export function musicInferenceWorkerPath(): string {
  const directory = importMetaDir();
  for (const name of ['inference-worker.mjs', 'inference-worker.ts']) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`music inference worker is missing next to ${directory}`);
}

function forkOptions(): Parameters<typeof fork>[2] {
  return {
    // Native type stripping (Node 24) or the bundled .mjs; no host loader flags.
    execArgv: [],
    serialization: 'advanced',
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: {
      ...process.env,
      // Inside Electron, run the fork as plain node (the desktop shell's own
      // native services use utilityProcess for the same reason).
      ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    },
  };
}

/** One child process, one request in flight at a time, FIFO by call order. */
class WorkerChannel {
  private readonly kind: MusicInferenceWorkerKind;
  private readonly config: unknown;
  private child: ChildProcess | null = null;
  private starting: Promise<void> | null = null;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private tail: Promise<unknown> = Promise.resolve();
  private stderr = '';
  private closed = false;

  constructor(kind: MusicInferenceWorkerKind, config: unknown) {
    this.kind = kind;
    this.config = config;
  }

  private ensureChild(): ChildProcess {
    if (this.child) return this.child;
    const child = fork(musicInferenceWorkerPath(), [], forkOptions());
    child.stderr?.on('data', (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-STDERR_TAIL);
    });
    child.on('message', (message: unknown) => this.handleMessage(message));
    child.on('error', (error: Error) => {
      this.fail(new Error(`music inference worker failed to start: ${error.message}`));
    });
    child.on('exit', (code, signal) => {
      if (this.child !== child) return;
      const detail = this.stderr.trim().slice(-600);
      this.fail(new Error(
        `music inference worker exited with ${signal ? `signal ${signal}` : `code ${code}`}${detail ? `: ${detail}` : ''}`,
      ));
    });
    this.child = child;
    // The child starts ref'd so `start()` cannot lose its event loop while it
    // waits for `ready`; settle() drops the refs again when the request is done.
    this.setChildRefs(child, true);
    return child;
  }

  /**
   * A warm worker must not keep its host alive. The child handle and its IPC
   * channel are the obvious refs; the piped stderr is a third one, and leaving
   * it ref'd is why `occ song-film` used to sit in `do_epoll_wait` after its JSON.
   */
  private setChildRefs(child: ChildProcess, active: boolean): void {
    const stderr = child.stderr as unknown as { ref?: () => void; unref?: () => void } | null;
    if (active) {
      child.ref();
      child.channel?.ref();
      stderr?.ref?.();
      return;
    }
    child.unref();
    child.channel?.unref();
    stderr?.unref?.();
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const value = message as Record<string, unknown>;
    if (value.type === 'fatal') {
      const detail = typeof value.message === 'string' ? value.message.slice(0, 800) : 'no diagnostics';
      this.fail(new Error(detail));
      return;
    }
    const requestId = value.requestId;
    if (!Number.isSafeInteger(requestId)) return;
    const pending = this.pending.get(requestId as number);
    if (!pending) return;
    if (value.type === 'progress' && typeof value.progress === 'number') {
      pending.onProgress?.(value.progress);
      return;
    }
    if (value.type === 'error') {
      const detail = typeof value.message === 'string' ? value.message.slice(0, 800) : 'no diagnostics';
      this.settle(requestId as number, new Error(detail));
      return;
    }
    this.settle(requestId as number, undefined, value);
  }

  private settle(requestId: number, error?: Error, value?: Record<string, unknown>): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve(value!);
    if (this.pending.size === 0 && this.child) this.setChildRefs(this.child, false);
  }

  private fail(error: Error): void {
    this.resetChild();
    for (const requestId of [...this.pending.keys()]) this.settle(requestId, error);
  }

  private resetChild(): void {
    const child = this.child;
    this.child = null;
    this.starting = null;
    if (child) child.kill();
  }

  private start(): Promise<void> {
    if (this.starting) return this.starting;
    const child = this.ensureChild();
    this.starting = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        this.fail(new Error(`music inference worker did not start within ${START_TIMEOUT_MS / 1000}s`));
        reject(new Error('music inference worker did not start'));
      }, START_TIMEOUT_MS);
      const onMessage = (message: unknown) => {
        if (!message || typeof message !== 'object') return;
        const value = message as Record<string, unknown>;
        if (value.type !== 'ready') return;
        cleanup();
        resolve();
      };
      const onExit = () => {
        cleanup();
        reject(new Error('music inference worker exited before it was ready'));
      };
      const cleanup = () => {
        clearTimeout(timer);
        child.off('message', onMessage);
        child.off('exit', onExit);
      };
      child.on('message', onMessage);
      child.on('exit', onExit);
      child.send({ type: 'init', kind: this.kind, config: this.config });
    }).catch((error: unknown) => {
      this.starting = null;
      throw error instanceof Error ? error : new Error(String(error));
    });
    return this.starting;
  }

  private send(
    message: Record<string, unknown>,
    onProgress?: (progress: number) => void,
  ): Promise<Record<string, unknown>> {
    if (this.closed) return Promise.reject(new Error('music inference is disposed'));
    const child = this.ensureChild();
    const requestId = this.nextId++;
    const { promise, resolve, reject } = Promise.withResolvers<Record<string, unknown>>();
    const timer = setTimeout(
      () => this.fail(new Error(`music inference timed out after ${REQUEST_TIMEOUT_MS / 60_000} minutes`)),
      REQUEST_TIMEOUT_MS,
    );
    this.pending.set(requestId, { resolve, reject, onProgress, timer });
    this.setChildRefs(child, true);
    try {
      child.send({ ...message, requestId }, (error) => {
        if (error) this.settle(requestId, error);
      });
    } catch (error) {
      this.settle(requestId, error instanceof Error ? error : new Error(String(error)));
    }
    return promise;
  }

  request(
    message: Record<string, unknown>,
    onProgress?: (progress: number) => void,
  ): Promise<Record<string, unknown>> {
    // The child answers messages in order, but each answer is async; serialize
    // so two assets analyzed at once never interleave model calls.
    const run = this.tail
      .then(() => this.start())
      .then(() => this.send(message, onProgress));
    this.tail = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const child = this.child;
    this.child = null;
    this.starting = null;
    for (const requestId of [...this.pending.keys()]) this.settle(requestId, new Error('music inference is disposed'));
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    // By now every handle may be unref'd. Keep the child and a timer ref'd until
    // it exits, or Node drains the loop mid-`close()` and exits with an unsettled
    // top-level await (code 13).
    child.ref();
    let timer: NodeJS.Timeout | undefined;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, 5_000); });
    child.kill();
    try {
      await Promise.race([exited, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function rhythmResult(message: Record<string, unknown>): { analysis: BeatThisAnalysis; backend: string } {
  const analysis = message.analysis as Partial<BeatThisAnalysis> | undefined;
  if (!analysis || !Array.isArray(analysis.beatsMs) || !Array.isArray(analysis.downbeatsMs)
    || typeof message.backend !== 'string') {
    throw new Error('music inference worker returned an invalid rhythm result');
  }
  return { analysis: analysis as BeatThisAnalysis, backend: message.backend };
}

function embeddingResult(message: Record<string, unknown>): { vector: number[]; backend: string } {
  const vector = message.vector;
  if (!Array.isArray(vector) || vector.length !== CLAP_INFERENCE_CONTRACT.embeddingDimension
    || vector.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))
    || typeof message.backend !== 'string') {
    throw new Error('music inference worker returned an invalid embedding');
  }
  return { vector: vector as number[], backend: message.backend };
}

class ForkedMusicInference implements MusicInference {
  private readonly config: MusicInferenceConfig;
  private rhythm: WorkerChannel | null = null;
  private clap: WorkerChannel | null = null;
  private disposed = false;

  constructor(config: MusicInferenceConfig) {
    this.config = config;
  }

  private rhythmChannel(): WorkerChannel {
    this.rhythm ??= new WorkerChannel('rhythm', this.config.rhythm);
    return this.rhythm;
  }

  private clapChannel(): WorkerChannel {
    this.clap ??= new WorkerChannel('clap', this.config.clap);
    return this.clap;
  }

  async analyze(input: MusicInferenceInput): Promise<MusicInferenceOutput> {
    if (this.disposed) throw new Error('music inference is disposed');
    if (!(input.samples instanceof Float32Array) || input.samples.length === 0) {
      throw new Error('music inference requires decoded audio samples');
    }
    if (input.windows.length === 0) throw new Error('music inference requires at least one CLAP window');
    const rhythm = rhythmResult(await this.rhythmChannel().request(
      { type: 'analyze', samples: input.samples, sampleRate: input.sampleRate },
      (progress) => input.onProgress?.('rhythm', progress),
    ));
    input.onProgress?.('rhythm', 1);

    const clap = this.clapChannel();
    const sum = new Float64Array(CLAP_INFERENCE_CONTRACT.embeddingDimension);
    const windowEmbeddings: number[][] = [];
    let semanticBackend = '';
    for (let index = 0; index < input.windows.length; index += 1) {
      input.onProgress?.('semantic', index / input.windows.length);
      const embedded = embeddingResult(await clap.request({ type: 'embed', window: input.windows[index]! }));
      semanticBackend = embedded.backend;
      windowEmbeddings.push(embedded.vector);
      for (let dimension = 0; dimension < sum.length; dimension += 1) sum[dimension] += embedded.vector[dimension]!;
      input.onProgress?.('semantic', (index + 1) / input.windows.length);
    }
    return {
      rhythm: rhythm.analysis,
      embedding: normalizedMeanVector(sum, input.windows.length),
      windowEmbeddings,
      backends: { rhythm: rhythm.backend, semantic: semanticBackend },
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await Promise.all([this.rhythm?.close(), this.clap?.close()]);
    this.rhythm = null;
    this.clap = null;
  }
}

export function createWorkerMusicInference(config: MusicInferenceConfig): MusicInference {
  return new ForkedMusicInference(config);
}

function supportedPlatform(): 'darwin' | 'win32' | 'linux' {
  if (process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux') {
    return process.platform;
  }
  throw new Error(`music analysis is not supported on ${process.platform}`);
}

/** Headless hosts run the CPU providers: deterministic, no GPU contention with the editor. */
export function inferenceConfigForPacks(files: MusicPackFiles): MusicInferenceConfig {
  const platform = supportedPlatform();
  return {
    rhythm: {
      platform,
      preferredBackend: 'native-cpu',
      modelPath: files.rhythmModelPath,
      filterbankPath: files.rhythmFilterbankPath,
    },
    clap: { cacheDir: files.cacheDir, platform, preferredBackend: 'native-cpu' },
  };
}

let defaultInference: MusicInference | null = null;

export function defaultMusicInference(files: MusicPackFiles): MusicInference {
  if (!defaultInference) defaultInference = createWorkerMusicInference(inferenceConfigForPacks(files));
  return defaultInference;
}

export async function disposeDefaultMusicInference(): Promise<void> {
  const inference = defaultInference;
  defaultInference = null;
  if (inference) await inference.dispose();
}

/** Verification seam: installs a host a test can leave with a pending request. */
export function setDefaultMusicInferenceForTest(inference: MusicInference | null): void {
  defaultInference = inference;
}
