// Local model-pack discovery for the headless music runner. The install route
// (server/plugins/model-packs.ts) already SHA-256-verifies every file before it
// publishes a pack, so this module only re-checks presence and byte size on
// each run: hashing 83 MB per analyze_music call would dominate its latency.
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { modelPackDefinition, type ModelPackDefinition } from '../../shared/model-packs/catalog.ts';
import { modelCachePath } from '../../shared/model-cache-path.ts';
import { RHYTHM_INFERENCE_CONTRACT } from '../../shared/vector-inference-contract.ts';

export const MUSIC_PACK_IDS = ['rhythm-lite', 'music-semantics-lite'] as const;
export type MusicPackId = typeof MUSIC_PACK_IDS[number];

export interface MusicPackFiles {
  readonly cacheDir: string;
  readonly rhythmModelPath: string;
  readonly rhythmFilterbankPath: string;
}

export interface MusicPackStatus {
  readonly installed: boolean;
  readonly missing: ReadonlyArray<{ readonly id: MusicPackId; readonly status: 'absent' }>;
  /** Present only when both packs are installed. */
  readonly files?: MusicPackFiles;
}

export function musicCacheDir(): string {
  return modelCachePath(homedir());
}

function packDefinition(id: MusicPackId): ModelPackDefinition {
  const pack = modelPackDefinition(id);
  if (!pack) throw new Error(`unknown model pack ${id}`);
  return pack;
}

async function packFilesPresent(pack: ModelPackDefinition, cacheDir: string): Promise<boolean> {
  for (const file of pack.files) {
    const info = await stat(join(cacheDir, pack.modelId, file.path)).catch(() => null);
    if (!info?.isFile() || info.size !== file.sizeBytes) return false;
  }
  return true;
}

/** Same two packs and byte-size checks the model-pack catalog reports as installed. */
export async function inspectMusicPacks(cacheDir: string = musicCacheDir()): Promise<MusicPackStatus> {
  const missing: Array<{ id: MusicPackId; status: 'absent' }> = [];
  for (const id of MUSIC_PACK_IDS) {
    if (!await packFilesPresent(packDefinition(id), cacheDir)) missing.push({ id, status: 'absent' });
  }
  if (missing.length) return { installed: false, missing };
  const rhythmRoot = join(cacheDir, packDefinition('rhythm-lite').modelId);
  return {
    installed: true,
    missing: [],
    files: {
      cacheDir,
      rhythmModelPath: join(rhythmRoot, RHYTHM_INFERENCE_CONTRACT.files.model.path),
      rhythmFilterbankPath: join(rhythmRoot, RHYTHM_INFERENCE_CONTRACT.files.filterbank.path),
    },
  };
}
