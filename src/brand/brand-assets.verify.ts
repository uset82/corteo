// C-02 gate: the brand face is really on disk, is what it claims to be, and
// index.css declares it. Sizes are pinned to the bytes, so a truncated download
// or an HTML error page saved as a font fails here.
// One face, not two: the old wordmark's Helvetica look-alike went out with the old
// wordmark, so this file must not see it come back.
// `npx tsx src/brand/brand-assets.verify.ts`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FONT_DIR = new URL('../../public/fonts/corteo/', import.meta.url);
const FILES: readonly (readonly [string, number, string | null])[] = [
  ['DINishCondensed-Black.woff2', 28_772, 'wOF2'],
  ['OFL-DINish.txt', 4_384, null],
];

for (const [name, size, magic] of FILES) {
  const bytes = readFileSync(new URL(name, FONT_DIR));
  assert.equal(bytes.length, size, `${name}: 字节数应与钉住的一致`);
  if (magic) assert.equal(bytes.subarray(0, 4).toString('latin1'), magic, `${name}: 魔数应为 ${magic}`);
}

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const face = (family: string, format: string, weight: number): void => {
  const block = new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*\\}`, 's').exec(css)?.[0] ?? '';
  assert.ok(block, `index.css: 缺少 ${family} 的 @font-face`);
  assert.ok(block.includes(`format('${format}')`), `index.css: ${family} 格式应为 ${format}`);
  assert.ok(block.includes(`font-weight: ${weight};`), `index.css: ${family} 字重应为 ${weight}`);
  assert.ok(block.includes('font-display: swap;'), `index.css: ${family} 应使用 font-display: swap`);
  assert.ok(/url\('\/fonts\/corteo\//.test(block), `index.css: ${family} 应从 /fonts/corteo/ 自托管`);
};
face('DINish Condensed', 'woff2', 900);

// The dropped face must not be declared anywhere: a stale @font-face would point at a
// file that no longer exists and every wordmark would fall back silently.
assert.doesNotMatch(css, /font-family:\s*'Heros'/, 'index.css: Heros 已下线');
assert.doesNotMatch(css, /texgyreheros/, 'index.css: 不再引用 Heros 文件');

assert.ok(css.includes('--cc-font-brand:'), 'index.css: 缺少 --cc-font-brand');
assert.ok(css.includes('--cc-font-display:'), 'index.css: 缺少 --cc-font-display');
assert.match(css, /--cc-font-brand:\s*'DINish Condensed'/, 'index.css: 字标用的是那唯一一款品牌字体');

console.log('brand-assets.verify: ok（一款品牌字体、一份许可证、@font-face 与变量）');
