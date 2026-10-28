import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpegBin } from '../server/media-binaries.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const home = mkdtempSync(join(tmpdir(), 'occ-inbox-'));
const inbox = join(home, 'inbox');
const exports = join(home, 'exports');
const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home,
  OPENCHATCUT_DATA_DIR: join(home, 'library'), CORTEO_MEDIA_INBOX: inbox, CORTEO_EXPORT_DIR: exports };
delete env.OPENCHATCUT_DEV_PROFILE_ID;
function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', join(root, 'cli/main.ts'), ...args],
    { cwd: root, env, encoding: 'utf8' });
}
try {
  mkdirSync(inbox);
  const empty = run(['inbox', '--host', 'grok', '--json']);
  assert.equal(empty.status, 1);
  assert.equal(JSON.parse(empty.stdout).error, 'inbox_empty');
  assert.match(empty.stderr, /inbox is empty/);
  const bad = run(['inbox', '--host', 'nope', '--json']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown host profile "nope"/);
  const clip = join(inbox, 'clip.mp4');
  const generated = spawnSync(ffmpegBin(), ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=blue:s=1280x720:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip]);
  assert.equal(generated.status, 0, generated.stderr.toString());
  const result = run(['inbox', '--host', 'grok', '--dry-run', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  for (const key of ['ok', 'host', 'input', 'projectId', 'exportPath', 'attachPath', 'width', 'height', 'fps', 'durationSeconds', 'bytes', 'dryRun']) assert.ok(key in report, key);
  assert.equal(report.ok, true);
  assert.equal(report.attachPath, report.exportPath);
  assert.ok(report.exportPath.startsWith(exports + '/'));
  assert.deepEqual([report.width, report.height, report.fps], [1080, 1920, 30]);
  assert.equal(report.dryRun, true);
  assert.equal(existsSync(join(inbox, '.corteo-done.json')), false);
  const itemsResult = run(['timeline', 'items', report.projectId, '--json']);
  assert.equal(itemsResult.status, 0, itemsResult.stderr);
  const items = JSON.parse(itemsResult.stdout).items;
  const video = items.filter((item: { kind: string }) => item.kind === 'video');
  assert.equal(video.length, 1);
  assert.equal(video[0].fit, 'cover');
  console.log('inbox.verify: ok');
} finally {
  rmSync(home, { recursive: true, force: true });
}
