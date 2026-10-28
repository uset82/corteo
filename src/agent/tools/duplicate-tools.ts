export { DUPLICATE_TOOL_NAMES, DUPLICATE_TOOL_SCHEMAS } from './schemas/duplicate-tools';
import type { AgentContext } from '../context';
import { duplicatePayloadFrom } from '../../media/duplicatePayload';

function payloadFor(ctx: AgentContext) {
  const state = ctx.getState();
  return duplicatePayloadFrom(ctx.getDoc().assets, state.items, state.fps);
}

type Args = Record<string, unknown>;

/**
 * Browser-side executor: the duplicate sampler is server-only, so this asks the
 * route. The headless MCP path never reaches here (offline-executor calls the
 * shared analysis directly).
 */
export async function execDuplicateTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'find_duplicate_media') return { error: `unknown tool ${name}` };
  try {
    const response = await fetch('/api/media-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payloadFor(ctx),
        includeThumbnails: false,
        ...(typeof args.threshold === 'number' ? { threshold: args.threshold } : {}),
      }),
    });
    if (!response.ok) return { error: `duplicate detection failed (${response.status})` };
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
