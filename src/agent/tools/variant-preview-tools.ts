import type { AgentContext } from '../context';

type Args = Record<string, unknown>;

/**
 * Browser executor: the preview renderer is server-only, so the project graph
 * goes to /api/variant-previews. The route uses the same Remotion pipeline and
 * export permit as a delivery export.
 */
export async function execVariantPreviewTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  if (name !== 'render_variant_previews') return { error: `unknown tool ${name}` };
  try {
    const response = await fetch('/api/variant-previews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: ctx.getDoc(),
        ...(typeof args.groupId === 'string' && args.groupId.trim() ? { groupId: args.groupId.trim() } : {}),
        ...(typeof args.timelineId === 'string' && args.timelineId.trim() ? { timelineId: args.timelineId.trim() } : {}),
      }),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) return { error: body?.error ?? `preview render failed (${response.status})` };
    return body;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
