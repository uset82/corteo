// Duplicate shot detector panel (Phase 3.4).
//
// Hashes one representative frame per visual clip (src/duplicates/duplicateScan)
// and lists groups of near-identical shots. Selecting a group puts those clips
// into the timeline selection so they can be trimmed or replaced together.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimelineItem, TimelineState } from '../editor/types';
import { Icon } from '../components/icons';
import { useT } from '../i18n/locale';
import { DEFAULT_DUPLICATE_THRESHOLD } from '../duplicates/perceptualHash';
import { isSampledItem, scanForDuplicates, type DuplicateScanResult } from '../duplicates/duplicateScan';
import '../scene-detection/scene-detection.css';

interface DuplicateDetectorDialogProps {
  state: TimelineState;
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}

function formatTime(frames: number, fps: number): string {
  const seconds = Math.max(0, frames) / Math.max(1, fps);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
}

export function DuplicateDetectorDialog({ state, onSelect, onClose }: DuplicateDetectorDialogProps) {
  const t = useT();
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_DUPLICATE_THRESHOLD);
  const abortRef = useRef<AbortController | null>(null);

  const sampled = useMemo(() => state.items.filter(isSampledItem), [state.items]);
  const byId = useMemo(() => new Map(state.items.map((item) => [item.id, item])), [state.items]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const scan = async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setScanning(true);
    setError(null);
    setProgress(0);
    try {
      const scanResult = await scanForDuplicates(state.items, state.fps, {
        threshold,
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (!controller.signal.aborted) setResult(scanResult);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  };

  const close = (): void => {
    abortRef.current?.abort();
    onClose();
  };

  const groups = result?.groups ?? [];
  const label = (item: TimelineItem): string => item.name || item.src?.split('/').pop() || item.id;

  return createPortal(
    <div className="cc-scene-overlay" role="dialog" aria-modal="true" aria-labelledby="cc-dupes-title" onClick={scanning ? undefined : close}>
      <section className="cc-scene-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="cc-scene-header">
          <div>
            <h2 id="cc-dupes-title">{t('重复片段检测')}</h2>
            <p>{t('比较每个画面片段的中点帧，找出重复使用的镜头')}</p>
          </div>
          <button type="button" autoFocus className="cc-scene-icon-button" onClick={close} aria-label={t('关闭')}>
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="cc-scene-body">
          <aside className="cc-scene-options">
            <label>
              <span>{t('相似阈值')}</span>
              <strong>{threshold}</strong>
              <input type="range" min={0} max={16} step={1} value={threshold} disabled={scanning}
                onChange={(event) => setThreshold(Number(event.target.value))} />
              <small>{t('数值越大，越多相似镜头被判为重复')}</small>
            </label>

            <div className="cc-scene-progress-card">
              <div><span>{scanning ? t('正在比较画面') : t('画面片段')}</span><strong>{Math.round(progress * 100)}%</strong></div>
              <div className="cc-scene-progress-track"><i style={{ transform: `scaleX(${progress})` }} /></div>
              <small>{t('可扫描 {n} 个画面片段；文字、纯色和序列会被跳过', { n: sampled.length })}</small>
            </div>

            <button type="button" className="cc-scene-button primary" onClick={() => void scan()} disabled={scanning || sampled.length < 2}>
              {result ? t('重新扫描') : t('扫描')}
            </button>
            {sampled.length < 2 && <small>{t('时间线上至少需要两个画面片段')}</small>}
            {error && <p className="cc-scene-error">{error}</p>}
          </aside>

          <main className="cc-scene-results">
            <div className="cc-scene-results-header">
              <div>
                <h3>{t('重复组')}</h3>
                <p>{result
                  ? t('找到 {n} 组重复片段，点击一组即可选中', { n: groups.length })
                  : t('扫描完成后会列出相似镜头')}</p>
              </div>
              {result && <span>{t('已扫描 {n} 个', { n: result.scanned })}</span>}
            </div>

            <div className="cc-scene-list">
              {!result && (
                <div className="cc-scene-empty"><Icon name="film" size={28} /><span>{scanning ? t('正在比对各片段画面…') : t('点击“扫描”开始')}</span></div>
              )}
              {result && groups.length === 0 && (
                <div className="cc-scene-empty"><Icon name="check" size={28} /><span>{t('未找到重复')}</span></div>
              )}
              {groups.map((group, index) => (
                <article className="cc-scene-row" key={index} style={{ cursor: 'pointer' }}
                  role="button" tabIndex={0}
                  onClick={() => { onSelect(group.clips); close(); }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSelect(group.clips);
                    close();
                  }}>
                  <div className="cc-scene-row-meta">
                    <strong>#{index + 1}</strong>
                    <span>{t('相似度 {n}%', { n: group.similarity })}</span>
                    <em>{t('{n} 个片段', { n: group.clips.length })}</em>
                  </div>
                  <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, fontSize: 12, color: '#aaa' }}>
                    {group.clips.map((id) => {
                      const item = byId.get(id);
                      return (
                        <li key={id}>
                          {item ? `${label(item)} · ${formatTime(item.startFrame, state.fps)}` : id}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
              {result && result.skipped > 0 && (
                <p className="cc-scene-footnote">{t('跳过 {n} 个不可取帧的片段', { n: result.skipped })}</p>
              )}
            </div>
          </main>
        </div>
      </section>
    </div>,
    document.body,
  );
}
