import { spawn } from 'node:child_process';
import { existsSync, openSync, closeSync, chmodSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homeFrom, httpGet, loadHarnessConfig, parseArgs, pathsFor, forwardKeyFrom } from './lib.mjs';
import { findForwardPort } from './doctor.mjs';
import { buildHarnessArgs, DEFAULT_CORTEO_MCP_URL, ensureForwardEnabled, resolveCorteoMcp } from './start.mjs';
import { probeLanes, readBrainState, writeBrainState } from './probe.mjs';
import { ladderFor, BRAIN_ALIASES } from './ladder.mjs';
import { startBrainRouter } from './router.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function running(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

export async function brainStatus(home, brain) {
  const state = await readBrainState(home);
  const lanes = state.lanes ?? {};
  return { running: running(state.pid), pid: state.pid ?? null, webPort: state.webPort ?? null,
    forwardPort: state.forwardPort ?? null, routerPort: state.routerPort ?? null,
    probedAt: state.probedAt ?? null, passing: Object.values(lanes).filter((entry) => entry.ok).length,
    aliases: Object.fromEntries(BRAIN_ALIASES.map((alias) => [alias, ladderFor(alias, brain, lanes)[0] ?? null])) };
}

export async function stopBrain(home) {
  const state = await readBrainState(home);
  if (!running(state.pid)) return { ok: true, stopped: null };
  process.kill(state.pid, 'SIGTERM');
  return { ok: true, stopped: state.pid };
}

export async function serveBrain({ config, home, webPort, forwardPort, routerPort, env = process.env }) {
  const paths = pathsFor(home, config);
  const web = Number(webPort ?? config.ports.web);
  const forward = Number(forwardPort ?? config.ports.forward);
  const router = Number(routerPort ?? config.brain.routerPort);
  let child = null;
  let server = null;
  let interval = null;
  let stopping = false;
  let probe = null;
  let activeRouterPort = router;
  let spawnError = null;
  const startedAt = new Date().toISOString();

  async function shutdown() {
    if (stopping) return;
    stopping = true;
    if (interval) clearInterval(interval);
    if (server) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const killer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await Promise.race([new Promise((done) => child.once('exit', done)), sleep(5100)]);
      clearTimeout(killer);
    }
    await writeBrainState(home, { pid: null, dshPid: null });
  }

  const onSignal = () => { void shutdown().finally(() => process.exit(0)); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    if ((await httpGet({ port: web })).status === 0) {
      await ensureForwardEnabled({ settingsPath: paths.pluginSettings, port: forward, webPort: web });
      const mcp = await resolveCorteoMcp({ corteoDir: root, env });
      const patchPath = join(root, 'config/harness/corteo-mcp.cordis.yml');
      const patch = mcp.token && existsSync(patchPath) ? patchPath : null;
      if (!mcp.token) console.error(`Sin token MCP: ${mcp.reason} Arranco sin la conexión a corteo.`);
      await mkdir(join(home, 'logs'), { recursive: true });
      const logPath = join(home, 'logs/dsh.log');
      const fd = openSync(logPath, 'a', 0o600);
      chmodSync(logPath, 0o600);
      try {
        child = spawn(paths.dshBin, buildHarnessArgs({ webPort: web, patchPath: patch }), {
          env: { ...env, DSH_HOME: home, CORTEO_MCP_URL: env.CORTEO_MCP_URL ?? DEFAULT_CORTEO_MCP_URL,
            ...(mcp.token ? { CORTEO_MCP_TOKEN: mcp.token } : {}) }, stdio: ['ignore', fd, fd],
        });
      } finally { closeSync(fd); }
      child.on('error', (error) => { spawnError = error; });
    }
    const deadline = Date.now() + 120_000;
    let key = null;
    let port = null;
    while (Date.now() < deadline) {
      if (spawnError) throw new Error(`dsh could not start: ${spawnError.message}`);
      if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error('dsh exited before the forward port became ready');
      key = await forwardKeyFrom(paths.pluginSettings);
      if (key) port = await findForwardPort({ start: forward, range: config.forwardPortRange ?? 10, key });
      if (port) break;
      await sleep(500);
    }
    if (!key || !port) throw new Error('forward port did not become ready within 120 seconds');
    async function refresh() {
      const lanes = await probeLanes({ port, key, candidates: config.brain.candidates,
        timeoutMs: config.brain.probeTimeoutMs });
      if (stopping) return;
      probe = lanes;
      await writeBrainState(home, { version: 1, pid: process.pid, dshPid: child?.pid ?? null,
        webPort: web, forwardPort: port, routerPort: activeRouterPort, startedAt,
        probedAt: new Date().toISOString(), lanes });
    }
    await refresh();
    try {
      ({ server } = await startBrainRouter({ brain: config.brain, getProbe: () => probe,
        forwardPort: port, forwardKey: key, port: router }));
    } catch (error) {
      if (error.code === 'EADDRINUSE') throw new Error(`router port ${router} is in use; pass --router-port`);
      throw error;
    }
    activeRouterPort = server.address().port;
    await writeBrainState(home, { routerPort: activeRouterPort });
    interval = setInterval(() => refresh().catch((error) => console.error(`probe: ${error.message}`)),
      config.brain.probeIntervalMinutes * 60_000);
    await new Promise((done) => {
      if (child) child.once('exit', done);
    });
    await shutdown();
  } catch (error) {
    await shutdown();
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, ...argv] = process.argv.slice(2);
  const { values, flags } = parseArgs(argv);
  const known = new Set(['home', 'web-port', 'forward-port', 'router-port']);
  const unknown = Object.keys(values).filter((key) => !known.has(key));
  if (unknown.length || [...flags].some((flag) => flag !== 'json')) {
    console.error('unknown brain option');
    process.exitCode = 1;
  } else {
    try {
      const config = await loadHarnessConfig(root);
      const home = homeFrom(config, values);
      if (action === 'serve') await serveBrain({ config, home, webPort: values['web-port'],
        forwardPort: values['forward-port'], routerPort: values['router-port'] });
      else if (action === 'stop') console.log(JSON.stringify(await stopBrain(home)));
      else if (action === 'status') console.log(JSON.stringify(await brainStatus(home, config.brain)));
      else throw new Error('brain needs serve, stop or status');
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
