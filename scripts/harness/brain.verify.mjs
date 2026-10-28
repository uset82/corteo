import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'scripts/harness/brain.mjs');
const home = await mkdtemp(join(tmpdir(), 'brain-verify-'));
const key = 'test-forward-key-not-for-output';
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const webPort = await freePort();
const forwardPort = await freePort();
const routerPort = await freePort();
const dsh = join(home, 'runtime/node_modules/.bin/dsh');
await mkdir(dirname(dsh), { recursive: true });
await mkdir(join(home, 'our-free-model'), { recursive: true });
await writeFile(join(home, 'our-free-model/settings.json'), JSON.stringify({ forwardKey: key }));
await writeFile(dsh, `#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const settings = JSON.parse(fs.readFileSync(path.join(process.env.DSH_HOME, 'our-free-model/settings.json')));
const web = Number(process.argv[process.argv.indexOf('--port') + 1]);
const s1 = http.createServer((req, res) => { res.writeHead(401); res.end(); });
const s2 = http.createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer ' + settings.forwardKey) { res.writeHead(401); res.end(); return; }
  if (req.url === '/v1/models') { res.end('{"data":[]}'); return; }
  req.resume();
  req.on('end', () => { res.setHeader('content-type','application/json'); res.end(JSON.stringify({choices:[{message:{content:'listo'}}]})); });
});
s1.listen(web, '127.0.0.1');
s2.listen(settings.forward.port, '127.0.0.1');
process.on('SIGTERM', () => { s1.close(); s2.close(); });
`);
await chmod(dsh, 0o755);
const env = { ...process.env, HOME: home };
delete env.OPENCHATCUT_MCP_TOKEN;
const args = ['serve', '--home', home, '--web-port', String(webPort), '--forward-port', String(forwardPort), '--router-port', String(routerPort)];
const child = spawn(process.execPath, [script, ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (data) => { stderr += data; });
try {
  let state;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`brain exited: ${stderr}`);
    try {
      state = JSON.parse(await readFile(join(home, 'brain.json'), 'utf8'));
      const response = await fetch(`http://127.0.0.1:${routerPort}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
      if (response.ok) {
        assert.equal((await response.json()).data.length, 3);
        break;
      }
    } catch { /* wait for the router */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(state?.routerPort, routerPort, stderr);
  assert.ok(state.dshPid);
  const statusText = execFileSync(process.execPath, [script, 'status', '--home', home, '--json'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(JSON.parse(statusText).running, true);
  assert.ok(!statusText.includes(key));
  const stopped = JSON.parse(execFileSync(process.execPath, [script, 'stop', '--home', home], { cwd: root, env, encoding: 'utf8' }));
  assert.equal(stopped.stopped, child.pid);
  await new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(() => reject(new Error('brain did not stop')), 10000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  const final = JSON.parse(await readFile(join(home, 'brain.json'), 'utf8'));
  assert.equal(final.pid, null);
  assert.equal(final.dshPid, null);
  await assert.rejects(fetch(`http://127.0.0.1:${webPort}/`));
  await assert.rejects(fetch(`http://127.0.0.1:${forwardPort}/`));
  console.log('brain.verify: ok');
} finally {
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(home, { recursive: true, force: true });
}
