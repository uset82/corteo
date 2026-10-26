/**
 * C-08 gate: the repository does not call the product by its old name.
 *
 * brand-text.verify covers the copy a person reads. This one covers the repo
 * itself — every tracked file, including scripts, comments and JSON — so a
 * path that survived a sweep fails here instead of in someone's terminal.
 *
 * History is out of scope, and it says so by path: `docs/plans/**` is the
 * record of what was true on the day it was written (the plans from before the
 * rename keep their text), and `CHANGELOG.md` is the same kind of record.
 *
 * What survives on purpose, and why removing it would break something:
 *
 *   1. the saved-skin migration key — it has to read the value that is already
 *      in someone's localStorage;
 *   2. the installer's own migration — it looks for `~/claudia` and
 *      `claudia.service` on a machine that ran the previous version, and it
 *      renames files whose names are literally the old ones;
 *   3. the two verifies that assert the name is *gone*, which have to spell it;
 *   4. proper nouns that belong to other people: the `claudia-bot` template
 *      repository and the plan filenames written before the rename, which are
 *      real paths and stay as they are;
 *   5. the migration notes in the README and the install guide, which name the
 *      old install root so a reader recognises what is about to be moved.
 *
 * (5) is scoped per file and per phrase, so the rest of those documents still
 * has to be clean and the notes cannot become a place to park a stale name.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const EXTENSIONS = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx|css|html|json|sh|md|svg)$/;
const SKIP_DIRS = ['node_modules/', 'dist/', '.git/', 'test-results/', '.workbuddy-ai/'];
const SKIP_FILES = [
  // The record of what shipped on each date, like the plans.
  'CHANGELOG.md',
  // This file: a search for a word has to contain the word.
  'scripts/no-claudia.verify.mjs',
];

/** Whole files that must keep the name to do their job, pinned by line count. */
const WHOLE_FILE = new Map([
  ['src/skins.ts', {
    lines: 4,
    why: 'reads a skin saved under the old name and removes the old marker',
  }],
  ['src/skins.verify.ts', {
    lines: 9,
    why: 'the migration cases have to write the old value to test the migration',
  }],
  ['install.sh', {
    lines: 9,
    why: 'the migration looks for the old root, the old unit and the old file names',
  }],
  ['src/brand/brand-text.verify.ts', {
    lines: 4,
    why: 'counts the old name in the dictionaries to assert the count is zero',
  }],
  ['src/brand/CorteoMarks.verify.tsx', {
    lines: 1,
    why: 'asserts index.html no longer contains the old name',
  }],
]);

/** Paths and proper nouns that may keep it in any file. */
const ANYWHERE = [
  'docs/plans/01-editor-claudia.md',
  'docs/plans/02-claudia-escucha.md',
  'docs/plans/04-claudia-brand.md',
  'docs/plans/05-claudia-portable.md',
  'claudia-bot',
  // This gate is named after the thing it forbids, so its own path in
  // package.json is the one place the string is unavoidable.
  'scripts/no-claudia.verify.mjs',
];

/** Per-file phrases; every other occurrence in that file still fails. */
const PHRASES = new Map([
  ['README.md', ['~/claudia', 'claudia.service']],
  ['README.es.md', []],
  ['AGENTS.md', []],
  ['documentation/CORTEO_INSTALL.md', ['~/claudia', 'claudia.service', '/home/you/claudia']],
]);

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => EXTENSIONS.test(file))
  .filter((file) => !SKIP_DIRS.some((dir) => file.startsWith(dir) || file.includes(`/${dir}`)))
  .filter((file) => !SKIP_FILES.includes(file))
  .filter((file) => !file.startsWith('docs/plans/'));

const problems = [];
const allowedSeen = new Map();
let scanned = 0;

for (const file of files) {
  const text = readFileSync(join(root, file), 'utf8');
  scanned += 1;
  if (!/claudia/i.test(text)) continue;

  const hits = [];
  text.split('\n').forEach((line, index) => {
    if (/claudia/i.test(line)) hits.push({ line: index + 1, text: line.trim() });
  });

  if (WHOLE_FILE.has(file)) {
    const { lines, why } = WHOLE_FILE.get(file);
    assert.equal(
      hits.length,
      lines,
      `${file} 的旧名从 ${lines} 行变成 ${hits.length} 行；这个文件允许保留旧名是因为${why}，改了就要一起改这个数`,
    );
    allowedSeen.set(file, hits.length);
    continue;
  }

  const phrases = [...ANYWHERE, ...(PHRASES.get(file) ?? [])];
  for (const hit of hits) {
    let rest = hit.text;
    for (const phrase of phrases) rest = rest.split(phrase).join('');
    if (/claudia/i.test(rest)) problems.push(`${file}:${hit.line}: ${hit.text}`);
  }
  if (hits.length > 0) allowedSeen.set(file, hits.length);
}

assert.deepEqual(
  problems,
  [],
  `旧名字还在这些地方（docs/plans/** 和 CHANGELOG.md 是历史，不算）：\n${problems.map((p) => `  ${p}`).join('\n')}`,
);

// A phrase that no longer occurs is a dead exemption: the note it protected was
// rewritten, or a sweep removed the mention and left the allowance behind.
for (const [file, phrases] of PHRASES) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const phrase of phrases) {
    assert.ok(
      text.includes(phrase),
      `${file} 不再提到 ${phrase}；这条豁免已经没用，删掉它，别让下一个旧名躲在这里`,
    );
  }
}

// The set of files that keep the name is part of the contract: a new file that
// starts using it has to be added here on purpose, with a reason.
assert.deepEqual(
  [...allowedSeen.keys()].sort(),
  [
    'AGENTS.md',
    'README.es.md',
    'README.md',
    'documentation/CORTEO_INSTALL.md',
    'install.sh',
    // test:serial names this gate, and the gate is named after what it forbids.
    'package.json',
    'src/brand/CorteoMarks.verify.tsx',
    'src/brand/brand-text.verify.ts',
    'src/skins.ts',
    'src/skins.verify.ts',
  ],
  '允许保留旧名的文件清单变了；要么改这一行，要么把旧名清掉',
);

const detail = [...allowedSeen].map(([file, count]) => `${file} ${count}`).join('，');
console.log(
  `no-claudia.verify: ok（${scanned} 个受版本控制的文件，旧名只剩迁移键、安装器的迁移、两个断言门和专有名词：${detail}）`,
);
