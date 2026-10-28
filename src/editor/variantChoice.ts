/** P4-3: the browser event fired when a version is chosen. */
export const VARIANT_CHOSEN_EVENT = 'variant.chosen';

export interface VariantChosenDetail {
  readonly groupId: string;
  readonly timelineId: string;
}

export function announceVariantChosen(detail: VariantChosenDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<VariantChosenDetail>(VARIANT_CHOSEN_EVENT, { detail }));
  }
}

export function subscribeVariantChosen(handler: (detail: VariantChosenDetail) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<VariantChosenDetail>).detail);
  window.addEventListener(VARIANT_CHOSEN_EVENT, listener);
  return () => window.removeEventListener(VARIANT_CHOSEN_EVENT, listener);
}
