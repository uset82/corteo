import type { MediaAsset, TimelineItem } from '../editor/types';

export interface DuplicatePayloadAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly src: string;
  readonly contentHash?: string;
  readonly durationSeconds: number;
}

export interface DuplicatePayloadItem {
  readonly id: string;
  readonly assetId: string;
  readonly name: string;
  readonly startFrame: number;
  readonly srcInFrame: number;
  readonly durationInFrames: number;
}

export interface DuplicatePayload {
  readonly assets: DuplicatePayloadAsset[];
  readonly items: DuplicatePayloadItem[];
  readonly fps: number;
}

const VISUAL_ITEM_KINDS = new Set(['video', 'image', 'gif', 'svg']);

/** The dialog, the route and the headless tool read the project in the same shape. */
export function duplicatePayloadFrom(
  sourceAssets: readonly MediaAsset[],
  sourceItems: readonly TimelineItem[],
  sourceFps: number,
): DuplicatePayload {
  const fps = Number.isFinite(sourceFps) && sourceFps > 0 ? sourceFps : 30;
  const assets = sourceAssets
    .filter((asset) => typeof asset.src === 'string' && asset.src.startsWith('/media/uploads/'))
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      src: asset.src,
      ...(asset.sourceContentHash ? { contentHash: asset.sourceContentHash } : {}),
      durationSeconds: asset.durationInFrames / fps,
    }));
  const idBySrc = new Map(assets.map((asset) => [asset.src, asset.id]));
  const items = sourceItems.flatMap((item) => {
    if (!VISUAL_ITEM_KINDS.has(item.kind)) return [];
    const assetId = item.sourceAssetId ?? (item.src ? idBySrc.get(item.src) : undefined);
    if (!assetId) return [];
    return [{
      id: item.id,
      assetId,
      name: item.name,
      startFrame: item.startFrame,
      srcInFrame: item.srcInFrame ?? 0,
      durationInFrames: item.durationInFrames,
    }];
  });
  return { assets, items, fps };
}
