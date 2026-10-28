// "Créditos" list: every asset that says where it came from, plus the
// creditos.txt export. The pool stores the source; this dialog only formats it.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaAsset } from '../editor/types';
import { useT } from '../i18n/locale';
import { downloadBlob } from '../export/exportFiles';
import { creditsText, mediaCreditEntries, type MediaCreditEntry } from './mediaCredits';

interface MediaCreditsDialogProps {
  readonly assets: MediaAsset[];
  readonly onClose: () => void;
}

function safeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function CreditRow({ entry }: { entry: MediaCreditEntry }) {
  const t = useT();
  const link = safeUrl(entry.pageUrl);
  return (
    <li className="cc-media-credits-item">
      <strong>{entry.name}</strong>
      {entry.uploader && <span>{t('作者')}: {entry.uploader}</span>}
      {link
        ? <a href={link} target="_blank" rel="noreferrer">{entry.provider ?? link}</a>
        : entry.provider && <span>{t('来源')}: {entry.provider}</span>}
      {entry.license && <span>{t('许可证')}: {entry.license}</span>}
      {entry.lyricLine && <span>{t('歌词片段')}: {entry.lyricLine}</span>}
      {entry.searchQuery && <span>{t('搜索词')}: {entry.searchQuery}</span>}
    </li>
  );
}

export function MediaCreditsDialog({ assets, onClose }: MediaCreditsDialogProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const entries = useMemo(() => mediaCreditEntries(assets), [assets]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(creditsText(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions / insecure context): the list stays selectable.
    }
  };
  const download = () => {
    downloadBlob(new Blob([creditsText(entries, new Date())], { type: 'text/plain;charset=utf-8' }), 'creditos.txt');
  };

  return createPortal(
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('素材来源')} onClick={onClose}>
      <div className="cc-modal cc-media-credits-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="cc-media-credits-head">
          <strong>{t('素材来源')}</strong>
          <button type="button" aria-label={t('关闭')} onClick={onClose}>×</button>
        </div>
        {entries.length === 0
          ? <p className="cc-media-credits-note">{t('还没有需要署名的来源。')}</p>
          : <ol className="cc-media-credits-list">{entries.map((entry) => <CreditRow key={entry.assetId} entry={entry} />)}</ol>}
        <div className="cc-media-credits-actions">
          <button type="button" disabled={entries.length === 0} onClick={() => void copy()}>{copied ? t('已复制') : t('复制全文')}</button>
          <button type="button" className="primary" onClick={download}>{t('下载 creditos.txt')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
