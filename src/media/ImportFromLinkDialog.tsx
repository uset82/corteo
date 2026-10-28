// "Importar desde enlace": a platform page becomes a generation job (yt-dlp on the
// server), a direct file URL goes through /api/import-url. Progress is read from
// /generate/progress so a long download does not hold an HTTP request open.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { isPlatformUrl } from '../../shared/platform-urls';
import type { ProbeResult } from '../../shared/media-probe';
import type { MediaAsset } from '../editor/types';
import { useT } from '../i18n/locale';
import { sniffKind } from '../agent/tools/stock-url-utils';
import type { GenerationJobResult } from '../generate/progress';

interface ImportFromLinkDialogProps {
  readonly fps: number;
  readonly onAddAsset: (asset: MediaAsset) => void;
  readonly onClose: () => void;
}

interface ProgressReport {
  status?: 'queued' | 'running' | 'succeeded' | 'failed';
  progress?: number;
  error?: string;
  code?: string;
  result?: GenerationJobResult;
  results?: GenerationJobResult[];
}

function parseSeconds(raw: string): number | undefined {
  const value = Number(raw.trim());
  return raw.trim() && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function fileNameOf(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
    return name || 'imported';
  } catch {
    return 'imported';
  }
}

export function ImportFromLinkDialog({ fps, onAddAsset, onClose }: ImportFromLinkDialogProps) {
  const t = useT();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const platform = isPlatformUrl(url);
  const hint = url.trim()
    ? platform
      ? t('YouTube、Vimeo 或 Bilibili：用 yt-dlp 下载，可能要几分钟。')
      : t('直接文件链接：先下载到本地素材库。')
    : '';

  const addResultAsset = (result: GenerationJobResult) => {
    if (!result.assetId || !result.path) return false;
    onAddAsset({
      id: result.assetId,
      name: result.name ?? fileNameOf(result.path),
      kind: result.kind ?? 'video',
      src: result.path,
      durationInFrames: Math.max(1, Math.round((result.durationSeconds ?? 0) * fps)),
      width: result.width,
      height: result.height,
      source: result.source,
    });
    return true;
  };

  const pollJob = async (jobId: string): Promise<void> => {
    while (alive.current) {
      const response = await fetch('/generate/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wait', target: 'generation', jobIds: [jobId], timeoutSeconds: 20 }),
      });
      const data = await response.json().catch(() => ({})) as { reports?: ProgressReport[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      const report = data.reports?.[0];
      if (!report) throw new Error(t('任务丢失，请重试。'));
      if (typeof report.progress === 'number') setProgress(report.progress);
      if (report.status === 'failed') throw new Error(report.error ?? report.code ?? t('下载失败'));
      if (report.status === 'succeeded') {
        const result = report.result ?? report.results?.[0];
        if (!result || !addResultAsset(result)) throw new Error(t('下载完成但没有可用的素材'));
        return;
      }
    }
  };

  const importPlatform = async (link: string) => {
    const startSeconds = parseSeconds(start);
    const endSeconds = parseSeconds(end);
    if (startSeconds !== undefined && endSeconds !== undefined && endSeconds <= startSeconds) {
      throw new Error(t('结束时间必须大于开始时间'));
    }
    const response = await fetch('/api/import-platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link, name: name.trim() || undefined, startSeconds, endSeconds }),
    });
    const body = await response.json().catch(() => ({})) as { jobId?: string; error?: string };
    if (!response.ok || !body.jobId) throw new Error(body.error ?? `HTTP ${response.status}`);
    setProgress(0);
    await pollJob(body.jobId);
  };

  const importDirect = async (link: string) => {
    const response = await fetch('/api/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link, name: name.trim() || undefined }),
    });
    const body = await response.json().catch(() => ({})) as {
      ok?: boolean; path?: string; filename?: string; probe?: ProbeResult; error?: string;
    };
    if (!body.ok || typeof body.path !== 'string' || !body.path.startsWith('/media/')) {
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    const probe = body.probe;
    const seconds = probe?.durationSeconds ?? 0;
    onAddAsset({
      id: crypto.randomUUID(),
      name: name.trim() || body.filename || fileNameOf(link),
      kind: sniffKind(body.path) ?? 'video',
      src: body.path,
      durationInFrames: Math.max(1, Math.round(seconds * fps)),
      width: probe?.width,
      height: probe?.height,
      source: { pageUrl: link },
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const link = url.trim();
    if (!/^https?:\/\//i.test(link)) { setError(t('请输入有效的 http(s) 链接')); return; }
    setBusy(true);
    setError('');
    setProgress(null);
    try {
      if (isPlatformUrl(link)) await importPlatform(link);
      else await importDirect(link);
      if (alive.current) onClose();
    } catch (caught) {
      if (alive.current) setError(t('导入失败：{error}', { error: caught instanceof Error ? caught.message : String(caught) }));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return createPortal(
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('从链接导入')} onClick={() => { if (!busy) onClose(); }}>
      <form className="cc-modal cc-import-link-dialog" onSubmit={(event) => void submit(event)} onClick={(event) => event.stopPropagation()}>
        <div className="cc-import-link-head">
          <strong>{t('从链接导入')}</strong>
          <button type="button" aria-label={t('关闭')} disabled={busy} onClick={onClose}>×</button>
        </div>
        <label className="cc-import-link-field">
          <span>{t('链接')}</span>
          <input autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" disabled={busy} />
        </label>
        <label className="cc-import-link-field">
          <span>{t('名称（可选）')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('默认使用作品标题')} disabled={busy} />
        </label>
        {platform && (
          <div className="cc-import-link-range">
            <label className="cc-import-link-field">
              <span>{t('从（秒）')}</span>
              <input inputMode="decimal" value={start} onChange={(event) => setStart(event.target.value)} placeholder="0" disabled={busy} />
            </label>
            <label className="cc-import-link-field">
              <span>{t('到（秒）')}</span>
              <input inputMode="decimal" value={end} onChange={(event) => setEnd(event.target.value)} placeholder={t('结尾')} disabled={busy} />
            </label>
          </div>
        )}
        {hint && <p className="cc-import-link-note">{hint}</p>}
        {busy && <p className="cc-import-link-note">{progress === null ? t('下载中…') : `${Math.round(progress)}%`}</p>}
        {error && <p className="cc-import-link-error">{error}</p>}
        <div className="cc-import-link-actions">
          <button type="button" disabled={busy} onClick={onClose}>{t('取消')}</button>
          <button type="submit" className="primary" disabled={busy}>{t('导入')}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
