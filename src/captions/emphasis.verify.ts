// Contract check for per-word emphasis (Plan 5, OP-08). Pure: resolve carries the flag onto
// the word, silence is unchanged, and the layer reads the word rather than an index.
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { applyWordOverrides } from './resolve';
import { captionWordColour } from './renderStyles';
import { CAPTION_STYLES } from './styles';
import type { CaptionWordOverride } from './types';
import type { TranscriptWord } from '../transcript/types';

const words: TranscriptWord[] = [
  { id: 'w1', text: 'el', start: 0, end: 200 },
  { id: 'w2', text: 'precio', start: 250, end: 700 },
  { id: 'w3', text: 'sube', start: 750, end: 1100 },
];
const indices = [0, 1, 2];
const refs = ['w1', 'w2', 'w3'];

// ── 1) No overrides: words come back untouched (the non-regression promise) ───────────
{
  const resolved = applyWordOverrides(words, indices, undefined, refs);
  assert.deepStrictEqual(resolved.words, words, 'a cue with no overrides is byte-identical');
  assert.ok(resolved.words.every((word) => word.emphasis === undefined));
}

// ── 2) An emphasis override lands on the word object ─────────────────────────────────
{
  const overrides: Record<number, CaptionWordOverride> = { 1: { emphasis: true } };
  const resolved = applyWordOverrides(words, indices, overrides, refs);
  assert.strictEqual(resolved.words[1].emphasis, true, 'the flagged word carries the hint');
  assert.strictEqual(resolved.words[0].emphasis, undefined);
  assert.strictEqual(resolved.words[2].emphasis, undefined);
  assert.strictEqual(resolved.words[1].text, 'precio', 'the text is untouched');
  assert.deepStrictEqual([resolved.words[1].start, resolved.words[1].end], [250, 700], 'the timing is untouched');
}

// ── 3) Emphasis composes with the other overrides instead of replacing them ──────────
{
  const overrides: Record<number, CaptionWordOverride> = { 1: { emphasis: true, text: 'PRECIO', timingOffsetMs: 50 } };
  const resolved = applyWordOverrides(words, indices, overrides, refs);
  const word = resolved.words[1];
  assert.strictEqual(word.text, 'PRECIO');
  assert.strictEqual(word.emphasis, true);
  assert.deepStrictEqual([word.start, word.end], [300, 750], 'the timing offset still applies');
}

// ── 4) A hidden word stays hidden, emphasis or not ──────────────────────────────────
{
  const overrides: Record<number, CaptionWordOverride> = { 1: { emphasis: true, hidden: true } };
  const resolved = applyWordOverrides(words, indices, overrides, refs);
  assert.strictEqual(resolved.words.length, 2, 'a hidden word is still dropped');
}

// ── 5) The layer reads the word, never an index into the override map ───────────────
{
  const source = await readFile(new URL('./CaptionsLayer.tsx', import.meta.url), 'utf8');
  assert.ok(!/wordOverrides\[.*emphasis/.test(source), 'the layer does not look emphasis up by index');
  assert.ok(source.includes('captionWordColour('), 'the colour rule is the shared function, not an inline expression');
}

// ── 6) The colour rule, tested without a Remotion context ───────────────────────────
{
  const preset = CAPTION_STYLES.find((style) => style.id === 'tiktok')!;
  assert.ok(preset.highlightColor && preset.color, 'the preset has two distinct colours');
  assert.notStrictEqual(preset.highlightColor, preset.color);

  assert.strictEqual(captionWordColour(preset, { emphasis: true }, false), preset.highlightColor, 'an emphasised word takes the highlight');
  assert.strictEqual(captionWordColour(preset, {}, false), preset.color, 'a plain word takes the base colour');
  assert.strictEqual(captionWordColour(preset, { emphasis: true }, true), preset.highlightColor, 'the active word is highlighted either way');
  assert.strictEqual(captionWordColour(preset, {}, true), preset.highlightColor, 'and it is highlighted when not emphasised too');

  // The layer asks this function, so the rule cannot drift back into the component.
  const layer = await readFile(new URL('./CaptionsLayer.tsx', import.meta.url), 'utf8');
  assert.ok(layer.includes('captionWordColour(preset, word, index === currentIndex)'), 'the layer uses the shared rule');
}

console.log('captions/emphasis.verify: ok');
