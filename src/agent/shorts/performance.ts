/**
 * The performance loop (Plan 5, OP-15).
 *
 * OpusClip trains on platform performance because it owns that data. Here the user owns it —
 * a CSV exported from TikTok/YouTube/Instagram — and the only honest thing to do with it is
 * join it against the scores we already gave those clips and show whether the rubric agreed
 * with the audience.
 *
 * Deliberately not a model: it reports bands, and it refuses to recommend anything from too
 * few rows. A "learning" loop that fits six data points is worse than no loop.
 */

export interface PerformanceRow {
  /** Free-form clip label, matched to nothing by itself; kept for the report. */
  clipId: string;
  /** The 0-99 score the rubric gave it when it was cut. */
  score: number;
  views: number;
  /** Optional average view percentage (0-100) when the platform reports it. */
  retention?: number;
}

export interface BandRow {
  label: string;
  min: number;
  max: number;
  clips: number;
  views: number;
  averageViews: number;
  averageRetention: number | null;
}

export interface PerformanceReport {
  rows: number;
  skipped: number;
  bands: BandRow[];
  /** The band with the best average views, when there is enough data to say. */
  bestBand: string | null;
  /** Lowest band whose average views still beat the overall average. */
  suggestedMinScore: number | null;
  confident: boolean;
  note: string;
}

export const BANDS = [
  { label: '0-39', min: 0, max: 39 },
  { label: '40-54', min: 40, max: 54 },
  { label: '55-69', min: 55, max: 69 },
  { label: '70-84', min: 70, max: 84 },
  { label: '85-99', min: 85, max: 99 },
] as const;

/** Below this many clips the report says so instead of recommending a threshold. */
export const MIN_ROWS = 12;

/**
 * Parse a CSV with a header. Accepted column names are forgiving because the export formats
 * differ per platform; a row with no score or no views is skipped, never guessed.
 */
export function parsePerformanceCsv(text: string): { rows: PerformanceRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''));
  const find = (...names: string[]): number => {
    for (const name of names) {
      const index = header.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const iClip = find('clip', 'clipid', 'id', 'title', 'video');
  const iScore = find('score', 'potencial', 'potential', 'virality');
  const iViews = find('views', 'viewcount', 'plays', 'reproducciones');
  const iRetention = find('retention', 'averageviewpercentage', 'avgviewpercent', 'retencion');
  if (iScore < 0 || iViews < 0) return { rows: [], skipped: Math.max(0, lines.length - 1) };

  const rows: PerformanceRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    // An empty cell is missing data, not a zero: Number('') is 0, which would silently
    // turn a blank score into the lowest band.
    const scoreText = (cells[iScore] ?? '').replace(/[^\d.-]/g, '');
    const viewsText = (cells[iViews] ?? '').replace(/[^\d.-]/g, '');
    if (!scoreText || !viewsText) {
      skipped += 1;
      continue;
    }
    const score = Number(scoreText);
    const views = Number(viewsText);
    if (!Number.isFinite(score) || !Number.isFinite(views) || views < 0) {
      skipped += 1;
      continue;
    }
    const retentionRaw = iRetention >= 0 ? Number(cells[iRetention]?.replace(/[^\d.-]/g, '')) : NaN;
    rows.push({
      clipId: iClip >= 0 ? (cells[iClip] ?? '').slice(0, 120) : '',
      score: Math.max(0, Math.min(99, Math.round(score))),
      views: Math.max(0, Math.round(views)),
      ...(Number.isFinite(retentionRaw) ? { retention: Math.max(0, Math.min(100, retentionRaw)) } : {}),
    });
  }
  return { rows, skipped };
}

/** Minimal CSV split: quotes, escaped quotes, commas. Enough for exports, not a spec. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ',' || char === ';') { cells.push(current.trim()); current = ''; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function reportPerformance(rows: readonly PerformanceRow[], skipped = 0): PerformanceReport {
  const bands: BandRow[] = BANDS.map((band) => {
    const inBand = rows.filter((row) => row.score >= band.min && row.score <= band.max);
    const views = inBand.reduce((sum, row) => sum + row.views, 0);
    const withRetention = inBand.filter((row) => typeof row.retention === 'number');
    const retentionSum = withRetention.reduce((sum, row) => sum + (row.retention ?? 0), 0);
    return {
      label: band.label,
      min: band.min,
      max: band.max,
      clips: inBand.length,
      views,
      averageViews: inBand.length ? Math.round(views / inBand.length) : 0,
      averageRetention: withRetention.length ? Number((retentionSum / withRetention.length).toFixed(1)) : null,
    };
  });

  const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
  const overallAverage = rows.length ? totalViews / rows.length : 0;
  const confident = rows.length >= MIN_ROWS;

  const populated = bands.filter((band) => band.clips > 0);
  const best = populated.length
    ? populated.reduce((a, b) => (b.averageViews > a.averageViews ? b : a))
    : null;

  // The lowest band that still performs above average is the honest suggestion: it is the
  // point where lowering the threshold stops paying for itself.
  const aboveAverage = confident
    ? populated.filter((band) => band.averageViews >= overallAverage).sort((a, b) => a.min - b.min)
    : [];

  return {
    rows: rows.length,
    skipped,
    bands,
    bestBand: best?.label ?? null,
    suggestedMinScore: aboveAverage[0]?.min ?? null,
    confident,
    note: !rows.length
      ? 'El CSV no tiene filas utilizables. Se esperan columnas de puntuación y de reproducciones.'
      : !confident
        ? `Solo ${rows.length} clips: por debajo de ${MIN_ROWS} no se recomienda mover el umbral, los números son ruido.`
        : `Con ${rows.length} clips, la banda ${best?.label ?? '—'} es la que mejor rinde.`,
  };
}
