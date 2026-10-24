// Shared plumbing for the DeepSeek Harness scripts. Everything here reads the
// pins from config/harness.json and works inside $DSH_HOME; no script may
// hard-code the version, the tag, the commit or the ports.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const HARNESS_CONFIG = 'config/harness.json';

export async function loadHarnessConfig(repoRoot) {
  const path = join(repoRoot, HARNESS_CONFIG);
  const config = await readJson(path);
  if (!config) throw new Error(`Falta ${path}: el repo no trae los pines de DeepSeek Harness.`);
  for (const [section, keys] of Object.entries({
    dsh: ['package', 'version', 'fallbackVersion'],
    plugin: ['name', 'repo', 'tag', 'commit'],
    ports: ['web', 'forward'],
  })) {
    for (const key of keys) {
      if (!config[section]?.[key]) throw new Error(`${HARNESS_CONFIG}: falta ${section}.${key}.`);
    }
  }
  return config;
}

export function expandHome(value) {
  if (value === '~') return homedir();
  if (value.startsWith('~/')) return join(homedir(), value.slice(2));
  return value;
}

// --key value, --key=value and bare flags. Unknown arguments are left to the
// caller so a script can reject them with its own message.
export function parseArgs(argv) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      flags.add(arg);
      continue;
    }
    const equals = arg.indexOf('=');
    if (equals !== -1) {
      values[arg.slice(2, equals)] = arg.slice(equals + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
    } else {
      flags.add(key);
    }
  }
  return { values, flags };
}

export function homeFrom(config, values = {}, env = process.env) {
  return resolve(expandHome(values.home ?? env.CORTEO_HARNESS_HOME ?? config.home));
}

export function pathsFor(home, config) {
  return {
    home,
    runtime: join(home, 'runtime'),
    dshBin: join(home, 'runtime', 'node_modules', '.bin', 'dsh'),
    dshPackage: join(home, 'runtime', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
    vendor: join(home, 'vendor', 'dsh-our-free-model'),
    profile: join(home, 'profiles', config.profile),
    pluginSettings: join(home, 'our-free-model', 'settings.json'),
    reports: join(home, 'reports'),
  };
}

export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`${path} no es JSON válido: ${error.message}`);
  }
}

// The plugin settings hold the forward key, so they never become group/world
// readable, not even when the file already existed with looser permissions.
export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export function maskSecret(secret) {
  if (!secret) return '(vacía)';
  return secret.length <= 4 ? '…' : `…${secret.slice(-4)}`;
}

export function command(cmd, args, { env = process.env, cwd, allowFailure = false } = {}) {
  const result = spawnSync(cmd, args, { env, cwd, encoding: 'utf8' });
  if (result.error) {
    if (allowFailure) return { status: null, stdout: '', stderr: result.error.message };
    throw new Error(`No pude ejecutar ${cmd}: ${result.error.message}`);
  }
  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${cmd} ${args.join(' ')} falló (código ${status})${detail ? `:\n${detail}` : ''}`);
  }
  return { status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function requireCommand(cmd, fix, env = process.env) {
  const result = command(cmd, ['--version'], { env, allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`No encontré ${cmd} en PATH${fix ? `. Instálalo con: ${fix}` : '.'}`);
  }
  return result.stdout.trim();
}

export function requireNode24() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 24) {
    throw new Error(`Este repo necesita Node 24 (tienes ${process.versions.node}). Ejecuta nvm use.`);
  }
}

export async function readInstalledDsh(home) {
  const pkg = await readJson(join(home, 'runtime', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'));
  return pkg?.version ?? null;
}

export function readVendorCommit(vendor, env = process.env) {
  if (!existsSync(join(vendor, '.git'))) return null;
  const result = command('git', ['-C', vendor, 'rev-parse', 'HEAD'], { env, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

// Resolves with { status, body } for any HTTP answer; status 0 means the port
// did not answer (connection refused, timeout). A running dsh web answers 401
// without its login token, and that still counts as running.
export function httpGet({ port, path = '/', headers = {}, timeoutMs = 2000, host = '127.0.0.1' }) {
  return new Promise((done) => {
    const req = request({ host, port, path, method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (body.length < 1_000_000) body += chunk;
      });
      res.on('end', () => done({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', (error) => done({ status: 0, body: '', error }));
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

export function forwardSettings(port) {
  return { enabled: true, host: '127.0.0.1', port, lan: { enabled: false, port: 0 } };
}

export async function forwardKeyFrom(settingsPath) {
  const settings = await readJson(settingsPath);
  return typeof settings?.forwardKey === 'string' ? settings.forwardKey : null;
}

export function logStep(text) {
  console.log(`• ${text}`);
}

export function logDone(text) {
  console.log(`\n✓ ${text}`);
}

export function logFail(text) {
  console.error(`\n✗ ${text}`);
}
