import type { SongLyricWord } from './songMap.ts';

export function parseLrc(text: string): SongLyricWord[] | null {
  const offset = Number(/\[offset:([+-]?\d+)\]/i.exec(text)?.[1] ?? 0);
  const entries: { text: string; startMs: number }[] = [];
  let hasStamp = false;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const stamps = [...line.matchAll(/\[(\d+):([0-5]\d)(?:\.(\d{2,3}))?\]/g)];
    if (!stamps.length) continue;
    hasStamp = true;
    const content = line.replace(/\[(?:\d+:[0-5]\d(?:\.\d{2,3})?|ar:[^\]]*|ti:[^\]]*|al:[^\]]*|by:[^\]]*|length:[^\]]*|offset:[^\]]*)\]/gi, '').trim();
    if (!content) continue;
    for (const stamp of stamps) {
      const startMs = (Number(stamp[1]) * 60 + Number(stamp[2])) * 1000
        + Number((stamp[3] ?? '').padEnd(3, '0') || 0) + offset;
      entries.push({ text: content, startMs });
    }
  }
  if (!hasStamp) return null;
  entries.sort((a, b) => a.startMs - b.startMs);
  return entries.map((entry, i) => ({ ...entry, endMs: entries[i + 1]?.startMs ?? entry.startMs + 4000 }));
}

export function splitPlainLyrics(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim())
    .filter((line) => line && !/^\[(?:coro|verso|chorus|verse)(?:\s+\d+)?\]$/i.test(line)
      && !/^\((?:x\s*\d+|bis)\)$/i.test(line));
}

interface Timing {
  downbeatsMs: readonly number[];
  fromMs: number;
  toMs: number;
  fallbackBarMs?: number;
}

export function timeUntimedLines(lines: readonly string[], timing: Timing): SongLyricWord[] {
  const { fromMs, toMs } = timing;
  if (!lines.length || toMs <= fromMs) return [];
  let beats = [...new Set(timing.downbeatsMs.filter((beat) => Number.isFinite(beat) && beat >= fromMs && beat < toMs))]
    .sort((a, b) => a - b);
  if (!beats.length) {
    const bar = Number.isFinite(timing.fallbackBarMs) && (timing.fallbackBarMs ?? 0) > 0 ? timing.fallbackBarMs! : 2000;
    beats = [];
    for (let time = fromMs; time < toMs; time += bar) beats.push(time);
  }
  const starts: number[] = [];
  if (lines.length <= beats.length) {
    for (let i = 0; i < lines.length; i++) starts.push(beats[Math.floor(i * beats.length / lines.length)]!);
  } else {
    for (let bar = 0; bar < beats.length; bar++) {
      const indexes = lines.map((_, i) => i).filter((i) => Math.floor(i * beats.length / lines.length) === bar);
      const start = beats[bar]!;
      const end = beats[bar + 1] ?? toMs;
      for (let i = 0; i < indexes.length; i++) starts.push(start + (end - start) * i / indexes.length);
    }
  }
  return lines.map((text, i) => ({ text, startMs: starts[i]!, endMs: starts[i + 1] ?? toMs }));
}

export interface LyricsInput extends Timing {
  pasted?: string;
  besideLrc?: string;
  besideTxt?: string;
  transcriptLines?: readonly SongLyricWord[];
}

export function resolveLyrics(input: LyricsInput): {
  source: 'pasted' | 'lrc' | 'txt' | 'transcript' | 'none';
  lines: SongLyricWord[];
} {
  for (const [source, text] of [['pasted', input.pasted], ['lrc', input.besideLrc], ['txt', input.besideTxt]] as const) {
    if (!text?.trim()) continue;
    const timed = parseLrc(text);
    const plain = timed === null ? splitPlainLyrics(text) : [];
    if (timed === null && !plain.length) continue;
    const lines = timed ?? timeUntimedLines(plain, input);
    return { source, lines: clipLines(lines, input.fromMs, input.toMs) };
  }
  if (input.transcriptLines?.length) return { source: 'transcript', lines: clipLines(input.transcriptLines, input.fromMs, input.toMs) };
  return { source: 'none', lines: [] };
}

function clipLines(lines: readonly SongLyricWord[], fromMs: number, toMs: number): SongLyricWord[] {
  return lines.filter((line) => line.text.trim() && line.endMs > fromMs && line.startMs < toMs)
    .map((line) => ({ ...line, startMs: Math.max(fromMs, line.startMs), endMs: Math.min(toMs, line.endMs) }));
}
