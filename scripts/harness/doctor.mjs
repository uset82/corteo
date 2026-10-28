// Checks a DeepSeek Harness setup step by step and stops at the first failure,
// naming the fix in Spanish. Prints the base URL and the key to paste into
// corteo, masked unless --show-key is passed.
// node scripts/harness/doctor.mjs [--home <dir>] [--web-port <n>] [--forward-port <n>] [--show-key]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  homeFrom, httpGet, loadHarnessConfig, logDone, logFail, logStep, maskSecret, parseArgs,
  pathsFor, readInstalledDsh, readJson, readVendorCommit,
} from './lib.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const TOTAL = 5;

class DoctorError extends Error {
  constructor(step, message, fix) {
    super(message);
    this.step = step;
    this.fix = fix;
  }
}

export { DoctorError };

export async function findForwardPort({ start, range, key, probe = httpGet }) {
  for (let offset = 0; offset < range; offset += 1) {
    const port = Number(start) + offset;
    const anonymous = await probe({ port, path: '/v1/models' });
    if (anonymous.status !== 401) continue;
    const authorized = await probe({ port, path: '/v1/models', headers: { Authorization: `Bearer ${key}` } });
    if (authorized.status === 200) return port;
  }
  return null;
}

export async function listModels({ port, key, probe = httpGet }) {
  const answer = await probe({ port, path: '/v1/models', headers: { Authorization: `Bearer ${key}` } });
  if (answer.status !== 200) return { status: answer.status, models: [] };
  try {
    const body = JSON.parse(answer.body);
    return { status: 200, models: Array.isArray(body.data) ? body.data.map((model) => model.id) : [] };
  } catch {
    return { status: 200, models: [] };
  }
}

export async function runDoctor({
  root = repoRoot,
  home,
  webPort,
  forwardPort,
  showKey = false,
  env = process.env,
  probe = httpGet,
  log = console.log,
  step = logStep,
  done = logDone,
}) {
  const config = await loadHarnessConfig(root);
  const paths = pathsFor(home ?? homeFrom(config, {}, env), config);
  const web = Number(webPort ?? config.ports.web);
  const firstForward = Number(forwardPort ?? config.ports.forward);

  step(`1/${TOTAL} Versiones instaladas frente a config/harness.json`);
  const installed = await readInstalledDsh(paths.home);
  if (!installed) {
    throw new DoctorError(1, `dsh no está instalado en ${paths.home}.`, 'npm run harness:install');
  }
  if (installed !== config.dsh.version) {
    throw new DoctorError(1, `dsh ${installed} no coincide con ${config.dsh.version}.`, 'npm run harness:install');
  }
  const commit = readVendorCommit(paths.vendor, env);
  if (commit !== config.plugin.commit) {
    throw new DoctorError(
      1,
      `el plugin está en ${commit ?? 'un commit desconocido'}, esperaba ${config.plugin.commit}.`,
      'npm run harness:install',
    );
  }

  step(`2/${TOTAL} La interfaz web responde en ${web}`);
  const webAnswer = await probe({ port: web });
  if (webAnswer.status === 0) {
    throw new DoctorError(2, `nada responde en http://127.0.0.1:${web}.`, 'npm run harness');
  }

  step('3/5 El reenvío está encendido y tiene clave');
  const settings = await readJson(paths.pluginSettings);
  if (!settings?.forward?.enabled) {
    throw new DoctorError(3, 'el reenvío del plugin está apagado.', 'Enciéndelo en la UI del plugin o vuelve a ejecutar npm run harness');
  }
  if (settings.forward.lan?.enabled) {
    throw new DoctorError(3, 'el reenvío LAN está encendido y nunca debe estarlo.', 'Apágalo en la UI del plugin');
  }
  if (typeof settings.forwardKey !== 'string' || !settings.forwardKey) {
    throw new DoctorError(3, 'no hay forwardKey en los ajustes del plugin.', 'Reinicia el plugin o vuelve a ejecutar npm run harness:install');
  }

  step(`4/${TOTAL} El puerto del reenvío contesta con la clave`);
  const port = await findForwardPort({
    start: firstForward,
    range: config.forwardPortRange ?? 10,
    key: settings.forwardKey,
    probe,
  });
  if (!port) {
    throw new DoctorError(
      4,
      `ningún puerto entre ${firstForward} y ${firstForward + (config.forwardPortRange ?? 10) - 1} responde 401 sin clave y 200 con ella.`,
      'Comprueba que el plugin está cargado y el reenvío encendido',
    );
  }

  step(`5/${TOTAL} Los modelos del reenvío`);
  const { models } = await listModels({ port, key: settings.forwardKey, probe });
  if (!models.length) {
    throw new DoctorError(5, `el puerto ${port} no lista modelos.`, 'Espera a que el plugin sondee los canales y reintenta');
  }

  const key = showKey ? settings.forwardKey : maskSecret(settings.forwardKey);
  log(`    ${models.length} modelos; los primeros: ${models.slice(0, 10).join(', ')}`);
  done('DeepSeek Harness está listo. Pega esto en corteo › Ajustes › DeepSeek Harness:');
  log(`    URL base: http://127.0.0.1:${port}/v1`);
  log(`    Clave:    ${key}`);
  if (!showKey) log('    (clave oculta; para verla: npm run harness:doctor -- --show-key)');
  return { ok: true, webPort: web, forwardPort: port, models, key };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, flags } = parseArgs(process.argv.slice(2));
  const known = new Set(['home', 'web-port', 'forward-port']);
  const unknown = Object.keys(values).filter((key) => !known.has(key));
  if (unknown.length) {
    console.error(`Argumentos desconocidos: ${unknown.map((key) => `--${key}`).join(', ')}`);
    process.exit(1);
  }
  try {
    const config = await loadHarnessConfig(repoRoot);
    await runDoctor({
      root: repoRoot,
      home: homeFrom(config, values),
      webPort: values['web-port'],
      forwardPort: values['forward-port'],
      showKey: flags.has('show-key'),
    });
  } catch (error) {
    if (error instanceof DoctorError) {
      logFail(`Paso ${error.step}/${TOTAL}: ${error.message}`);
      console.error(`  Arreglo: ${error.fix}`);
    } else {
      logFail(error.message);
    }
    process.exit(1);
  }
}
