// Claudia's two marks (docs/plans/04-claudia-brand.md, BD-3).
// Both are token-only: no raw colors, so switching skin repaints them and the
// theme-tokenization gate stays green.
// The wordmark is real text, made uppercase by CSS, so a screen reader reads a
// word instead of announcing letters. The star is decorative and hidden from AT.

/** Wordmark: a clay streak, then CLAUDIA in Heros 700 with 0.2em tracking.
 * The negative right margin cancels the trailing letter-space. */
export function ClaudiaWordmark({ size = 14 }: { size?: number }) {
  return (
    <span className="cc-wordmark" style={{ fontSize: size }}>
      <span className="cc-wordmark-streak" aria-hidden="true" />
      Claudia
    </span>
  );
}

/** Eight-pointed star, the favicon's shape, in the accent color.
 * Used only in the favicon and the collapsed chat rail. */
export function ClaudiaMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, color: 'var(--cc-accent)' }}
    >
      <polygon
        fill="currentColor"
        points="12,1 13.76,7.75 19.78,4.22 16.25,10.24 23,12 16.25,13.76 19.78,19.78 13.76,16.25 12,23 10.24,16.25 4.22,19.78 7.75,13.76 1,12 7.75,10.24 4.22,4.22 10.24,7.75"
      />
    </svg>
  );
}
