// corteo's two marks (docs/plans/05-corteo.md, C-02).
// Both are token-only: no raw colors, so switching skin repaints them and the
// theme-tokenization gate stays green.
// The wordmark is real text, so a screen reader reads a word instead of
// announcing letters. The mark is decorative and hidden from AT.

/** Wordmark: `corteo` in DINish Condensed Black, lowercase, 0.02em tracking.
 * Lowercase at every size, like the command. Uppercase condensed reads as a poster
 * headline and shouts at 11px in the chat header. */
export function CorteoWordmark({ size = 14 }: { size?: number }) {
  return (
    <span className="cc-wordmark" style={{ fontSize: size }}>
      corteo
    </span>
  );
}

/** The cut: a 20x20 square split on the 45° diagonal, the two halves slid apart.
 * The upper-left half takes the accent, the lower-right takes textStrong — which is
 * the bone of the palette on the dark skins and near-black on the light ones, so the
 * mark inverts to ink with no second asset and no [data-cc-skin] rule.
 * The gap band is 22 < x+y < 26, i.e. 4/√2 ≈ 2.83 perpendicular. One geometry at
 * every size, measured at 16px. If a smaller size ever fails, the gap grows (3.2),
 * never shrinks: a thin gap is eaten by antialiasing. */
export function CorteoMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <polygon fill="var(--cc-accent)" points="2,2 20,2 2,20" />
      <polygon fill="var(--cc-text-strong)" points="22,22 4,22 22,4" />
    </svg>
  );
}
