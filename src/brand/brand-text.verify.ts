/**
 * BQ-1 gate: the old product name is out of the text.
 *
 * The product is corteo. The name `OpenChatCut` survives in exactly two places,
 * both deliberate:
 *
 *  1. the five desktop-updater strings, which describe the upstream release the
 *     app downloads and installs — renaming them would make the notice lie about
 *     what it is installing;
 *  2. code comments, header constants, URL literals and the bundled agent skill
 *     docs, which are not user-facing copy and are out of BQ-1's scope.
 *
 * This gate covers (1) and the copy files the plan names explicitly. It reads
 * quoted string literals rather than raw lines, so a comment mentioning the old
 * name does not fail the build.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

/**
 * Every string literal in a TypeScript source, comments and regexes excluded.
 *
 * A regex cannot do this job: one apostrophe in a comment (`// don't`) opens a
 * phantom string and desynchronises every literal after it. So walk the source
 * and track whether we are in code, a comment, a regex or a literal. `/` is the
 * only ambiguous character — it opens a comment, a regex, or is division — and
 * the character before it settles the question.
 */
function quoted(source: string): string[] {
  const out: string[] = [];
  // A regex can follow these characters and nothing else; after an identifier,
  // a number, `)` or `]` the slash is division.
  const REGEX_AFTER = new Set('(,=:[!&|?{};+-*%~^<>'.split(''));
  let i = 0;
  let lastSig: string | undefined;

  while (i < source.length) {
    const c = source[i];

    // Line comment.
    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    // Block comment.
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    // Regex literal: `/"/g`, `/'/g`, `/[^A-Za-z0-9_.-]/g`. Quotes inside one must
    // not be mistaken for string delimiters.
    if (c === '/' && (lastSig === undefined || REGEX_AFTER.has(lastSig))) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
        else if (d === '\n') break;
        j += 1;
      }
      i = j + 1;
      lastSig = '/';
      continue;
    }
    // String literal.
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') { j += 2; continue; }
        if (source[j] === quote) break;
        j += 1;
      }
      out.push(source.slice(i, Math.min(j + 1, source.length)));
      i = j + 1;
      lastSig = quote;
      continue;
    }

    if (!/\s/.test(c)) lastSig = c;
    i += 1;
  }

  return out;
}

/** Unwrap a literal to its body, so whitelist entries read like the dict does. */
const body = (literal: string) => literal.slice(1, -1);

const OLD = 'OpenChatCut';

/**
 * The five desktop-updater keys, plus their English and Russian values. These
 * are the only user-visible strings allowed to keep the upstream name.
 */
const UPDATER_KEYS = [
  '发现 OpenChatCut 新版本 {latest}，当前版本 {current}。请前往项目仓库查看更新。',
  '发现 OpenChatCut 新版本 {latest}，当前版本 {current}。可以直接下载并安装。',
  '正在下载 OpenChatCut {latest}：{percent}%',
  'OpenChatCut {latest} 已下载，重启后完成安装。',
  '正在重启并安装 OpenChatCut…',
];

const UPDATER_EN = [
  'OpenChatCut {latest} is available; current version: {current}. Visit the project repository to review the update.',
  'OpenChatCut {latest} is available; current version: {current}. Download and install it directly.',
  'Downloading OpenChatCut {latest}: {percent}%',
  'OpenChatCut {latest} is downloaded. Restart to finish installing.',
  'Restarting to install OpenChatCut…',
];

const UPDATER_RU = [
  'Доступна новая версия OpenChatCut {latest}, текущая — {current}. Загляните в репозиторий проекта.',
  'Доступна новая версия OpenChatCut {latest}, текущая — {current}. Можно скачать и установить.',
  'Загрузка OpenChatCut {latest}: {percent}%',
  'OpenChatCut {latest} загружен, установка завершится после перезапуска.',
  'Перезапуск и установка OpenChatCut…',
];

const ALLOWED = new Set([...UPDATER_KEYS, ...UPDATER_EN, ...UPDATER_RU]);

// ── 1. the dictionaries ──────────────────────────────────────────────────────

/** Every `.ts` file under a directory, minus the `.occ-*` working copies. */
function dictFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    if (name.includes('.occ-')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...dictFiles(rel));
    else if (name.endsWith('.ts')) out.push(rel);
  }
  return out;
}

const offenders: { file: string; text: string }[] = [];
let corteoMentions = 0;
let claudiaMentions = 0;

for (const locale of ['en', 'es', 'it', 'ru', 'zh']) {
  for (const file of dictFiles(`src/i18n/dict/${locale}`)) {
    const source = read(file);
    corteoMentions += (source.match(/corteo/g) ?? []).length;
    claudiaMentions += (source.match(/Claudia/g) ?? []).length;
    for (const literal of quoted(source)) {
      const text = body(literal);
      if (!text.includes(OLD)) continue;
      if (!ALLOWED.has(text)) offenders.push({ file, text });
    }
  }
}

