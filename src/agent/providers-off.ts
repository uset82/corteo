import { providersOffAllows } from '../../shared/providers-off';

export { PROVIDERS_OFF_ALLOWED, providersOffAllows } from '../../shared/providers-off';

// __PROVIDERS_OFF__ is a Vite-`define` global (declared in src/globals.d.ts);
// undefined under tsx and in the Electron embedded server → every provider
// stays available there. The typeof guard keeps the bare reference safe.
// This is only the pre-hydration default: read providersOff() once the app has
// loaded, because the value below is frozen when the bundle is built.
export const PROVIDERS_OFF: boolean =
  typeof __PROVIDERS_OFF__ !== 'undefined' ? __PROVIDERS_OFF__ : false;

// The server reads the switch per request; the bundle froze it at build time.
// A packaged desktop build would therefore hide pages the server serves (or
// offer pages it refuses). GET /api/keys reports the live value and wins.
let liveProvidersOff: boolean | null = null;

export function applyProvidersOff(value: boolean): void {
  liveProvidersOff = value;
}

export function providersOff(): boolean {
  return liveProvidersOff ?? PROVIDERS_OFF;
}

export function providerAvailable(provider: string): boolean {
  return !providersOff() || providersOffAllows(provider);
}
