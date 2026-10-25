import { Suspense, useEffect } from 'react';
import type { ProjectMeta } from '../../persist/projectStoreCoordinators';
import { theme } from '../../theme';
import { useT } from '../../i18n/locale';
import { CorteoWordmark } from '../../brand/CorteoMarks';
import { DashboardHeaderLinks } from '../DashboardHeaderLinks';
import { Icon } from '../icons';
import { bindAction } from '../../shortcuts/actionRegistry';
// Opened on demand, so they load on demand — see dashboardDialogs.tsx.
import {
  McpGuideDialog, MediaCleanupDialog, SettingsDialog, ShortcutsDialog,
} from './dashboardDialogs';
import { useDashboardDialogPrefetch } from './dashboardDialogLoaders';
import { SkinPicker } from '../settings/SkinPicker';
import { LocaleToggle } from '../TopBar';
import {
  miniBtn, nameInput, searchBox, searchClear, searchEmpty, searchIcon, searchInput, settingsBtn,
} from './dashboardStyles';
import { relativeProjectTime, type DashboardModel, type DashboardProps } from './useDashboardModel';

// Layout lives in the .cc-projects-* rules in src/index.css (BD-4): frameless cards,
// a hairline that closes the title row, and one clay button on the page.

/** One quiet line when no model is configured. No icon and no clay: this is a note,
 * not a call to action competing with "Nuevo proyecto". */
function ModelNotice({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  return (
    <section role="status" className="cc-projects-model-note">
      <span>{t('配置模型后即可使用助手。')}</span>
      <button type="button" onClick={onOpen} className="cc-projects-btn">{t('配置模型')}</button>
    </section>
  );
}

function ProjectSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <label style={searchBox}>
      <span style={searchIcon}><Icon name="search" size={13} /></span>
      <input
        type="search"
        aria-label={t('搜索工程')}
        placeholder={t('搜索工程')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape') onChange(''); }}
        autoComplete="off"
        spellCheck={false}
        style={searchInput}
      />
      {value && <button type="button" onClick={() => onChange('')} aria-label={t('清除搜索')} style={searchClear}><Icon name="x" size={12} /></button>}
    </label>
  );
}

export function DashboardTitlebarContent({ model }: { model: DashboardModel }) {
  const t = useT();
  return (
    <>
      <CorteoWordmark size={13} />
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <DashboardHeaderLinks />
        <button onClick={() => model.setDialog('mcp', true)} data-tip={t('外部 Agent 接入 (MCP)')} aria-label={t('外部 Agent 接入 (MCP)')} className="cc-header-btn cc-tip cc-tip-r" style={settingsBtn}><Icon name="plug" size={16} /></button>
        <button onClick={() => model.setDialog('shortcuts', true)} data-tip={t('编辑快捷键')} aria-label={t('编辑快捷键')} className="cc-header-btn cc-tip cc-tip-r" style={settingsBtn}><Icon name="keyboard" size={16} /></button>
        <LocaleToggle />
        <SkinPicker />
        <button onClick={() => model.setDialog('settings', true)} data-tip={t('设置 · API 密钥')} aria-label={t('设置 · API 密钥')} className="cc-header-btn cc-tip cc-tip-r" style={settingsBtn}><Icon name="sliders" size={16} /></button>
      </span>
    </>
  );
}

function ProjectToolbar({ projects, model, onNew }: { projects: ProjectMeta[]; model: DashboardModel; onNew: () => void }) {
  const t = useT();
  return (
    <header className="cc-projects-head">
      <div className="cc-projects-title-row">
        <div className="cc-projects-heading">
          <h1 className="cc-projects-title">{t('工程')}</h1>
          <span className="cc-projects-count">
            {model.normalizedQuery
              ? t('{n} / {total} 个', { n: model.visibleProjects.length, total: projects.length })
              : t('{n} 个', { n: projects.length })}
          </span>
        </div>
        <div className="cc-projects-actions">
          <ProjectSearch value={model.query} onChange={model.setQuery} />
          <button onClick={() => model.transfer.fileRef.current?.click()} disabled={model.transfer.busy} className="cc-projects-btn" title={t('导入 .ccproj 工程文件(兼容旧 .ccproj.json)')}>{t('导入工程')}</button>
          <button onClick={onNew} className="cc-projects-btn cc-projects-btn--primary" title={t('新建工程')}>{t('新建工程')}</button>
          <button onClick={() => model.setDialog('cleanup', true)} className="cc-projects-btn cc-projects-btn--icon" aria-label={t('清理素材')} title={t('清理所有工程都不引用的上传素材(测试/已删工程残留)')}><Icon name="trash" size={14} /></button>
          <input ref={model.transfer.fileRef} type="file" accept=".ccproj,.json,application/json,application/x-openchatcut-project" onChange={model.transfer.pickImport} style={{ display: 'none' }} />
        </div>
      </div>
      {model.transfer.note && <p className="cc-projects-note">{model.transfer.note}</p>}
    </header>
  );
}

function ProjectName({ project, model }: { project: ProjectMeta; model: DashboardModel }) {
  const t = useT();
  if (model.rename.editingId === project.id) {
    return <input
      autoFocus
      value={model.rename.draft}
      onChange={(event) => model.rename.setDraft(event.target.value)}
      onBlur={model.rename.commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') model.rename.commit();
        if (event.key === 'Escape') model.rename.cancel();
      }}
      style={nameInput}
    />;
  }
  return <div onDoubleClick={() => model.rename.start(project)} title={t('双击重命名')} className="cc-projects-name">{project.name}</div>;
}

