import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { normalizeLlmProvider } from '../../shared/llm-providers.ts';
import {
  PROVIDERS_OFF_ALLOWED,
  providersOffAllows,
  providersOffEnv,
} from '../../shared/providers-off.ts';
import { getKey } from '../keystore.ts';
import { llmProviderForRequest } from './llm-proxy.ts';

export { PROVIDERS_OFF_ALLOWED, providersOffAllows, providersOffEnv };

/** Whole mounts that only serve a remote or subscription backend. P1-1 adds
 * the generation, stock and cloud-transcription routes to this file. */
export const PROVIDERS_OFF_BLOCKED_PREFIXES = [
  '/api/codex',
  '/api/copilot',
  '/api/claude-code',
  '/api/xai-oauth',
] as const;

export function providersOff(env: NodeJS.ProcessEnv = process.env): boolean {
  return providersOffEnv(env);
}

function blockedMount(pathname: string): boolean {
  return PROVIDERS_OFF_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function requestProvider(req: IncomingMessage): string {
  try {
    return llmProviderForRequest(req);
  } catch {
    // A malformed header falls back to the saved default, exactly like the proxy.
    return normalizeLlmProvider(getKey('LLM_PROVIDER'));
  }
}

function refuse(req: IncomingMessage, res: ServerResponse): void {
  req.resume();
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'providers_disabled' }));
}

/** Read the switch per request so a verify can toggle it without a restart. */
export function providersOffMiddleware(env?: NodeJS.ProcessEnv) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (!providersOff(env)) { next(); return; }
    const pathname = (req.url ?? '/').split('?')[0];
    const llmRequest = pathname === '/llm' || pathname.startsWith('/llm/');
    if (llmRequest ? !providersOffAllows(requestProvider(req)) : blockedMount(pathname)) {
      refuse(req, res);
      return;
    }
    next();
  };
}

export function providersOffPlugin(env?: NodeJS.ProcessEnv): Plugin {
  return {
    name: 'openchatcut-providers-off',
    configureServer(server) {
      server.middlewares.use('/', providersOffMiddleware(env));
    },
  };
}
