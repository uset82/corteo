import type { AgentToolSchema } from '../../tool-schema';

export const CATALOG_SEARCH_TOOL_SCHEMAS: AgentToolSchema[] = [
  {
    name: 'search_catalog',
    description:
      'Search every project for a scene or a phrase, the way a person remembers it. '
      + 'The phrase is first rewritten into the words an editor would have written (free local model), then the existing '
      + 'full-text index over chats, captions and transcripts of every project is queried with all of them, and hits are '
      + 'merged and ranked by how many terms matched. Read-only. '
      + 'Use when the user says "¿dónde explico el estribillo?", "find the project where I talk about the chorus", '
      + '"which clip mentions the price". Without a model it still searches the literal phrase. '
      + 'This is recall over words the project already contains; it does not understand a picture.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the user remembers, in their words (a phrase, not keywords).' },
        projectId: { type: 'string', description: 'Optional: restrict to one project.' },
        limit: { type: 'number', description: 'Max hits to return. Default 12, max 40.' },
      },
      required: ['query'],
    },
  },
];

export const CATALOG_SEARCH_TOOL_NAMES = new Set(CATALOG_SEARCH_TOOL_SCHEMAS.map((t) => t.name));
