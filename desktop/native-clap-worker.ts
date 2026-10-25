import {
  isDesktopInferenceRequestId,
  parseDesktopClapRequest,
  type DesktopClapRequest,
  type DesktopClapResponse,
  type DesktopInferenceProgress,
} from '../shared/desktop-inference.ts';
import {
  ClapInference,
  normalizeClapRuntimeConfig,
  type ClapRunOptions,
  type ClapRuntimeConfig,
} from '../shared/music-inference/clap.ts';

const LOAD_PROGRESS_SHARE = 0.25;

interface NativeClapWorkerConfig extends ClapRuntimeConfig {
  readonly origin: string;
}

const port = process.parentPort;
if (!port) throw new Error('native CLAP process requires a parent port');

let engine: ClapInference | null = null;
let queue = Promise.resolve();
const canceled = new Set<string>();

function initialize(value: unknown): void {
  if (typeof value !== 'object' || value === null) throw new Error('invalid native CLAP configuration');
  const origin = Reflect.get(value, 'origin');
  if (typeof origin !== 'string') throw new Error('invalid native CLAP configuration');
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
    throw new Error('invalid native CLAP origin');
  }
  const config: NativeClapWorkerConfig = { ...normalizeClapRuntimeConfig(value), origin };
  engine = new ClapInference(config);
}

function requireEngine(): ClapInference {
  if (!engine) throw new Error('native CLAP process is not initialized');
  return engine;
}

function postProgress(progress: DesktopInferenceProgress): void {
  port.postMessage({ type: 'progress', progress });
}

function runOptions(requestId: string): ClapRunOptions {
  return {
    onLoadProgress: (progress, file) => {
      if (canceled.has(requestId)) return;
      postProgress({ requestId, progress: progress * LOAD_PROGRESS_SHARE, ...(file ? { file } : {}) });
    },
    checkpoint: () => {
      if (canceled.has(requestId)) throw new DOMException('Native CLAP request canceled', 'AbortError');
    },
  };
}

async function embed(request: Extract<DesktopClapRequest, { action: 'embed' }>): Promise<DesktopClapResponse> {
  const active = requireEngine();
  const options = runOptions(request.requestId);
  const activeBackend = await active.load(options);
  const vector = await active.embed(request.samples, options);
  if (!canceled.has(request.requestId)) postProgress({ requestId: request.requestId, progress: 1 });
  return { requestId: request.requestId, backend: activeBackend, result: { type: 'embedding', vector } };
}

async function execute(request: DesktopClapRequest): Promise<DesktopClapResponse> {
  if (request.action === 'embed') return embed(request);
  const activeBackend = await requireEngine().load(runOptions(request.requestId));
  return { requestId: request.requestId, backend: activeBackend, result: { type: 'loaded' } };
}

function postCanceled(requestId: string): void {
  port.postMessage({
    type: 'error',
    requestId,
    name: 'AbortError',
    message: 'Native CLAP request canceled',
  });
}

async function handle(value: unknown): Promise<void> {
  const request = parseDesktopClapRequest(value);
  if (canceled.delete(request.requestId)) {
    postCanceled(request.requestId);
    return;
  }
  try {
    const response = await execute(request);
    if (canceled.delete(request.requestId)) postCanceled(request.requestId);
    else port.postMessage({ type: 'result', response });
  } catch (error) {
    if (canceled.delete(request.requestId)) {
      postCanceled(request.requestId);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    port.postMessage({ type: 'error', requestId: request.requestId, name: 'Error', message });
  }
}

function cancel(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  const requestId = Reflect.get(value, 'requestId');
  if (isDesktopInferenceRequestId(requestId)) canceled.add(requestId);
}

port.on('message', (event) => {
  const value = event.data;
  if (typeof value === 'object' && value !== null && Reflect.get(value, 'type') === 'initialize') {
    initialize(Reflect.get(value, 'config'));
    return;
  }
  if (typeof value === 'object' && value !== null && Reflect.get(value, 'type') === 'cancel') {
    cancel(value);
    return;
  }
  queue = queue.then(() => handle(value), () => handle(value));
});
