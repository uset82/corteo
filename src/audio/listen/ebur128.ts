// EBU R128 loudness as a pure parser plus an argument builder, so the server can
// spawn ffmpeg and the verifies can parse a captured stderr with no process.
//
// The trap this file exists to avoid: `-v error` silences the ebur128 summary,
// which is printed at info level, so the filter looks like it produced nothing.
// The builder never sets a log level; it hides only the banner and the stats.

export interface LoudnessPoint {
  readonly timeMs: number;
  /** Short-term (3 s window) loudness; null when the filter reported nan/-inf. */
  readonly shortTermLufs: number | null;
}

export interface LoudnessReport {
  readonly integratedLufs: number | null;
  readonly loudnessRangeLu: number | null;
  readonly truePeakDbfs: number | null;
  readonly shortTerm: readonly LoudnessPoint[];
}

/** ffmpeg args for `ebur128`: full stderr keeps the summary and the S: curve. */
export function buildEbur128Args(inputPath: string): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    inputPath,
    '-filter_complex',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ];
}

function parseMeasure(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const FRAME_LINE = /(?:^|\s)t:\s*(?<time>-?\d+(?:\.\d+)?)\s.*?\bS:\s*(?<short>-?\d+(?:\.\d+)?|nan|-?inf)/;
const INTEGRATED = /^\s*I:\s*(?<value>-?\d+(?:\.\d+)?|nan|-?inf)\s*LUFS/;
const RANGE = /^\s*LRA:\s*(?<value>-?\d+(?:\.\d+)?)\s*LU\b/;
const TRUE_PEAK = /^\s*Peak:\s*(?<value>-?\d+(?:\.\d+)?|nan|-?inf)\s*dBFS/;

/**
 * Reads the summary block and the per-frame `t:` lines from ffmpeg's stderr.
 * Anything unparseable stays null rather than throwing: a truncated log is a
 * missing measurement, not a failed song.
 */
export function parseEbur128(stderr: string): LoudnessReport {
  let integratedLufs: number | null = null;
  let loudnessRangeLu: number | null = null;
  let truePeakDbfs: number | null = null;
  const shortTerm: LoudnessPoint[] = [];
  let section: 'integrated' | 'range' | 'peak' | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    if (/Integrated loudness:/.test(line)) {
      section = 'integrated';
      continue;
    }
    if (/Loudness range:/.test(line)) {
      section = 'range';
      continue;
    }
    if (/True peak:/.test(line)) {
      section = 'peak';
      continue;
    }
    const frame = FRAME_LINE.exec(line);
    if (frame?.groups) {
      shortTerm.push({
        timeMs: Number(frame.groups.time) * 1000,
        shortTermLufs: parseMeasure(frame.groups.short),
      });
      continue;
    }
    if (section === 'integrated' && integratedLufs === null) {
      const match = INTEGRATED.exec(line);
      if (match?.groups) integratedLufs = parseMeasure(match.groups.value);
    } else if (section === 'range' && loudnessRangeLu === null) {
      const match = RANGE.exec(line);
      if (match?.groups) loudnessRangeLu = parseMeasure(match.groups.value);
    } else if (section === 'peak' && truePeakDbfs === null) {
      const match = TRUE_PEAK.exec(line);
      if (match?.groups) truePeakDbfs = parseMeasure(match.groups.value);
    }
  }
  return { integratedLufs, loudnessRangeLu, truePeakDbfs, shortTerm };
}
