import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHostProfile, skillSource, validateHostProfile } from './host-profile.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const home = mkdtempSync(join(tmpdir(), 'occ-host-'));
const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, OPENCHATCUT_DATA_DIR: join(home, 'library') };
delete env.OPENCHATCUT_DEV_PROFILE_ID;
for (const variable of ['CORTEO_SKILL_DEST', 'CORTEO_MEDIA_INBOX', 'CORTEO_EXPORT_DIR', 'CORTEO_PORT']) delete env[variable as keyof typeof env];
function run(args: string[], extra: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', join(root, 'cli/main.ts'), ...args], {
    cwd: root, env: { ...env, ...extra }, encoding: 'utf8',
  });
}
function json(args: string[], extra?: NodeJS.ProcessEnv) {
  const result = run(args, extra);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
try {
  const names = ['claude-duet', 'grok', 'muse'];
  assert.deepEqual(json(['host', 'list', '--json']).hosts, names);
  const profiles = names.map((name) => loadHostProfile(name, { home, env }));
  for (const profile of profiles) {
    const { host, skillDest, mediaInbox, ...shared } = profile;
    const { host: _host, skillDest: _skill, mediaInbox: _inbox, ...baseline } = profiles[0]!;
    assert.deepEqual(shared, baseline);
    assert.ok(host && skillDest && mediaInbox);
    const first = json(['host', 'install', host, '--json']);
    assert.equal(first.skillChanged, true);
    assert.deepEqual(readFileSync(first.skillPath), readFileSync(skillSource));
    assert.equal(json(['host', 'install', host, '--json']).skillChanged, false);
  }
  assert.equal(json(['host', 'show', 'muse', '--json'], { CORTEO_EXPORT_DIR: join(home, 'out') }).exportDir, join(home, 'out'));
  const badPath = run(['host', 'show', 'grok', '--json'], { CORTEO_EXPORT_DIR: 'relative' });
  assert.equal(badPath.status, 1);
  assert.match(badPath.stderr, /CORTEO_EXPORT_DIR must be an absolute path/);
  const unknown = run(['host', 'show', 'nope', '--json']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown host profile "nope": use grok, muse or claude-duet/);
  assert.ok(validateHostProfile({ ...profiles[0], renderGl: 'angle' }, 'claude-duet').some((problem) => problem.includes('renderGl')));
  const grep = spawnSync('git', ['grep', '-n', '-i', '-w', '-E', 'muse|claude-duet', '--', 'src', 'server', 'shared', 'remotion', 'desktop'], { cwd: root });
  assert.equal(grep.status, 1, grep.stdout.toString());
  console.log('host-profile.verify: ok');
} finally {
  rmSync(home, { recursive: true, force: true });
}
