# Plan 4: the Claudia name and look

The editor becomes **Claudia** on every screen: the wordmark, the tab title, the chat header and onboarding, and the projects page. It gets one visual identity taken from claudia.gallery.

Two parallel tracks, plus a merge:

- **DeepSeek (BD-1 to BD-4):** fonts, skin, marks, projects page.
- **Qoder (BQ-1 to BQ-4):** the old name out of the text, the fork's links and the assistant's identity, the chat panel, the last cleanups.
- **B-9 (Cursor):** merges both.

> **Status, 2026-10-24.** The Qoder and DeepSeek agents were unavailable, so the WorkBuddy agent executed all eight cards in `~/corteo-workbuddy` and pushed them on its harness branch, `harness-workbuddy`. B-9 merged them the same day. The record is in `docs/plans/PROGRESS.md` › B-9, "Brand track · DeepSeek (BD)" and "Brand track · Qoder (BQ)". This file stays the brief for any later work on the name and the look: the cards as they were written, the wireframes, the Chinese key for every string the tracks added, and the two kickoff prompts.

## Defaults

- **Name.** "Claudia" appears in the UI and the tab title, the built-in assistant's self-introduction, the MCP instructions the models read, exported file names, and the README prose. The repository, the `~/corteo*` folders, the `corteo` alias and every internal identifier keep their names — see Names.
- **Look.** The new default skin "Claudia" uses claudia.gallery's brand: near-black surfaces and clay `#d97757`, an uppercase tracked wordmark with a clay streak, condensed black display type, and the eight-pointed star. The six existing skins stay in the picker.
- **Type.** Geist stays the UI font. Two brand faces are added, each used in exactly one place.
- **Fork identity.** The header's source link points to `uset82/corteo`. The upstream author's contact email goes away, and so does the web app's automatic upstream-release check. The OpenChatCut credits and the AGPL notices stay.
- **Scope.** The projects page, the chat panel, the top bar, the tab and the UI text. The timeline, inspector, media and export panels only pick up the new skin.

## Design brief

### Method

Ground it in the subject (a music-video studio for an AI pop star, used by a musician: the footage and the titles carry the colour, the chrome recedes). Decide before coding. One bold move. Follow the brand where it decides. Review before calling it done.

### Tokens

The skin `claudia` is first in `SKINS` (`src/skins.ts`), is `DEFAULT_SKIN`, and has `nameZh: 'Claudia'`.

