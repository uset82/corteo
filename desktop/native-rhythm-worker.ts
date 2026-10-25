import {
  isDesktopInferenceRequestId,
  isDesktopRhythmResponse,
  parseDesktopRhythmRequest,
  type DesktopInferenceProgress,
  type DesktopRhythmRequest,
  type DesktopRhythmResponse,
} from '../shared/desktop-inference.ts';
import {
  RhythmInference,
  normalizeRhythmRuntimeConfig,
  type RhythmRuntimeConfig,
} from '../shared/music-inference/rhythm.ts';

const port = process.parentPort;
if (!port) throw new Error('native rhythm process requires a parent port');
let runtime: RhythmRuntimeConfig | null = null;
let engine: RhythmInference | null = null;
let queue = Promise.resolve();
const canceled = new Set<string>();

function initialize(value: unknown): void {
  runtime = normalizeRhythmRuntimeConfig(value);
}

function requireEngine(): RhythmInference {
  if (!engine) {
    if (!runtime) throw new Error('native rhythm process is not initialized');
    engine = new RhythmInference(runtime);
  }
  return engine;
}

function throwIfCanceled(requestId: string): void {
  if (canceled.has(requestId)) throw new DOMException('Native rhythm request canceled', 'AbortError');
}

function report(requestId: string, progress: number): void {
  const message: DesktopInferenceProgress = {
    requestId,
    progress: Math.max(0, Math.min(1, progress)),
  };
  port.postMessage({ type: 'progress', progress: message });
}

function runOptions(requestId: string): { onProgress: (progress: number) => void; checkpoint: () => void } {
  return {
    onProgress: (progress) => report(requestId, progress),
    checkpoint: () => throwIfCanceled(requestId),
  };
}

async function analyze(
  request: Extract<DesktopRhythmRequest, { action: 'analyze' }>,
): Promise<DesktopRhythmResponse> {
  const result = await requireEngine().runLogits(request.samples, runOptions(request.requestId));
  return { requestId: request.requestId, backend: result.backend,
    result: { type: 'analysis', beat: result.logits.beat, downbeat: result.logits.downbeat } };
}

async function respond(request: DesktopRhythmRequest): Promise<DesktopRhythmResponse> {
  if (request.action === 'analyze') return analyze(request);
  const backend = await requireEngine().load(runOptions(request.requestId));
  throwIfCanceled(request.requestId);
  report(request.requestId, 1);
  return { requestId: request.requestId, backend, result: { type: 'loaded' } };
}

async function handle(value: unknown): Promise<void> {
  const request = parseDesktopRhythmRequest(value);
  try {
    const response = await respond(request);
    if (!isDesktopRhythmResponse(response)) throw new Error('native rhythm response failed validation');
    port.postMessage({ type: 'result', response });
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    const message = error instanceof Error ? error.message : String(error);
    port.postMessage({ type: 'error', requestId: request.requestId, name, message });
  } finally {
    canceled.delete(request.requestId);
  }
}

port.on('message', (event) => {
  const value = event.data;
  if (typeof value === 'object' && value !== null && Reflect.get(value, 'type') === 'initialize') {
    initialize(Reflect.get(value, 'config'));
    return;
  }
  if (typeof value === 'object' && value !== null && Reflect.get(value, 'type') === 'cancel') {
    const requestId = Reflect.get(value, 'requestId');
    if (!isDesktopInferenceRequestId(requestId)) throw new Error('invalid native rhythm cancellation');
    canceled.add(requestId);
    return;
  }
  queue = queue.then(() => handle(value), () => handle(value));
});
