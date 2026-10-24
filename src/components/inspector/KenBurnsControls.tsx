// Ken Burns effect panel for Inspector
import { useState } from 'react';

export interface KenBurnsEffectData {
  enabled: boolean;
  startX: number;
  startY: number;
  startScale: number;
  endX: number;
  endY: number;
  endScale: number;
  easing: 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut';
  duration?: number;
}

interface KenBurnsControlsProps {
  value: KenBurnsEffectData;
  onChange: (value: KenBurnsEffectData) => void;
}

export function KenBurnsControls({ value, onChange }: KenBurnsControlsProps) {
  const handleChange = (updates: Partial<KenBurnsEffectData>) => {
    onChange({ ...value, ...updates });
  };

  return (
    <div className="ken-burns-panel" style={{ padding: '12px', background: '#2a2a2a', borderRadius: '6px', marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600 }}>Ken Burns Effect</label>
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
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>Start Position</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>X</label>
                <input
                  type="number"
                  value={value.startX}
                  onChange={(e) => handleChange({ startX: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>Y</label>
                <input
                  type="number"
                  value={value.startY}
                  onChange={(e) => handleChange({ startY: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', color: '#888' }}>Scale</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={value.startScale}
                onChange={(e) => handleChange({ startScale: parseFloat(e.target.value) || 1 })}
                style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa' }}>End Position</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>X</label>
                <input
                  type="number"
                  value={value.endX}
                  onChange={(e) => handleChange({ endX: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#888' }}>Y</label>
                <input
                  type="number"
                  value={value.endY}
                  onChange={(e) => handleChange({ endY: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', color: '#888' }}>Scale</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={value.endScale}
                onChange={(e) => handleChange({ endScale: parseFloat(e.target.value) || 1 })}
                style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>Easing</label>
            <select
              value={value.easing}
              onChange={(e) => handleChange({ easing: e.target.value as any })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
            >
              <option value="linear">Linear</option>
              <option value="ease">Ease</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
              <option value="easeInOut">Ease In/Out</option>
            </select>
          </div>

          <div style={{ marginTop: '12px', padding: '8px', background: '#1a1a1a', borderRadius: '4px', fontSize: '11px', color: '#888' }}>
            💡 Ken Burns creates smooth pan and zoom animations on still images with sub-pixel precision
          </div>
        </>
      )}
    </div>
  );
}

// Helper function to apply Ken Burns to Remotion composition
export function applyKenBurnsToClip(kenBurns: KenBurnsEffectData, frame: number, fps: number, durationInSeconds: number) {
  if (!kenBurns.enabled) return { x: 0, y: 0, scale: 1 };
  
  const totalFrames = durationInSeconds * fps;
  const progress = frame / totalFrames;
  
  // Apply easing
  let easedProgress = progress;
  switch (kenBurns.easing) {
    case 'ease':
      easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      break;
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
  }
  
  // Interpolate values
  const x = kenBurns.startX + (kenBurns.endX - kenBurns.startX) * easedProgress;
  const y = kenBurns.startY + (kenBurns.endY - kenBurns.startY) * easedProgress;
  const scale = kenBurns.startScale + (kenBurns.endScale - kenBurns.startScale) * easedProgress;
  
  return { x, y, scale };
}
