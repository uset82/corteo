// The two pictures a seeing model reads: a drawn song map and an ffmpeg
// spectrogram. The SVG is built separately from the rasterization so the
// verifies can inspect labels without decoding pixels.
/// <reference path="./sharp.d.ts" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { displayMusicLabel } from '../../src/audio/intelligence/clapProfile.ts';
import type { MusicAnalysis, MusicSection } from '../../src/audio/intelligence/types.ts';
import type { Moment, SongMeasurements } from '../../src/audio/listen/types.ts';
import { displaySectionRole, type SongMap, type SongMapSection } from '../../src/audio/listen/songMap.ts';
import { spawnMediaProcess } from '../media-process.ts';
import { ffmpegBin } from '../media-binaries.ts';

export const MAP_WIDTH = 1280;
export const MAP_HEIGHT = 720;
export const SPECTROGRAM_WIDTH = 1280;
export const SPECTROGRAM_HEIGHT = 480;

const LEFT = 64;
const RIGHT = 24;
const PLOT = MAP_WIDTH - LEFT - RIGHT;
const MAX_LYRIC_LINES = 14;
const MAX_LYRIC_CHARS = 96;

const ROLE_COLOR: Record<MusicSection['role'], string> = {
  'intro-like': '#3b6ea8',
  build: '#b07a2e',
  peak: '#c0446c',
  break: '#4a5568',
  steady: '#3f7d5e',
  'outro-like': '#5a6b94',
};

export interface SongPictureInput {
  readonly analysis: Pick<MusicAnalysis, 'durationMs' | 'beatsMs' | 'downbeatsMs' | 'sections'>;
  readonly measurements?: Pick<SongMeasurements, 'frames' | 'moments'>;
  readonly songMap?: Pick<SongMap, 'lines' | 'sections'>;
  readonly title?: string;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(ms) ? ms : 0) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xOf(timeMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return LEFT;
  return LEFT + Math.max(0, Math.min(1, timeMs / durationMs)) * PLOT;
}

function tickSeconds(durationMs: number): number {
  const duration = durationMs / 1000;
  for (const step of [15, 30, 60, 120, 300, 600, 1200]) {
    if (duration / step <= 10) return step;
  }
  return 2400;
}

function polyline(values: readonly { timeMs: number; value: number }[], peak: number, top: number, height: number, durationMs: number): string {
  if (!values.length || !(peak > 0)) return '';
  return values.map((point) => {
    const x = xOf(point.timeMs, durationMs).toFixed(1);
    const y = (top + height - Math.max(0, Math.min(1, point.value / peak)) * height).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
}

function downsample<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const step = Math.ceil(items.length / max);
  return items.filter((_, index) => index % step === 0);
}

function lineText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_LYRIC_CHARS ? `${flat.slice(0, MAX_LYRIC_CHARS - 1)}…` : flat;
}

function sectionsOf(input: SongPictureInput): readonly (MusicSection | SongMapSection)[] {
  return input.songMap?.sections ?? input.analysis.sections;
}

function momentText(moment: Moment): string {
  return moment.kind === 'vocals-in' || moment.kind === 'vocals-out' ? moment.kind : moment.kind;
}

