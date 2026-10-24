// BD-1 gate: the two brand faces are really on disk, are what they claim to be,
// and index.css declares them. Sizes are pinned to the bytes BD-1 downloads, so a
// truncated download or an HTML error page saved as a font fails here.
// `npx tsx src/brand/brand-assets.verify.ts`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FONT_DIR = new URL('../../public/fonts/claudia/', import.meta.url);
const FILES: readonly (readonly [string, number, string | null])[] = [
  ['DINishCondensed-Black.woff2', 28_772, 'wOF2'],
  ['OFL-DINish.txt', 4_384, null],
  ['texgyreheros-bold.otf', 135_204, 'OTTO'],
  ['GUST-FONT-LICENSE.txt', 1_456, null],
];

for (const [name, size, magic] of FILES) {
  const bytes = readFileSync(new URL(name, FONT_DIR));
  assert.equal(bytes.length, size, `${name}: 字节数应与 BD-1 钉住的一致`);
  if (magic) assert.equal(bytes.subarray(0, 4).toString('latin1'), magic, `${name}: 魔数应为 ${magic}`);
}

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const face = (family: string, format: string, weight: number): void => {
  const block = new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*\\}`, 's').exec(css)?.[0] ?? '';
  assert.ok(block, `index.css: 缺少 ${family} 的 @font-face`);
  assert.ok(block.includes(`format('${format}')`), `index.css: ${family} 格式应为 ${format}`);
  assert.ok(block.includes(`font-weight: ${weight};`), `index.css: ${family} 字重应为 ${weight}`);
  assert.ok(block.includes('font-display: swap;'), `index.css: ${family} 应使用 font-display: swap`);
  assert.ok(/url\('\/fonts\/claudia\//.test(block), `index.css: ${family} 应从 /fonts/claudia/ 自托管`);
};
face('Heros', 'opentype', 700);
face('DINish Condensed', 'woff2', 900);

assert.ok(css.includes('--cc-font-brand:'), 'index.css: 缺少 --cc-font-brand');
assert.ok(css.includes('--cc-font-display:'), 'index.css: 缺少 --cc-font-display');

console.log('brand-assets.verify: ok（两款品牌字体、两份许可证、@font-face 与变量）');
