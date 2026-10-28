import type { AgentToolSchema } from '../../tool-schema';

export const DUPLICATE_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'find_duplicate_media',
    description:
      'Find duplicate media in the project: exact copies by SHA-256 content hash and visually near-identical assets compared by 64-bit dHash frames sampled at 10%, 50% and 90% of each clip. Also reports media source ranges reused on the active timeline. Read-only: it returns groups and occurrence ids. Removing a duplicate is the user\'s call — use the media pool UI, or remove_item for one explicit clip.',
    input_schema: {
      type: 'object',
      properties: {
        threshold: {
          type: 'integer',
          minimum: 0,
          maximum: 32,
          description: 'Maximum 64-bit dHash Hamming distance for a visual match. Defaults to 10.',
        },
      },
    },
  },
];

export const DUPLICATE_TOOL_NAMES = new Set(DUPLICATE_TOOL_SCHEMAS.map((tool) => tool.name));
