// Pinned yt-dlp provisioning (P3-1). Downloads one upstream release asset for
// this platform into vendor/yt-dlp/<platform>/, verifies the pinned size and
// SHA-256 BEFORE installing it, and treats a second run as a no-op. A newer
// upstream release is adopted only by editing VERSION and the pins together.
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const VERSION = '2026.10.26';
const BASE = `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}`;

// Generated from GitHub's release API for VERSION; both the size and the digest
// are part of the pin, so a truncated or swapped download never reaches vendor/.
export const PLATFORMS = {
  'linux-x64': {
    asset: 'yt-dlp', bytes: 3_073_072, executable: 'yt-dlp',
    sha256: 'e51e69e89489f199530f13d32a4342da3ddb2cf34842f364603a066db05afbf3',
  },
  'linux-arm64': {
    asset: 'yt-dlp', bytes: 3_073_072, executable: 'yt-dlp',
    sha256: 'e51e69e89489f199530f13d32a4342da3ddb2cf34842f364603a066db05afbf3',
  },
  'win32-x64': {
    asset: 'yt-dlp.exe', bytes: 23_575_744, executable: 'yt-dlp.exe',
    sha256: 'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d',
  },
  'darwin-arm64': {
    asset: 'yt-dlp_macos', bytes: 37_466_304, executable: 'yt-dlp',
    sha256: '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa',
  },
  'darwin-x64': {
    asset: 'yt-dlp_macos', bytes: 37_466_304, executable: 'yt-dlp',
    sha256: '0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa',
  },
};

export const platformKey = (platform = process.platform, arch = process.arch) => `${platform}-${arch}`;
export const vendorRoot = (root = ROOT) => join(root, 'vendor', 'yt-dlp');

export function binaryPath(platform, spec, root = ROOT) {
  if (!spec) throw new Error(`unsupported platform ${platform}`);
  return join(vendorRoot(root), platform, spec.executable);
}

export const provenancePath = (binary) => `${binary}.provenance.json`;

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Return the reason bytes do not match the pin, or null when they do. */
export function assetProblem(bytes, spec) {
  if (bytes.length !== spec.bytes) {
    return `downloaded ${bytes.length} bytes, pinned size is ${spec.bytes}`;
  }
  const digest = sha256(bytes);
  return digest === spec.sha256 ? null : `sha256 ${digest} does not match the pinned ${spec.sha256}`;
}

export function provenanceProblem(provenance, spec) {
  if (!provenance || typeof provenance !== 'object') return 'provenance is missing';
  if (provenance.version !== VERSION) return `provenance version is ${String(provenance.version)}, pinned is ${VERSION}`;
  if (provenance.asset !== spec.asset) return `provenance asset is ${String(provenance.asset)}, pinned is ${spec.asset}`;
  if (provenance.sha256 !== spec.sha256) return 'provenance sha256 does not match the pin';
  if (provenance.bytes !== spec.bytes) return 'provenance size does not match the pin';
  return null;
}

async function fileProblem(binary, spec) {
  if (!existsSync(binary)) return 'missing';
  return assetProblem(await readFile(binary), spec);
}

async function writeProvenance(binary, spec) {
  await writeFile(provenancePath(binary), JSON.stringify({
    version: VERSION, asset: spec.asset, bytes: spec.bytes, sha256: spec.sha256,
  }, null, 2));
}

async function readProvenance(binary) {
  try {
    return JSON.parse(await readFile(provenancePath(binary), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Ensure the pinned binary exists and matches. `spec`/`binary` are injectable so
 * the regression can exercise the checksum and no-op paths without a network.
 * `check: true` never downloads; it only reports whether the pin is satisfied.
 */
export async function provision({
  platform = platformKey(),
  root = ROOT,
  spec = PLATFORMS[platform],
  binary = spec ? binaryPath(platform, spec, root) : '',
  fetchImpl = fetch,
  check = false,
} = {}) {
  if (!spec) return { ok: false, skipped: true, reason: `unsupported platform ${platform}` };
  const problem = await fileProblem(binary, spec);
  if (!problem) {
    if (provenanceProblem(await readProvenance(binary), spec)) await writeProvenance(binary, spec);
    return { ok: true, path: binary, provisioned: true };
  }
  if (check) return { ok: false, path: binary, reason: problem };

  const url = `${BASE}/${spec.asset}`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`download failed ${response.status} for ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const mismatch = assetProblem(bytes, spec);
  if (mismatch) throw new Error(`${spec.asset} failed verification: ${mismatch}`);
  await mkdir(dirname(binary), { recursive: true });
  const temp = `${binary}.download-${process.pid}`;
  try {
    await writeFile(temp, bytes);
    await chmod(temp, 0o755);
    await rename(temp, binary);
    await writeProvenance(binary, spec);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
  return { ok: true, path: binary, provisioned: false };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const explicit = args.find((arg) => arg.startsWith('--platform='))?.slice('--platform='.length);
  const platform = explicit || platformKey();
  const spec = PLATFORMS[platform];
  if (!spec) {
    console.warn(`[yt-dlp] no pinned binary for ${platform}; platform import will be unavailable`);
    process.exit(check ? 1 : 0);
  }
  try {
    const result = await provision({ platform, check });
    if (!result.ok) {
      console.error(`[yt-dlp] ${result.reason} (${result.path})`);
      process.exit(1);
    }
    console.log(result.provisioned
      ? `[yt-dlp] ${VERSION} already provisioned at ${result.path}`
      : `[yt-dlp] ${VERSION} installed at ${result.path}`);
  } catch (error) {
    console.error(`[yt-dlp] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
