import { providersOffAllows } from '../../shared/providers-off';

export { PROVIDERS_OFF_ALLOWED, providersOffAllows } from '../../shared/providers-off';

// __PROVIDERS_OFF__ is a Vite-`define` global (declared in src/globals.d.ts);
// undefined under tsx and in the Electron embedded server → every provider
// stays available there. The typeof guard keeps the bare reference safe.
export const PROVIDERS_OFF: boolean =
  typeof __PROVIDERS_OFF__ !== 'undefined' ? __PROVIDERS_OFF__ : false;

export function providerAvailable(provider: string): boolean {
  return !PROVIDERS_OFF || providersOffAllows(provider);
}
