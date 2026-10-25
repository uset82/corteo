// C-02 gate: corteo's two marks, the tab title and the favicon.
// `npx tsx --tsconfig tsconfig.app.json src/brand/CorteoMarks.verify.tsx`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorteoMark, CorteoWordmark } from './CorteoMarks';

const wordmark = renderToStaticMarkup(<CorteoWordmark size={14} />);
assert.match(wordmark, />corteo</, '字标必须是真的 "corteo" 小写文字，读屏才读得出一个词');
assert.match(wordmark, /cc-wordmark/, '字标用 .cc-wordmark');
assert.doesNotMatch(wordmark, /cc-wordmark-streak/, '旧字标前面的 clay 竖条已经去掉');
assert.match(wordmark, /font-size:14px/, 'size 决定内联字号');

const mark = renderToStaticMarkup(<CorteoMark size={16} />);
assert.match(mark, /viewBox="0 0 24 24"/, '标记是 24x24 视图');
assert.match(mark, /points="2,2 20,2 2,20"/, '上左半是 accent 三角');
assert.match(mark, /points="22,22 4,22 22,4"/, '下右半是 bone 三角');
assert.match(mark, /fill="var\(--cc-accent\)"/, '上左半用 accent token');
assert.match(mark, /fill="var\(--cc-text-strong\)"/, '下右半用 textStrong，浅色皮肤自动反成墨色');
assert.match(mark, /aria-hidden="true"/, '标记是装饰，读屏跳过');

// Both marks are token-only: a raw color here would break every skin but one.
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
for (const [label, markup] of [['wordmark', wordmark], ['mark', mark]] as const) {
  assert.doesNotMatch(markup, RAW_COLOR, `${label}: 不能有写死的颜色`);
}

// One geometry at every size: the two polygons never move, only the box does.
for (const size of [14, 16, 20, 24]) {
  const at = renderToStaticMarkup(<CorteoMark size={size} />);
  assert.match(at, /points="2,2 20,2 2,20"/, `${size}px: 几何不变`);
  assert.match(at, new RegExp(`width="${size}"`), `${size}px: 宽度跟随 size`);
}

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
assert.match(html, /<title>corteo<\/title>/, '标签页标题是 corteo');
assert.match(html, /<html lang="es">/, '页面语言是西语');
assert.match(html, /rel="icon"[^>]*corteo-mark\.svg/, '图标指向 corteo-mark.svg');
assert.match(html, /name="theme-color" content="#0a0b0d"/, 'theme-color 是皮肤底色');
assert.match(html, /rel="preload" as="font"[^>]*DINishCondensed-Black\.woff2/, '预载 DINish Condensed');
assert.doesNotMatch(html, /texgyreheros/, 'Heros 已随旧字标一起下线');
assert.doesNotMatch(html, /claudia/i, 'index.html 里不再有旧名字');

// The favicon is the same two polygons on the editor's void, and it is on disk.
const favicon = readFileSync(new URL('../../public/corteo-mark.svg', import.meta.url), 'utf8');
assert.match(favicon, /points="2,2 20,2 2,20"/, 'favicon: accent 半');
assert.match(favicon, /points="22,22 4,22 22,4"/, 'favicon: bone 半');
assert.match(favicon, /#ff4a1f/, 'favicon: accent 值');
assert.match(favicon, /#f7f3ea/, 'favicon: bone 值');
assert.match(favicon, /rx="7"/, 'favicon: 圆角');

console.log('CorteoMarks.verify: ok（字标、标记、favicon、标签页与预载）');
