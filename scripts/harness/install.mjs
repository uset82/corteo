// Installs the pinned DeepSeek Harness runtime and the Our Free Model plugin
// into $DSH_HOME. Idempotent: a home that already matches the pins is left
// untouched, and the plugin is never installed from npm.
// node scripts/harness/install.mjs [--home <dir>]
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  command, ensurePnpm, homeFrom, httpGet, loadHarnessConfig, logDone, logStep, parseArgs, pathsFor,
  readInstalledDsh, readJson, readVendorCommit, requireCommand, requireNode24, writePrivateJson,
} from './lib.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export async function installHarness({
  root = repoRoot,
  home,
  env = process.env,
  probe = httpGet,
  step = logStep,
  done = logDone,
} = {}) {
  const config = await loadHarnessConfig(root);
  const paths = pathsFor(home ?? homeFrom(config, {}, env), config);

  requireNode24();
  requireCommand('git', 'apt install git', env);
  const pnpmEnv = ensurePnpm({ home: paths.home, env });

  let changed = false;

  step(`Comprobando ${config.dsh.package}@${config.dsh.version} en ${paths.runtime}`);
  if (await readInstalledDsh(paths.home) !== config.dsh.version) {
    command('npm', ['install', '--prefix', paths.runtime, `${config.dsh.package}@${config.dsh.version}`], { env });
    const installed = await readInstalledDsh(paths.home);
    if (installed !== config.dsh.version) {
      throw new Error(`La instalación dejó ${config.dsh.package}@${installed ?? 'nada'}, esperaba ${config.dsh.version}.`);
    }
    if (!existsSync(paths.dshBin)) throw new Error(`Falta el binario ${paths.dshBin} después de instalar dsh.`);
    changed = true;
  } else {
    step(`dsh ${config.dsh.version} ya está instalado.`);
  }

  step(`Comprobando el plugin ${config.plugin.name} ${config.plugin.tag}`);
  let commit = readVendorCommit(paths.vendor, env);
  if (!commit) {
    if (existsSync(paths.vendor)) {
      throw new Error(`${paths.vendor} existe pero no es un clon git. Bórralo y vuelve a ejecutar.`);
    }
    command('git', ['clone', '--depth', '1', '--branch', config.plugin.tag, config.plugin.repo, paths.vendor], { env });
    commit = readVendorCommit(paths.vendor, env);
    changed = true;
  }
  if (commit !== config.plugin.commit) {
    throw new Error(
      `El plugin está en el commit ${commit ?? 'desconocido'}, esperaba ${config.plugin.commit} `
      + `(${config.plugin.tag}). No se registró en dsh.`,
    );
  }

  step(`Comprobando el plugin en el perfil ${config.profile}`);
  const profilePackage = await readJson(resolve(paths.profile, 'package.json'));
  const linked = profilePackage?.dependencies?.[config.plugin.name];
  const wantedLink = `link:${paths.vendor}`;
  if (linked !== wantedLink) {
    command(paths.dshBin, ['plugin', '--profile', config.profile, 'add', paths.vendor], {
      env: { ...pnpmEnv, DSH_HOME: paths.home },
    });
    changed = true;
  }

  step('Comprobando distribution: managed');
  const settings = await readJson(paths.pluginSettings);
  if (settings?.distribution !== 'managed') {
    const web = await probe({ port: config.ports.web });
    if (web.status !== 0) {
      throw new Error(
        'DeepSeek Harness está corriendo y el plugin reescribe sus ajustes desde memoria. '
        + 'Páralo (Ctrl+C en su terminal) y vuelve a ejecutar npm run harness:install.',
      );
    }
    await writePrivateJson(paths.pluginSettings, { ...(settings ?? {}), distribution: 'managed' });
    changed = true;
  }

  if (!changed) {
    done('Nada que hacer: el runtime, el plugin y los ajustes ya coinciden con config/harness.json.');
    return { changed, home: paths.home };
  }
  done(`DeepSeek Harness listo en ${paths.home}. Siguiente paso: npm run harness`);
  return { changed, home: paths.home };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs(process.argv.slice(2));
  const unknown = Object.keys(values).filter((key) => key !== 'home');
  if (unknown.length) {
    console.error(`Argumentos desconocidos: ${unknown.map((key) => `--${key}`).join(', ')}`);
    process.exit(1);
  }
  try {
    const config = await loadHarnessConfig(repoRoot);
    await installHarness({ root: repoRoot, home: homeFrom(config, values) });
  } catch (error) {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
  }
}
