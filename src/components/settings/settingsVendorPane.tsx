// Provider configuration page composition: the vendor pane shells (Codex,
// Copilot, Claude Code, xAI OAuth, local model packs) and the page header.
// Field rendering and the connection-test row live in settingsVendorFields.tsx
// and are re-exported below for the sibling panes that import them from here.
import { theme } from '../../theme';
import { useT } from '../../i18n/locale';
import { VendorIcon } from './vendorIcons';
import { Icon } from '../icons';
import { CodexAccountCard } from './CodexAccountCard';
import { ClaudeCodeVendorPane } from './ClaudeCodeVendorPane';
import { FalModelNote } from './FalModelNote';
import { llmProviderConfigNames, normalizeLlmProvider } from '../../../shared/llm-providers';
import { MODEL_CAPABILITY_OVERRIDES_KEY } from '../../../shared/model-capabilities';
import { CopilotVendorPane } from './CopilotVendorPane';
import { ModelCapabilityEditor } from './ModelCapabilityEditor';
import { XaiOauthVendorPane } from './XaiOauthVendorPane';
import { VisionModelPane } from './VisionModelPane';
import { LocalAsrPane } from './LocalAsrPane';
import { LocalModelPackPane } from './LocalModelPackPane';
import { SemanticModelPackPane } from './SemanticModelPackPane';
import { SettingsNoteAction } from './SettingsNoteAction.tsx';
import {
  modelValue, vendorConfigured,
  type SettingsField, type SettingsVendorPage,
} from './settingsSchema';
import { fieldCardBox, ON, pageNote, pane } from './settingsVendorPane.styles';
export { ON, WARN } from './settingsVendorPane.styles';
import { FieldRow, TestConnectionRow, type FieldCtx } from './settingsVendorFields';
export { FieldRow, TestConnectionRow };
export type { FieldCtx };

const CAPABILITY_OVERRIDE_FIELD: SettingsField = {
  name: MODEL_CAPABILITY_OVERRIDES_KEY, label: '模型能力', kind: 'text', defaultLabel: '',
};

function capabilityOverridesValue(ctx: FieldCtx): string {
  return ctx.values[MODEL_CAPABILITY_OVERRIDES_KEY]
    ?? modelValue(ctx.status, MODEL_CAPABILITY_OVERRIDES_KEY);
}

function apiModelId(page: SettingsVendorPage, ctx: FieldCtx): string {
  const names = llmProviderConfigNames(page.vendor);
  const field = page.fields.find((candidate) => candidate.name === names.model);
  return (ctx.values[names.model] ?? modelValue(ctx.status, names.model)) || field?.defaultLabel || '';
}

// ──Provider configuration page ────────────────────────────────────────────────────────

export function VendorPane({ page, hint, ctx }: {
  page: SettingsVendorPage; hint: string; ctx: FieldCtx;
}) {
  const t = useT();
  if (page.connection === 'codex') return <CodexVendorPane page={page} hint={hint} ctx={ctx} />;
  if (page.connection === 'copilot') return (
    <CopilotVendorPane page={page} hint={hint} ctx={ctx} rawOverrides={capabilityOverridesValue(ctx)}
      onOverridesChange={(value) => ctx.onStage(CAPABILITY_OVERRIDE_FIELD, value)}>
      {page.fields.map((field) => <FieldRow key={field.name} field={field} ctx={ctx} />)}
    </CopilotVendorPane>
  );
  if (page.connection === 'claude-code') return (
    <ClaudeCodeVendorPane page={page} hint={hint} ctx={ctx} rawOverrides={capabilityOverridesValue(ctx)}
      onOverridesChange={(value) => ctx.onStage(CAPABILITY_OVERRIDE_FIELD, value)}>
      {page.fields.map((field) => <FieldRow key={field.name} field={field} ctx={ctx} />)}
    </ClaudeCodeVendorPane>
  );
  if (page.connection === 'xai-oauth') return <XaiOauthVendorPane page={page} hint={hint} ctx={ctx} />;
  if (page.key === 'llm/vision') return <VisionModelPane />;
  if (page.kind === 'local-models') return <LocalModelsPane page={page} fields={page.fields} ctx={ctx} />;
  const on = vendorConfigured(ctx.status, page, ctx.codex.status, ctx.copilot.status, ctx.claudeCode.status);
  return (
    <div style={pane}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VendorIcon vendor={page.vendor} size={18} />
          <b style={{ fontSize: 13 }}>{t(page.title)}</b>
          <span style={{ fontSize: 11, color: on ? ON : theme.textDim }}>{on ? t('已配置') : t('未配置')}</span>
        </div>
        <div style={{ fontSize: 11.5, color: theme.textDim, marginTop: 3, paddingLeft: 26 }}>{t(hint)}</div>
      </div>
      <section style={fieldCardBox}>
        {page.note && <div style={pageNote}>{t(page.note)}</div>}
        {page.noteAction && <SettingsNoteAction config={page.noteAction} onOpenPage={ctx.openPage} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: page.note ? 9 : 0 }}>
          {page.fields.map((f) => <FieldRow key={f.name} field={f} ctx={ctx} />)}
        </div>
        <FalModelNote page={page} status={ctx.status} values={ctx.values} />
        {page.key.startsWith('llm/') && (
          <ModelCapabilityEditor backend="api" provider={normalizeLlmProvider(page.vendor)}
            modelId={apiModelId(page, ctx)} rawOverrides={capabilityOverridesValue(ctx)}
            onChange={(value) => ctx.onStage(CAPABILITY_OVERRIDE_FIELD, value)} />
        )}
      </section>
      {page.vendor !== 'fal' && <TestConnectionRow page={page} ctx={ctx} />}
    </div>
  );
}

