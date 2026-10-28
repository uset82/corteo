// Provision the pinned yt-dlp binary used by the platform-import route.
//
//   npm run sync:yt-dlp               install the pinned release when it is missing or stale
//   npm run sync:yt-dlp -- --update   fetch the latest release, re-pin the table below, install it
//
// Assets come from the official GitHub release and are checked against the
// pinned size and sha256 BEFORE anything is written, the same way
// scripts/sync-whisper-cli.mjs does it. Every installed binary gets a
// provenance record (`<binary>.provenance.json`); a later run trusts the file
// only when that record still matches the pin, the bytes still hash to the
// recorded digest, and `--version` actually prints the pinned version.
//
// Output: vendor/yt-dlp/<platform>/yt-dlp[.exe] (outside public/, gitignored).
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SELF = fileURLToPath(import.meta.url);
const OUT_DIR = join(ROOT, 'vendor', 'yt-dlp');
const API_LATEST = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

export const VERSION = '2026.10.26';

// Pinned from the GitHub release API for VERSION:
//   curl -sL https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest
// Regenerate with `npm run sync:yt-dlp -- --update`, or by hand whenever
// VERSION moves. A mismatch must fail provisioning, never install whatever
// bytes arrived.
export const PLATFORMS = {
  'win32-x64': {
    asset: 'yt-dlp.exe',
    bytes: 23_575_744,
    sha256: 'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d',
    executable: 'yt-dlp.exe',
  },
  'darwin-x64': {
    asset: 'yt-dlp_macos',
    bytes: 37_466_304,
    sha256: '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa',
    executable: 'yt-dlp',
  },
  'darwin-arm64': {
    asset: 'yt-dlp_macos',
    bytes: 37_466_304,
    sha256: '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa',
    executable: 'yt-dlp',
  },
  'linux-x64': {
    asset: 'yt-dlp_linux',
    bytes: 41_166_968,
    sha256: '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795',
    executable: 'yt-dlp',
  },
  'linux-arm64': {
    asset: 'yt-dlp_linux_aarch64',
    bytes: 40_789_792,
    sha256: 'e87e9533e89fe5889abaa21f5114dfe7756d6aa6219b83551add04d48b18e483',
    executable: 'yt-dlp',
  },
};

export const PROVENANCE_SUFFIX = '.provenance.json';
/** Any real yt-dlp build is several MB; this only rejects stubs and truncations. */
export const MIN_YTDLP_BINARY_BYTES = 1 << 20;

export function platformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

export function releaseUrl(version, asset) {
  return `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${asset}`;
}

