import type { AgentToolSchema } from '../../tool-schema';

export const VARIANT_PREVIEW_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'render_variant_previews',
    description:
      'Render fresh 480p H.264 previews of every version in a variant group on the server, and return playable URLs with each version\'s label, note and status. Real operation: writes preview files and can take a while, so call it after the versions are edited and before presenting them. Re-rendering replaces the previous previews.',
    input_schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'Variant group id returned by create_variants.' },
        timelineId: { type: 'string', description: 'Any timeline in the group (prefix/name ok); when neither is given, the active sequence\'s group is used.' },
      },
    },
  },
];

export const VARIANT_PREVIEW_TOOL_NAMES = new Set(VARIANT_PREVIEW_TOOL_SCHEMAS.map((tool) => tool.name));
