import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mcpTokenPath } from '../mcp-token.ts';
import { checkDraft, rejected, textAddsOnly } from './delegate-policy.ts';

interface Dependencies {
  fetchImpl?: typeof fetch;
  routerUrl?: string;
  forwardKey?: string;
  secrets?: string[];
}

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; } catch { return {}; }
}

function connection(deps: Dependencies): { key: string; url: string; secrets: string[] } {
  const config = readJson(join(process.cwd(), 'config/harness.json'));
  const configHome = typeof config.home === 'string' ? config.home : '~/.corteo-harness';
  const rawHome = process.env.CORTEO_HARNESS_HOME ?? configHome;
  const home = resolve(rawHome === '~' ? homedir() : rawHome.startsWith('~/') ? join(homedir(), rawHome.slice(2)) : rawHome);
  const settings = readJson(join(home, 'our-free-model/settings.json'));
  const state = readJson(join(home, 'brain.json'));
  const brain = config.brain as Record<string, unknown> | undefined;
  const port = state.routerPort ?? brain?.routerPort ?? 18890;
  let token = process.env.OPENCHATCUT_MCP_TOKEN ?? '';
  if (!token) {
    try { token = readFileSync(mcpTokenPath({ profileId: process.env.OPENCHATCUT_DEV_PROFILE_ID }), 'utf8').trim(); } catch { /* No token yet. */ }
  }
  const key = deps.forwardKey ?? (typeof settings.forwardKey === 'string' ? settings.forwardKey : '');
  return { key, url: deps.routerUrl ?? `http://127.0.0.1:${port}/v1`, secrets: [token, key, ...(deps.secrets ?? [])] };
}

// Find the first complete JSON value even when a model adds prose or a fence.
function parseAnswer(answer: string): unknown {
  const cleaned = answer.replace(/```(?:json)?/gi, '');
  for (let start = 0; start < cleaned.length; start += 1) {
    const first = cleaned[start];
    if (first === '{' || first === '[' || first === '"') {
      let depth = 0, inString = false, escaped = false;
      for (let end = start; end < cleaned.length; end += 1) {
        const ch = cleaned[end];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
        } else if (ch === '"') inString = true;
        else if (ch === '{' || ch === '[') depth += 1;
        else if (ch === '}' || ch === ']') depth -= 1;
        if (!inString && depth === 0) {
          try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { break; }
        }
      }
    } else if (start === 0 || /[\s:]/.test(cleaned[start - 1])) {
      const match = cleaned.slice(start).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)(?![\w.])/);
      if (match) return JSON.parse(match[0]);
    }
  }
  throw new Error('No JSON value found');
}

export async function delegateTask(args: Record<string, unknown>, deps: Dependencies = {}): Promise<Record<string, unknown>> {
  const { key, url, secrets } = connection(deps);
  const checked = checkDraft(args, secrets);
  if ('error' in checked) return checked;
  if (!key) return { ok: false, error: 'brain_unavailable', reason: 'not_installed', tried: [] };
  if (args.maxTokens !== undefined && (!Number.isInteger(args.maxTokens) || Number(args.maxTokens) < 16 || Number(args.maxTokens) > 4096)) {
    return rejected('invalid_max_tokens', 'maxTokens must be an integer from 16 to 4096.');
  }
  const system = 'You are a drafting helper for a video editor. Answer with one JSON value that matches this JSON schema and nothing else. No code fences.'
    + `\n${JSON.stringify(checked.schema)}`
    + (args.kind === 'tool_args' ? `\nThese are arguments for ${args.tool}; edit_item may only contain adds of type text.` : '');
  const messages = [{ role: 'system', content: system }, { role: 'user', content: `${args.kind}\n${checked.inputText}` }];
  let lane = '', latencyMs = 0, validatorErrors = '';
  for (let attempts = 1; attempts <= 2; attempts += 1) {
    let response: Response;
    try {
      response = await (deps.fetchImpl ?? fetch)(`${url.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: args.alias, messages, stream: false, temperature: 0.2, max_tokens: args.maxTokens ?? 1024 }),
      });
    } catch { return { ok: false, error: 'brain_unavailable', reason: 'router_down', tried: [] }; }
    let body: Record<string, any>;
    try { body = await response.json() as Record<string, any>; } catch { body = {}; }
    if (!response.ok) return { ok: false, error: 'brain_unavailable', reason: body.error?.code ?? 'router_down', tried: body.error?.tried ?? [] };
    lane = response.headers.get('x-corteo-lane') ?? '';
    latencyMs = Number(response.headers.get('x-corteo-latency-ms') ?? 0);
    const answer: unknown = body.choices?.[0]?.message?.content;
    if (typeof answer !== 'string') validatorErrors = 'Missing JSON answer.';
    else if (answer.length > 16000) return { ok: false, error: 'answer_too_large' };
    else {
      try {
        const json = parseAnswer(answer);
        if (checked.validate(json) && (args.tool !== 'edit_item' || args.kind !== 'tool_args' || textAddsOnly(json))) {
          return { ok: true, alias: args.alias, kind: args.kind, lane, latencyMs, attempts, json };
        }
        validatorErrors = JSON.stringify(checked.validate.errors ?? 'edit_item accepts only text adds');
      } catch { validatorErrors = 'No valid JSON value found.'; }
    }
    validatorErrors = validatorErrors.slice(0, 800);
    if (attempts === 2) return { ok: false, error: 'invalid_json', lane, latencyMs, attempts, validatorErrors };
    messages.push({ role: 'assistant', content: typeof answer === 'string' ? answer : '' });
    messages.push({ role: 'user', content: `Your JSON did not validate: ${validatorErrors}. Answer again with only valid JSON.` });
  }
  return { ok: false, error: 'invalid_json', lane, latencyMs, attempts: 2, validatorErrors };
}
