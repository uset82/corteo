import type { MediaAsset } from '../editor/types';
import { t } from '../i18n/locale';

/** One line group of the "Créditos" list, one per distinct source. */
export interface MediaCreditEntry {
  assetId: string;
  name: string;
  provider?: string;
  title?: string;
  uploader?: string;
  pageUrl?: string;
  license?: string;
  lyricLine?: string;
  searchQuery?: string;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The credits of everything in the pool that says where it came from.
 * Assets imported from disk have no source and stay out; the same page URL
 * imported twice is one credit line, not two.
 */
export function mediaCreditEntries(assets: readonly MediaAsset[]): MediaCreditEntry[] {
  const seen = new Set<string>();
  const entries: MediaCreditEntry[] = [];
  for (const asset of assets) {
    const source = asset.source;
    if (!source) continue;
    const entry: MediaCreditEntry = {
      assetId: asset.id,
      name: clean(source.title) ?? asset.name,
      provider: clean(source.provider),
      title: clean(source.title),
      uploader: clean(source.uploader),
      pageUrl: clean(source.pageUrl),
      license: clean(source.license),
      lyricLine: clean(source.lyricLine),
      searchQuery: clean(source.searchQuery),
    };
    const described = entry.provider ?? entry.title ?? entry.uploader ?? entry.pageUrl
      ?? entry.license ?? entry.lyricLine ?? entry.searchQuery;
    if (!described) continue;
    const key = entry.pageUrl
      ? `url:${entry.pageUrl}`
      : `meta:${entry.name}\u0000${entry.provider ?? ''}\u0000${entry.uploader ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}

function entryLines(entry: MediaCreditEntry, index: number, lines: string[]): void {
  lines.push(`${index}. ${entry.name}`);
  if (entry.uploader) lines.push(`   ${t('作者')}: ${entry.uploader}`);
  const source = [entry.provider, entry.pageUrl].filter(Boolean).join(' — ');
  if (source) lines.push(`   ${t('来源')}: ${source}`);
  if (entry.license) lines.push(`   ${t('许可证')}: ${entry.license}`);
  if (entry.lyricLine) lines.push(`   ${t('歌词片段')}: ${entry.lyricLine}`);
  if (entry.searchQuery) lines.push(`   ${t('搜索词')}: ${entry.searchQuery}`);
}

/** Plain text for `creditos.txt`, ready to paste under the final titles. */
export function creditsText(entries: readonly MediaCreditEntry[], generatedAt?: Date): string {
  const lines = [`${t('素材来源')} · corteo`];
  if (generatedAt) {
    const day = generatedAt.toISOString().slice(0, 10);
    lines.push(day);
  }
  lines.push('');
  if (entries.length === 0) {
    lines.push(t('还没有需要署名的来源。'));
    return `${lines.join('\n')}\n`;
  }
  entries.forEach((entry, index) => {
    entryLines(entry, index + 1, lines);
    lines.push('');
  });
  lines.pop();
  return `${lines.join('\n')}\n`;
}
