// BD-4 gate: the projects page against the brief.
// `npx tsx --tsconfig tsconfig.app.json src/components/dashboard/DashboardViews.verify.tsx`
//
// Server-rendered, so no browser: the wordmark, the title card, the empty state,
// the single clay button, and a Spanish entry for every t() literal in the file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProjectMeta } from '../../persist/projectStoreCoordinators';
import es from '../../i18n/dict/es';
import esBrand from '../../i18n/dict/es/brand';
import { DashboardContent, DashboardTitlebarContent } from './DashboardViews';
import type { DashboardModel, DashboardProps } from './useDashboardModel';

const project = (id: string, name: string): ProjectMeta => ({ id, name, updatedAt: Date.now() - 7_200_000 });

const props = (projects: ProjectMeta[]): DashboardProps => ({
  projects,
  onOpen: () => undefined,
  onNew: () => undefined,
  onRename: () => undefined,
  onDuplicate: () => undefined,
  onDelete: () => Promise.resolve(),
  onExport: () => Promise.resolve(''),
  onImport: () => Promise.resolve(''),
});

function model(visibleProjects: ProjectMeta[], hasModel = true): DashboardModel {
  return {
    modelSnapshot: { loaded: true, choices: hasModel ? ['gpt-x'] : [] } as unknown as DashboardModel['modelSnapshot'],
    query: '',
    normalizedQuery: '',
    visibleProjects,
    setQuery: () => undefined,
    dialogs: { settings: false, shortcuts: false, mcp: false, cleanup: false },
    setDialog: () => undefined,
    rename: {
      editingId: null, draft: '', confirmId: null,
      setDraft: () => undefined, setConfirmId: () => undefined,
      start: () => undefined, commit: () => undefined, cancel: () => undefined,
    },
    transfer: {
      note: null, busy: false, fileRef: { current: null },
      run: () => Promise.resolve(), pickImport: () => undefined,
    },
    thumbs: {},
  };
}

const page = (projects: ProjectMeta[], hasModel = true): string => renderToStaticMarkup(
  <div>
    <DashboardTitlebarContent model={model(projects, hasModel)} />
    <DashboardContent props={props(projects)} model={model(projects, hasModel)} />
  </div>,
);

// ── The wordmark, and the old identity gone ──
const withProjects = page([project('a', 'Corazón roto')]);
assert.match(withProjects, /class="cc-wordmark"/, '顶栏要有 Claudia 字标');
assert.match(withProjects, /Claudia/, '字标是 "Claudia" 文字');
assert.doesNotMatch(withProjects, /OpenChatCut/, '页面不能再出现上游名');
assert.doesNotMatch(withProjects, /＋/, '不再有虚线「＋」新建卡');
assert.doesNotMatch(withProjects, /→|›/, '行与按钮不加箭头');
assert.doesNotMatch(withProjects, /· Mis proyectos|· 我的工程/, '标题旁不再有「· 我的工程」');

// ── A project without a thumbnail gets a title card, not a play icon ──
assert.match(withProjects, /cc-projects-titlecard[^>]*>Corazón roto</, '没有缩略图的工程用标题卡显示名字');
assert.match(withProjects, /cc-projects-title/, '标题行用 display 字');

// ── Exactly one clay button per screen ──
const primaryButtons = withProjects.match(/cc-projects-btn--primary/g) ?? [];
assert.equal(primaryButtons.length, 1, `一屏只能有一个主按钮，实际 ${primaryButtons.length} 个`);

// ── The empty library ──
// Server rendering has no locale dictionary loaded, so t() returns its key; the
// Spanish copy itself is checked by the dictionary scan at the bottom.
const empty = page([]);
assert.match(empty, /还没有工程/, '空库显示空状态');
assert.match(empty, /新建一个工程，或导入一个 \.ccproj 文件。/, '空状态给出下一步');
assert.equal((empty.match(/cc-projects-btn--primary/g) ?? []).length, 1, '空状态里也只有一个主按钮');
assert.doesNotMatch(empty, /cc-projects-grid/, '空库不渲染网格');

// ── The model notice is one quiet line, and it only shows without a model ──
const noModel = page([project('a', 'Uno')], false);
assert.match(noModel, /配置模型后即可使用助手。/, '没有模型时给一行提示');
assert.doesNotMatch(noModel, /sparkles/, '提示行不带图标');
assert.doesNotMatch(withProjects, /配置模型后即可使用助手。/, '有模型时不显示提示');

// ── Every t() literal in the file has Spanish copy ──
const source = readFileSync(new URL('./DashboardViews.tsx', import.meta.url), 'utf8');
const spanish: Record<string, string> = { ...es, ...esBrand };
const literals = [...source.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]);
assert.ok(literals.length > 0, '文件里应当有 t() 调用');
const missing = [...new Set(literals)].filter((key) => !(key in spanish));
assert.deepEqual(missing, [], `这些 t() 字面量没有西语条目：${missing.join(' / ')}`);

console.log(`DashboardViews.verify: ok（${new Set(literals).size} 条 t() 字面量都有西语）`);
