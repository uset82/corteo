import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const MCP_CONTROL_TOOLS: Tool[] = [
  {
    name: 'delegate',
    description: "Ask corteo's free-model brain for one bounded draft (storyboard, social copy, score reasons, tool arguments, lyric cards). Returns JSON that matches your schema plus the lane and latency, or brain_unavailable. It never edits, renders or publishes: apply the result yourself with a real tool.",
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        alias: { type: 'string', enum: ['corteo-edit', 'corteo-draft', 'corteo-fast'] },
        kind: { type: 'string', enum: ['storyboard', 'social_copy', 'score_reasons', 'tool_args', 'lyric_cards'] },
        tool: { type: 'string' }, schema: { type: 'object' }, input: {},
        maxTokens: { type: 'integer', minimum: 16, maximum: 4096, default: 1024 },
      },
      required: ['alias', 'kind', 'input'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'openchatcut_status',
    description: 'Show connected corteo editors, this transport session binding, and capability status.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_projects',
    description: 'List corteo projects, newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        includeDeleted: { type: 'boolean' },
        editorBaseUrl: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'create_project',
    description: 'Create an empty corteo project with one active timeline and one video track.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        compositionWidth: { type: 'number' },
        compositionHeight: { type: 'number' },
        fps: { type: 'number' },
        editorBaseUrl: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'target_project',
    description: 'Permanently bind this MCP transport to a live browser editor, or to an existing stored project through the offline fallback.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' }, editorBaseUrl: { type: 'string' } },
      required: ['projectId'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_editor_url',
    description: 'Return the corteo editor URL for this session project or an explicitly named project.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' }, editorBaseUrl: { type: 'string' } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export const MCP_CONTROL_TOOL_NAMES: Record<string, true> = Object.fromEntries(
  MCP_CONTROL_TOOLS.map((tool) => [tool.name, true]),
);
