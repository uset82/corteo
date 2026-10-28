import type { ProjectDoc, Timeline, TimelineVariant } from './types';

/** Every timeline tagged with `groupId`, in tab order. */
export function variantMembers(doc: ProjectDoc, groupId: string): Timeline[] {
  return doc.timelines
    .filter((timeline) => timeline.variant?.groupId === groupId)
    .sort((a, b) => a.order - b.order);
}

/** The user's pick inside a group, or null while nobody has chosen. */
export function chosenVariant(doc: ProjectDoc, groupId: string): Timeline | null {
  return variantMembers(doc, groupId).find((timeline) => timeline.variant?.status === 'chosen') ?? null;
}

/** Group ids in the order their first member was created; the compare dialog
 * offers the newest group first. */
export function variantGroups(doc: ProjectDoc): string[] {
  const groups: string[] = [];
  for (const timeline of [...doc.timelines].sort((a, b) => a.order - b.order)) {
    const id = timeline.variant?.groupId;
    if (id && !groups.includes(id)) groups.push(id);
  }
  return groups.reverse();
}

const ALPHABET = 'ABCDEFGHIJ';

/** Next free label in a group: A, B, C… then A2, B2… Do not reuse a label that
 * a member already carries — the model refers to versions by it. */
export function nextVariantLabel(members: readonly Pick<Timeline, 'variant'>[]): string {
  const taken = new Set(members.map((member) => member.variant?.label).filter(Boolean));
  for (const letter of ALPHABET) if (!taken.has(letter)) return letter;
  for (let round = 2; round < 10; round += 1) {
    for (const letter of ALPHABET) {
      const label = `${letter}${round}`;
      if (!taken.has(label)) return label;
    }
  }
  return `V${taken.size + 1}`;
}

/** A label the tab can show without wrapping; notes stay one line too. */
export function cleanVariantLabel(label: string | undefined, fallback: string): string {
  const text = label?.trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, 24) : fallback;
}

export function cleanVariantNote(note: string | undefined): string | undefined {
  const text = note?.trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, 160) : undefined;
}

/** What the tools return for one member. */
export function describeVariant(timeline: Timeline) {
  const variant = timeline.variant!;
  return {
    timelineId: timeline.id,
    name: timeline.name,
    label: variant.label,
    note: variant.note,
    status: variant.status,
    clips: timeline.items.length,
    durationInFrames: timeline.items.reduce((end, item) => Math.max(end, item.startFrame + item.durationInFrames), 0),
  };
}

export function isVariantStatus(value: unknown): value is TimelineVariant['status'] {
  return value === 'candidate' || value === 'chosen' || value === 'discarded';
}
