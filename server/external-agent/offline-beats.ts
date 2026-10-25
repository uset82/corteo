// Headless detect_beats. The browser path fetches /media/uploads; this process
// reads the library file and decodes it with ffmpeg.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { analyzeBeats, type BeatAnalysis } from '../../src/audio/beats.ts';
import { ffmpegBin } from '../media-binaries.ts';
import { resolveUploadFile, uploadNameOfSource } from '../media-dir.ts';

const execFileAsync = promisify(execFile);
const SAMPLE_RATE = 44100;

function localAudioPath(src: string): string | null {
  const name = uploadNameOfSource(src);
  if (name) return resolveUploadFile(name);
  return existsSync(src) ? src : null;
}

export async function analyzeLocalBeats(src: string): Promise<BeatAnalysis> {
  const file = localAudioPath(src);
  if (!file) throw new Error(`audio file not found: ${src}`);
  const { stdout } = await execFileAsync(ffmpegBin(), [
    '-v', 'error',
    '-i', file,
    '-f', 'f32le',
    '-ac', '1',
    '-ar', String(SAMPLE_RATE),
    'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const bytes = Buffer.from(stdout as unknown as Uint8Array);
  if (bytes.length < 4) throw new Error(`ffmpeg produced no samples for ${src}`);
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  return analyzeBeats(samples, SAMPLE_RATE);
}
