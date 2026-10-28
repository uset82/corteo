// Media pool duplicate detector: POST /api/media-duplicates, then a dialog with
// thumbnails, jump-to-clip and one-undo removal. The analysis is server-only
// (ffmpeg dHash), so the browser never samples frames itself.
import { createContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaAsset, TimelineItem } from '../editor/types';
import { useT } from '../i18n/locale';
import { duplicatePayloadFrom } from './duplicatePayload';

export interface MediaDuplicatesWiring {
  readonly items: readonly TimelineItem[];
  readonly fps: number;
  readonly onJumpToMediaItem: (itemId: string) => void;
  readonly onRemoveDuplicateMediaAssets: (assetIds: string[]) => void;
  readonly onRemoveDuplicateMediaItems: (itemIds: string[]) => void;
}

export const MediaDuplicatesContext = createContext<MediaDuplicatesWiring | null>(null);
export const MediaDuplicatesProvider = MediaDuplicatesContext.Provider;

interface DuplicateGroupView {
  id: string;
  kind: 'exact' | 'visual';
  assetIds: string[];
  names: string[];
  thumbnails?: string[];
  maxDistance?: number;
}

interface DuplicateReuseView {
  assetId: string;
  name: string;
  occurrences: Array<{
    itemId: string;
    name: string;
    startFrame: number;
    srcInFrame: number;
    durationInFrames: number;
    sameRange: boolean;
  }>;
}

interface DuplicateReportView {
  ok: true;
  groups: DuplicateGroupView[];
  reused: DuplicateReuseView[];
}

interface MediaDuplicatesDialogProps extends MediaDuplicatesWiring {
  readonly assets: MediaAsset[];
  readonly onClose: () => void;
}

type Status = 'loading' | 'ready' | 'error';

export function MediaDuplicatesDialog({ assets, items, fps, onClose, onJumpToMediaItem, onRemoveDuplicateMediaAssets, onRemoveDuplicateMediaItems }: MediaDuplicatesDialogProps) {
  const t = useT();
  const [status, setStatus] = useState<Status>('loading');
  const [report, setReport] = useState<DuplicateReportView | null>(null);
  const [error, setError] = useState('');
  const payload = useMemo(() => duplicatePayloadFrom(assets, items, fps), [assets, items, fps]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    void (async () => {
      try {
        const response = await fetch('/api/media-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, includeThumbnails: true }),
          signal: controller.signal,
        });
        const body = await response.json() as { error?: string } & DuplicateReportView;
        if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        setReport(body);
        setStatus('ready');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus('error');
      }
    })();
    return () => controller.abort();
  }, [payload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usage = useMemo(() => {
    const byAsset = new Map<string, TimelineItem[]>();
    for (const item of items) {
      if (!item.sourceAssetId) continue;
      const rows = byAsset.get(item.sourceAssetId) ?? [];
      rows.push(item);
      byAsset.set(item.sourceAssetId, rows);
    }
    return byAsset;
  }, [items]);

  const usageOf = (assetId: string): TimelineItem[] => usage.get(assetId) ?? [];
  const removeAsset = (assetId: string) => {
    onRemoveDuplicateMediaAssets([assetId]);
    onClose();
  };
  const removeItem = (itemId: string) => {
    onRemoveDuplicateMediaItems([itemId]);
    onClose();
  };

  const hasResults = report !== null && (report.groups.length > 0 || report.reused.length > 0);
  return createPortal(
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('Duplicados')} onClick={onClose}>
      <div className="cc-modal cc-media-duplicates-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="cc-media-duplicates-head">
          <strong>{t('Duplicados')}</strong>
          <button type="button" aria-label={t('Cerrar')} onClick={onClose}>×</button>
        </div>
        {status === 'loading' && <p className="cc-media-duplicates-note">{t('Analizando duplicados…')}</p>}
        {status === 'error' && <p className="cc-media-duplicates-note">{t('No se pudieron analizar los duplicados: {error}', { error })}</p>}
        {status === 'ready' && !hasResults && <p className="cc-media-duplicates-note">{t('No se encontraron duplicados.')}</p>}
        {status === 'ready' && report && hasResults && (
          <div className="cc-media-duplicates-list">
            {report.groups.map((group) => (
              <section className="cc-media-duplicates-group" key={group.id}>
                <strong>{t(group.kind === 'exact' ? 'Copias idénticas' : 'Similares')}</strong>
                {group.assetIds.map((assetId, index) => {
                  const rows = usageOf(assetId);
                  return (
                    <div className="cc-media-duplicates-item" key={assetId}>
                      {group.thumbnails?.[index]
                        ? <img src={group.thumbnails[index]} alt="" />
                        : <span className="cc-media-duplicates-thumb" />}
                      <div>
                        <strong>{group.names[index] ?? assetId}</strong>
                        <span>{rows.length > 0 ? `${rows.length} × ${t('en la línea de tiempo')}` : t('sin clips')}</span>
                      </div>
                      <button type="button" disabled={rows.length === 0} onClick={() => { if (rows[0]) onJumpToMediaItem(rows[0].id); }}>{t('Ir al clip')}</button>
                      {index > 0 && <button type="button" onClick={() => removeAsset(assetId)}>{t('Quitar')}</button>}
                    </div>
                  );
                })}
              </section>
            ))}
            {report.reused.map((group) => (
              <section className="cc-media-duplicates-group" key={`reuse-${group.assetId}`}>
                <strong>{t('Rangos reutilizados en la línea de tiempo')} · {group.name}</strong>
                {group.occurrences.map((occurrence, index) => (
                  <div className="cc-media-duplicates-item" key={occurrence.itemId}>
                    <div>
                      <strong>{occurrence.name}</strong>
                      <span>{occurrence.sameRange ? t('Mismo rango de origen') : t('Otro rango de origen')}</span>
                    </div>
                    <button type="button" onClick={() => onJumpToMediaItem(occurrence.itemId)}>{t('Ir al clip')}</button>
                    {index > 0 && <button type="button" onClick={() => removeItem(occurrence.itemId)}>{t('Quitar')}</button>}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
