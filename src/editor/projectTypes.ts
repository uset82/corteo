import type { CURRENT_PROJECT_VERSION } from '../../shared/project-version.js';
import type { BrandKit } from '../brand/kit.js';
import type { DesignStyle } from './designTypes.js';
import type { MediaAsset, MediaFolder } from './mediaTypes.js';
import type { Timeline } from './timelineTypes.js';

/** a project = shared media + ordered timelines + which one is active
 * (manage_timelines). `version` makes persisted-document migrations explicit. */
export interface ProjectDoc {
  version: typeof CURRENT_PROJECT_VERSION;
  /** project-wide media pool, shared by every timeline */
  assets: MediaAsset[];
  mediaFolders: MediaFolder[];
  timelines: Timeline[];
  activeTimelineId: string;
  /** applied brand identity (manage_design_style); absent = no style set */
  designStyle?: DesignStyle;
  /** Plan 5 brand kit (per-channel captions, logo, palette). Absent = the defaults in
   * `src/brand/kit.ts` apply. Never rewritten on load: docs saved before this field
   * existed simply read as the defaults. */
  brandKit?: BrandKit;
}

/** the active timeline of a project (falls back to the first if the id is stale). */
export function activeTimeline(doc: ProjectDoc): Timeline {
  return doc.timelines.find((t) => t.id === doc.activeTimelineId) ?? doc.timelines[0];
}

/** active editor view with the project's shared assets attached for existing
 * timeline consumers. The returned `assets` field is derived, never persisted
 * inside a timeline. */
export function activeEditorState(doc: ProjectDoc): Timeline {
  return { ...activeTimeline(doc), assets: doc.assets };
}
