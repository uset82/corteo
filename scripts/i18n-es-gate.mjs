// P5-2: the Spanish half of the i18n gate. scripts/check-i18n.mjs imports this
// and fails the build with whatever it returns, so `npm run verify:i18n` (and
// therefore `npm test`) covers it.
//
// Four rules:
//   1. Coverage — every key of every module in src/i18n/dict/en/ resolves to a
//      Spanish value in the assembled es dictionary, and a key written in
//      Chinese carries a value that is neither the key itself nor Chinese. A key
//      already in Latin script (product names, protocol tokens, the handful of
//      Spanish strings en/shorts.ts uses as keys) has nothing to translate: it
//      only has to resolve and stay free of Chinese.
//   2. Placeholders — the set of {placeholders} in the Spanish value equals the
//      set in the English value, so a {name} can never fall out of a sentence.
//   3. One wording per key — a key defined by two es sources (modules,
//      es/index.ts `base`, es/brand.ts) carries the same Spanish in both,
//      because Object.assign order would otherwise pick one of them silently.
//   4. Allowlist — a real exception goes in ALLOWLIST below, with its reason.
//      It is empty on purpose: every exception so far was better fixed than
//      excused, and rule 1's Latin-script carve-out removed the rest.
//
// The assembly is read from es/index.ts rather than assumed: the imports and the
// Object.assign argument order are what the app actually spreads, so a module
// that exists on disk but was never wired in shows up as missing keys.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

const CJK = /[\u3400-\u9fff]/;
const PLACEHOLDER = /\{[a-zA-Z0-9_]+\}/g;

// A real exception silences exactly one rule for exactly one key, so each entry
// needs a reason a reviewer can check against the code. Empty is the goal.
const ALLOWLIST = [
  // { rule: 'coverage', key: '歌曲地图标题', reason: '…' },
];

function allowed(rule, key) {
  return ALLOWLIST.some((entry) => entry.rule === rule && entry.key === key);
}

function unwrap(node) {
  let expression = node;
  while (
    expression
    && (expression.type === 'TSAsExpression'
      || expression.type === 'TSSatisfiesExpression'
      || expression.type === 'TSTypeAssertion'
      || expression.type === 'ParenthesizedExpression')
  ) {
    expression = expression.expression;
  }
  return expression;
}

function parseFile(filePath) {
  return parse(fs.readFileSync(filePath, 'utf8'), {
    sourceType: 'module',
    sourceFilename: filePath,
    plugins: ['typescript'],
  });
}

/** The string-keyed entries of an object literal, in source order. */
function entries(objectNode) {
  const map = new Map();
  if (!objectNode || objectNode.type !== 'ObjectExpression') return map;
  for (const property of objectNode.properties) {
    if (property.type !== 'ObjectProperty' || property.computed) continue;
    if (property.key.type !== 'StringLiteral') continue;
    if (property.value.type !== 'StringLiteral') continue;
    map.set(property.key.value, property.value.value);
  }
  return map;
}

/** The default-exported dictionary object of an es module. */
function readDictionary(filePath) {
  const ast = parseFile(filePath);
  const declaration = ast.program.body.find((node) => node.type === 'ExportDefaultDeclaration');
  return entries(unwrap(declaration?.declaration));
}

/**
 * es/index.ts: the `base` object, the identifier -> module imports, and the
 * order of the Object.assign call that assembles everything.
 */
function readAssembly(indexPath) {
  const ast = parseFile(indexPath);
  const imports = new Map();
  let base = new Map();
  let order = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const specifier = node.specifiers.find((item) => item.type === 'ImportDefaultSpecifier');
      if (specifier) imports.set(specifier.local.name, node.source.value.replace(/^\.\//, ''));
      continue;
    }
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.id.name === 'base') {
          base = entries(unwrap(declarator.init));
        }
      }
      continue;
    }
    if (node.type === 'ExportDefaultDeclaration') {
      const call = unwrap(node.declaration);
      if (call?.type === 'CallExpression' && call.callee.type === 'MemberExpression') {
        order = call.arguments
          .slice(1)
          .map((argument) => (argument.type === 'Identifier' ? argument.name : null))
          .filter(Boolean);
      }
    }
  }
  return { base, imports, order };
}

