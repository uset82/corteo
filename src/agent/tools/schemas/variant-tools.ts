import type { AgentToolSchema } from '../../tool-schema';

export const VARIANT_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'create_variants',
    description:
      'Create 2 to 4 sibling versions of a sequence so they can be compared. Each copy shares a variant group and carries its own label, note and status "borrador"; the returned timeline ids are the handles for editing each version with the existing timeline-targeted tools. The source sequence is unchanged and stays active.',
    input_schema: {
      type: 'object',
      properties: {
        timelineId: { type: 'string', description: 'Source sequence id (prefix/name ok). Defaults to the active sequence.' },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'One short label per version (2 to 4, unique). Each label becomes the version sequence name and variant label.',
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional note per version, same order as labels; missing notes become empty strings.',
        },
      },
      required: ['labels'],
    },
  },
  {
    name: 'choose_variant',
    description:
      'Record the version the user chose: make that sequence active, mark it "elegida" and every sibling in its group "descartada", as one undo step. Use only after the user answers; do not choose on their behalf.',
    input_schema: {
      type: 'object',
      properties: {
        timelineId: { type: 'string', description: 'Chosen version timeline id (prefix/name ok).' },
      },
      required: ['timelineId'],
    },
  },
  {
    name: 'get_variant_choice',
    description:
      'Read a variant group: labels, notes, statuses and which version is chosen/active. With wait:true, long-poll up to 45 seconds for a version to be marked elegida, then return the current state. Read-only.',
    input_schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'Variant group id returned by create_variants.' },
        timelineId: { type: 'string', description: 'Any timeline in the group (prefix/name ok); when neither is given, the active sequence\'s group is used.' },
        wait: { type: 'boolean', description: 'true waits up to 45 s for a version to be marked elegida.' },
      },
    },
  },
];

export const VARIANT_TOOL_NAMES = new Set(VARIANT_TOOL_SCHEMAS.map((tool) => tool.name));
