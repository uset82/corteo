// Ken Burns effect panel for Inspector
//
// Integrated with the editor data model via src/editor/kenBurns.ts: the panel
// edits the canonical two-point x/y/scale keyframe signature. Preview and export
// interpolate those keyframes everywhere, so no render-side changes are needed.
import { useState } from 'react';
import type { KeyframeEasing } from '../../editor/clipTypes';
import { KEN_BURNS_EASINGS, type NamedEasing } from '../../editor/kenBurns';
import { useT } from '../../i18n/locale';

export { type KenBurnsSpec } from '../../editor/kenBurns';

export type KenBurnsEffectData = {
  enabled: boolean;
  startX: number;
  startY: number;
  startScale: number;
  endX: number;
  endY: number;
  endScale: number;
  easing: NamedEasing;
  duration?: number;
};

interface KenBurnsControlsProps {
  value: KenBurnsEffectData;
  onChange: (value: KenBurnsEffectData) => void;
}

const inputStyle = {
  width: '100%', padding: '4px 8px', fontSize: '12px',
  background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff',
} as const;

/** Kept for external sample/template consumers: re-export from kenBurns.ts
 * (named easings only, tuple curves stay with the generic keyframe editor). */
export type KbEasing = NamedEasing;

// Chinese source strings are the i18n keys (see src/i18n/locale.ts).
const easingLabels: Record<NamedEasing, string> = {
  linear: '线性',
  easeIn: '缓入',
  easeOut: '缓出',
  easeInOut: '缓入缓出',
};

export function KenBurnsControls({ value, onChange }: KenBurnsControlsProps) {
  const t = useT();
  const [, forceRender] = useState(0);
  const handleChange = (updates: Partial<KenBurnsEffectData>) => {
    forceRender((n) => n + 1); // keep local number-input responsiveness snappy
    onChange({ ...value, ...updates });
  };

  return (
    <div className="ken-burns-panel" style={{ padding: '12px', background: '#2a2a2a', borderRadius: '6px', marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600 }}>{t('Ken Burns 效果')}</label>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => handleChange({ enabled: e.target.checked })}
          style={{ width: '16px', height: '16px' }}
        />
      </div>

      {value.enabled && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('开始位置')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>X (%)</label>
                <input
                  type="number"
                  value={value.startX}
                  onChange={(e) => handleChange({ startX: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>Y (%)</label>
                <input
                  type="number"
                  value={value.startY}
                  onChange={(e) => handleChange({ startY: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', color: '#888' }}>{t('缩放 (1 = 100%)')}</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={value.startScale}
                onChange={(e) => handleChange({ startScale: parseFloat(e.target.value) || 1 })}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>{t('结束位置')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>X (%)</label>
                <input
                  type="number"
                  value={value.endX}
                  onChange={(e) => handleChange({ endX: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>Y (%)</label>
                <input
                  type="number"
                  value={value.endY}
                  onChange={(e) => handleChange({ endY: parseFloat(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', color: '#888' }}>{t('缩放 (1 = 100%)')}</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={value.endScale}
                onChange={(e) => handleChange({ endScale: parseFloat(e.target.value) || 1 })}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>{t('缓动')}</label>
            <select
              value={value.easing}
              onChange={(e) => handleChange({ easing: e.target.value as Exclude<KeyframeEasing, [number, number, number, number]> })}
              style={{ ...inputStyle, padding: '6px 8px' }}
            >
              {KEN_BURNS_EASINGS.map((easing) => (
                <option key={easing} value={easing}>{t(easingLabels[easing])}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '12px', padding: '8px', background: '#1a1a1a', borderRadius: '4px', fontSize: '11px', color: '#888' }}>
            💡 {t('Ken Burns 效果说明')}
          </div>
        </>
      )}
    </div>
  );
}

// Kept for external sample/template consumers: compute an interpolated
// transform at a given frame. The editor preview and export pipelines get
// this behavior for free through canonical ItemKeyframes (see kenBurns.ts).
export function applyKenBurnsToClip(kenBurns: KenBurnsEffectData, frame: number, fps: number, durationInSeconds: number) {
  if (!kenBurns.enabled) return { x: 0, y: 0, scale: 1 };

  const totalFrames = Math.max(1, durationInSeconds * fps);
  const progress = Math.min(1, Math.max(0, frame / totalFrames));

  // Apply easing
  let easedProgress = progress;
  switch (kenBurns.easing) {
    case 'easeIn':
      easedProgress = progress * progress;
      break;
    case 'easeOut':
      easedProgress = 1 - Math.pow(1 - progress, 2);
      break;
    case 'easeInOut':
      easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      break;
    default:
      break;
  }

  // Interpolate values
  const x = kenBurns.startX + (kenBurns.endX - kenBurns.startX) * easedProgress;
  const y = kenBurns.startY + (kenBurns.endY - kenBurns.startY) * easedProgress;
  const scale = kenBurns.startScale + (kenBurns.endScale - kenBurns.startScale) * easedProgress;

  return { x, y, scale };
}