function sha256Of(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Reject a download before it is written anywhere. Pure. */
export function assetProblem(bytes, spec) {
  if (bytes.length !== spec.bytes) {
    return `asset is ${bytes.length} bytes, pinned size is ${spec.bytes}`;
  }
  const digest = sha256Of(bytes);
  if (digest !== spec.sha256) {
    return `asset sha256 ${digest} does not match the pinned ${spec.sha256}`;
  }
  return null;
}

/**
 * `yt-dlp --version` needs no network: it only has to start and name itself.
 * A missing shared library exits non-zero, and a placeholder that merely exits
 * 0 prints nothing. Pure.
 */
export function versionProbeProblem(code, output, expected) {
  if (code !== 0) return `\`--version\` exited ${code}`;
  const printed = output.trim();
  if (!printed) return '`--version` printed nothing';
  if (expected && printed !== expected) return `binary reports ${printed}, pinned is ${expected}`;
  if (!/^\d{4}\.\d{2}\.\d{2}/.test(printed)) return '`--version` output is not a yt-dlp version';
  return null;
}

/**
 * Decide whether an already-provisioned binary can be trusted, so the skip path
 * is a verification instead of existsSync(). Pure; `binary` and `probe` are
 * null when the caller could not gather them.
 */
export function provisionedProblem({ expected, record, binary, probe }) {
  if (!record) return 'no provenance record';
  if (record.source === 'override') {
    // A binary supplied by hand has no knowable upstream version; it still has
    // to be a real, runnable executable matching its recorded digest.
  } else if (record.version !== expected.version) {
    return `provisioned from ${record.version ?? 'an unrecorded version'}, want ${expected.version}`;
  } else if (record.assetSha256 !== expected.assetSha256) {
    return 'provenance asset digest does not match the pinned digest';
  }
  if (!binary) return 'binary is missing';
  if (binary.bytes < MIN_YTDLP_BINARY_BYTES) {
    return `binary is only ${binary.bytes} bytes (minimum ${MIN_YTDLP_BINARY_BYTES})`;
  }
  if (!binary.executable) return 'binary is not executable';
  if (binary.sha256 !== record.binarySha256) return 'binary does not match its provenance digest';
  return probe?.problem ?? null;
}

/**
 * Turn a GitHub release payload into the pin table this script holds. Only the
 * five official standalone assets are read; a release that loses one of them
 * is an error, not a silently partial table. Pure.
 */
export function pinsFromRelease(release) {
  const version = String(release?.tag_name ?? '').trim();
  if (!/^\d{4}\.\d{2}\.\d{2}/.test(version)) {
    throw new Error(`release has no usable tag_name: ${String(release?.tag_name)}`);
  }
  const wanted = {
    'win32-x64': 'yt-dlp.exe',
    'darwin-x64': 'yt-dlp_macos',
    'darwin-arm64': 'yt-dlp_macos',
    'linux-x64': 'yt-dlp_linux',
    'linux-arm64': 'yt-dlp_linux_aarch64',
  };
  const assets = new Map((release.assets ?? []).map((asset) => [asset.name, asset]));
  const platforms = {};
  for (const [key, name] of Object.entries(wanted)) {
    const asset = assets.get(name);
    if (!asset) throw new Error(`release ${version} has no ${name}`);
    const digest = String(asset.digest ?? '');
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error(`release ${version} has no sha256 digest for ${name}`);
    platforms[key] = {
      asset: name,
      bytes: Number(asset.size),
      sha256: digest.slice('sha256:'.length),
      executable: name === 'yt-dlp.exe' ? 'yt-dlp.exe' : 'yt-dlp',
    };
  }
  return { version, platforms };
}

function platformsSource(platforms) {
  return Object.entries(platforms)
    .map(([key, spec]) => [
      `  '${key}': {`,
      `    asset: '${spec.asset}',`,
      `    bytes: ${spec.bytes.toLocaleString('en-US').replaceAll(',', '_')},`,
      `    sha256: '${spec.sha256}',`,
      `    executable: '${spec.executable}',`,
      '  },',
    ].join('\n'))
    .join('\n');
}

/**
 * Rewrite the pinned table in this file's own source so `--update` moves the
 * pin with the binary it installs. Everything outside the two constants is
 * preserved byte for byte. Pure.
 */
export function rewritePins(source, { version, platforms }) {
  const versionPattern = /^export const VERSION = '[^']*';$/m;
  const platformsPattern = /^export const PLATFORMS = \{[\s\S]*?^\};$/m;
  if (!versionPattern.test(source)) throw new Error('VERSION constant not found; refusing to install an unpinned build');
  if (!platformsPattern.test(source)) throw new Error('PLATFORMS constant not found; refusing to install an unpinned build');
  return source
    .replace(versionPattern, `export const VERSION = '${version}';`)
    .replace(platformsPattern, `export const PLATFORMS = {\n${platformsSource(platforms)}\n};`);
}

