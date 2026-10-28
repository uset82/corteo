import type { AgentContext } from '../src/agent/context.ts';
import { duplicatePayloadFrom } from '../src/media/duplicatePayload.ts';
import { analyzeMediaDuplicates, resolveUploadAssetPath } from './media-duplicates.ts';

/** Headless find_duplicate_media: resolve uploads and run the same analysis as the route. */
export async function findDuplicateMediaForContext(
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<unknown> {
  const state = ctx.getState();
  const payload = duplicatePayloadFrom(ctx.getDoc().assets, state.items, state.fps);
  const assets = payload.assets.flatMap((asset) => {
    const path = resolveUploadAssetPath(asset.src);
    return path
      ? [{
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        path,
        ...(asset.contentHash ? { contentHash: asset.contentHash } : {}),
        durationSeconds: asset.durationSeconds,
      }]
      : [];
  });
  return analyzeMediaDuplicates(assets, payload.items, {
    includeThumbnails: false,
    ...(typeof args.threshold === 'number' ? { threshold: args.threshold } : {}),
  });
}
