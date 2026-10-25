import { useState } from 'react';
import type { BrandKit } from '../../brand/kit';
import { CAPTION_STYLES } from '../../captions/styles';
import { useT } from '../../i18n/locale';
import { theme } from '../../theme';

/**
 * "Marca" — the brand-kit editor inside the existing design-style panel (Plan 5, OP-10 step 4).
 *
 * It edits the kit the document already carries (`brandKitOf` supplies the defaults when the
 * project has none) and commits it through the same `setBrandKit` command the agent uses, so
 * the panel and `apply_brand_kit` can never disagree about what a kit is.
 *
 * Only the fields a person actually tunes live here: name, caption preset, safe margin. The
 * logo and the palette stay in the design-style controls above, which already own them.
 */

interface BrandKitSectionProps {
  kit: BrandKit;
  onSave: (kit: BrandKit) => void;
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 };
const label: React.CSSProperties = { width: 132, fontSize: 12, color: theme.textDim };
const field: React.CSSProperties = {
  flex: 1, minWidth: 0, height: 28, padding: '0 8px', fontSize: 12,
  color: theme.text, background: theme.panelAlt,
  border: `1px solid ${theme.border}`, borderRadius: 6,
};

export function BrandKitSection({ kit, onSave }: BrandKitSectionProps) {
  const t = useT();
  const [name, setName] = useState(kit.name);
  const [captionPreset, setCaptionPreset] = useState(kit.captionPreset);
  const [safeMargin, setSafeMargin] = useState(kit.safeMargin);
  const [saved, setSaved] = useState(false);

  const dirty = name !== kit.name || captionPreset !== kit.captionPreset || safeMargin !== kit.safeMargin;

  const commit = (): void => {
    onSave({ ...kit, name, captionPreset, safeMargin });
    setSaved(true);
  };

  return (
    <section
      aria-label={t('品牌')}
      style={{ borderTop: `1px solid ${theme.border}`, padding: '12px 16px' }}
    >
      <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 650, color: theme.text }}>{t('品牌')}</h3>

      <div style={row}>
        <label style={label} htmlFor="cc-brand-name">{t('品牌名称')}</label>
        <input
          id="cc-brand-name"
          style={field}
          value={name}
          maxLength={40}
          onChange={(event) => { setName(event.target.value); setSaved(false); }}
        />
      </div>

      <div style={row}>
        <label style={label} htmlFor="cc-brand-captions">{t('字幕样式')}</label>
        <select
          id="cc-brand-captions"
          style={field}
          value={captionPreset}
          onChange={(event) => { setCaptionPreset(event.target.value); setSaved(false); }}
        >
          {CAPTION_STYLES.map((style) => (
            <option key={style.id} value={style.id}>{style.label}</option>
          ))}
        </select>
      </div>

      <div style={row}>
        <label style={label} htmlFor="cc-brand-margin">{t('安全边距')}</label>
        <input
          id="cc-brand-margin"
          style={field}
          type="range"
          min={0}
          max={0.2}
          step={0.01}
          value={safeMargin}
          onChange={(event) => { setSafeMargin(Number(event.target.value)); setSaved(false); }}
        />
        <span style={{ width: 42, fontSize: 11, color: theme.textDim, textAlign: 'right' }}>
          {Math.round(safeMargin * 100)}%
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={commit}
          disabled={!dirty}
          style={{
            height: 28, padding: '0 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: dirty ? 'pointer' : 'default',
            border: 'none', background: theme.accent, color: theme.onAccent,
            opacity: dirty ? 1 : 0.5,
          }}
        >
          {saved && !dirty ? t('已保存') : t('保存品牌')}
        </button>
        <span style={{ fontSize: 11, color: theme.textDim }}>
          {t('corteo puede aplicar esta marca a todos los clips')}
        </span>
      </div>
    </section>
  );
}
