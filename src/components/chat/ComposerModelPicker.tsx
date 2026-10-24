import { useState } from 'react';
import { useT } from '../../i18n/locale';
import { theme } from '../../theme';
import { selectAgentModel } from '../../agent/model-selection';
import { refreshDshModels } from '../../app/appShell';
import { Icon } from '../icons';
import { ComposerPopover } from './ComposerPopover';
import type { ComposerModelView } from './useComposerModelView';
import codexPng from '../../../assets/vendor-icons/codex-color.png';
import copilotSvg from '../../../assets/vendor-icons/copilot.svg?raw';
import claudeSvg from '../../../assets/vendor-icons/claude-color.svg';

function ChoiceLogo({ backend }: { backend: 'api' | 'codex' | 'copilot' | 'claude-code' }) {
  if (backend === 'copilot') {
    return (
      <span
        aria-hidden
        // Static codebase asset, non-user input — inlined so it inherits currentColor.
        dangerouslySetInnerHTML={{ __html: copilotSvg }}
        style={{ width: 18, height: 18, borderRadius: 5, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.panel, border: `0.5px solid ${theme.borderLight}`, color: theme.text, fontSize: 12 }}
      />
    );
  }
  if (backend !== 'codex' && backend !== 'claude-code') return null;
  return (
    <img
      src={backend === 'codex' ? codexPng : claudeSvg}
      alt=""
      aria-hidden
      style={{ width: 18, height: 18, borderRadius: 5, objectFit: 'contain', flex: '0 0 auto', background: theme.panel, border: `0.5px solid ${theme.borderLight}` }}
    />
  );
}

const refreshBtn = {
  display: 'flex', alignItems: 'center', padding: '1px 3px', border: 0, borderRadius: 3,
  background: 'transparent', color: theme.textDim, cursor: 'pointer',
} as const;

export function ComposerModelPicker({ anchor, onClose, view }: {
  readonly anchor: HTMLElement | null;
  readonly onClose: () => void;
  readonly view: ComposerModelView;
}) {
  const t = useT();
  const [refreshing, setRefreshing] = useState(false);
  const hasHarnessModels = view.modelState.choices.some((choice) => choice.provider === 'dsh');
  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await refreshDshModels();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <ComposerPopover width={278} anchor={anchor} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 10.5, color: theme.textDim, padding: '4px 8px 6px' }}>
        <span>{t('本条对话使用的模型')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {hasHarnessModels && (
            <button type="button" aria-label={t('刷新模型列表')} title={t('刷新模型列表')}
              disabled={refreshing} onClick={() => { void refresh(); }}
              style={{ ...refreshBtn, opacity: refreshing ? 0.45 : 1 }}>
              <Icon name="refresh" size={12} />
            </button>
          )}
          <span title={view.contextTitle} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{view.contextLabel}</span>
        </span>
      </div>
      {view.harnessDown && (
        <div style={{ margin: '0 8px 6px', padding: '6px 8px', borderRadius: 3, background: theme.panel, color: theme.textDim, fontSize: 10.5, lineHeight: 1.45 }}>
          {t('DeepSeek Harness 无响应。用 npm run harness 启动它。')}
        </div>
      )}
      {view.modelState.choices.length === 0 && (
        <div style={{ padding: '7px 9px 9px', color: theme.textDim, fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {view.modelState.loaded ? t('请先在设置中配置一个模型厂商。') : t('正在读取模型配置…')}
        </div>
      )}
      {view.modelState.choices.map((choice) => {
        const active = choice.id === view.modelState.activeId;
        return (
          <button type="button" key={choice.id}
            onClick={() => { selectAgentModel(choice.id); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 9px', border: 0, borderRadius: 3, background: active ? theme.panel : 'transparent', color: theme.text, cursor: 'pointer', textAlign: 'left' }}>
            <ChoiceLogo backend={choice.backend} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 11.5, fontWeight: 600 }}>{choice.providerLabel}</strong>
              <small style={{ display: 'block', color: theme.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{choice.model}</small>
            </span>
            {active && <span style={{ color: theme.accent, lineHeight: 0 }}><Icon name="check" size={13} /></span>}
          </button>
        );
      })}
    </ComposerPopover>
  );
}