- **Surfaces:** bg `#0a0b0d`, inset `#0e0f11`, panel `#111317`, panelAlt `#181b20`, hover `#20242a`, border `#2a2e35`, borderLight `#3b4048`, tlTrack `#1a1d23`, tlSidePanel `#15181d`.
- **Text:** text `#ece9e2`, textMuted `#a9adb3`, textDim `#7a7f86`, textStrong `#fffaf0`.
- **Accent:** accent `#d97757`, accentDeep `#c2603f`, accentRgb `217,119,87`, onAccent `#0a0b0d`. White on clay is only 3.12:1, so text on clay is dark (6.31:1).
- **Rest:** inkRgb `236,233,226`, shadowRgb `0,0,0`, colorScheme `dark`. Gold, select, success, danger and the track and clip colours are inherited from Graphite, because they carry meaning: warning, selection, status, track type.
- **Contrast (gated in `src/skins.verify.ts`):** text/panel 15.34, text/panelAlt 14.24, textMuted/panel 8.25, textDim/panel 4.61 (the gallery's own `#6f747b` fails at 3.95), onAccent/accent 6.31, textStrong/hover 14.98, gold badge 13.05.

### Type

- UI and mono: unchanged.
- **Wordmark only:** TeX Gyre Heros Bold, a Helvetica look-alike under the GUST Font License. `--cc-font-brand: 'Heros', 'Helvetica Neue', Arial, sans-serif`.
- **Display only** (the projects page title and the title cards): DINish Condensed Black, OFL-1.1. `--cc-font-display: 'DINish Condensed', 'Arial Narrow', sans-serif`.
- Both are self-hosted in `public/fonts/claudia/`, because the gallery relies on the system's Helvetica and DIN Condensed and Windows has neither.

### Marks

- **`ClaudiaWordmark({ size = 14 })`** — real text "Claudia", uppercased by CSS so a screen reader reads a word; Heros 700 with 0.2em tracking; led by a 3px × 1.15em clay streak with a 0.78em gap; a -0.2em right margin cancels the trailing tracking; tokens only.
- **`ClaudiaMark({ size = 16 })`** — the eight-pointed star in a 24×24 viewBox, `fill="currentColor"`, coloured with `var(--cc-accent)`. Points: `12,1 13.76,7.75 19.78,4.22 16.25,10.24 23,12 16.25,13.76 19.78,19.78 13.76,16.25 12,23 10.24,16.25 4.22,19.78 7.75,13.76 1,12 7.75,10.24 4.22,4.22 10.24,7.75`. Used only in the favicon and the collapsed chat rail.
- **Favicon `public/claudia-mark.svg`** — a 32×32 rounded square (rx 7) in `#0a0b0d` with the star at `translate(4 4)` in `#d97757`.

### Copy

Spanish, sentence case, the "tú" form, plain verbs: "Nuevo proyecto", "Importar proyecto", "Configurar modelo". The musician's words: montar, cortar, letra, golpes, plano. No exclamation marks, no marketing voice, no emojis.

### AI tells — the review list

1. No gradients, glows, glass or blur panels, coloured shadows, or hover lifts and scaling.
2. Clay appears only on the wordmark streak, the star, one primary button per screen, focus rings and selection.
3. Capitals only in the wordmark and the display type. No kicker or eyebrow labels.
4. No arrows on rows or buttons, no sparkles icon, no icon tiles in front of text rows.
5. No card kit (icon, title and description boxes in a grid) and no dashed "+" tiles.
6. No middle-dot meta strings such as "· Mis proyectos", and no mono type for labels that aren't code.
7. Motion: no entrance animations; hover and focus change only colour, border or opacity, ≤160 ms; reduced motion turns them off.
8. No English on the Spanish screens this plan touches.
9. The global focus ring stays on everything; click targets ≥28 px in the editor and ≥30 px on the projects page; the projects page works at 390 px.

### Screens

**Projects page (BD-4).** Wordmark-only header; then `PROYECTOS` + count, search, "Importar proyecto" (outlined), "Nuevo proyecto" (the only clay button), media cleanup as an icon-only ghost button with aria-label "Limpiar medios"; a 0.5px rule closes the row; the import/export status note sits under it. The model notice is one quiet line with an outlined "Configurar modelo". Cards are frameless: a 16:9 thumbnail (inset background, 0.5px border, radius 3, borderLight on hover), then the name at 13 px/550 and the time at 11 px textDim; actions appear on hover and focus-within, and always under `@media (hover: none)`. A project without a thumbnail gets a title card — its name in the display font, uppercase, 22 px, textMuted, bottom-left, at most 3 lines. Content padding 40px 32px 80px; grid `minmax(232px, 1fr)` with 28px 20px gaps; at 720 px and below, 24px 16px and `minmax(160px, 1fr)`. An empty library shows "Todavía no hay proyectos" and "Crea un proyecto nuevo o importa un archivo .ccproj." with both buttons, outlined, because the toolbar already carries the page's one primary button.

**Chat panel (BQ-3).** Header: `ClaudiaWordmark size={13}` with "Asistente de edición" below it. Collapsed rail: `ClaudiaMark` at 14 px over a vertical CLAUDIA in the brand font (10 px, 0.2em tracking, textDim). Onboarding: no kicker; the h2 reads "¿Qué quieres montar?", followed by "Describe el vídeo que quieres o empieza por una de estas ideas.". Four starters, text-only rows with no icon tile and no arrow: Montar al ritmo (Cambia de plano en los golpes de la canción), Letra en pantalla (Subtítulos de la letra sincronizados con la voz), Teaser vertical (15 segundos en 9:16 con el mejor momento), Títulos y créditos (Título de apertura y créditos finales). Four quick actions: Cortar en los golpes, Añadir la letra, Pasar a vertical, Recortar inicio y final. Composer placeholders: "Describe lo que quieres crear…" and "Dime qué cambiar. Usa @ para citar un medio.". Quick-action menu label: "Acciones rápidas…". Starter rows at least 44 px high, label 12.5px/600, description 11 px in textDim, hover ink at 3.5% with the label turning textStrong.

### Wireframes

Projects page (BD-4) at 1440 px wide. At 390 px the toolbar wraps under the title and the cards go two across. `T` is the icon-only media cleanup button.

```text
+------------------------------------------------------------------------------+
| |CLAUDIA                                  source  mcp  keys  ES  skin  gear  |
+------------------------------------------------------------------------------+
|  PROYECTOS 12     [Buscar proyectos] [Importar proyecto] [Nuevo proyecto] [T] |
|  --------------------------------------------------------------------------  |
|  Configura un modelo para usar el asistente.            [Configurar modelo]  |
|                                                                              |
|  +--------------+  +--------------+  +--------------+  +--------------+      |
|  |  thumbnail   |  |              |  |  thumbnail   |  |              |      |
|  |              |  | VERANO EN    |  |              |  | LUNA         |      |
|  |              |  | LA PLAYA     |  |              |  | LLENA        |      |
|  +--------------+  +--------------+  +--------------+  +--------------+      |
|  Corazón roto      Verano en la playa  Demo 3            Luna llena          |
|  hace 2 h          hace 3 d            hace 1 sem        hace 2 sem          |
+------------------------------------------------------------------------------+
```

Chat panel (BQ-3), open and collapsed:

```text
+-----------------------------------+    +--+
| |CLAUDIA            runs trash  < |    |> |
|  Asistente de edición             |    |* |  star, clay
+-----------------------------------+    |C |
|  ¿Qué quieres montar?             |    |L |  CLAUDIA set
|  Describe el vídeo que quieres o  |    |A |  vertically,
|  empieza por una de estas ideas.  |    |U |  dim
|  -------------------------------  |    |D |
|  Montar al ritmo                  |    |I |
|  Cambia de plano en los golpes…   |    |A |
|  -------------------------------  |    +--+
|  Letra en pantalla                |
|  Teaser vertical                  |
|  Títulos y créditos               |
+-----------------------------------+
| Describe lo que quieres crear…    |
+-----------------------------------+
```

## Names: what changes and what stays

- **Claudia:** everything a person reads in the app; the assistant's self-introduction and the MCP instructions; exported names (the FCPXML title and events, CapCut drafts); the README prose.
- **corteo:** the repository, the folders and the `corteo` alias.
- **OpenChatCut stays** where it is a credit or an identifier other things depend on: the README credits, `LICENSE`, the `package.json` author; the `openchatcut_*` MCP tools, the `openchatcut` server key and `occ`; the `OPENCHATCUT_*` variables, `~/.openchatcut`, `.ccproj` and its MIME type; the `X-OpenChatCut-*` headers and the `com.openchatcut.*` FCPXML keys; `window.openChatCutDesktop`, the npm package name, `skills/openchatcut/` and the tool catalog file; the desktop app and `public/openchatcut-icon.png`; and the five desktop-updater messages, which name upstream's release.

## Parallel work

- **DeepSeek owns:** `public/fonts/claudia/`, `public/claudia-mark.svg`, `index.html`; `src/brand/` (except `brand-text.verify.ts`); `src/skins.ts` and its verify; `src/components/Dashboard.tsx` and `src/components/dashboard/`; `src/i18n/dict/{en,es}/brand.ts`, the brand line in `en/index.ts` and `dictRegistry.ts`; in `src/index.css`, the font block at the top and new rules after `.cc-header-btn:hover`; its own BD section of PROGRESS.
- **Qoder owns:** every other dictionary file; `src/components/chat/` and the `.cc-chat-*` rules (edited in place); `src/components/icons.tsx`, `TopBar.tsx` and `DashboardHeaderLinks.tsx`; `src/ui/`, `src/agent/`, `server/external-agent/` and `src/export/`; `src/app/EditorGuards.tsx`, `src/plugins/resourcePreview.ts`, `src/persist/projectStore.ts`; the generated tool catalog and `src/brand/brand-text.verify.ts`; its own BQ section of PROGRESS.
- **Both:** add entries to `test:serial` in `package.json` and to `CHROME_FILES` in `src/theme-tokenization.verify.ts`. Neither appends at the end of `src/index.css`.
- **Spanish text:** DeepSeek puts new and corrected Spanish in `es/brand.ts`, which `dictRegistry.ts` spreads over `es/index.ts`. Qoder uses `es/index.ts`. P5-1 later folds `es/brand.ts` into the per-module files.

**Merging** only goes one way: DeepSeek never merges; Qoder merges `github/brand-deepseek` once, before BQ-3, and only after BD-3 is done; B-9 merges both branches into `cursor/video-editor-mvp-d191`.

**Expected conflicts:** the `test:serial` line, `CHROME_FILES`, `src/index.css`, the import list in `en/index.ts`, and the PROGRESS sections. Keep both sides every time.

## DeepSeek track (BD)

None of these tasks adds an MCP tool; this is an exception to rule 3 in `AGENTS.md`.

### BD-1 · Brand fonts
Download with `curl -fL` into `public/fonts/claudia/`, and stop with a blocker if a size differs: `DINishCondensed-Black.woff2` from `playbeing/dinish@v4.007` (28,772 bytes), its `OFL.txt` as `OFL-DINish.txt` (4,384), `texgyreheros-bold.otf` from CTAN (135,204), and `GUST-FONT-LICENSE.txt` (1,456). Add two `@font-face` rules after the Geist block (Heros 700 `opentype`, DINish Condensed 900 `woff2`, both `font-display: swap`) and a `:root` block with the two font variables. New `src/brand/brand-assets.verify.ts` in `test:serial`: the four files exist, the woff2 starts with `wOF2` and the OTF with `OTTO`, and `index.css` declares both faces.

### BD-2 · The Claudia skin
Add `claudia` to `SKINS` and make it `DEFAULT_SKIN`. One-time migration in `initSkins()`, before `applySkin(getSkin())`: if `cc.skin.claudia` is unset, set it, and if the saved skin is `'graphite'`, save `'claudia'` instead; any other saved skin is kept. Extend `src/skins.verify.ts`: claudia is first and is the default, its tokens equal the brief, and with `localStorage` stubbed graphite migrates once, a graphite picked again afterwards stays, and mocha stays.

### BD-3 · Marks, favicon and tab
`src/brand/ClaudiaMarks.tsx` (both marks) plus `.cc-wordmark` and `.cc-wordmark-streak`; `public/claudia-mark.svg`; `index.html` with `lang="es"`, `<title>Claudia</title>`, the SVG icon, `theme-color` `#0a0b0d` and preloads for both fonts (`as="font"`, `crossorigin`). New `src/brand/ClaudiaMarks.verify.tsx` (`renderToStaticMarkup`, `--tsconfig tsconfig.app.json`): the wordmark's text is "Claudia", neither mark uses raw colours, and `index.html` has the title and the icon and no longer references `openchatcut-icon.png`. Add `ClaudiaMarks.tsx` to `CHROME_FILES`. Push as soon as it is done: BQ-3 waits for it.

### BD-4 · The projects page
`DashboardViews.tsx`, `dashboardStyles.ts`, `Dashboard.tsx`, new `.cc-projects-*` rules, both `brand.ts` dictionaries, `en/index.ts` and `dictRegistry.ts`, as described under Screens. New keys go in `en/brand.ts` (added last to the `Object.assign` call) and `es/brand.ts`. New `DashboardViews.verify.tsx`, server-rendered: the wordmark is present; "OpenChatCut", the arrow, sparkles and the "＋" tile are absent; a project without a thumbnail gets a title card; an empty library shows the empty state; there is exactly one primary button; and every `t()` literal in the file has a Spanish entry. Add `DashboardViews.tsx` and `dashboardStyles.ts` to `CHROME_FILES`. Screenshots to `test-results/brand/` (not committed) at 1440x900 and 390x844.

## Qoder track (BQ)

Same rules: no MCP tools, push after every task.

### BQ-1 · The old name out of the text
Every key and value containing "OpenChatCut" in `src/i18n/dict/{en,es,it,ru}/` switches to "Claudia", and so do the `t()`/`translate()` calls that use those keys (the Settings provider panes, the MCP guide, the library notice, `ExportDialogTabs.tsx`, `EditorGuards.tsx`). Chinese keys keep "Claudia" in Latin letters. The chat's expand and collapse labels become 展开助手 and 收起助手. **Kept:** the five desktop-updater keys in `en/components.ts` lines 30-36 and their Italian and Russian twins. Exported names: FCPXML "Claudia Timeline", "Claudia Export" and "Claudia Export (Resolve)"; CapCut `Claudia-<date>`. Other visible strings: two errors in `src/plugins/resourcePreview.ts`, `src/agent/external-bridge-session.ts:115`, `src/agent/external-bridge-runtime.ts:223`. New `src/brand/brand-text.verify.ts` in `test:serial`.

### BQ-2 · The fork's links and the assistant's identity
`DashboardHeaderLinks.tsx`: the contact popover and the author email go; the repository link points to `https://github.com/uset82/corteo`, labelled "Código fuente (AGPL)" (key 源代码 (AGPL)) — this link is the AGPL source offer. `src/ui/upstreamUpdate.ts`: `startAutomaticUpstreamUpdateCheck()` returns early unless `hasDesktopUpdateSupport()`; the manual check in Settings stays; a new `src/ui/upstreamUpdateWeb.verify.ts` proves no fetch happens without the desktop bridge. `src/agent/systemPrompt.ts`: "The official product name is Claudia…", "You are Claudia's professional writer-director and video-editing AI.", plus one line saying Claudia is also the AI pop star from claudia.gallery who drives the editor over MCP and that the built-in assistant is the editor's assistant, not her. Also: `src/agent/skills/product-help/SKILL.md`, `server/external-agent/mcp-instructions.ts` ("In its UI this editor is called Claudia; tool names keep the openchatcut_ prefix."), `mcp-controls.ts` and `mcp-binding.ts`.

### BQ-3 · The chat panel (needs BD-3)
The header, the collapsed rail, the onboarding and the four starters with no icon tiles and no arrows, the four quick actions, the composer placeholders and the quick-action menu label, as described under Screens. In CSS: remove the kicker, icon and arrow rules and their reduced-motion block; the container-query rule targets `.cc-wordmark`. Delete `BrandMark` and `OpenChatCutWordmark` from `src/components/icons.tsx` (keep the PNG, which the desktop build uses). New `ChatPanelView.verify.tsx`: the wordmark is present with no old name and no arrow, there are four starters, and every preset string and every `t()` literal in `ChatPanelView.tsx` and `CapabilityGapBanner.tsx` has English and Spanish entries. Add the file to `CHROME_FILES`.

### BQ-4 · Cleanups and the review
Remove the decorative conic-gradient account circle in `src/components/TopBar.tsx` and add the file to `CHROME_FILES` if no raw colours remain. Spanish: "Volver a proyectos". The default name of a copied project becomes `Copia de <name>` in `src/persist/projectStore.ts:415` and in `src/agent/tools/schemas/project-tools.ts:73`, then run `npm run generate:server-tool-catalog`. Review the editor's top bar, the chat and the dialogs they open against the AI-tells list; fix small misses on the spot and record the rest under "Qoder (brand): review".

## New strings: the Chinese key for each one

Upstream keys every UI string by its Chinese original, so the key stays Chinese even where the copy is new. The Spanish entry for all of these lives in `src/i18n/dict/es/brand.ts`; the English entry lives in `src/i18n/dict/en/brand.ts` unless the last column says otherwise. Placeholders such as `{n}` must appear unchanged in every language.

### Projects page (BD-4)

| Key | English | Spanish | English file |
|---|---|---|---|
| `工程` | Projects | Proyectos | `components.ts` |
| `新建工程` | New Project | Nuevo proyecto | `components.ts` |
| `导入工程` | Import Project | Importar proyecto | `components.ts` |
| `搜索工程` | Search projects | Buscar proyectos | `components.ts` |
| `清除搜索` | Clear search | Limpiar búsqueda | `components.ts` |
| `清理素材` | Clean Up Media | Limpiar medios | `components.ts` (the dashboard one) |
| `配置模型` | Configure Model | Configurar modelo | `components.ts` |
| `{n} 个` | {n} total | {n} | `components.ts` |
| `{n} / {total} 个` | {n} of {total} | {n} de {total} | `components.ts` |
| `配置模型后即可使用助手。` | Set up a model to use the assistant. | Configura un modelo para usar el asistente. | `brand.ts` |
| `还没有工程` | No projects yet | Todavía no hay proyectos | `brand.ts` |
| `新建一个工程，或导入一个 .ccproj 文件。` | Create a new project or import a .ccproj file. | Crea un proyecto nuevo o importa un archivo .ccproj. | `brand.ts` |
| `没有找到匹配“{query}”的工程` | No projects match “{query}” | No hay proyectos que coincidan con “{query}” | `components.ts` |

### Fork links (BQ-2)

| Key | English | Spanish | English file |
|---|---|---|---|
| `源代码 (AGPL)` | Source code (AGPL) | Código fuente (AGPL) | `brand.ts` |

### Chat panel labels (BQ-1)

The two keys that used to name the old product. The value changes; the key is the new one.

| Key | English | Spanish | English file |
|---|---|---|---|
| `展开助手` | Show assistant | Mostrar asistente | `chat.ts` |
| `收起助手` | Hide assistant | Ocultar asistente | `chat.ts` |

### Chat panel (BQ-3)

| Key | English | Spanish | English file |
|---|---|---|---|
| `编辑助手` | Editing assistant | Asistente de edición | `brand.ts` |
| `你想剪什么？` | What do you want to cut? | ¿Qué quieres montar? | `brand.ts` |
| `描述你想要的视频，或从下面挑一个开始。` | Describe the video you want, or start from one of these ideas. | Describe el vídeo que quieres o empieza por una de estas ideas. | `brand.ts` |

### Starters and quick actions (BQ-3)

Four starters and four quick actions, each with a label, a one-line description and the prompt the button sends.

| Key | English | Spanish | English file |
|---|---|---|---|
| `按节拍剪辑` | Cut to the beat | Montar al ritmo | `brand.ts` |
| `在歌曲的鼓点上切换镜头` | Change shots on the hits | Cambia de plano en los golpes de la canción | `brand.ts` |
| `按歌曲的鼓点切换镜头，做出有节奏的剪辑` | Cut the shots on the hits and give the edit a rhythm | Monta los planos en los golpes de la canción y dale ritmo al corte | `brand.ts` |
| `歌词上屏` | Lyrics on screen | Letra en pantalla | `brand.ts` |
| `与歌声同步的歌词字幕` | Lyric subtitles synced to the vocal | Subtítulos de la letra sincronizados con la voz | `brand.ts` |
| `生成与歌声同步的歌词字幕并应用到时间线` | Generate lyric subtitles synced to the vocal and apply them to the timeline | Genera los subtítulos de la letra sincronizados con la voz y aplícalos a la línea de tiempo | `brand.ts` |
| `竖版预告` | Vertical teaser | Teaser vertical | `brand.ts` |
| `9:16 的 15 秒高光片段` | 15 seconds in 9:16 with the best moment | 15 segundos en 9:16 con el mejor momento | `brand.ts` |
| `挑出最精彩的部分，做一支 9:16 的 15 秒竖版预告` | Pick the best moment and make a 15-second 9:16 teaser | Elige el mejor momento y monta un teaser vertical de 15 segundos en 9:16 | `brand.ts` |
| `片头与片尾字幕` | Titles and credits | Títulos y créditos | `brand.ts` |
| `开场标题与结尾字幕` | Opening title and closing credits | Título de apertura y créditos finales | `brand.ts` |
| `为这支片子做开场标题和结尾字幕` | Add an opening title and closing credits to this piece | Pon un título de apertura y créditos finales a esta pieza | `brand.ts` |
| `在鼓点上切分` | Cut on the hits | Cortar en los golpes | `brand.ts` |
| `在当前时间线的鼓点位置切分片段` | Split the clips on the hits in the current timeline | Corta los clips en los golpes de la línea de tiempo actual | `brand.ts` |
| `添加歌词` | Add the lyrics | Añadir la letra | `brand.ts` |
| `为当前片段添加歌词字幕` | Add lyric subtitles to the current clips | Añade los subtítulos de la letra a los clips actuales | `brand.ts` |
| `转为竖屏` | Go vertical | Pasar a vertical | `brand.ts` |
| `把当前工程转换为 9:16 竖屏，并调整主要画面构图` | Turn the project into 9:16 and reframe the main shot | Pasa el proyecto a 9:16 y reencuadra el plano principal | `brand.ts` |
| `裁掉首尾` | Trim head and tail | Recortar inicio y final | `brand.ts` |
| `裁掉当前片段开头和结尾的多余部分` | Trim the extra material at the start and end of the current clips | Recorta lo que sobra al principio y al final de los clips actuales | `brand.ts` |

### Chat strings that only had an English fallback (BQ-3)

Spanish users were reading these in English before the track touched them.

| Key | English | Spanish | English file |
|---|---|---|---|
| `清空对话` | Clear chat | Vaciar la conversación | `chat.ts` |
| `加载更早消息` | Load earlier messages | Cargar mensajes anteriores | `chat.ts` |
| `聊天滚动快捷操作` | Chat scroll shortcuts | Atajos de desplazamiento del chat | `chat.ts` |
| `快速操作` | Quick actions | Acciones rápidas | `chat.ts` |
| `快速操作…` | Quick actions… | Acciones rápidas… | `chat.ts` |
| `描述你想要创建的内容...` | Describe what you want to create... | Describe lo que quieres crear… | `chat.ts` |
| `告诉 AI 要做哪些修改 - @ 引用素材` | Tell the AI what to change — @ to reference assets | Dime qué cambiar. Usa @ para citar un medio. | `chat.ts` |
| `以下能力未配置，相关功能暂不可用：` | These capabilities are not configured; related features are unavailable: | Estas capacidades no están configuradas y no están disponibles: | `chat.ts` |
| `去设置配置` | Open settings | Ir a ajustes | `chat.ts` |

### Top bar (BQ-4)

| Key | English | Spanish | English file |
|---|---|---|---|
| `返回工程列表` | Back to projects | Volver a proyectos | `topbar.ts` |

## B-9 · Merge the brand tracks (Cursor agent only)

Done on 2026-10-24. The `brand-deepseek` and `brand-qoder` branches this card expected were never created: all eight cards arrived on `harness-workbuddy` (`1fabc26`), so steps 1 and 3 became reading that branch's BD and BQ tables and one fast-forward. The card as written:

1. Read both progress tables and look at the screenshots.
2. Review both diffs against the brief and the AI-tells list.
3. Merge the brand work into `cursor/video-editor-mvp-d191`, keeping both sides of the expected conflicts.
4. Rewrite the README and AGENTS prose: the product is Claudia; corteo stays the repository and command name; the two font licences go into the credits.
5. `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`. Check the projects page and the chat at 1440 and 390 px wide, push, and ask Carlos to publish.

## Not in this plan

- Renaming the repository, the folders, the alias, the npm package, or any identifier listed under Names.
- The desktop app's name and icon.
- Tool descriptions and skill texts that mention OpenChatCut beyond the identity lines above.
- Redesigning the timeline, inspector, media or export panels beyond the new skin.
- Sentence-case fixes in English, Italian and Russian beyond the keys this plan touches.
- `README_ZH.md`, which stays upstream's.


## Appendix: the two kickoff prompts

Written when the plan was approved, and kept for the record. **Do not paste them again.** The DeepSeek and Qoder agents were unavailable on 2026-10-24, the branches `brand-deepseek` and `brand-qoder` were never created, and the WorkBuddy agent executed all eight cards on `harness-workbuddy`. Running these now would redo finished work. The kickoffs still in use are Plan 3's (`docs/plans/03-deepseek-harness.md`).

### DeepSeek (never used)

```text
You are the DeepSeek agent on corteo, a music-video editor in the browser (a fork of OpenChatCut) that is being renamed Claudia. Your job is Plan 4's DeepSeek track: BD-1 to BD-4 (brand fonts, the Claudia skin, the marks and tab, the projects page).

Where you work
- Only in ~/corteo-deepseek, on branch brand-deepseek. Don't touch ~/corteo, ~/corteo-qoder or ~/corteo-workbuddy.
- Every command (git, npm, node, npx, curl) runs inside WSL. If your app runs on Windows, wrap each one:
  wsl.exe -e bash -lc 'source ~/.nvm/nvm.sh && cd ~/corteo-deepseek && <command>'
  If wsl.exe is blocked, stop and ask Carlos to allow it. Never run git or npm from Windows on a \\wsl$ path.

First
1. git status must be clean. Then: git fetch github && git merge --ff-only github/main
2. docs/plans/04-claudia-brand.md must exist. If it doesn't, stop and tell Carlos to publish Cursor's branch to GitHub main.
3. If node_modules is missing: ONNXRUNTIME_NODE_INSTALL=skip npm install
4. Read AGENTS.md, then docs/plans/04-claudia-brand.md (design brief, Names, Parallel work, cards BD-1 to BD-4), then the "Brand track · DeepSeek (BD)" section at the end of docs/plans/PROGRESS.md.

Rules
- The design brief is binding: tokens, type, sizes, copy and the AI-tells list. Where something is open, pick what fits the brief and log it under "DeepSeek: decisions".
- Edit only the files the plan assigns to the DeepSeek track. Never edit src/i18n/dict/es/index.ts, src/components/chat/, src/components/TopBar.tsx, src/components/DashboardHeaderLinks.tsx, src/components/icons.tsx, src/ui/, src/agent/, server/, README.md, AGENTS.md, or the Qoder sections of PROGRESS.md.
- Fonts only from the URLs in BD-1. No new npm dependencies, no global tools, no system packages.
- Dev server, in its own terminal: NODE_OPTIONS=--max-old-space-size=6144 npm run dev -- --port 5203, then open http://localhost:5203
- Per task: the checks of the work loop in AGENTS.md plus the card's Verify; set the task done in your table; commit with the task ID first, staging files by name (never git add -A or git add .); then git push github brand-deepseek. Push BD-3 as soon as it is done: Qoder waits for it.
- Never push main or any other branch, never force-push, never merge or rebase.
- BD-3 and BD-4 end with the AI-tells check from the brief; write the result in your table's notes.
- At most three attempts per failure, then set the task blocked with an entry under "DeepSeek: blockers" and go on.

Finish
After BD-4, or when nothing is left that you can do: npm test (with CC_RENDER_GL=swangle if there is no GPU) and npm run build, push, and report to Carlos: tasks done, tasks blocked and why, the screenshots in test-results/brand/, and the real npm test result (pass count or failing test names).
```

### Qoder (never used)

```text
You are the Qoder agent on corteo. Start this only after your Plan 3 track (HQ-1 to HQ-5) is done or blocked and reported to Carlos. Your job now is Plan 4's Qoder track: BQ-1 to BQ-4 (the old name out of the text, the fork's links and the assistant's identity, the chat panel, the last cleanups and the review).

Where you work
- Only in ~/corteo-qoder, on a new branch brand-qoder. Don't touch ~/corteo, ~/corteo-deepseek or ~/corteo-workbuddy.
- Same WSL rule as Plan 3: if your IDE runs on Windows, wrap each command:
  wsl.exe -e bash -lc 'source ~/.nvm/nvm.sh && cd ~/corteo-qoder && <command>'
  If wsl.exe is blocked, stop and ask Carlos.

First
1. git status must be clean and harness-qoder fully pushed.
2. git fetch github && git switch -c brand-qoder harness-qoder && git merge --no-edit github/main
   If docs/plans/PROGRESS.md conflicts, keep both sides.
3. docs/plans/04-claudia-brand.md must exist now.
4. Read AGENTS.md, then docs/plans/04-claudia-brand.md (design brief, Names, Parallel work, cards BQ-1 to BQ-4), then the "Brand track · Qoder (BQ)" section of docs/plans/PROGRESS.md.

Rules
- The design brief is binding. Log open choices under "Qoder (brand): decisions".
- Don't edit the files the plan assigns to the DeepSeek track.
- Your one allowed merge, right before BQ-3: git fetch github && git show github/brand-deepseek:docs/plans/PROGRESS.md
  - If BD-3 is done there: git merge --no-edit github/brand-deepseek. On conflicts keep both sides (test:serial in package.json, CHROME_FILES in src/theme-tokenization.verify.ts, src/index.css, src/i18n/dict/en/index.ts), then run npx tsc -b and npm run verify:i18n.
  - If BD-3 is not done: set BQ-3 blocked ("waiting for BD-3"), do BQ-4, push and report. Carlos restarts you when BD-3 is done.
- Dev server: NODE_OPTIONS=--max-old-space-size=6144 npm run dev -- --port 5202
- Per task: the work-loop checks plus the card's Verify, set it done, commit with the task ID first (stage files by name), then git push github brand-qoder. Never push main or another branch, never force-push, never merge anything except the one merge above.
- At most three attempts per failure, then set the task blocked with an entry under "Qoder (brand): blockers".

Finish
npm test and npm run build, push, and report to Carlos: tasks done, tasks blocked and why, the BQ-4 review, the screenshots in test-results/brand/, and the real npm test result.
```
