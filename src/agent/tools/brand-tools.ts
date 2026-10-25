export { BRAND_TOOL_SCHEMAS, BRAND_TOOL_NAMES } from './schemas/brand-tools';
import type { AgentContext } from '../context';
import { brandKitOf, normalizeBrandKit } from '../../brand/kit';
import { execCaptionsTool } from './captions-tools';

// apply_brand_kit — Plan 5, OP-10 step 3b.
//
// A kit is only worth having if applying it is one action. This composes what already exists
// (`edit_captions` for the preset and the motion) rather than adding a renderer path. The
// watermark and the palette are deliberately not touched here: they belong to
// `update_watermark` and `manage_design_style`, whose arguments have their own contracts, and
// this tool reports that instead of silently skipping it.

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === 'object' ? value as Record<string, unknown> : {});

type Args = Record<string, unknown>;

interface Applied {
  timelineId: string;
  captions: 'applied' | 'failed';
  motion: 'applied' | 'skipped' | 'failed';
}

export async function execBrandTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'apply_brand_kit') return { error: `unknown tool ${name}` };

  const doc = ctx.getDoc();
  if (!doc.timelines.length) return { error: 'El proyecto no tiene ninguna secuencia.' };

  const inlineKit = args.kit && typeof args.kit === 'object' ? args.kit : null;
  const kit = inlineKit ? normalizeBrandKit(inlineKit) : brandKitOf(doc);
  const scope = args.scope === 'active' ? 'active' : 'all';

  if (args.save === true) ctx.commands.setBrandKit(kit);

  const originalActiveId = ctx.getDoc().activeTimelineId;
  const targets = scope === 'active'
    ? [originalActiveId]
    : ctx.getDoc().timelines.map((timeline) => timeline.id);

  const applied: Applied[] = [];
  for (const timelineId of targets) {
    ctx.commands.switchTimeline(timelineId);
    let captions: Applied['captions'] = 'failed';
    let motion: Applied['motion'] = kit.captionMotion ? 'failed' : 'skipped';
    try {
      const template = asRecord(await execCaptionsTool('edit_captions', {
        action: 'template',
        templatePreset: kit.captionPreset,
      }, ctx));
      if (template.error === undefined) {
        captions = 'applied';
        if (kit.captionMotion) {
          const animation = asRecord(await execCaptionsTool('edit_captions', {
            action: 'animation',
            motionPreset: kit.captionMotion,
          }, ctx));
          motion = animation.error === undefined ? 'applied' : 'failed';
        }
      }
    } catch {
      captions = 'failed';
    }
    applied.push({ timelineId, captions, motion });
  }
  ctx.commands.switchTimeline(originalActiveId);

  const okCount = applied.filter((entry) => entry.captions === 'applied').length;
  return {
    ok: true,
    kit,
    saved: args.save === true,
    scope,
    applied,
    note: okCount === applied.length
      ? `Marca aplicada a ${applied.length} secuencia(s): subtítulos «${kit.captionPreset}».`
      : `Marca aplicada a ${okCount} de ${applied.length} secuencia(s). Revisa las que fallaron (puede que no tengan subtítulos).`,
    notApplied: ['watermark', 'palette'],
    notAppliedNote: 'El logo y la paleta todavía no se aplican desde aquí: usa update_watermark y manage_design_style.',
  };
}
