// Build-time global injected by Vite `define` in config/vite.config.ts (computed from
// .env.local key presence — BOOLEANS ONLY, no key value ever reaches the browser).
// Declared here as a GLOBAL ambient (not a module-local `declare const`) so esbuild
// treats it as a free identifier and applies the define replacement; a module-local
// declaration would make esbuild skip it. Undefined outside Vite (tsx checks) — always
// read behind a `typeof … !== 'undefined'` guard. See src/agent/capabilities.ts.
declare const __CONFIGURED_CAPS__: Record<string, boolean> | undefined;
declare const __APP_VERSION__: string | undefined;
// Local-only deployment switch (`OPENCHATCUT_PROVIDERS=off`), separate from
// __CONFIGURED_CAPS__ so it never enters the agent's capability prompt.
// Undefined under tsx and in the Electron embedded server. Read through
// src/agent/providers-off.ts behind the same typeof guard.
declare const __PROVIDERS_OFF__: boolean | undefined;

declare module '*.png' {
  const url: string;
  export default url;
}
