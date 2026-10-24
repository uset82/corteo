import { useT } from '../i18n/locale';
import {
  MAX_VIDEO_BITRATE_MBPS,
  MIN_VIDEO_BITRATE_MBPS,
  type VideoBitrateMode,
} from './bitrate';
import { CRF_RANGE } from './useExportDialogModel';

interface ExportBitrateControlProps {
  mode: VideoBitrateMode;
  customMbps: number;
  crf: number;
  /** VP8/ProRes have no CRF path in the server renderer. */
  allowCrf: boolean;
  resolvedBps: number;
  disabled: boolean;
  onModeChange: (mode: VideoBitrateMode) => void;
  onCustomMbpsChange: (value: number) => void;
  onCrfChange: (value: number) => void;
}

const MODES: Array<{ value: VideoBitrateMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'crf', label: '恒定质量 (CRF)' },
  { value: 'compact', label: '小文件' },
  { value: 'recommended', label: '推荐' },
  { value: 'high', label: '高质量' },
  { value: 'custom', label: '自定义' },
];

export function ExportBitrateControl({
  mode,
  customMbps,
  crf,
  allowCrf,
  resolvedBps,
  disabled,
  onModeChange,
  onCustomMbpsChange,
  onCrfChange,
}: ExportBitrateControlProps) {
  const t = useT();
  const modes = allowCrf ? MODES : MODES.filter((entry) => entry.value !== 'crf');
  return (
    <div className="cc-export-bitrate">
      <select
        className="cc-export-select"
        aria-label={t('码率模式')}
        value={mode}
        disabled={disabled}
        onChange={(event) => onModeChange(event.target.value as VideoBitrateMode)}
      >
        {modes.map((entry) => <option key={entry.value} value={entry.value}>{t(entry.label)}</option>)}
      </select>
      {mode === 'custom' && (
        <label className="cc-export-bitrate-custom">
          <input
            type="number"
            min={MIN_VIDEO_BITRATE_MBPS}
            max={MAX_VIDEO_BITRATE_MBPS}
            step={0.5}
            value={customMbps}
            disabled={disabled}
            aria-label={t('自定义码率')}
            onChange={(event) => onCustomMbpsChange(Number(event.target.value))}
          />
          <span>Mbps</span>
        </label>
      )}
      {mode === 'crf' && (
        <label className="cc-export-bitrate-custom">
          <input
            type="range"
            min={CRF_RANGE.min}
            max={CRF_RANGE.max}
            step={1}
            value={crf}
            disabled={disabled}
            aria-label={t('CRF 值')}
            onChange={(event) => onCrfChange(Number(event.target.value))}
          />
          <span>{t('CRF {value}', { value: crf })}</span>
        </label>
      )}
      <small>
        {mode === 'crf'
          ? t('CRF 18–28，数值越小画质越高、文件越大；仅在本机渲染生效。')
          : t('预计视频码率：{value} Mbps', { value: (resolvedBps / 1_000_000).toFixed(1) })}
      </small>
    </div>
  );
}
