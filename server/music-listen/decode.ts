// ffmpeg-backed PCM decode for the headless music runner. The browser path
// resamples through Web Audio; here ffmpeg is the only decoder available, so the
// same 22.05 kHz mono stream feeds the rhythm core and each CLAP window is
// decoded natively at 48 kHz instead of being upsampled in JS.
import { spawnMediaProcess } from '../media-process.ts';
import { ffmpegBin } from '../media-binaries.ts';

const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const BYTES_PER_SAMPLE = 4;

export interface DecodeAudioOptions {
  readonly signal?: AbortSignal;
  /** Seek this many seconds into the source before reading. */
  readonly startSeconds?: number;
  /** Read at most this many seconds. */
  readonly durationSeconds?: number;
  /** Hard cap for the whole decode; guard against a runaway source duration. */
  readonly maxSeconds?: number;
  readonly timeoutMs?: number;
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error(signal.reason === undefined ? 'Audio decode aborted' : String(signal.reason));
  error.name = 'AbortError';
  return error;
}

function seconds(value: number, label: string): string {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number of seconds`);
  return value.toFixed(3);
}

/** Mono float32 PCM at `sampleRate`; rejects empty audio instead of returning a silent buffer. */
export function decodeAudioFile(
  file: string,
  sampleRate: number,
  options: DecodeAudioOptions = {},
): Promise<Float32Array> {
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000) {
    throw new Error(`Invalid audio sample rate: ${sampleRate}`);
  }
  if (!file) throw new Error('Audio decode requires a local file path');
  const maxSeconds = options.maxSeconds ?? 15 * 60;
  const args = ['-v', 'error', '-nostdin'];
  if (options.startSeconds !== undefined) args.push('-ss', seconds(options.startSeconds, 'startSeconds'));
  if (options.durationSeconds !== undefined) args.push('-t', seconds(options.durationSeconds, 'durationSeconds'));
  args.push(
    '-i', file,
    '-vn', '-sn', '-dn',
    '-ac', '1',
    '-ar', String(sampleRate),
    '-f', 'f32le',
    '-acodec', 'pcm_f32le',
    'pipe:1',
  );
  const byteLimit = Math.ceil(maxSeconds * sampleRate * BYTES_PER_SAMPLE);
  return new Promise<Float32Array>((resolve, reject) => {
    const child = spawnMediaProcess(ffmpegBin(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let stderr = '';
    let total = 0;
    let settled = false;
    const finish = (error?: Error, value?: Float32Array): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (error) {
        child.kill('SIGKILL');
        reject(error);
        return;
      }
      resolve(value!);
    };
    const onAbort = () => finish(options.signal ? abortError(options.signal) : new Error('Audio decode aborted'));
    const timer = setTimeout(
      () => finish(new Error(`Audio decode timed out after ${Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)}s`)),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > byteLimit + 4) {
        finish(new Error(`Audio exceeds the ${Math.round(maxSeconds / 60)}-minute decode limit`));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 8_192) stderr += chunk.toString('utf8');
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(new Error(`ffmpeg failed to start: ${error.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        finish(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-600) || 'no diagnostics'}`));
        return;
      }
      const buffer = Buffer.concat(chunks, total);
      const sampleCount = Math.floor(buffer.length / BYTES_PER_SAMPLE);
      if (!sampleCount) {
        finish(new Error('Decoded media contains no audio samples'));
        return;
      }
      finish(undefined, new Float32Array(buffer.buffer, buffer.byteOffset, sampleCount).slice());
    });
  });
}
