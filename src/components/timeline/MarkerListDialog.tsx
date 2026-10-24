// Marker list panel (Phase 4.3): jump to any project or clip marker, edit its
// note/color, or delete it without hunting for the pin on the ruler.
import { createPortal } from 'react-dom';
import { MARKER_HEX, type Marker, type MarkerColor, type TimelineState } from '../../editor/types';
import type { EditorCommands } from '../../editor/store';
import { Icon } from '../icons';
import { useT } from '../../i18n/locale';
import { theme } from '../../theme';
import '../../scene-detection/scene-detection.css';

interface MarkerListDialogProps {
  state: TimelineState;
  commands: EditorCommands;
  onSeek: (frame: number) => void;
  onClose: () => void;
}

const COLORS = Object.keys(MARKER_HEX) as MarkerColor[];

export function formatMarkerTime(frames: number, fps: number): string {
  const seconds = Math.max(0, frames) / Math.max(1, fps);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

export function MarkerListDialog({ state, commands, onSeek, onClose }: MarkerListDialogProps) {
  const t = useT();
  const markers = [...(state.markers ?? [])].sort((a, b) => a.fromFrame - b.fromFrame);
  const byId = new Map(state.items.map((item) => [item.id, item]));
  const label = (marker: Marker): string => {
    if (marker.scope === 'project') return t('项目');
    const item = marker.itemId ? byId.get(marker.itemId) : undefined;
    return item ? `${t('片段')} · ${item.name}` : t('片段');
  };
  return createPortal(
    <div className="cc-scene-overlay" role="dialog" aria-modal="true" aria-labelledby="cc-markers-title" onClick={onClose}>
      <section className="cc-scene-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="cc-scene-header">
          <div>
            <h2 id="cc-markers-title">{t('标记列表')}</h2>
            <p>{t('点击标记跳转；批注和颜色可直接修改')}</p>
          </div>
          <button type="button" autoFocus className="cc-scene-icon-button" onClick={onClose} aria-label={t('关闭')}>
            <Icon name="x" size={17} />
          </button>
        </header>
        <div className="cc-scene-body" style={{ gridTemplateColumns: '1fr' }}>
          <main className="cc-scene-results">
            <div className="cc-scene-list">
              {markers.length === 0 && (
                <div className="cc-scene-empty"><Icon name="bookmark" size={28} /><span>{t('还没有标记。按 M 在播放头添加项目标记。')}</span></div>
              )}
              {markers.map((marker) => (
                <article
                  key={marker.id}
                  className="cc-scene-row"
                  style={{ cursor: 'pointer', opacity: marker.durationFrames > 0 ? 1 : 0.96 }}
                  role="button"
                  tabIndex={0}
                  onClick={() => { onSeek(marker.fromFrame); onClose(); }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSeek(marker.fromFrame);
                    onClose();
                  }}
                >
                  <div className="cc-scene-row-meta" style={{ alignItems: 'center' }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: MARKER_HEX[marker.color], display: 'inline-block' }} />
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMarkerTime(marker.fromFrame, state.fps)}</strong>
                    <span>{label(marker)}</span>
                    {marker.durationFrames > 0 && <em>{t('区间 {n}s', { n: (marker.durationFrames / state.fps).toFixed(1) })}</em>}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }} onClick={(event) => event.stopPropagation()}>
                      <select
                        aria-label={t('颜色')}
                        value={marker.color}
                        onChange={(event) => commands.updateMarker(marker.id, { color: event.target.value as MarkerColor })}
                        style={{ background: theme.panelAlt, color: theme.text, border: `0.5px solid ${theme.border}`, borderRadius: 4, fontSize: 11, padding: '2px 4px' }}
                      >
                        {COLORS.map((color) => <option key={color} value={color}>{t(color)}</option>)}
                      </select>
                      <button
                        type="button"
                        className="cc-scene-button"
                        onClick={() => commands.removeMarker(marker.id)}
                        aria-label={t('删除标记')}
                      >
                        {t('删除')}
                      </button>
                    </span>
                  </div>
                  <input
                    value={marker.note}
                    placeholder={t('批注…')}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => commands.updateMarker(marker.id, { note: event.target.value })}
                    style={{
                      width: '100%', marginTop: 6, background: theme.panelAlt, color: theme.text,
                      border: `0.5px solid ${theme.border}`, borderRadius: 4, padding: '4px 6px', fontSize: 12,
                    }}
                  />
                </article>
              ))}
            </div>
          </main>
        </div>
      </section>
    </div>,
    document.body,
  );
}
