import { useState } from 'react';
import type { CaptionsData, CaptionMotionPreset } from './types';
import { CAPTION_MOTION_OPTIONS } from './captionMotion';
import type { LatidoBeats } from './latidoBeats';
import { useT } from '../i18n/locale';

interface CaptionMotionControlsProps {
  value: CaptionMotionPreset | undefined;
  onChange: (patch: Pick<CaptionsData, 'motionPreset' | 'motionBeatsMs'>) => void;
  /** Beat grid already stored on the captions item (`latido`). */
  beatsMs?: readonly number[];
  /** Resolves the grid from the song analysis; absent in hosts without an analysis cache. */
  resolveBeats?: () => Promise<LatidoBeats | { readonly error: string }>;
}

export function CaptionMotionControls({ value, onChange, beatsMs, resolveBeats }: CaptionMotionControlsProps) {
  const t = useT();
  const selected = value ?? 'none';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pulseCount = value === 'latido' ? beatsMs?.length ?? 0 : 0;

  const choose = async (id: CaptionMotionPreset) => {
    setError(null);
    if (id !== 'latido') {
      onChange({ motionPreset: id, motionBeatsMs: undefined });
      return;
    }
    if (beatsMs?.length) {
      onChange({ motionPreset: 'latido', motionBeatsMs: [...beatsMs] });
      return;
    }
    if (!resolveBeats || busy) {
      setError(t('音乐脉动需要先分析歌曲。'));
      return;
    }
    setBusy(true);
    const result = await resolveBeats();
    setBusy(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onChange({ motionPreset: 'latido', motionBeatsMs: [...result.beatsMs] });
  };

  return (
    <div className="cc-cap-field">
      <div className="cc-cap-label">{t('字幕动效')}</div>
      <div className="cc-cap-pills" role="listbox" aria-label={t('字幕动效')}>
        {CAPTION_MOTION_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={selected === option.id}
            className={`cc-cap-pill${selected === option.id ? ' selected' : ''}`}
            disabled={busy}
            onClick={() => void choose(option.id)}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
      {busy && <p className="cc-cap-hint">{t('正在读取节拍…')}</p>}
      {!busy && error && <p className="cc-cap-hint" role="alert">{error}</p>}
      {!busy && !error && pulseCount > 0 && (
        <p className="cc-cap-hint">{t('节拍脉动 · {n} 拍', { n: pulseCount })}</p>
      )}
      <p className="cc-cap-hint">{t('动效按时间线帧计算，预览与导出保持一致。')}</p>
    </div>
  );
}
