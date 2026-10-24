// Searchable effects browser (Phase 2.4).
//
// Effects and LUTs are applied from the clip context menu today; this dialog adds
// the missing searchable catalog: type to filter, click a row to append it to the
// effect stack of every selected visual clip. Ordering and parameter editing stay
// in the inspector, which is where the stack is rendered.
import { useMemo, useState } from 'react';
import type { TimelineState } from '../editor/types';
import type { EditorCommands } from '../editor/store';
import { ALL_FX, LUT_EFFECTS, serializableDefsFor } from '../gl/fx/effects';
import { useT } from '../i18n/locale';
import { Icon } from './icons';
import '../scene-detection/scene-detection.css';

interface EffectsBrowserDialogProps {
  state: TimelineState;
  commands: EditorCommands;
  onClose: () => void;
}

const VISUAL = new Set(['video', 'image']);

export function EffectsBrowserDialog({ state, commands, onClose }: EffectsBrowserDialogProps) {
  const t = useT();
  const [query, setQuery] = useState('');

  const targets = useMemo(
    () => state.items.filter((item) => VISUAL.has(item.kind) && (state.selectedIds ?? []).includes(item.id)),
    [state.items, state.selectedIds],
  );

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(ALL_FX)
      .filter((def) => !needle || `${t(def.name)} ${def.name} ${def.desc}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(a.id in LUT_EFFECTS) - Number(b.id in LUT_EFFECTS) || t(a.name).localeCompare(t(b.name)));
  }, [query, t]);

  const apply = (assetId: string) => {
    for (const item of targets) {
      const next = [...(item.effects ?? []), { id: `fx_${crypto.randomUUID()}`, assetId, overrides: {} }];
      commands.setItemEffects(item.id, next, serializableDefsFor(next));
    }
    onClose();
  };

  return (
    <div className="cc-scene-overlay" onPointerDown={onClose}>
      <div className="cc-scene-dialog" role="dialog" aria-label={t('Biblioteca de efectos')} onPointerDown={(event) => event.stopPropagation()}>
        <header className="cc-scene-header">
          <div>
            <h2>{t('Biblioteca de efectos')}</h2>
            <p>{targets.length > 1
              ? t('Se aplicará a {n} clips seleccionados', { n: targets.length })
              : targets.length === 1
                ? t('Se aplicará al clip seleccionado')
                : t('Selecciona primero un clip de vídeo o imagen')}</p>
          </div>
          <button type="button" className="cc-scene-icon-button" onClick={onClose} title={t('关闭')}><Icon name="x" size={14} /></button>
        </header>

        <div className="cc-scene-search-row">
          <input
            autoFocus
            className="cc-scene-search"
            placeholder={t('Buscar efectos y LUTs…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="cc-scene-list">
          {entries.length === 0 && <p className="cc-scene-empty">{t('没有匹配的效果')}</p>}
          {entries.map((def) => (
            <button
              key={def.id}
              type="button"
              className="cc-scene-row cc-scene-row-button"
              disabled={targets.length === 0}
              onClick={() => apply(def.id)}
            >
              <span className="cc-scene-row-name">
                {t(def.name)}
                {def.id in LUT_EFFECTS && <span className="cc-scene-badge">LUT</span>}
              </span>
              <span className="cc-scene-row-desc">{t(def.desc)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
