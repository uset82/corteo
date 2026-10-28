import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'scripts/harness/boot.mjs');
const brainScript = join(root, 'scripts/harness/brain.mjs');
const scratch = await mkdtemp(join(tmpdir(), 'brain-boot-'));
const key = 'boot-test-key-do-not-print';
const pin = '25ab765d6bb860779dbd8c53062953524f3cac09';
const bin = join(scratch, 'bin');
await mkdir(bin, { recursive: true });
await writeFile(join(bin, 'pnpm'), '#!/usr/bin/env node\nconsole.log("10")\n', { mode: 0o755 });
await writeFile(join(bin, 'git'), `#!/usr/bin/env node\nconsole.log("${pin}")\n`, { mode: 0o755 });
const env = { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin` };
delete env.OPENCHATCUT_MCP_TOKEN;

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function fixture(name) {
  const home = join(scratch, name);
  const dsh = join(home, 'runtime/node_modules/.bin/dsh');
  await mkdir(dirname(dsh), { recursive: true });
  await mkdir(join(home, 'runtime/node_modules/@deepseek-ai/dsh'), { recursive: true });
  await writeFile(join(home, 'runtime/node_modules/@deepseek-ai/dsh/package.json'), JSON.stringify({ version: '0.2.1-rc.2' }));
  await mkdir(join(home, 'vendor/dsh-our-free-model/.git'), { recursive: true });
  await mkdir(join(home, 'profiles/web'), { recursive: true });
  await writeFile(join(home, 'profiles/web/package.json'), JSON.stringify({
    dependencies: { 'dsh-our-free-model': `link:${join(home, 'vendor/dsh-our-free-model')}` },
  }));
  await mkdir(join(home, 'our-free-model'), { recursive: true });
  await writeFile(join(home, 'our-free-model/settings.json'), JSON.stringify({ forwardKey: key, distribution: 'managed' }));
  await writeFile(dsh, `#!/usr/bin/env node
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const home=process.env.DSH_HOME, settings=JSON.parse(fs.readFileSync(path.join(home,'our-free-model/settings.json')));
const web=Number(process.argv[process.argv.indexOf('--port')+1]);
const s1=http.createServer((req,res)=>{res.writeHead(401);res.end()});
const s2=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer '+settings.forwardKey){res.writeHead(401);res.end();return}
 if(req.url==='/v1/models'){res.setHeader('content-type','application/json');res.end('{"data":[{"id":"fake"}]}');return}
 req.resume();req.on('end',()=>{
 if(fs.existsSync(path.join(home,'all429'))){res.writeHead(429);res.end();return}
 res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:'listo'}}]}));
 });
});
s1.listen(web,'127.0.0.1');
if(!process.env.NO_FORWARD)s2.listen(settings.forward.port,'127.0.0.1');
process.on('SIGTERM',()=>{s1.close();s2.close()});
`, { mode: 0o755 });
  return home;
}

let configured = false;
const received = [];
const editor = createHttpServer((req, res) => {
  let text = '';
  req.on('data', (chunk) => { text += chunk; });
  req.on('end', () => {
    received.push({ url: req.url, method: req.method, headers: req.headers, body: text ? JSON.parse(text) : null });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/keys/test') res.end(JSON.stringify({ ok: configured }));
    else if (req.method === 'POST') { configured = true; res.end('{}'); }
    else res.end(JSON.stringify({ keys: { LLM_DSH_API_KEY: { configured } } }));
  });
});
await new Promise((resolve) => editor.listen(0, '127.0.0.1', resolve));
const editorPort = editor.address().port;
const web = await freePort(), forward = await freePort(), router = await freePort();
const home = await fixture('happy');
const homes = [home];
async function run(homeDir, ports, extra = [], extraEnv = {}) {
  try {
    const { stdout, stderr } = await exec(process.execPath, [script, '--json', '--home', homeDir,
      '--web-port', String(ports.web), '--forward-port', String(ports.forward), '--router-port', String(ports.router),
      '--editor-url', `http://127.0.0.1:${editorPort}`, ...extra],
    { cwd: root, env: { ...env, ...extraEnv, HOME: homeDir }, timeout: 75000 });
    assert.ok(!stdout.includes(key) && !stderr.includes(key));
    return { status: 0, data: JSON.parse(stdout) };
  } catch (error) {
    assert.ok(!String(error.stdout).includes(key) && !String(error.stderr).includes(key));
    return { status: error.code, data: JSON.parse(error.stdout) };
  }
}
async function stop(homeDir) {
  try {
    await exec(process.execPath, [brainScript, 'stop', '--home', homeDir], { cwd: root, env });
    for (let i = 0; i < 100; i++) {
      try { if (!JSON.parse(await readFile(join(homeDir, 'brain.json'), 'utf8')).pid) return; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch {}
}
try {
  const ports = { web, forward, router };
  const first = await run(home, ports);
  assert.equal(first.status, 0, JSON.stringify(first.data));
  assert.equal(first.data.editor, 'linked');
  assert.ok(first.data.probe.lane);
  const update = received.find((request) => request.url === '/api/keys' && request.method === 'POST');
  assert.equal(update.body.LLM_DSH_API_KEY, key);
  assert.equal(update.body.LLM_DSH_BASE_URL, `http://127.0.0.1:${forward}/v1`);
  assert.equal(update.headers.host, `127.0.0.1:${editorPort}`);
  assert.equal(update.headers.origin, `http://127.0.0.1:${editorPort}`);
  assert.equal(update.headers['sec-fetch-site'], 'same-origin');
  const state = JSON.parse(await readFile(join(home, 'brain.json'), 'utf8'));
  const second = await run(home, ports);
  assert.equal(second.status, 0, JSON.stringify(second.data));
  assert.equal(second.data.editor, 'already');
  assert.equal(JSON.parse(await readFile(join(home, 'brain.json'), 'utf8')).pid, state.pid);
  const deadEditorPort = await freePort();
  const skipped = await run(home, ports, ['--editor-url', `http://127.0.0.1:${deadEditorPort}`]);
  assert.equal(skipped.status, 0, JSON.stringify(skipped.data));
  assert.equal(skipped.data.editor, 'skipped');
  await writeFile(join(home, 'all429'), '');
  const failed = await run(home, ports);
  assert.equal(failed.status, 1);
  assert.equal(failed.data.step, 'probe');
  assert.equal(failed.data.error, 'no_lane');
  const noForward = await fixture('no-forward');
  homes.push(noForward);
  const failure = await run(noForward, { web: await freePort(), forward: await freePort(), router: await freePort() },
    ['--forward-timeout-ms', '1200', '--no-editor'], { NO_FORWARD: '1' });
  assert.equal(failure.status, 1);
  assert.equal(failure.data.step, 'forward');
  assert.ok(!(await readFile(join(home, 'brain.json'), 'utf8')).includes(key));
  console.log('boot.verify: ok');
} finally {
  for (const entry of homes) await stop(entry);
  editor.closeAllConnections();
  await new Promise((resolve) => editor.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
