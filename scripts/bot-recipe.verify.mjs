/**
 * C-11 gate: the bot template is buildable, and the doc and the proof agree.
 *
 * Three things are checked here, and only the first one is about JSON:
 *
 *   1. `bot/dist/recipe.json` is what `bot/` currently builds — the committed
 *      recipe is a deliverable a person imports, so a stale one is a lie;
 *   2. the recipe lists exactly the four skills, each described with "Use when";
 *   3. every command line in `corteo-setup`'s rehearsal blocks also appears in
 *      `scripts/bot-rehearsal.sh`. That last one is the point of the file: the
 *      skill tells a bot what to type, the rehearsal proves those exact lines
 *      run, and this gate is what stops the two from drifting apart. A skill
 *      that quietly gets "better" than the rehearsal is a skill nobody tested.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'scripts/build-bot-recipe.mjs');
const RECIPE = join(ROOT, 'bot/dist/recipe.json');
const SETUP = join(ROOT, 'bot/skills/corteo-setup/SKILL.md');
const REHEARSAL = join(ROOT, 'scripts/bot-rehearsal.sh');

const EXPECTED = ['corteo-edit', 'corteo-repair', 'corteo-setup', 'corteo-welcome'];

function squash(text) {
  return text.replace(/[ \t]+/g, ' ').trim();
}

// ── 1. the build validates itself ───────────────────────────────────────────
let buildOutput = '';
try {
  buildOutput = execFileSync(process.execPath, [BUILD, '--check'], { cwd: ROOT, encoding: 'utf8' });
} catch (error) {
  const detail = (error.stderr || error.stdout || error.message || '').trim();
  assert.fail(`build-bot-recipe --check failed:\n${detail}`);
}
assert.match(buildOutput, /bot-recipe: ok/, 'build-bot-recipe --check did not report ok');

// ── 2. the committed recipe says what it should ─────────────────────────────
assert.ok(existsSync(RECIPE), 'bot/dist/recipe.json is missing — run `npm run build:bot-recipe`');
const recipe = JSON.parse(readFileSync(RECIPE, 'utf8'));

assert.deepEqual(
  Object.keys(recipe).sort(),
  ['memory', 'plugins', 'profile', 'routines', 'skills'],
  'the recipe must have exactly profile, memory, skills, routines and plugins',
);
assert.ok(recipe.profile.length > 0, 'the recipe has no profile');
assert.equal(recipe.memory.length, 1, 'memory is one log line, not a list of them');
assert.ok(Array.isArray(recipe.routines) && recipe.routines.length === 0, 'corteo ships no routines');
assert.ok(Array.isArray(recipe.plugins) && recipe.plugins.length === 0, 'corteo ships no plugins');

assert.deepEqual(
  recipe.skills.map((skill) => skill.name).sort(),
  EXPECTED,
  'the recipe must list exactly the four skills',
);
for (const skill of recipe.skills) {
  assert.match(skill.description, /^Use when\b/, `${skill.name}: description must start with "Use when"`);
  assert.ok(skill.body.trim().length > 0, `${skill.name}: empty body`);
  assert.ok(
    !/uset82\.workers\.dev/.test(skill.body),
    `${skill.name}: a private host leaked into the skill`,
  );
}
assert.ok(!/uset82\.workers\.dev/.test(recipe.profile), 'a private host leaked into the profile');

// ── 3. the skill and the rehearsal run the same commands ────────────────────
assert.ok(existsSync(SETUP), 'bot/skills/corteo-setup/SKILL.md is missing');
assert.ok(existsSync(REHEARSAL), 'scripts/bot-rehearsal.sh is missing — the proof the skill is executable');

const setup = readFileSync(SETUP, 'utf8');
const rehearsal = squash(readFileSync(REHEARSAL, 'utf8'));

const blocks = [];
let current = null;
for (const line of setup.split(/\r?\n/)) {
  if (line.trim() === '# rehearsal:begin') {
    assert.equal(current, null, 'nested rehearsal:begin in corteo-setup');
    current = [];
    continue;
  }
  if (line.trim() === '# rehearsal:end') {
    assert.ok(current !== null, 'rehearsal:end without a begin in corteo-setup');
    blocks.push(current);
    current = null;
    continue;
  }
  if (current !== null) current.push(line);
}
assert.equal(current, null, 'unterminated rehearsal block in corteo-setup');
assert.equal(blocks.length, 2, 'corteo-setup should have two rehearsal blocks: install, then prove');

const commands = blocks.flat().map(squash).filter((line) => line.length > 0);
assert.ok(commands.length >= 10, `only ${commands.length} rehearsal lines found in corteo-setup`);

const missing = commands.filter((command) => !rehearsal.includes(command));
assert.deepEqual(
  missing,
  [],
  `corteo-setup runs commands the rehearsal does not:\n${missing.map((line) => `  ${line}`).join('\n')}`,
);

console.log(
  `bot-recipe.verify: ok (${recipe.skills.length} skills, ${commands.length} rehearsal lines match, recipe is current)`,
);
