// Plan 1 Phase 4: sibling versions of a sequence. The three tools are pure data
// plus the draft's commands, so the built-in chat and the headless MCP path use
// the same executor. A version is a duplicated timeline tagged with a shared
// variant group; the source sequence is never tagged.
import type { AgentContext } from '../context';
import type { ProjectDoc, Timeline } from '../../editor/types';
import { findTimeline } from './timeline-tools';

type Args = Record<string, unknown>;

export const VARIANT_CHOICE_TIMEOUT_MS = 45_000;
export const VARIANT_CHOICE_POLL_MS = 500;

export interface VariantView {
  id: string;
  name: string;
  label: string;
  note: string;
  status: string;
  active: boolean;
}

export interface VariantChoiceReport {
  ok: true;
  groupId: string;
  variants: VariantView[];
  chosen: VariantView | null;
  waitedMs: number;
  timedOut: boolean;
}

type Group = { groupId: string; timelines: Timeline[] };
type GroupResult = Group | { error: string };
type ReportResult = VariantChoiceReport | { error: string };

export interface VariantWaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function view(timeline: Timeline, doc: ProjectDoc): VariantView {
  return {
    id: timeline.id,
    name: timeline.name,
    label: timeline.variant?.label ?? '',
    note: timeline.variant?.note ?? '',
    status: timeline.variant?.status ?? 'borrador',
    active: timeline.id === doc.activeTimelineId,
  };
}

function groupFor(doc: ProjectDoc, selector: { groupId?: unknown; timelineId?: unknown }): GroupResult {
  let groupId = typeof selector.groupId === 'string' ? selector.groupId.trim() : '';
  if (!groupId && typeof selector.timelineId === 'string' && selector.timelineId.trim()) {
    const timeline = findTimeline(doc, selector.timelineId);
    if (!timeline) return { error: `no timeline ${selector.timelineId}` };
    groupId = timeline.variant?.groupId ?? '';
    if (!groupId) return { error: `timeline ${timeline.name} is not a version` };
  }
  if (!groupId) {
    const active = doc.timelines.find((timeline) => timeline.id === doc.activeTimelineId);
    groupId = active?.variant?.groupId ?? '';
  }
  if (!groupId) return { error: 'no version group: pass groupId or timelineId' };
  const timelines = doc.timelines
    .filter((timeline) => timeline.variant?.groupId === groupId)
    .sort((a, b) => a.order - b.order);
  if (!timelines.length) return { error: `no version group ${groupId}` };
  return { groupId, timelines };
}

function reportFor(doc: ProjectDoc, group: Group): VariantChoiceReport {
  const variants = group.timelines.map((timeline) => view(timeline, doc));
  return {
    ok: true,
    groupId: group.groupId,
    variants,
    chosen: variants.find((variant) => variant.status === 'elegida') ?? null,
    waitedMs: 0,
    timedOut: false,
  };
}

/** Poll the shared draft until a version is elegida, or the (injectable) cap expires. */
export async function waitForVariantChoice(
  ctx: Pick<AgentContext, 'getDoc'>,
  selector: { groupId?: unknown; timelineId?: unknown },
  wait: boolean,
  options: VariantWaitOptions = {},
): Promise<ReportResult> {
  const initial = groupFor(ctx.getDoc(), selector);
  if ('error' in initial) return initial;
  let report = reportFor(ctx.getDoc(), initial);
  if (!wait || report.chosen) return report;

  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const timeoutMs = Math.max(0, options.timeoutMs ?? VARIANT_CHOICE_TIMEOUT_MS);
  const intervalMs = Math.max(1, options.intervalMs ?? VARIANT_CHOICE_POLL_MS);
  const started = now();
  while (true) {
    const elapsed = now() - started;
    if (elapsed >= timeoutMs) break;
    await sleep(Math.min(intervalMs, timeoutMs - elapsed));
    const doc = ctx.getDoc();
    const next = groupFor(doc, selector);
    if ('error' in next) return next;
    report = reportFor(doc, next);
    if (report.chosen) return { ...report, waitedMs: now() - started };
  }
  const doc = ctx.getDoc();
  const finalGroup = groupFor(doc, selector);
  if ('error' in finalGroup) return finalGroup;
  return { ...reportFor(doc, finalGroup), waitedMs: now() - started, timedOut: true };
}

function availableTimelines(doc: ProjectDoc) {
  return doc.timelines.map((timeline) => ({ id: timeline.id, name: timeline.name }));
}

function parseVariants(args: Args): { error: string } | { labels: string[]; notes: string[] } {
  if (!Array.isArray(args.labels) || args.labels.length < 2 || args.labels.length > 4) {
    const count = Array.isArray(args.labels) ? args.labels.length : 0;
    return { error: `create_variants needs 2 to 4 labels (one per version); got ${count}` };
  }
  if (args.labels.some((label) => typeof label !== 'string' || !label.trim())) {
    return { error: 'every label must be a non-empty string' };
  }
  const labels = args.labels.map((label) => (label as string).trim());
  if (new Set(labels).size !== labels.length) return { error: 'version labels must be unique' };
  const rawNotes = args.notes;
  if (rawNotes !== undefined && !Array.isArray(rawNotes)) return { error: 'notes must be an array of strings' };
  const notes = Array.isArray(rawNotes) ? rawNotes.map((note) => (typeof note === 'string' ? note.trim() : '')) : [];
  if (notes.length > labels.length) return { error: 'notes has more entries than labels' };
  return {
    labels,
    notes: labels.map((_, index) => notes[index] ?? ''),
  };
}

export async function execVariantTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name === 'create_variants') {
    const parsed = parseVariants(args);
    if ('error' in parsed) return parsed;
    const doc = ctx.getDoc();
    const source = findTimeline(doc, args.timelineId ?? doc.activeTimelineId);
    if (!source) return { error: `no timeline ${String(args.timelineId ?? doc.activeTimelineId)}`, available: availableTimelines(doc) };
    const { groupId, ids } = ctx.commands.createVariants(source.id, parsed.labels.map((label, index) => ({
      label,
      note: parsed.notes[index] ?? '',
    })));
    const after = ctx.getDoc();
    return {
      ok: true,
      groupId,
      source: { id: source.id, name: source.name },
      variants: ids.map((id) => {
        const timeline = after.timelines.find((row) => row.id === id);
        return timeline ? view(timeline, after) : { id };
      }),
    };
  }

  if (name === 'choose_variant') {
    const doc = ctx.getDoc();
    const timeline = findTimeline(doc, args.timelineId);
    if (!timeline) return { error: `no timeline ${String(args.timelineId)}`, available: availableTimelines(doc) };
    if (!timeline.variant) return { error: `timeline ${timeline.name} is not a version; create_variants first` };
    const result = ctx.commands.chooseVariant(timeline.id);
    if (!result.ok) return { error: result.error ?? 'could not choose the version' };
    const report = await waitForVariantChoice(ctx, { groupId: result.groupId ?? timeline.variant.groupId }, false);
    return 'error' in report ? report : { ...report, changed: result.changed };
  }

  if (name === 'get_variant_choice') {
    return waitForVariantChoice(ctx, {
      groupId: args.groupId,
      timelineId: args.timelineId,
    }, args.wait === true);
  }

  return { error: `unknown tool ${name}` };
}
