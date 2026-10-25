import type { AgentToolSchema } from '../../tool-schema';

export const BRAND_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'apply_brand_kit',
    description:
      'Apply the project\u2019s brand kit to finished clips so a batch looks like one channel: the caption preset, and '
      + 'optionally the caption motion, on every target sequence. Read the kit from the project by default, or pass one '
      + 'inline (it is normalized first). With save:true it also becomes the project\u2019s kit, which is the same value '
      + 'make_shorts reads through brandKitId. '
      + 'Use when the user says "aplica la marca", "pon el mismo estilo a todos los clips", or as the packaging step after '
      + 'make_shorts. One call, and the active sequence is restored when it finishes. '
      + 'Not wired yet: the logo/watermark and the palette, which belong to update_watermark and manage_design_style \u2014 '
      + 'this tool says so in its result instead of pretending it applied them.',
    input_schema: {
      type: 'object',
      properties: {
        kit: {
          type: 'object',
          description: 'Brand kit to apply. Omit to use the project\u2019s own kit (or the defaults if it has none).',
        },
        scope: {
          type: 'string',
          enum: ['all', 'active'],
          description: 'all (default) applies to every sequence in the project; active only to the current one.',
        },
        save: {
          type: 'boolean',
          description: 'true stores this kit on the project (one undo step), so later calls and make_shorts reuse it.',
        },
      },
    },
  },
];

export const BRAND_TOOL_NAMES = new Set(BRAND_TOOL_SCHEMAS.map((t) => t.name));