function CodexVendorPane({ page, hint, ctx }: {
  page: SettingsVendorPage; hint: string; ctx: FieldCtx;
}) {
  const t = useT();
  const status = ctx.codex.status;
  const statusLabel = !status ? t('状态未知')
    : !status.installed ? t('CLI 未安装')
      : status.loginPending || ctx.codex.login ? t('登录中')
        : status.account?.type === 'chatgpt' ? t('已登录')
          : status.account ? t('API Key 模式')
            : status.error || ctx.codex.error ? t('连接异常') : t('未登录');
  const on = vendorConfigured(ctx.status, page, status);
  const capabilityModelId = (ctx.values.CODEX_MODEL ?? modelValue(ctx.status, 'CODEX_MODEL'))
    || ctx.codex.models.find((model) => model.isDefault)?.id
    || '';
  return (
    <div style={pane}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VendorIcon vendor={page.vendor} size={18} />
          <b style={{ fontSize: 13 }}>{t(page.title)}</b>
          <span style={{ fontSize: 11, color: on ? ON : theme.textDim }}>{statusLabel}</span>
        </div>
        <div style={{ fontSize: 11.5, color: theme.textDim, marginTop: 3, paddingLeft: 26 }}>{t(hint)}</div>
      </div>
      <CodexAccountCard controller={ctx.codex} />
      <section style={fieldCardBox}>
        {page.note && <div style={pageNote}>{t(page.note)}</div>}
        {page.noteAction && <SettingsNoteAction config={page.noteAction} onOpenPage={ctx.openPage} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: page.note ? 9 : 0 }}>
          {page.fields.map((field) => <FieldRow key={field.name} field={field} ctx={ctx} />)}
        </div>
        {capabilityModelId && (
          <ModelCapabilityEditor backend="codex" provider="openai"
            modelId={capabilityModelId}
            rawOverrides={capabilityOverridesValue(ctx)}
            onChange={(value) => ctx.onStage(CAPABILITY_OVERRIDE_FIELD, value)} />
        )}
      </section>
    </div>
  );
}

function LocalModelsPane({ page, fields, ctx }: {
  page: SettingsVendorPage; fields: readonly SettingsField[]; ctx: FieldCtx;
}) {
  const t = useT();
  const title = page.key === 'local/asr' ? '本地转写' : page.key === 'local/music/packs' ? '节拍与音乐分析' : '画面语义搜索';
  return (
    <div style={pane}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {page.icon ? <Icon name={page.icon} size={18} /> : <VendorIcon vendor={page.vendor} size={18} />}
          <b style={{ fontSize: 13 }}>{t(title)}</b>
        </div>
        <div style={{ fontSize: 11.5, color: theme.textDim, marginTop: 3, paddingLeft: 26 }}>
          {t('本地模型按需安装，索引、转写和分析都在本机完成。')}
        </div>
      </div>
      {page.key === 'local/asr' && <LocalAsrPane fields={fields} ctx={ctx} />}
      {page.key === 'local/music/packs' && <LocalModelPackPane
        packIds={['rhythm-lite', 'music-semantics-lite']}
        title="节拍与音乐分析模型"
        description="模型不会自动安装。安装后，节拍与音乐语义分析只在本机运行。" />}
      {page.key === 'local/semantic/setup' && <SemanticModelPackPane />}
    </div>
  );
}
