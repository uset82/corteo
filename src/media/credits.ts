import type { MediaAsset, MediaSourceCredits } from '../editor/types';

export type { MediaSourceCredits } from '../editor/types';

const FIELDS = ['title', 'uploader', 'pageUrl', 'license', 'lyricLine', 'searchQuery'] as const;
const LIMITS: Record<(typeof FIELDS)[number], number> = {
  title: 300, uploader: 300, pageUrl: 2000, license: 300, lyricLine: 1000, searchQuery: 300,
};

/** Accept only trimmed strings; never store an object of empty fields. */
export function readSourceCredits(value: unknown): MediaSourceCredits | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const credits: MediaSourceCredits = {};
  for (const field of FIELDS) {
    const raw = input[field];
    if (typeof raw !== 'string') continue;
    const text = raw.trim().slice(0, LIMITS[field]);
    if (text) credits[field] = text;
  }
  return Object.keys(credits).length ? credits : undefined;
}

export const CREDITS_FILE_NAME = 'creditos.txt';

export interface CreditRow {
  readonly name: string;
  readonly title?: string;
  readonly uploader?: string;
  readonly pageUrl?: string;
  readonly license?: string;
  readonly lyricLine?: string;
  readonly searchQuery?: string;
}

/** One row per credited pool asset; uncredited media is omitted, not invented. */
export function creditRows(assets: readonly MediaAsset[]): CreditRow[] {
  return assets.flatMap((asset) => {
    const source = asset.source;
    if (!source || !FIELDS.some((field) => source[field])) return [];
    return [{
      name: asset.name,
      ...(source.title ? { title: source.title } : {}),
      ...(source.uploader ? { uploader: source.uploader } : {}),
      ...(source.pageUrl ? { pageUrl: source.pageUrl } : {}),
      ...(source.license ? { license: source.license } : {}),
      ...(source.lyricLine ? { lyricLine: source.lyricLine } : {}),
      ...(source.searchQuery ? { searchQuery: source.searchQuery } : {}),
    }];
  });
}

const LABELS: Record<(typeof FIELDS)[number], string> = {
  title: 'Título', uploader: 'Autor', pageUrl: 'Enlace', license: 'Licencia',
  lyricLine: 'Línea de la letra', searchQuery: 'Búsqueda',
};

/** Plain-text credits file: one block per source, Spanish labels and UTF-8. */
export function creditsText(rows: readonly CreditRow[]): string {
  const header = 'Créditos de fuentes\n===================\n';
  if (!rows.length) return `${header}\nNo hay fuentes acreditadas.\n`;
  const blocks = rows.map((row) => {
    const lines = [`Archivo: ${row.name}`];
    for (const field of FIELDS) {
      const value = row[field];
      if (value) lines.push(`${LABELS[field]}: ${value}`);
    }
    return lines.join('\n');
  });
  return `${header}\n${blocks.join('\n\n')}\n`;
}
