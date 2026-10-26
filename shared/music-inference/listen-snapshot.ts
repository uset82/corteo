// The text half of listen_to_song: a Spanish summary plus compact JSON that
// stays under the MCP result limit for any song length. Pure functions only, so
// the server tool, the browser degrade and the verifies build the same text.
import { displayMusicLabel } from '../../src/audio/intelligence/clapProfile.ts';
import { displaySectionRole } from '../../src/audio/listen/songMap.ts';
import type { SongMap } from '../../src/audio/listen/songMap.ts';
import type { MusicSection } from '../../src/audio/intelligence/types.ts';
import type { KeyEstimate, Moment, SongMeasurements } from '../../src/audio/listen/types.ts';

/** The MCP projection rejects non-image results above 16,000 characters. */
export const LISTEN_TEXT_MAX_CHARS = 15_000;
/** 1-second curves shrink past this: a 15-minute song must still fit. */
export const LISTEN_MAX_CURVE_POINTS = 480;

export type ListenAnalysisSource = 'model' | 'dsp';

export interface ListenRange {
  readonly fromMs: number;
  readonly toMs: number;
}

export interface ListenPictures {
  readonly map: boolean;
  readonly spectrogram: boolean;
}

export interface ListenSnapshotInput {
  readonly assetName: string;
  readonly durationMs: number;
  readonly range: ListenRange;
  readonly analysisSource: ListenAnalysisSource;
  readonly analysisNote?: string;
  readonly bpm?: number;
  readonly meter?: number;
  readonly beatConfidence?: number;
  readonly sections: readonly Pick<MusicSection, 'fromMs' | 'toMs' | 'role' | 'energy' | 'mood'>[];
  readonly beatsMs: readonly number[];
  readonly downbeatsMs: readonly number[];
  readonly measurements?: Pick<SongMeasurements, 'frames' | 'onsets' | 'accents' | 'moments' | 'key'> | null;
  readonly songMap?: Pick<SongMap, 'lines' | 'chorusGroups' | 'lyricsSource'> | null;
  readonly songMapRef?: string | null;
  readonly pictures?: ListenPictures;
}

export interface ListenSnapshot {
  readonly summaryEs: string;
  readonly data: Record<string, unknown>;
}

interface DetailLevel {
  readonly stepMs: number;
  readonly maxLines: number;
  readonly maxMoments: number;
  readonly maxSections: number;
}

