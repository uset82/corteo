import type { AgentContext } from '../context';
import type { MediaAsset, TimelineItem } from '../../editor/types';

export type Args = Record<string, unknown>;

export interface ResolvedMusicTarget {
  readonly asset: MediaAsset;
  readonly item?: TimelineItem;
}

export function resolvePrefix<T extends { readonly id: string }>(
  values: readonly T[],
  query: string,
  label: string,
): T {
  const displayQuery = query.slice(0, 80);
  const exact = values.find((value) => value.id === query);
  if (exact) return exact;
  const matches = values.filter((value) => value.id.startsWith(query));
  if (matches.length === 1 && matches[0]) return matches[0];
  if (matches.length > 1) throw new Error(`${label} id prefix ${displayQuery} is ambiguous`);
  throw new Error(`no ${label} ${displayQuery}`);
}

function resolveAssetForItem(item: TimelineItem, assets: readonly MediaAsset[]): MediaAsset {
  if (item.sourceAssetId) {
    const byId = assets.find((asset) => asset.id === item.sourceAssetId);
    if (byId) return byId;
  }
  if (item.src) {
    const bySource = assets.filter((asset) => asset.src === item.src);
    if (bySource.length === 1 && bySource[0]) return bySource[0];
  }
  throw new Error(`clip ${item.id} is not linked to a unique media-pool asset; relink it before music analysis`);
}

/** Shared by the browser tools and the headless MCP/CLI runner. */
export function resolveMusicTarget(args: Args, ctx: AgentContext): ResolvedMusicTarget {
  const assetQuery = typeof args.assetId === 'string' ? args.assetId.trim() : '';
  const itemQuery = typeof args.itemId === 'string' ? args.itemId.trim() : '';
  if (assetQuery && itemQuery) throw new Error('pass assetId or itemId, not both');
  if (itemQuery) {
    const item = resolvePrefix(ctx.getState().items, itemQuery, 'timeline item');
    if (item.kind !== 'audio' && item.kind !== 'video') {
      throw new Error(`clip ${item.id} is ${item.kind}; music analysis requires an audio/video clip`);
    }
    return { item, asset: resolveAssetForItem(item, ctx.getDoc().assets) };
  }
  if (assetQuery) {
    const asset = resolvePrefix(ctx.getDoc().assets, assetQuery, 'media-pool asset');
    if (asset.kind !== 'audio' && asset.kind !== 'video') {
      throw new Error(`asset ${asset.id} is ${asset.kind}; music analysis requires audio/video media`);
    }
    return { asset };
  }
  throw new Error('pass assetId (media pool) or itemId (timeline clip)');
}