/** Pure SVG: every label the verify checks for is produced here. */
export function buildSongMapSvg(input: SongPictureInput): string {
  const { durationMs } = input.analysis;
  const title = escapeXml(input.title ?? 'Mapa de la canción');
  const pieces: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">`,
    '<rect width="100%" height="100%" fill="#0f1218"/>',
    `<text x="${LEFT}" y="30" fill="#e8edf5" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="600">${title}</text>`,
    `<text x="${MAP_WIDTH - RIGHT}" y="30" text-anchor="end" fill="#8b98ab" font-family="Helvetica, Arial, sans-serif" font-size="14">${formatClock(durationMs)}</text>`,
  ];

  const step = tickSeconds(durationMs);
  const grid: string[] = [];
  for (let seconds = 0; seconds * 1000 <= durationMs; seconds += step) {
    const x = xOf(seconds * 1000, durationMs).toFixed(1);
    grid.push(`<line x1="${x}" y1="44" x2="${x}" y2="${MAP_HEIGHT - 28}" stroke="#1e2633" stroke-width="1"/>`);
    grid.push(`<text x="${x}" y="${MAP_HEIGHT - 8}" text-anchor="middle" fill="#8b98ab" font-family="Helvetica, Arial, sans-serif" font-size="12">${formatClock(seconds * 1000)}</text>`);
  }
  pieces.push(...grid);

  const frames = downsample(input.measurements?.frames ?? [], 640);
  const rmsPeak = Math.max(...frames.map((frame) => frame.rms), 0);
  const wave = polyline(frames.map((frame) => ({ timeMs: frame.timeMs, value: frame.rms })), rmsPeak, 52, 84, durationMs);
  if (wave) {
    const mirrored = frames.map((frame) => {
      const x = xOf(frame.timeMs, durationMs).toFixed(1);
      const y = (136 + Math.max(0, Math.min(1, frame.rms / rmsPeak)) * 84).toFixed(1);
      return `${x},${y}`;
    }).reverse().join(' ');
    pieces.push(`<polyline points="${wave} ${mirrored}" fill="none" stroke="#7fd1ff" stroke-width="1.2"/>`);
    pieces.push(`<line x1="${LEFT}" y1="136" x2="${MAP_WIDTH - RIGHT}" y2="136" stroke="#263244" stroke-width="1"/>`);
  }
  pieces.push(`<text x="${LEFT}" y="48" fill="#8b98ab" font-family="Helvetica, Arial, sans-serif" font-size="12">onda</text>`);

  const energy = polyline(frames.map((frame) => ({ timeMs: frame.timeMs, value: frame.rms })), rmsPeak, 168, 92, durationMs);
  const bassPeak = Math.max(...frames.map((frame) => frame.bass), 0);
  const bass = polyline(frames.map((frame) => ({ timeMs: frame.timeMs, value: frame.bass })), bassPeak, 168, 92, durationMs);
  pieces.push('<rect x="64" y="164" width="1192" height="100" fill="#121722"/>');
  if (energy) pieces.push(`<polyline points="${energy}" fill="none" stroke="#7be0a8" stroke-width="2"/>`);
  if (bass) pieces.push(`<polyline points="${bass}" fill="none" stroke="#f0a35e" stroke-width="2"/>`);
  pieces.push(`<text x="${LEFT}" y="184" fill="#7be0a8" font-family="Helvetica, Arial, sans-serif" font-size="12">energía</text>`);
  pieces.push(`<text x="${LEFT + 64}" y="184" fill="#f0a35e" font-family="Helvetica, Arial, sans-serif" font-size="12">graves</text>`);

  const bandTop = 284;
  const bandHeight = 46;
  for (const section of sectionsOf(input)) {
    const x = xOf(section.fromMs, durationMs);
    const width = Math.max(1, xOf(section.toMs, durationMs) - x);
    const color = ROLE_COLOR[section.role];
    pieces.push(`<rect x="${x.toFixed(1)}" y="${bandTop}" width="${width.toFixed(1)}" height="${bandHeight}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="1.5"/>`);
    const label = section.mood
      ? `${displaySectionRole(section.role)} · ${displayMusicLabel(section.mood.label)}`
      : displaySectionRole(section.role);
    pieces.push(`<text x="${(x + 6).toFixed(1)}" y="${bandTop + 20}" fill="#e8edf5" font-family="Helvetica, Arial, sans-serif" font-size="12">${escapeXml(label)}</text>`);
    pieces.push(`<text x="${(x + 6).toFixed(1)}" y="${bandTop + 37}" fill="#c8d2e0" font-family="Helvetica, Arial, sans-serif" font-size="11">${Math.round(section.energy * 100)}%</text>`);
  }
  for (const downbeat of input.analysis.downbeatsMs) {
    const x = xOf(downbeat, durationMs).toFixed(1);
    pieces.push(`<line x1="${x}" y1="${bandTop - 10}" x2="${x}" y2="${bandTop}" stroke="#e8edf5" stroke-width="2"/>`);
  }

  const drops = (input.measurements?.moments ?? []).filter((moment) => moment.kind === 'drop');
  for (const drop of drops) {
    const x = xOf(drop.timeMs, durationMs).toFixed(1);
    pieces.push(`<line x1="${x}" y1="160" x2="${x}" y2="${bandTop + bandHeight}" stroke="#7fd1ff" stroke-width="1.5" stroke-dasharray="6 4"/>`);
    pieces.push(`<text x="${(Number(x) + 4).toFixed(1)}" y="${bandTop + bandHeight + 14}" fill="#7fd1ff" font-family="Helvetica, Arial, sans-serif" font-size="12">drop</text>`);
  }
  const otherMoments = (input.measurements?.moments ?? []).filter((moment) => moment.kind !== 'drop').slice(0, 12);
  for (const moment of otherMoments) {
    const x = xOf(moment.timeMs, durationMs).toFixed(1);
    pieces.push(`<line x1="${x}" y1="${bandTop + bandHeight}" x2="${x}" y2="${bandTop + bandHeight + 6}" stroke="#8b98ab" stroke-width="1"/>`);
    pieces.push(`<text x="${(Number(x) + 2).toFixed(1)}" y="${bandTop + bandHeight + 18}" fill="#8b98ab" font-family="Helvetica, Arial, sans-serif" font-size="10">${escapeXml(momentText(moment))}</text>`);
  }

  const lyricTop = 372;
  pieces.push(`<text x="${LEFT}" y="${lyricTop - 8}" fill="#8b98ab" font-family="Helvetica, Arial, sans-serif" font-size="12">letra</text>`);
  const lines = (input.songMap?.lines ?? []).slice(0, MAX_LYRIC_LINES);
  if (!lines.length) {
    pieces.push(`<text x="${LEFT}" y="${lyricTop + 16}" fill="#4a5568" font-family="Helvetica, Arial, sans-serif" font-size="13">sin letra transcrita</text>`);
  }
  lines.forEach((line, index) => {
    const y = lyricTop + 20 + index * 21;
    const chorus = line.chorusGroup === undefined ? '' : '· ';
    pieces.push(`<text x="${LEFT}" y="${y}" fill="${line.chorusGroup === undefined ? '#c8d2e0' : '#ffd479'}" font-family="Helvetica, Arial, sans-serif" font-size="14">${formatClock(line.startMs)}  ${escapeXml(chorus + lineText(line.text))}</text>`);
  });

  pieces.push('</svg>');
  return pieces.join('\n');
}