/** Deterministic shrink order; the last level fits even a 15-minute song. */
const DETAIL_LEVELS: readonly DetailLevel[] = [
  { stepMs: 1_000, maxLines: 40, maxMoments: 24, maxSections: 24 },
  { stepMs: 1_000, maxLines: 24, maxMoments: 18, maxSections: 24 },
  { stepMs: 2_000, maxLines: 24, maxMoments: 12, maxSections: 16 },
  { stepMs: 2_000, maxLines: 12, maxMoments: 12, maxSections: 16 },
  { stepMs: 4_000, maxLines: 8, maxMoments: 8, maxSections: 12 },
  { stepMs: 4_000, maxLines: 0, maxMoments: 8, maxSections: 12 },
  { stepMs: 8_000, maxLines: 0, maxMoments: 6, maxSections: 12 },
];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function percent(value: number): number {
  return Math.round(clamp01(Number.isFinite(value) ? value : 0) * 100);
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function twoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function flatText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function listenClock(ms: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(ms) ? ms : 0) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeListenRange(
  fromMs: unknown,
  toMs: unknown,
  durationMs: number,
): ListenRange {
  const duration = Math.max(0, Math.round(durationMs));
  const from = typeof fromMs === 'number' && Number.isFinite(fromMs) ? Math.round(fromMs) : 0;
  const to = typeof toMs === 'number' && Number.isFinite(toMs) ? Math.round(toMs) : duration;
  const range = {
    fromMs: Math.max(0, Math.min(duration, from)),
    toMs: Math.max(0, Math.min(duration, to)),
  };
  if (range.toMs <= range.fromMs) {
    throw new Error('toMs must be greater than fromMs after clamping to the song duration');
  }
  return range;
}

function inRange(timeMs: number, range: ListenRange): boolean {
  return timeMs >= range.fromMs && timeMs < range.toMs;
}

function overlap(sectionFromMs: number, sectionToMs: number, range: ListenRange): boolean {
  return sectionToMs > range.fromMs && sectionFromMs < range.toMs;
}

interface Curves {
  readonly stepMs: number;
  readonly energy: number[];
  readonly bass: number[];
}

function buildCurves(
  frames: Pick<SongMeasurements, 'frames'>['frames'],
  range: ListenRange,
  minimumStepMs: number,
): Curves {
  const span = range.toMs - range.fromMs;
  const stepMs = Math.max(
    1_000,
    Math.ceil(span / LISTEN_MAX_CURVE_POINTS / 1_000) * 1_000,
    minimumStepMs,
  );
  const points = Math.max(1, Math.ceil(span / stepMs));
  const rms = new Array<number>(points).fill(0);
  const bass = new Array<number>(points).fill(0);
  const counts = new Array<number>(points).fill(0);
  let rmsPeak = 0;
  let bassPeak = 0;
  // Peaks cover the whole song so a quiet range is not stretched to full scale.
  for (const frame of frames) {
    rmsPeak = Math.max(rmsPeak, frame.rms);
    bassPeak = Math.max(bassPeak, frame.bass);
  }
  for (const frame of frames) {
    if (!inRange(frame.timeMs, range)) continue;
    const index = Math.min(points - 1, Math.floor((frame.timeMs - range.fromMs) / stepMs));
    rms[index]! += frame.rms;
    bass[index]! += frame.bass;
    counts[index]! += 1;
  }
  const scale = (values: number[], peak: number): number[] => values.map((sum, index) => {
    const mean = counts[index] ? sum / counts[index]! : 0;
    return peak > 0 ? percent(mean / peak) : 0;
  });
  return { stepMs, energy: scale(rms, rmsPeak), bass: scale(bass, bassPeak) };
}

/** Drops survive the cap first; the rest stays chronological. */
function pickMoments(
  moments: readonly Moment[],
  range: ListenRange,
  max: number,
): { count: number; listed: Array<Record<string, unknown>> } {
  const inside = moments
    .filter((moment) => inRange(moment.timeMs, range))
    .sort((left, right) => left.timeMs - right.timeMs || left.kind.localeCompare(right.kind));
  const drops = inside.filter((moment) => moment.kind === 'drop').slice(0, Math.min(8, max));
  const rest = inside.filter((moment) => moment.kind !== 'drop').slice(0, max - drops.length);
  const listed = [...drops, ...rest]
    .sort((left, right) => left.timeMs - right.timeMs)
    .map((moment) => ({
      kind: moment.kind,
      timeMs: Math.round(moment.timeMs),
      strength: twoDecimals(clamp01(moment.strength)),
    }));
  return { count: inside.length, listed };
}

function listedSections(
  input: ListenSnapshotInput,
  level: DetailLevel,
): { count: number; listed: Array<Record<string, unknown>> } {
  const inside = input.sections.filter((section) => overlap(section.fromMs, section.toMs, input.range));
  const listed = inside.slice(0, level.maxSections).map((section) => ({
    fromMs: Math.round(section.fromMs),
    toMs: Math.round(section.toMs),
    role: section.role,
    roleEs: displaySectionRole(section.role),
    energy: twoDecimals(clamp01(section.energy)),
    ...(section.mood
      ? { mood: displayMusicLabel(section.mood.label), moodScore: twoDecimals(clamp01(section.mood.score)) }
      : {}),
  }));
  return { count: inside.length, listed };
}

function listedLyrics(
  input: ListenSnapshotInput,
  level: DetailLevel,
): {
  source: string;
  lineCount: number;
  lines: Array<Record<string, unknown>>;
  chorusGroups: Array<Record<string, unknown>>;
} {
  const map = input.songMap;
  const inside = (map?.lines ?? []).filter((line) => inRange(line.startMs, input.range));
  const lines = level.maxLines > 0
    ? inside.slice(0, level.maxLines).map((line) => ({
      atMs: Math.round(line.startMs),
      text: flatText(line.text, 120),
      ...(line.sectionIndex === undefined ? {} : { sectionIndex: line.sectionIndex }),
      ...(line.chorusGroup === undefined ? {} : { chorusGroup: line.chorusGroup }),
    }))
    : [];
  return {
    source: map?.lyricsSource ?? 'none',
    lineCount: inside.length,
    lines,
    chorusGroups: (map?.chorusGroups ?? []).map((group) => ({
      index: group.index,
      text: flatText(group.text, 48),
      lines: group.lineIndexes.length,
    })),
  };
}

function keyOf(measurements: ListenSnapshotInput['measurements']): KeyEstimate | null {
  const key = measurements?.key;
  if (!key) return null;
  return { tonic: key.tonic, mode: key.mode, confidence: twoDecimals(clamp01(key.confidence)) };
}

function snapshotData(input: ListenSnapshotInput, level: DetailLevel): Record<string, unknown> {
  const beatsMs = input.beatsMs.filter((value) => inRange(value, input.range));
  const downbeatsMs = input.downbeatsMs.filter((value) => inRange(value, input.range));
  const accents = (input.measurements?.accents ?? []).filter((point) => inRange(point.timeMs, input.range));
  const sections = listedSections(input, level);
  const moments = pickMoments(input.measurements?.moments ?? [], input.range, level.maxMoments);
  const curves = input.measurements
    ? buildCurves(input.measurements.frames, input.range, level.stepMs)
    : null;
  const lyrics = listedLyrics(input, level);
  const key = keyOf(input.measurements);
  return {
    assetName: flatText(input.assetName, 120),
    durationMs: Math.round(input.durationMs),
    range: input.range,
    source: input.analysisSource,
    ...(input.analysisNote ? { note: flatText(input.analysisNote, 300) } : {}),
    ...(typeof input.bpm === 'number' && Number.isFinite(input.bpm) ? { bpm: oneDecimal(input.bpm) } : {}),
    ...(typeof input.meter === 'number' && input.meter > 0 ? { meter: Math.round(input.meter) } : {}),
    ...(typeof input.beatConfidence === 'number' && Number.isFinite(input.beatConfidence)
      ? { confidence: twoDecimals(clamp01(input.beatConfidence)) }
      : {}),
    ...(key ? { key } : {}),
    sectionCount: sections.count,
    sections: sections.listed,
    beatCount: beatsMs.length,
    beatsMs: beatsMs.slice(0, 16).map((value) => Math.round(value)),
    downbeatCount: downbeatsMs.length,
    downbeatsMs: downbeatsMs.slice(0, 8).map((value) => Math.round(value)),
    onsetCount: input.measurements?.onsets.length ?? 0,
    accentCount: accents.length,
    accentsMs: accents.slice(0, 8).map((point) => Math.round(point.timeMs)),
    momentCount: moments.count,
    moments: moments.listed,
    curves,
    lyrics,
    songMapRef: input.songMapRef ?? null,
    pictures: input.pictures ?? { map: false, spectrogram: false },
  };
}

function sectionSummary(listed: readonly Record<string, unknown>[], count: number): string {
  if (!count) return 'Secciones: sin cambios de energía claros.';
  const shown = listed.slice(0, 6).map((section) => {
    const mood = typeof section.mood === 'string' ? `, ${section.mood}` : '';
    const from = listenClock(Number(section.fromMs) || 0);
    const to = listenClock(Number(section.toMs) || 0);
    return `${from}–${to} ${String(section.roleEs)} ${Math.round(Number(section.energy) * 100)}%${mood}`;
  });
  const extra = count > shown.length ? ` · +${count - shown.length}` : '';
  return `Secciones (${count}): ${shown.join(' · ')}${extra}.`;
}

function momentSummary(listed: readonly Record<string, unknown>[], count: number): string {
  if (!count) return 'Momentos: sin caídas ni pausas claras.';
  const shown = listed.slice(0, 8).map((moment) => `${listenClock(Number(moment.timeMs) || 0)} ${String(moment.kind)}`);
  const extra = count > shown.length ? ` · +${count - shown.length}` : '';
  return `Momentos (${count}): ${shown.join(' · ')}${extra}.`;
}

function energySummary(data: Record<string, unknown>): string | null {
  const curves = data.curves as { readonly energy: number[]; readonly stepMs: number } | null;
  if (!curves || !curves.energy.length) return null;
  let total = 0;
  let peak = 0;
  let peakIndex = 0;
  curves.energy.forEach((value, index) => {
    total += value;
    if (value > peak) {
      peak = value;
      peakIndex = index;
    }
  });
  const average = Math.round(total / curves.energy.length);
  const at = listenClock((data.range as ListenRange).fromMs + peakIndex * curves.stepMs);
  return `Energía: media ${average}% · pico ${peak}% en ${at}.`;
}

function keySummary(data: Record<string, unknown>): string | null {
  const key = data.key as KeyEstimate | undefined;
  if (!key) return null;
  return `Tonalidad: ${key.tonic} ${key.mode === 'minor' ? 'menor' : 'mayor'} (${Math.round(key.confidence * 100)}%).`;
}

function lyricsSummary(data: Record<string, unknown>): string {
  const lyrics = data.lyrics as {
    readonly lineCount: number;
    readonly lines: Array<Record<string, unknown>>;
    readonly chorusGroups: Array<Record<string, unknown>>;
  };
  if (!lyrics.lineCount) {
    return 'Letra: sin transcripción; no hay líneas que leer.';
  }
  const groups = lyrics.chorusGroups.length
    ? ` · ${lyrics.chorusGroups.length} estribillo${lyrics.chorusGroups.length === 1 ? '' : 's'}`
    : '';
  const quote = lyrics.chorusGroups[0]?.text ?? lyrics.lines[0]?.text;
  return `Letra: ${lyrics.lineCount} líneas${groups}${quote ? ` · «${String(quote)}»` : ''}.`;
}

function summaryOf(input: ListenSnapshotInput, data: Record<string, unknown>): string {
  const pieces: string[] = [];
  const cropped = input.range.fromMs > 0 || input.range.toMs < Math.round(input.durationMs)
    ? ` · tramo ${listenClock(input.range.fromMs)}–${listenClock(input.range.toMs)}`
    : '';
  const name = data.assetName as string;
  pieces.push(`Canción: «${name}» · ${listenClock(input.durationMs)}${cropped}`);
  const tempo = typeof data.bpm === 'number'
    ? `Tempo: ${data.bpm} BPM${typeof data.meter === 'number' ? ` · compás ${data.meter}/4` : ''}${typeof data.confidence === 'number' ? ` · confianza ${data.confidence}` : ''}.`
    : 'Tempo: sin un pulso fiable.';
  pieces.push(tempo);
  const key = keySummary(data);
  if (key) pieces.push(key);
  pieces.push(sectionSummary(data.sections as Array<Record<string, unknown>>, data.sectionCount as number));
  pieces.push(momentSummary(data.moments as Array<Record<string, unknown>>, data.momentCount as number));
  const energy = energySummary(data);
  if (energy) pieces.push(energy);
  pieces.push(`Pulso: ${data.beatCount} pulsos y ${data.downbeatCount} compases · ${data.accentCount} acentos.`);
  pieces.push(lyricsSummary(data));
  if (typeof data.note === 'string') pieces.push(`Aviso: ${data.note}`);
  const ref = data.songMapRef;
  pieces.push(typeof ref === 'string'
    ? `Mapa guardado: ${ref}.`
    : 'Mapa de la canción solo en memoria: sin análisis del modelo no se guarda.');
  const pictures = data.pictures as ListenPictures;
  pieces.push(pictures.map && pictures.spectrogram
    ? 'Adjunto el mapa de la canción y el espectrograma.'
    : pictures.map
      ? 'Adjunto el mapa de la canción.'
      : pictures.spectrogram
        ? 'Adjunto el espectrograma.'
        : 'Sin imágenes en esta respuesta.');
  return pieces.join('\n');
}

export function buildListenSnapshot(input: ListenSnapshotInput): ListenSnapshot {
  let last: ListenSnapshot | null = null;
  for (const level of DETAIL_LEVELS) {
    const data = snapshotData(input, level);
    last = { summaryEs: summaryOf(input, data), data };
    if (JSON.stringify(last).length <= LISTEN_TEXT_MAX_CHARS) return last;
  }
  return last!;
}
