#!/usr/bin/env node
// Builds bot/dist/recipe.json — the one file a person hands to a Grok Bot.
//
// The recipe is a *replay plan*, not a bundle: on import the bot re-emits every
// skill through its own state tool, so the budgets below are measured on the
// emitted text, not on the files. A skill that only fits because a comment was
// trimmed is a skill that will not fit once the bot rewrites it.
//
// `--check` validates and compares against the committed recipe without writing,
// which is what `npm run verify:bot-recipe` runs.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOT = join(ROOT, 'bot');
const OUT = join(BOT, 'dist', 'recipe.json');

const KB = 1024;
const LIMITS = { profile: 3 * KB, skill: 6 * KB, recipe: 80 * KB };

// A skill's description is emitted twice — once in the list the model reads,
// once in the front matter of the file it writes — so it is counted twice.
const LISTED = 2;

const SKILLS = [
  'corteo-welcome',
  'corteo-setup',
  'corteo-edit',
  'corteo-repair',
];

// Content of a skill is treated as untrusted: it may not smuggle a secret, a
// private path, or an instruction to install something without asking.
// `instructional` rules are judged line by line so a prohibition — "Never
// install a plugin" — is not mistaken for the thing it forbids.
const NEGATED = /^\s*(?:[-*]\s*)?(?:never|do not|don'?t|nunca)\b/i;

const SCRUB = [
  { pattern: /Bearer\s+[A-Za-z0-9._~+/-]{8,}/, what: 'a bearer token' },
  { pattern: /\bOPENCHATCUT_MCP_TOKEN\s*=\s*\S/, what: 'an inline token value' },
  { pattern: /\b(?:ghp|sk|xox[baprs])[-_][A-Za-z0-9]{12,}/, what: 'an API key' },
  { pattern: /(?:\/home\/[a-z][\w.-]*|\/Users\/[a-z]|[A-Za-z]:\\Users|wsl\.localhost)/, what: 'a private path' },
  { pattern: /uset82\.workers\.dev/, what: 'a private host' },
  { pattern: /auto-?install/i, what: 'an auto-install instruction', instructional: true },
  {
    pattern: /install\s+(?:an?\s+)?(?:plugin|mcp\s+server)/i,
    what: 'an instruction to install a plugin',
    instructional: true,
  },
  { pattern: /\\"/, what: 'a double-quoted shell example' },
  { pattern: /--args\s+"/, what: 'a double-quoted --args' },
];

function fail(message) {
  process.stderr.write(`build-bot-recipe: ${message}\n`);
  process.exit(1);
}

function bytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

function parseFrontMatter(text, where) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) fail(`${where}: no front matter`);
  const meta = {};
  let key = '';
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (pair) {
      key = pair[1];
      meta[key] = pair[2].trim();
      continue;
    }
    if (!key || !/^\s+\S/.test(line)) fail(`${where}: cannot read front matter line "${line}"`);
    meta[key] = `${meta[key]} ${line.trim()}`.trim();
  }
  // `>` and `|` are folded/literal block markers, not content.
  for (const name of Object.keys(meta)) meta[name] = meta[name].replace(/^[>|][-+]?\s*/, '').trim();
  return { meta, body: match[2] };
}

function scrub(text, where) {
  const lines = text.split('\n');
  for (const rule of SCRUB) {
    const scope = rule.instructional ? lines.filter((line) => !NEGATED.test(line)) : [text];
    for (const line of scope) {
      const hit = rule.pattern.exec(line);
      if (hit) fail(`${where}: contains ${rule.what} ("${hit[0].slice(0, 60)}")`);
    }
  }
}

function readProfile() {
  const path = join(BOT, 'profile.md');
  if (!existsSync(path)) fail('bot/profile.md is missing');
  const profile = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  scrub(profile, 'bot/profile.md');
  if (bytes(profile) > LIMITS.profile) {
    fail(`bot/profile.md is ${bytes(profile)} B, over the ${LIMITS.profile} B budget`);
  }
  return profile;
}

function readSkills() {
  const dir = join(BOT, 'skills');
  if (!existsSync(dir)) fail('bot/skills/ is missing');
  const found = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const missing = SKILLS.filter((name) => !found.includes(name));
  const extra = found.filter((name) => !SKILLS.includes(name));
  if (missing.length) fail(`bot/skills/ is missing ${missing.join(', ')}`);
  if (extra.length) fail(`bot/skills/ has an unlisted skill: ${extra.join(', ')} — add it to SKILLS`);

  return found.map((folder) => {
    const where = `bot/skills/${folder}/SKILL.md`;
    const path = join(dir, folder, 'SKILL.md');
    if (!existsSync(path)) fail(`${where} is missing`);
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
    const { meta, body } = parseFrontMatter(text, where);
    if (meta.name !== folder) {
      fail(`${where}: front matter name is "${meta.name}", must match the folder`);
    }
    if (!/^Use when\b/.test(meta.description ?? '')) {
      fail(`${where}: description must start with "Use when"`);
    }
    scrub(text, where);
    const size = bytes(body);
    if (size > LIMITS.skill) fail(`${where} is ${size} B, over the ${LIMITS.skill} B budget`);
    return { name: meta.name, description: meta.description, body };
  });
}

function build() {
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const profile = readProfile();
  const skills = readSkills();
  const memory = [
    `corteo ${version} · ${skills.length} skills · the person's projects live in the editor's library on their machine, not in this chat`,
  ];
  // Kept in the shape the import expects and left empty on purpose: corteo has
  // no webhook to wake the bot and no plugin to install.
  const recipe = { profile, memory, skills, routines: [], plugins: [] };

  const reemitted =
    bytes(profile) + skills.reduce((sum, skill) => sum + LISTED * bytes(skill.description) + bytes(skill.body), 0);
  if (reemitted > LIMITS.recipe) {
    fail(`the re-emitted recipe is ${reemitted} B, over the ${LIMITS.recipe} B budget`);
  }
  return { recipe, reemitted, profile: bytes(profile), skills };
}

function serialise(recipe) {
  return `${JSON.stringify(recipe, null, 2)}\n`;
}

const check = process.argv.includes('--check');
const { recipe, reemitted, profile, skills } = build();
const text = serialise(recipe);

if (check) {
  if (!existsSync(OUT)) fail('bot/dist/recipe.json is missing — run `npm run build:bot-recipe`');
  const committed = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  if (committed !== text) fail('bot/dist/recipe.json is stale — run `npm run build:bot-recipe`');
  process.stdout.write(
    `bot-recipe: ok — ${skills.length} skills, profile ${profile} B, ${reemitted} B re-emitted of ${LIMITS.recipe}\n`,
  );
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text);
process.stdout.write(`wrote bot/dist/recipe.json — ${skills.length} skills, ${reemitted} B re-emitted\n`);
for (const skill of skills) {
  process.stdout.write(`  ${skill.name.padEnd(16)} ${String(bytes(skill.body)).padStart(5)} B body\n`);
}
