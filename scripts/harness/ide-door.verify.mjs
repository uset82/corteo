import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { forwardSettings } from './lib.mjs';
import { startBrainRouter } from './router.mjs';

const { server } = await startBrainRouter({ port: 0, brain: {}, getProbe: () => null, forwardKey: 'test' });
try {
  assert.equal(server.address().address, '127.0.0.1');
} finally { await new Promise((resolve) => server.close(resolve)); }
assert.equal(forwardSettings(18899).host, '127.0.0.1');
assert.equal(forwardSettings(18899).lan.enabled, false);

const harnessDir = new URL('.', import.meta.url);
for (const file of await readdir(harnessDir)) {
  if (!file.endsWith('.mjs') || file.endsWith('.verify.mjs')) continue;
  const source = await readFile(new URL(file, harnessDir), 'utf8');
  assert.ok(!source.includes('0.0.0.0'), `${file} must not bind every interface`);
  for (const line of source.split('\n').filter((line) => /\.listen\s*\(/.test(line))) {
    assert.ok(line.includes("'127.0.0.1'"), `${file} must bind loopback`);
  }
}
for (const path of ['docs/harness.md', 'skills/corteo/SKILL.md']) {
  const source = await readFile(path, 'utf8');
  for (const text of ['http://127.0.0.1:18890/v1', 'corteo-edit', 'corteo-draft', 'corteo-fast']) {
    assert.ok(source.includes(text), `${path} must include ${text}`);
  }
  assert.doesNotMatch(source, /Bearer [A-Za-z0-9_-]{20,}|"forwardKey"\s*:\s*"/);
}

const secrets = [];
try {
  const settings = JSON.parse(await readFile(join(homedir(), '.corteo-harness/our-free-model/settings.json'), 'utf8'));
  if (typeof settings.forwardKey === 'string' && settings.forwardKey) secrets.push(settings.forwardKey);
} catch { /* No installed key. */ }
const profiles = join(homedir(), '.openchatcut/dev-profiles');
let names = [];
try { names = await readdir(profiles); } catch { /* No profiles. */ }
for (const name of names) {
  try {
    const token = (await readFile(join(profiles, name, 'mcp-token'), 'utf8')).trim();
    if (token) secrets.push(token);
  } catch { /* Profile has no token. */ }
}
const files = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
for (const file of files) {
  let data;
  try { data = await readFile(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (data.includes(0)) continue;
  for (const secret of secrets) assert.ok(!data.includes(Buffer.from(secret)), `secret found in tracked file ${file}`);
}
console.log('real forward key and profile tokens: not in the repo');
console.log('ide-door.verify: all checks passed');
