// P3-3: the credit list for attributed assets and the creditos.txt download.
// Only assets with a source object appear; nothing is invented for uploads with
// no attribution.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaAsset } from '../editor/types';
import { useT } from '../i18n/locale';
import { creditRows, creditsText, CREDITS_FILE_NAME } from './credits';

interface MediaCreditsDialogProps {
  assets: MediaAsset[];
  onClose: () => void;
}

const FIELDS = [
  ['title', 'Título'],
  ['uploader', 'Autor'],
  ['license', 'Licencia'],
  ['pageUrl', 'Enlace'],
  ['lyricLine', 'Línea de la letra'],
  ['searchQuery', 'Búsqueda'],
] as const;

export function MediaCreditsDialog({ assets, onClose }: MediaCreditsDialogProps) {
  const t = useT();
  const rows = useMemo(() => creditRows(assets), [assets]);
  const [exported, setExported] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = () => {
    const text = creditsText(rows);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = CREDITS_FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };

  return createPortal(
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('Créditos')} onClick={onClose}>
      <div className="cc-modal cc-credits-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="cc-credits-head">
          <strong>{t('Créditos')}</strong>
          <button type="button" aria-label={t('Cerrar')} onClick={onClose}>×</button>
        </div>
        {rows.length === 0 ? (
          <p className="cc-credits-note">{t('No hay créditos de fuentes todavía.')}</p>
        ) : (
          <div className="cc-credits-list">
            {rows.map((row, index) => (
              <section className="cc-credits-row" key={`${row.name}-${index}`}>
                <strong>{t('Archivo')}: {row.name}</strong>
                {FIELDS.map(([field, label]) => row[field] ? (
                  <div className="cc-credits-field" key={field}>
                    <span>{t(label)}</span>
                    {field === 'pageUrl'
                      ? <a href={row.pageUrl} target="_blank" rel="noreferrer">{row.pageUrl}</a>
                      : <span>{row[field]}</span>}
                  </div>
                ) : null)}
              </section>
            ))}
          </div>
        )}
        <div className="cc-credits-actions">
          <button type="button" className="primary" disabled={!rows.length} onClick={download}>
            {t('Exportar creditos.txt')}
          </button>
          {exported && <span className="cc-credits-note">{CREDITS_FILE_NAME}</span>}
          <button type="button" onClick={onClose}>{t('Cerrar')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
