// P3-4: "Importar desde enlace" in the media-pool menu. Platform pages use the
// P3-2 NDJSON route; direct media URLs use /api/import-url. The dialog creates
// the pool asset locally, so no project document goes to the server.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaAsset } from '../editor/types';
import { useT } from '../i18n/locale';
import { directoryFileToAsset } from './directoryImportAsset';
import { classifyImportLink, directImportAsset, type ImportUrlResponse } from './importLink';

interface MediaImportLinkDialogProps {
  assets: MediaAsset[];
  fps: number;
  onAddAsset: (asset: MediaAsset) => void;
  onClose: () => void;
}

interface PlatformFile {
  name: string;
  src: string;
  storedName: string;
  contentHash: string;
  kind: 'video' | 'audio' | 'image' | 'gif' | 'svg';
  size: number;
  durationSeconds?: number;
  sourceModifiedAt: number;
  width?: number;
  height?: number;
  sourceFps?: number;
}

export function MediaImportLinkDialog({ assets, fps, onAddAsset, onClose }: MediaImportLinkDialogProps) {
  const t = useT();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const finish = (asset: MediaAsset) => {
    onAddAsset(asset);
    setDone(true);
    setProgress(100);
    setTimeout(onClose, 700);
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    setDone(false);
    let target;
    try {
      target = classifyImportLink(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    setBusy(true);
    setProgress(target.kind === 'platform' ? 0 : null);
    try {
      if (target.kind === 'platform') {
        const response = await fetch('/api/import-platform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: target.url,
            knownHashes: assets.map((asset) => asset.sourceContentHash).filter(Boolean),
          }),
        });
        if (!response.ok || !response.body || !(response.headers.get('content-type') ?? '').includes('ndjson')) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let file: PlatformFile | null = null;
        for (;;) {
          const chunk = await reader.read();
          buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: Record<string, unknown>;
            try { event = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
            if (event.type === 'progress' && typeof event.percent === 'number') setProgress(event.percent);
            else if (event.type === 'error') throw new Error(typeof event.error === 'string' ? event.error : 'Import failed');
            else if (event.type === 'done') file = event.file as PlatformFile;
          }
          if (chunk.done) break;
        }
        if (!file) throw new Error('La importación terminó sin archivo.');
        finish(await directoryFileToAsset({ ...file, importId: crypto.randomUUID() }, fps));
      } else {
        const response = await fetch('/api/import-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target.url }),
        });
        const body = await response.json().catch(() => null) as ImportUrlResponse | null;
        if (!body) throw new Error(`HTTP ${response.status}`);
        finish(directImportAsset(body, target.url, fps));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('Importar desde enlace')} onClick={() => { if (!busy) onClose(); }}>
      <div className="cc-modal cc-import-link-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="cc-import-link-head">
          <strong>{t('Importar desde enlace')}</strong>
          <button type="button" aria-label={t('Cerrar')} disabled={busy} onClick={onClose}>×</button>
        </div>
        <p className="cc-import-link-note">
          {t('Pega una URL de YouTube, Vimeo, Bilibili o un archivo de vídeo, audio o imagen.')}
        </p>
        <input
          autoFocus
          value={url}
          disabled={busy}
          placeholder="https://www.youtube.com/watch?v=…"
          aria-label={t('Enlace del video o archivo')}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }}
        />
        {busy && progress !== null && (
          <div className="cc-import-link-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            <span>{t('Importando… {percent}%', { percent: Math.round(progress) })}</span>
          </div>
        )}
        {busy && progress === null && <p className="cc-import-link-note">{t('Importando…')}</p>}
        {error && <p className="cc-import-link-error">{t('No se pudo importar el enlace: {error}', { error })}</p>}
        {done && <p className="cc-import-link-done">{t('Importación completada')}</p>}
        <div className="cc-import-link-actions">
          <button type="button" className="primary" disabled={!url.trim() || busy} onClick={() => void submit()}>
            {busy ? t('Importando…') : t('Importar')}
          </button>
          <button type="button" disabled={busy} onClick={onClose}>{t('Cerrar')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
