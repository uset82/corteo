import type { AgentToolSchema } from '../../tool-schema';

export const VARIANT_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'create_variants',
    description: [
      'Make 2-4 versions of the current sequence to compare. Each version is a full sibling copy of',
      '`timelineId` (or the active sequence), tagged with a group id and a short label, and returned',
      'with its id so later timeline tools can edit that copy only. The original sequence is left',
      'alone as the shared ancestor; the copies are what the user compares in "Comparar versiones".',
      'Write one line in `notes` per version saying what you will try in it, then edit each copy',
      'with the existing timeline-targeted tools.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        timelineId: { type: 'string', description: 'Sequence to copy. Defaults to the active one.' },
        count: { type: 'integer', minimum: 2, maximum: 4, default: 2, description: 'How many versions to make. Defaults to 2.' },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Short labels for the versions (A, B, … by default). Same length as `count`.',
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'One short note per version on what it changes, shown in the compare dialog.',
        },
        groupId: {
          type: 'string',
          description: 'Add to an existing comparison group instead of starting a new one.',
        },
      },
    },
  },
  {
    name: 'get_variant_choice',
    description: [
      'Wait for the user to pick a version from a comparison group in the "Comparar versiones" dialog.',
      'Polls in short slices (20 s max per call) and returns the chosen version, or `pending: true`',
      'with the group listing when nobody has picked yet. Call it again to keep waiting; tell the',
      'user which dialog to open if it stays pending. Read-only.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'Comparison group. Omit to use the newest group.' },
        timeoutSeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'How long this call waits. Defaults to 15 s.',
        },
      },
    },
  },
  {
    name: 'choose_variant',
    description: [
      'Record the user\'s choice for a comparison group when they say it in chat instead of the',
      'dialog: that version becomes "chosen", its siblings "discarded", and the sequence becomes',
      'active. Optionally rewrite the chosen version\'s note. One undo step.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'Comparison group. Omit to use the newest group.' },
        timelineId: { type: 'string', description: 'The version to keep.' },
        label: { type: 'string', description: 'The version to keep, by label, when no timelineId is given.' },
        note: { type: 'string', description: 'Optional replacement note for the chosen version.' },
      },
    },
  },
];

export const VARIANT_TOOL_NAMES = new Set(VARIANT_TOOL_SCHEMAS.map((tool) => tool.name));
