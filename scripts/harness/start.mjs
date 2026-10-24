// Starts the pinned harness in the foreground, with the free-model forward port
// on loopback and corteo registered as an MCP server. Ctrl+C stops it.
// node scripts/harness/start.mjs [--home <dir>] [--web-port <n>] [--forward-port <n>] [--corteo <dir>]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  command, forwardSettings, homeFrom, httpGet, loadHarnessConfig, logFail, logStep, parseArgs,
  pathsFor, readJson, writePrivateJson,
} from './lib.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export function buildHarnessArgs({ webPort, patchPath }) {
  const args = ['web', '--no-open', '--host', '127.0.0.1', '--port', String(webPort)];
  if (patchPath) args.push('--patch', patchPath);
  return args;
}

export async function ensureForwardEnabled({ settingsPath, port, webPort, env = process.env, probe = httpGet }) {
  const settings = await readJson(settingsPath) ?? {};
  const wanted = forwardSettings(port);
  if (JSON.stringify(settings.forward) === JSON.stringify(wanted)) return { changed: false, settings };
  const web = await probe({ port: webPort });
  if (web.status !== 0) {
    throw new Error(
      'DeepSeek Harness está corriendo y el plugin reescribe sus ajustes desde memoria. '
      + 'Páralo (Ctrl+C) y vuelve a ejecutar npm run harness.',
    );
  }
  const next = { ...settings, forward: wanted };
  await writePrivateJson(settingsPath, next);
  return { changed: true, settings: next };
}

// The MCP patch needs corteo's bearer token. It comes from the environment or
// from the checkout's isolated dev profile, never from the repo.
export async function resolveCorteoMcp({ corteoDir, env = process.env, homeDir = homedir() } = {}) {
  if (env.OPENCHATCUT_MCP_TOKEN) {
    return { token: env.OPENCHATCUT_MCP_TOKEN, source: 'OPENCHATCUT_MCP_TOKEN' };
  }
  const dir = resolve(corteoDir);
  const gitDir = command('git', ['-C', dir, 'rev-parse', '--absolute-git-dir'], { env, allowFailure: true });
  if (gitDir.status !== 0) {
    return { token: null, reason: `${dir} no es un checkout git. Pasa --corteo <ruta>.` };
  }
  const metadata = await readJson(join(gitDir.stdout.trim(), 'openchatcut-dev-profile.json'));
  if (!metadata?.profileId) {
    return { token: null, reason: `No hay perfil de desarrollo en ${gitDir.stdout.trim()}. Abre corteo una vez.` };
  }
  const tokenPath = join(homeDir, '.openchatcut', 'dev-profiles', metadata.profileId, 'mcp-token');
  try {
    const token = (await readFile(tokenPath, 'utf8')).trim();
    if (token) return { token, source: tokenPath };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { token: null, reason: `corteo crea ${tokenPath} en su primera petición MCP. Abre el editor una vez.` };
}

export async function startHarness({
  root = repoRoot,
  home,
  webPort,
  forwardPort,
  corteoDir,
  env = process.env,
  probe = httpGet,
  spawnFn = spawn,
  log = console.log,
} = {}) {
  const config = await loadHarnessConfig(root);
  const paths = pathsFor(home ?? homeFrom(config, {}, env), config);
  const web = Number(webPort ?? config.ports.web);
  const forward = Number(forwardPort ?? config.ports.forward);

  const answer = await probe({ port: web });
  if (answer.status !== 0) {
    logStep(`DeepSeek Harness ya responde en http://127.0.0.1:${web}; no arranco otro.`);
    logStep('Para la URL y la clave del reenvío: npm run harness:doctor');
    return { running: true, webPort: web };
  }

  await ensureForwardEnabled({ settingsPath: paths.pluginSettings, port: forward, webPort: web, env, probe });

  const patchPath = join(root, 'config/harness/corteo-mcp.cordis.yml');
  const mcp = await resolveCorteoMcp({ corteoDir: corteoDir ?? join(homedir(), 'corteo'), env });
  let patch = null;
  if (mcp.token && existsSync(patchPath)) {
    patch = patchPath;
  } else if (!mcp.token) {
    log(`⚠ Sin token MCP: ${mcp.reason} Arranco sin la conexión a corteo; reinícialo después.`);
  }

  logStep(`Arrancando DeepSeek Harness en http://127.0.0.1:${web}`);
  logStep('Abre el enlace que imprima dsh tal cual: lleva el token de acceso.');
  logStep('La clave del reenvío sale de: npm run harness:doctor');
  if (patch) logStep(`corteo entra por MCP en ${env.CORTEO_MCP_URL ?? 'http://localhost:5199/api/external-mcp/mcp?toolExposure=progressive'}`);

  const args = buildHarnessArgs({ webPort: web, patchPath: patch });
  const child = spawnFn(paths.dshBin, args, {
    env: {
      ...env,
      DSH_HOME: paths.home,
      CORTEO_MCP_URL: env.CORTEO_MCP_URL ?? 'http://localhost:5199/api/external-mcp/mcp?toolExposure=progressive',
      ...(mcp.token ? { CORTEO_MCP_TOKEN: mcp.token } : {}),
    },
    stdio: 'inherit',
  });
  const code = await new Promise((done) => {
    child.on('error', (error) => {
      logFail(`No pude arrancar dsh: ${error.message}`);
      done(1);
    });
    child.on('exit', (exitCode) => done(exitCode ?? 0));
  });
  return { code, webPort: web };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs(process.argv.slice(2));
  const known = new Set(['home', 'web-port', 'forward-port', 'corteo']);
  const unknown = Object.keys(values).filter((key) => !known.has(key));
  if (unknown.length) {
    console.error(`Argumentos desconocidos: ${unknown.map((key) => `--${key}`).join(', ')}`);
    process.exit(1);
  }
  try {
    const config = await loadHarnessConfig(repoRoot);
    const result = await startHarness({
      root: repoRoot,
      home: homeFrom(config, values),
      webPort: values['web-port'],
      forwardPort: values['forward-port'],
      corteoDir: values.corteo,
    });
    process.exit(result.code ?? 0);
  } catch (error) {
    logFail(error.message);
    process.exit(1);
  }
}
