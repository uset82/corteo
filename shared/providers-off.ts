/** Providers reachable when a deployment forces `OPENCHATCUT_PROVIDERS=off`:
 * the local DeepSeek Harness gateway plus the two keyless local runtimes. The
 * server gate (`server/plugins/providers-off.ts`) and the browser UI share this
 * list so a hidden page can never reach a route the gate blocks. */
export const PROVIDERS_OFF_ALLOWED = ['dsh', 'ollama', 'lmstudio'] as const;

export function providersOffEnv(env: { readonly OPENCHATCUT_PROVIDERS?: string }): boolean {
  return env.OPENCHATCUT_PROVIDERS === 'off';
}

export function providersOffAllows(provider: string): boolean {
  return (PROVIDERS_OFF_ALLOWED as readonly string[]).includes(provider);
}
