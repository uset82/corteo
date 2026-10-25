import { providersOffEnv } from '../../shared/providers-off.ts';
import { PROVIDERS_OFF } from './providers-off.ts';
import { TOOL_SCHEMAS } from './tools.js';
import { validateAgentToolInvocation } from './execution-policy.js';
import { ExternalEditSessionOutcomeError } from './external-edit-session.js';
import type { AgentToolSchema } from './tool-schema.js';
import { isExternalDraftTool } from './external-tool-policy.js';
import {
  EXTERNAL_SESSION_TOOLS,
  externalDraftSchemas,
  externalGlobalReadSchemas,
  externalRealSchemas,
  type ExternalRegisteredTool,
} from './external-tool-shape.js';

function withoutEditSessionId(schema: AgentToolSchema): AgentToolSchema {
  const properties = { ...(schema.input_schema.properties ?? {}) };
  delete properties.editSessionId;
  return {
    ...schema,
    input_schema: {
      ...schema.input_schema,
      properties,
      required: schema.input_schema.required?.filter((name) => name !== 'editSessionId'),
    },
  };
}

/** Paid generation and stock search. Hidden from MCP when providers are off. */
export const PROVIDERS_OFF_HIDDEN_TOOLS = new Set([
  'submit_image', 'submit_voice', 'submit_sound', 'submit_music', 'submit_video',
  'generate_image', 'generate_video', 'generate_music', 'generate_voice', 'generate_sound',
  'submit_image_generation', 'submit_video_generation', 'submit_music_generation',
  'submit_sound_generation', 'submit_voice_generation',
  'rerun_generation',
  'search_stock_media',
]);

/** MCP-facing catalog: stateless reads, lifecycle controls, then session-bound editor tools. */
export function externalToolSchemas(): ExternalRegisteredTool[] {
  // This module reaches the browser bundle (through the editor bridge), where
  // `process` does not exist: the build-time define covers that path, and the
  // env read stays for tsx/server callers.
  const off = PROVIDERS_OFF
    || (typeof process !== 'undefined' && providersOffEnv(process.env));
  const visible = off
    ? TOOL_SCHEMAS.filter((tool) => !PROVIDERS_OFF_HIDDEN_TOOLS.has(tool.name))
    : TOOL_SCHEMAS;
  const globalReadTools = externalGlobalReadSchemas(visible);
  const editorTools = externalDraftSchemas(
    visible.filter((tool) => isExternalDraftTool(tool.name)),
  );
  const realTools = externalRealSchemas(visible);
  const sessionTools = EXTERNAL_SESSION_TOOLS.filter((tool) => !PROVIDERS_OFF_HIDDEN_TOOLS.has(tool.name));
  return [...globalReadTools, ...sessionTools, ...editorTools, ...realTools];
}

const EXTERNAL_ACTIVE_CATALOG = externalToolSchemas().map(withoutEditSessionId);

export function validateExternalInvocation(
  name: string,
  rawArgs: Record<string, unknown>,
): Record<string, unknown> {
  const args = { ...rawArgs };
  delete args.editSessionId;
  const schema = EXTERNAL_ACTIVE_CATALOG.find((candidate) => candidate.name === name)
    ?? { name, input_schema: { type: 'object' } as const };
  const validation = validateAgentToolInvocation(schema, args, EXTERNAL_ACTIVE_CATALOG);
  if (!validation.ok) {
    throw new ExternalEditSessionOutcomeError('rejected', validation.error);
  }
  return validation.args;
}

export type { ExternalRegisteredTool } from './external-tool-shape.js';