function ProjectActions({ project, props, model }: { project: ProjectMeta; props: DashboardProps; model: DashboardModel }) {
  const t = useT();
  if (model.rename.confirmId === project.id) {
    return <button
      onClick={() => {
        void model.transfer.run(props.onDelete(project.id).then(() => t('已永久删除「{name}」', { name: project.name })));
        model.rename.setConfirmId(null);
      }}
      disabled={model.transfer.busy}
      style={{ ...miniBtn, color: theme.danger }}
      title={t('彻底删除工程,并清掉只有它引用的素材文件')}
    >{t('确认删除')}</button>;
  }
  return (
    <>
      <button onClick={() => model.rename.start(project)} style={miniBtn} title={t('重命名')}><Icon name="pencil" size={13} /></button>
      <button onClick={() => props.onDuplicate(project.id)} style={miniBtn} title={t('复制')}><Icon name="copy" size={13} /></button>
      <button onClick={() => void model.transfer.run(props.onExport(project.id, project.name))} disabled={model.transfer.busy} style={miniBtn} title={t('导出为流式 .ccproj(含素材,可在桌面版/其它机器导入)')}><Icon name="download" size={13} /></button>
      <button onClick={() => model.rename.setConfirmId(project.id)} style={miniBtn} title={t('删除')}><Icon name="trash" size={13} /></button>
    </>
  );
}

function ProjectCard({ project, props, model }: { project: ProjectMeta; props: DashboardProps; model: DashboardModel }) {
  const t = useT();
  const thumb = model.thumbs[project.id];
  return (
    <article className="cc-projects-card">
      <button onClick={() => props.onOpen(project.id)} className="cc-projects-thumb" title={t('打开 {name}', { name: project.name })}>
        {thumb
          ? <img src={thumb} alt="" draggable={false} loading="lazy" decoding="async" />
          // No thumbnail: the name becomes a title card, like a music video's
          // opening frame, instead of a play icon floating in an empty box.
          : <span className="cc-projects-titlecard">{project.name}</span>}
      </button>
      <div className="cc-projects-meta">
        <ProjectName project={project} model={model} />
        <div className="cc-projects-sub">
          <span className="cc-projects-time">{relativeProjectTime(project.updatedAt, t)}</span>
          <div className="cc-projects-acts"><ProjectActions project={project} props={props} model={model} /></div>
        </div>
      </div>
    </article>
  );
}

function ProjectGrid({ props, model }: { props: DashboardProps; model: DashboardModel }) {
  const t = useT();
  const empty = props.projects.length === 0;
  return (
    <>
      {empty ? (
        <div className="cc-projects-empty">
          <h2>{t('还没有工程')}</h2>
          <p>{t('新建一个工程，或导入一个 .ccproj 文件。')}</p>
          <div className="cc-projects-empty-actions">
            {/* Outlined, not clay: the toolbar above already carries the page's one
                primary button, and a second one would compete with it. */}
            <button onClick={props.onNew} className="cc-projects-btn">{t('新建工程')}</button>
            <button onClick={() => model.transfer.fileRef.current?.click()} disabled={model.transfer.busy} className="cc-projects-btn">{t('导入工程')}</button>
          </div>
        </div>
      ) : (
        <div className="cc-projects-grid">
          {model.visibleProjects.map((project) => <ProjectCard key={project.id} project={project} props={props} model={model} />)}
        </div>
      )}
      {model.normalizedQuery && model.visibleProjects.length === 0 && (
        <div role="status" style={searchEmpty}><Icon name="search" size={14} />{t('没有找到匹配“{query}”的工程', { query: model.query.trim() })}</div>
      )}
    </>
  );
}

export function DashboardContent({ props, model }: { props: DashboardProps; model: DashboardModel }) {
  return (
    <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div className="cc-projects-content">
        <ProjectToolbar projects={props.projects} model={model} onNew={props.onNew} />
        {model.modelSnapshot.loaded && model.modelSnapshot.choices.length === 0 && <ModelNotice onOpen={() => model.setDialog('settings', true)} />}
        <ProjectGrid props={props} model={model} />
      </div>
    </main>
  );
}

export function DashboardDialogs({ model }: { model: DashboardModel }) {
  // The settings dialog's Anthropic pane summons the MCP guide through the
  // action registry; in the editor the top bar answers, here the dashboard's
  // own dialog state does. Without this the button silently does nothing on
  // the projects page, which is exactly where a new user starts.
  useEffect(() => bindAction('open-mcp-guide', () => model.setDialog('mcp', true)), [model]);
  useDashboardDialogPrefetch();
  return (
    // No fallback: a dialog that is still loading shows nothing, exactly as it
    // did before it was opened. The idle prefetch keeps that window tiny.
    <Suspense fallback={null}>
      {model.dialogs.settings && <SettingsDialog onClose={() => model.setDialog('settings', false)} />}
      {model.dialogs.shortcuts && <ShortcutsDialog onClose={() => model.setDialog('shortcuts', false)} />}
      {model.dialogs.mcp && <McpGuideDialog onClose={() => model.setDialog('mcp', false)} />}
      {model.dialogs.cleanup && <MediaCleanupDialog onClose={() => model.setDialog('cleanup', false)} />}
    </Suspense>
  );
}