/** Every key of every en module, with the module that defines it. */
function readEnglish(enRoot) {
  const byKey = new Map();
  const modules = fs.readdirSync(enRoot).filter((name) => name.endsWith('.ts'));
  for (const name of modules) {
    const dictionary = readDictionary(path.join(enRoot, name));
    for (const [key, value] of dictionary) {
      const owners = byKey.get(key) ?? [];
      owners.push({ module: `en/${name}`, value });
      byKey.set(key, owners);
    }
  }
  return byKey;
}

function placeholders(value) {
  return [...new Set(value.match(PLACEHOLDER) ?? [])].sort();
}

function show(list) {
  return list.length ? list.join(', ') : '无';
}

/**
 * Runs the four rules. Returns { issues, keys, modules } — `issues` is a list of
 * human-readable lines, empty when the dictionary is clean.
 */
export function runSpanishGate(root) {
  const dictRoot = path.join(root, 'src', 'i18n', 'dict');
  const enRoot = path.join(dictRoot, 'en');
  const esRoot = path.join(dictRoot, 'es');
  const issues = [];

  const english = readEnglish(enRoot);
  const { base, imports, order } = readAssembly(path.join(esRoot, 'index.ts'));

  // Every es source, so rule 3 sees a module even when the assembly forgot it.
  const sources = [['es/index.ts', base]];
  for (const name of fs.readdirSync(esRoot).filter((entry) => entry.endsWith('.ts'))) {
    if (name === 'index.ts') continue;
    sources.push([`es/${name}`, readDictionary(path.join(esRoot, name))]);
  }

  // A parser regression must not read as "everything is translated".
  if (!english.size) {
    return { issues: ['西语校验读不到英文词条：src/i18n/dict/en/ 的默认导出无法解析'], keys: 0, modules: sources.length };
  }
  if (!order.length || !base.size) {
    return { issues: ['西语校验读不到字典组装：es/index.ts 的 Object.assign 参数或 base 无法解析'], keys: 0, modules: sources.length };
  }

  // The dictionary the app really builds, in Object.assign order.
  const assembled = new Map();
  for (const identifier of order) {
    const entriesHere = identifier === 'base' ? base : readDictionary(path.join(esRoot, `${imports.get(identifier)}.ts`));
    for (const [key, value] of entriesHere) assembled.set(key, value);
  }

  // dictRegistry spreads es/brand.ts OVER es/index.ts (dictRegistry.ts:53),
  // so brand is part of the dictionary the app builds and wins last. Leaving it
  // out made every brand-only key look missing.
  const brandPath = path.join(esRoot, 'brand.ts');
  if (fs.existsSync(brandPath)) {
    for (const [key, value] of readDictionary(brandPath)) assembled.set(key, value);
  }

  // 1. Coverage.
  for (const [key, owners] of english) {
    if (allowed('coverage', key)) continue;
    const value = assembled.get(key);
    if (value === undefined) {
      const where = [...new Set(owners.map((owner) => owner.module))].join(', ');
      issues.push(`西语缺少词条：${where} · ${JSON.stringify(key)}`);
      continue;
    }
    if (value === key) {
      // Legitimate only when the key is not Chinese: nothing to translate.
      if (CJK.test(key)) {
        issues.push(`西语未翻译（值仍是中文键）：${owners[0].module} · ${JSON.stringify(key)}`);
      }
      continue;
    }
    if (CJK.test(value)) {
      issues.push(`西语里仍有中文：${owners[0].module} · ${JSON.stringify(key)} → ${JSON.stringify(value)}`);
    }
  }

  // 2. Placeholders.
  for (const [key, owners] of english) {
    if (allowed('placeholders', key)) continue;
    const value = assembled.get(key);
    if (value === undefined) continue;
    const expected = placeholders(owners[0].value);
    const found = placeholders(value);
    if (show(expected) === show(found)) continue;
    issues.push(
      `西语占位符与英文不一致：${owners[0].module} · ${JSON.stringify(key)}`
      + `（英文 ${show(expected)} / 西语 ${show(found)}）`,
    );
  }

  // 3. One wording per key.
  const seen = new Map();
  for (const [module, dictionary] of sources) {
    for (const [key, value] of dictionary) {
      const previous = seen.get(key);
      if (!previous) {
        seen.set(key, { module, value });
        continue;
      }
      if (previous.value === value || allowed('wording', key)) continue;
      issues.push(
        `同一词条有两种西语：${JSON.stringify(key)} · ${previous.module} ${JSON.stringify(previous.value)}`
        + ` ≠ ${module} ${JSON.stringify(value)}`,
      );
    }
  }

  return { issues, keys: assembled.size, modules: sources.length };
}