async function readProvenance(binPath) {
  try {
    const parsed = JSON.parse(await readFile(binPath + PROVENANCE_SUFFIX, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function inspectBinary(binPath) {
  try {
    const info = await stat(binPath);
    if (!info.isFile()) return null;
    return {
      bytes: info.size,
      executable: process.platform === 'win32' || (info.mode & 0o111) !== 0,
      sha256: sha256Of(await readFile(binPath)),
    };
  } catch {
    return null;
  }
}

async function probeVersion(binPath, expected) {
  const { execFile } = await import('node:child_process');
  return await new Promise((resolve) => {
    execFile(binPath, ['--version'], { timeout: 30_000, maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      const code = error ? (error.code ?? 1) : 0;
      resolve({ problem: versionProbeProblem(code, `${stdout ?? ''}${stderr ?? ''}`, expected) });
    });
  });
}

async function writeProvenance(binPath, record) {
  await writeFile(binPath + PROVENANCE_SUFFIX, `${JSON.stringify(record, null, 2)}\n`);
}

async function inspectProvisioned(binPath, spec, version) {
  const record = await readProvenance(binPath);
  const binary = await inspectBinary(binPath);
  const probe = binary ? await probeVersion(binPath, version) : null;
  const snapshot = {
    expected: { version, assetSha256: spec.sha256 },
    record,
    binary,
    probe,
  };
  return { ...snapshot, problem: provisionedProblem(snapshot) };
}

async function provision(binPath, targetDir, spec, version, source) {
  const url = releaseUrl(version, spec.asset);
  console.log(`[yt-dlp] downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed ${response.status} for ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const problem = assetProblem(bytes, spec);
  if (problem) throw new Error(`refusing ${spec.asset}: ${problem}`);
  await mkdir(targetDir, { recursive: true });
  await writeFile(binPath, bytes);
  if (process.platform !== 'win32') await chmod(binPath, 0o755);
  const binary = await inspectBinary(binPath);
  if (!binary) throw new Error(`yt-dlp missing after provisioning: ${binPath}`);
  await writeProvenance(binPath, {
    version,
    platform: platformKey(),
    source,
    asset: spec.asset,
    assetSha256: spec.sha256,
    binaryBytes: binary.bytes,
    binarySha256: binary.sha256,
    recordedAt: new Date().toISOString(),
  });
}

async function fetchLatest() {
  const response = await fetch(API_LATEST, { headers: { accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`release lookup failed ${response.status}`);
  return pinsFromRelease(await response.json());
}

async function main() {
  const update = process.argv.includes('--update');
  let version = VERSION;
  let platforms = PLATFORMS;
  if (update) {
    const latest = await fetchLatest();
    if (latest.version !== VERSION) {
      await writeFile(SELF, rewritePins(await readFile(SELF, 'utf8'), latest));
      console.log(`[yt-dlp] pin moved ${VERSION} -> ${latest.version}`);
    } else {
      console.log(`[yt-dlp] pin is already current (${VERSION})`);
    }
    version = latest.version;
    platforms = latest.platforms;
  }
  const key = platformKey();
  const spec = platforms[key];
  if (!spec) throw new Error(`unsupported platform ${key}`);
  const targetDir = join(OUT_DIR, key);
  const binPath = join(targetDir, spec.executable);
  const override = process.env.OPENCHATCUT_YTDLP;

  if (override) {
    console.log(`[yt-dlp] using override ${override}`);
    await mkdir(targetDir, { recursive: true });
    const bytes = await readFile(override);
    await writeFile(binPath, bytes);
    if (process.platform !== 'win32') await chmod(binPath, 0o755);
    const binary = await inspectBinary(binPath);
    if (!binary) throw new Error(`override ${override} is not a file`);
    await writeProvenance(binPath, {
      version: null,
      platform: key,
      source: 'override',
      overridePath: override,
      assetSha256: null,
      binaryBytes: binary.bytes,
      binarySha256: binary.sha256,
      recordedAt: new Date().toISOString(),
    });
  } else if (!update) {
    const state = await inspectProvisioned(binPath, spec, version);
    if (!state.problem) {
      console.log(`[yt-dlp] ${key} verified at ${binPath}`);
      return;
    }
    console.log(`[yt-dlp] re-provisioning ${key}: ${state.problem}`);
    await provision(binPath, targetDir, spec, version, 'asset');
  } else {
    await provision(binPath, targetDir, spec, version, 'update');
  }

  const { problem } = await inspectProvisioned(binPath, spec, version);
  if (problem) {
    // Never leave unusable bytes behind with a record vouching for them.
    await rm(binPath, { force: true });
    await rm(binPath + PROVENANCE_SUFFIX, { force: true });
    throw new Error(`${binPath} failed verification after provisioning: ${problem}`);
  }
  console.log(`[yt-dlp] ${key} ready at ${binPath} (${version})`);
}

// Only provision when invoked directly, so the verify can import the pure
// helpers without hitting the network.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[yt-dlp] ${error.message}`);
    process.exitCode = 1;
  });
}
