export { VARIANT_TOOL_NAMES, VARIANT_TOOL_SCHEMAS } from './schemas/variant-tools';
import type { AgentContext } from '../context';
import type { ProjectDoc, Timeline, TimelineVariant } from '../../editor/types';
import {
  chosenVariant,
  cleanVariantLabel,
  cleanVariantNote,
  describeVariant,
  nextVariantLabel,
  variantGroups,
  variantMembers,
} from '../../editor/variants';

type Args = Record<string, unknown>;

const POLL_MS = 500;

function findTimeline(doc: ProjectDoc, ref: unknown): Timeline | null {
  const query = String(ref ?? '').trim();
  if (!query) return null;
  return doc.timelines.find((timeline) => timeline.id === query || timeline.id.startsWith(query)) ?? null;
}

/** `groupId` from the call, else the group created most recently. */
function resolveGroup(doc: ProjectDoc, raw: unknown): string | { error: string } {
  const explicit = String(raw ?? '').trim();
  if (explicit) {
    return variantMembers(doc, explicit).length ? explicit : { error: `no variant group ${explicit}` };
  }
  const newest = variantGroups(doc)[0];
  return newest ?? { error: 'no variant group yet — call create_variants first' };
}

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
}

function createVariants(args: Args, ctx: AgentContext): unknown {
  const doc = ctx.getDoc();
  const base = args.timelineId ? findTimeline(doc, args.timelineId) : findTimeline(doc, doc.activeTimelineId);
  if (!base) return { error: `no timeline ${args.timelineId ?? doc.activeTimelineId}` };

  const requested = typeof args.count === 'number' && Number.isFinite(args.count)
    ? Math.round(args.count)
    : stringList(args.labels).length || 2;
  const count = Math.min(4, Math.max(2, requested));
  const wantedLabels = stringList(args.labels).map((label) => cleanVariantLabel(label, ''));
  if (wantedLabels.length && wantedLabels.length !== count) {
    return { error: `labels has ${wantedLabels.length} entries but count is ${count}` };
  }
  if (new Set(wantedLabels).size !== wantedLabels.length) return { error: 'labels must be unique' };
  const notes = stringList(args.notes);
  const existingGroup = String(args.groupId ?? '').trim();
  if (existingGroup && !variantMembers(doc, existingGroup).length) {
    return { error: `no variant group ${existingGroup}` };
  }
  const groupId = existingGroup || `vg_${crypto.randomUUID()}`;

  const created: ReturnType<typeof describeVariant>[] = [];
  for (let index = 0; index < count; index += 1) {
    const members = variantMembers(ctx.getDoc(), groupId);
    const label = wantedLabels[index] ?? nextVariantLabel(members);
    const variant: TimelineVariant = {
      groupId,
      label,
      status: 'candidate',
      ...(cleanVariantNote(notes[index]) ? { note: cleanVariantNote(notes[index]) } : {}),
    };
    const id = ctx.commands.duplicateTimeline(base.id, {
      name: `${base.name} · ${label}`,
      activate: false,
      variant,
    });
    const copy = ctx.getDoc().timelines.find((timeline) => timeline.id === id);
    if (copy?.variant) created.push(describeVariant(copy));
  }
  return {
    ok: true,
    groupId,
    base: { timelineId: base.id, name: base.name },
    variants: created,
    next: 'Edit each copy with the timeline-targeted tools (pass its timelineId), then tell the user to compare the versions in "Comparar versiones", or call get_variant_choice to wait for their pick.',
  };
}

async function getVariantChoice(args: Args, ctx: AgentContext): Promise<unknown> {
  const doc = ctx.getDoc();
  const group = resolveGroup(doc, args.groupId);
  if (typeof group !== 'string') return group;
  const timeout = typeof args.timeoutSeconds === 'number' && Number.isFinite(args.timeoutSeconds)
    ? Math.min(45, Math.max(1, Math.round(args.timeoutSeconds)))
    : 15;
  const startedAt = Date.now();
  const deadline = startedAt + timeout * 1000;
  for (;;) {
    const current = ctx.getDoc();
    const chosen = chosenVariant(current, group);
    const members = variantMembers(current, group).map(describeVariant);
    if (chosen) return { groupId: group, chosen: describeVariant(chosen), variants: members, pending: false };
    if (Date.now() >= deadline) {
      return {
        groupId: group,
        chosen: null,
        variants: members,
        pending: true,
        waitedSeconds: Math.round((Date.now() - startedAt) / 1000),
        hint: 'Nobody has picked yet. The user chooses in the "Comparar versiones" dialog; call get_variant_choice again to keep waiting.',
      };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

function chooseVariant(args: Args, ctx: AgentContext): unknown {
  const doc = ctx.getDoc();
  const group = resolveGroup(doc, args.groupId);
  if (typeof group !== 'string') return group;
  const members = variantMembers(doc, group);
  const label = String(args.label ?? '').trim().toLowerCase();
  const target = (args.timelineId ? findTimeline(doc, args.timelineId) : null)
    ?? (label ? members.find((member) => member.variant?.label.toLowerCase() === label) ?? null : null);
  if (!target || target.variant?.groupId !== group) {
    return {
      error: `no version ${args.timelineId ?? args.label ?? '(none given)'} in group ${group}`,
      available: members.map((member) => ({ timelineId: member.id, label: member.variant!.label })),
    };
  }
  ctx.commands.chooseVariant(group, target.id, cleanVariantNote(typeof args.note === 'string' ? args.note : undefined));
  const after = ctx.getDoc().timelines.find((timeline) => timeline.id === target.id);
  return {
    ok: true,
    groupId: group,
    chosen: describeVariant(after ?? target),
    discarded: variantMembers(ctx.getDoc(), group)
      .filter((member) => member.id !== target.id)
      .map((member) => ({ timelineId: member.id, label: member.variant!.label })),
  };
}

export async function execVariantTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  try {
    if (name === 'create_variants') return createVariants(args, ctx);
    if (name === 'get_variant_choice') return await getVariantChoice(args, ctx);
    if (name === 'choose_variant') return chooseVariant(args, ctx);
    return { error: `unknown tool ${name}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
