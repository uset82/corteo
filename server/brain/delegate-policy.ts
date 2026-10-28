import Ajv, { type ValidateFunction } from 'ajv';
import { TOOL_SCHEMAS } from '../../src/agent/tools.ts';

const aliases = ['corteo-edit', 'corteo-draft', 'corteo-fast'];
const kinds = ['storyboard', 'social_copy', 'score_reasons', 'tool_args', 'lyric_cards'];
const tools = ['split_item', 'edit_item', 'write_clip_title', 'write_social_copy'];

export type DelegateError = { ok: false; error: string; message: string };
export function rejected(error: string, message: string): DelegateError {
  return { ok: false, error, message };
}

function projectShape(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(projectShape);
  const object = value as Record<string, unknown>;
  return Array.isArray(object.timelines) || ('items' in object && 'tracks' in object)
    || Object.values(object).some(projectShape);
}

export function checkDraft(args: Record<string, unknown>, secrets: string[]):
  | DelegateError
  | { schema: object; validate: ValidateFunction; inputText: string } {
  if (!aliases.includes(String(args.alias))) return rejected('invalid_alias', 'Unknown model alias.');
  if (!kinds.includes(String(args.kind))) return rejected('invalid_kind', 'Unknown draft kind.');
  let inputText: string;
  let schemaText: string;
  try {
    inputText = JSON.stringify(args.input);
    schemaText = JSON.stringify(args.schema ?? {});
    if (typeof inputText !== 'string' || typeof schemaText !== 'string') throw new Error('not JSON');
  } catch {
    return rejected('invalid_schema', 'Input and schema must be JSON values.');
  }
  if (inputText.length > 12000) return rejected('input_too_large', 'Input exceeds 12,000 characters.');
  if (schemaText.length > 4000) return rejected('schema_too_large', 'Schema exceeds 4,000 characters.');
  if ([...secrets, 'OPENCHATCUT_MCP_TOKEN'].some((secret) => secret && (inputText.includes(secret) || schemaText.includes(secret)))) {
    return rejected('secret_in_input', 'Input or schema contains a secret.');
  }
  if (projectShape(args.input) || projectShape(args.schema)) return rejected('project_json_not_allowed', 'Do not send project JSON.');
  let schema: unknown = args.schema ?? {};
  if (args.kind === 'tool_args') {
    if (typeof args.tool !== 'string' || !args.tool) return rejected('tool_required', 'A target tool is required.');
    if (!tools.includes(args.tool)) return rejected('tool_not_allowed', 'This tool cannot be delegated.');
    if (args.alias !== 'corteo-edit') return rejected('alias_not_allowed', 'Tool arguments require corteo-edit.');
    schema = TOOL_SCHEMAS.find((tool) => tool.name === args.tool)?.input_schema;
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return rejected('invalid_schema', 'Schema must be an object.');
  try {
    const validate = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true }).compile(schema);
    return { schema, validate, inputText };
  } catch {
    return rejected('invalid_schema', 'The JSON schema could not be compiled.');
  }
}

export function textAddsOnly(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return Object.keys(object).every((key) => key === 'adds') && Array.isArray(object.adds)
    && object.adds.length > 0 && object.adds.every((entry: unknown) =>
      !!entry && typeof entry === 'object' && (entry as Record<string, unknown>).type === 'text');
}
