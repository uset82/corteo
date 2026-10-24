import type { CSSProperties } from 'react';
import { theme } from '../../theme';

// Only what still has to be inline: the rename input (its border marks the edit
// state) and the toolbar's search field. Layout lives in the .cc-projects-* rules.
export const nameInput: CSSProperties = { font: 'inherit', fontSize: 13, fontWeight: 550, background: theme.panelAlt, color: theme.text, border: `0.5px solid ${theme.accent}`, borderRadius: 5, padding: '2px 6px', width: '100%' };
export const miniBtn: CSSProperties = { background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
export const settingsBtn: CSSProperties = { background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
export const searchBox: CSSProperties = { width: 216, position: 'relative', display: 'inline-flex', alignItems: 'center' };
export const searchIcon: CSSProperties = { position: 'absolute', left: 9, display: 'inline-flex', color: theme.textDim, pointerEvents: 'none' };
export const searchInput: CSSProperties = {
  width: '100%', height: 30, boxSizing: 'border-box', padding: '0 30px 0 28px',
  border: `0.5px solid ${theme.border}`, borderRadius: 4, background: theme.bg, color: theme.text,
  fontSize: 12, WebkitAppearance: 'none',
};
export const searchClear: CSSProperties = {
  position: 'absolute', right: 2, width: 26, height: 26, display: 'grid', placeItems: 'center',
  padding: 0, border: 0, borderRadius: 4, background: 'transparent', color: theme.textDim, cursor: 'pointer',
};
export const searchEmpty: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, color: theme.textDim, fontSize: 12 };