export async function renderSongMapPng(input: SongPictureInput): Promise<Buffer> {
  return sharp(Buffer.from(buildSongMapSvg(input))).png({ compressionLevel: 9 }).toBuffer();
}

export function buildSpectrogramArgs(input: string, output: string): string[] {
  return [
    '-v', 'error', '-nostdin', '-y',
    '-i', input,
    '-lavfi', `showspectrumpic=s=${SPECTROGRAM_WIDTH}x${SPECTROGRAM_HEIGHT}:legend=1:scale=log:color=intensity`,
    '-frames:v', '1',
    output,
  ];
}

/** ffmpeg draws the legend and time axis; a temp file keeps the pipe free of muxer quirks. */
export async function renderSpectrogramPng(
  audioFile: string,
  options: { readonly timeoutMs?: number } = {},
): Promise<Buffer> {
  if (!audioFile) throw new Error('Spectrogram requires a local audio path');
  const dir = await mkdtemp(join(tmpdir(), 'occ-spectrogram-'));
  const out = join(dir, 'spectrogram.png');
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawnMediaProcess(ffmpegBin(), buildSpectrogramArgs(audioFile, out), {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Spectrogram timed out after ${Math.round((options.timeoutMs ?? 60_000) / 1000)}s`));
      }, options.timeoutMs ?? 60_000);
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < 8_192) stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(new Error(`ffmpeg failed to start: ${error.message}`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().slice(-600) || 'no diagnostics'}`));
          return;
        }
        resolve();
      });
    });
    const png = await readFile(out);
    if (!png.length) throw new Error('ffmpeg produced an empty spectrogram');
    return png;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