assert.deepEqual(
  offenders,
  [],
  `字典里还有未登记的上游名：\n${offenders.map((o) => `  ${o.file}: ${o.text}`).join('\n')}`,
);

// The whitelist has to stay populated: if a locale drops the updater strings the
// notice falls back silently, and the five `t()` call sites become dead keys.
const enSource = read('src/i18n/dict/en/components.ts');
const ruSource = read('src/i18n/dict/ru/index.ts');
for (const key of UPDATER_KEYS) {
  assert.ok(enSource.includes(key), `en/components.ts 少了更新器文案：${key}`);
  assert.ok(ruSource.includes(key), `ru/index.ts 少了更新器文案：${key}`);
}
for (const value of UPDATER_EN) assert.ok(enSource.includes(value), `en 更新器译文变了：${value}`);
for (const value of UPDATER_RU) assert.ok(ruSource.includes(value), `ru 更新器译文变了：${value}`);

// A sweep that renames the updater keys leaves dead keys behind, and these five must
// not take the product's name either: the notice would claim corteo is installing itself.
for (const file of dictFiles('src/i18n/dict')) {
  const source = read(file);
  assert.doesNotMatch(
    source,
    /发现 corteo|下载 corteo|corteo 已下载|安装 corteo/,
    `${file} 把更新器键改成了 corteo，那条通知会声称 corteo 在安装自己`,
  );
}

// Every locale that carries product copy names the product, and none of them names the
// old one. The floor is what caught a half-finished sweep the first time.
assert.ok(corteoMentions >= 30, `字典里 corteo 出现次数太少（${corteoMentions}），改名可能没铺开`);
assert.equal(claudiaMentions, 0, `字典里还有 ${claudiaMentions} 处旧名字`);

// ── 2. the strings outside the dictionaries ─────────────────────────────────

const COPY_FILES = [
  'src/plugins/resourcePreview.ts',
  'src/agent/external-bridge-session.ts',
  'src/agent/external-bridge-runtime.ts',
  // BQ-2's identity files: an external agent reads these before it touches the
  // project, so they name the product even though they are not UI copy.
  'server/external-agent/mcp-instructions.ts',
  'server/external-agent/mcp-controls.ts',
  'server/external-agent/mcp-binding.ts',
];

for (const file of COPY_FILES) {
  const literals = quoted(read(file)).map(body);
  const hits = literals.filter((text) => text.includes(OLD));
  assert.deepEqual(hits, [], `${file} 还有面向用户的上游名：${hits.join(' / ')}`);
  const stale = literals.filter((text) => text.includes('Claudia'));
  assert.deepEqual(stale, [], `${file} 还有旧名字：${stale.join(' / ')}`);
}

// The product-help skill's identity lines. Its body may still quote upstream's
// feature names, but the title and the description say who the product is.
const productHelp = read('src/agent/skills/product-help/SKILL.md');
assert.match(productHelp, /^# corteo Product Help$/m, 'product-help 的标题应为 corteo');
assert.match(productHelp, /^ {2}corteo product knowledge/m, 'product-help 的描述应介绍 corteo');
assert.doesNotMatch(productHelp, /OpenChatCut/, 'product-help 的标识行里还有上游名');

// ── 3. exported names ───────────────────────────────────────────────────────

const fcpxml = quoted(read('src/export/fcpxml.ts')).map(body);
for (const name of ['corteo Timeline', 'corteo Export', 'corteo Export (Resolve)']) {
  assert.ok(fcpxml.includes(name), `FCPXML 导出名应为 ${name}`);
}
assert.ok(
  !fcpxml.some((text) => text.includes(OLD)),
  'FCPXML 导出名里还有上游名',
);

const capcut = read('server/external-agent/jianying-export.ts');
assert.match(capcut, /`corteo-\$\{/, '剪映草稿名应为 corteo-<date>');
assert.doesNotMatch(capcut, /`OpenChatCut-/, '剪映草稿名里还有上游名');

// ── 4. the chat's expand and collapse labels ────────────────────────────────

const CHAT_LABELS: Record<string, [string, string]> = {
  'src/i18n/dict/en/chat.ts': ['Show assistant', 'Hide assistant'],
  'src/i18n/dict/es/brand.ts': ['Mostrar asistente', 'Ocultar asistente'],
  'src/i18n/dict/ru/index.ts': ['Развернуть ассистента', 'Свернуть ассистента'],
};

for (const [file, [show, hide]] of Object.entries(CHAT_LABELS)) {
  const source = read(file);
  assert.ok(source.includes(`'展开助手': '${show}'`), `${file} 的展开文案应为 ${show}`);
  assert.ok(source.includes(`'收起助手': '${hide}'`), `${file} 的收起文案应为 ${hide}`);
}

console.log(`brand-text.verify: ok（${corteoMentions} 处 corteo，0 处旧名，上游名只剩 ${ALLOWED.size} 条更新器文案）`);
