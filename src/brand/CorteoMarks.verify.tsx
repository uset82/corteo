// BD-3 gate: Claudia's two marks, the tab title and the favicon.
// `npx tsx --tsconfig tsconfig.app.json src/brand/CorteoMarks.verify.tsx`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClaudiaMark, ClaudiaWordmark } from './CorteoMarks';

const wordmark = renderToStaticMarkup(<ClaudiaWordmark size={14} />);
assert.match(wordmark, />Claudia</, '字标必须是真的 "Claudia" 文字（大写交给 CSS），读屏才读得出一个词');
assert.match(wordmark, /cc-wordmark/, '字标用 .cc-wordmark');
assert.match(wordmark, /cc-wordmark-streak/, '字标前面有 clay 竖条');
assert.match(wordmark, /font-size:14px/, 'size 决定内联字号');

const star = renderToStaticMarkup(<ClaudiaMark size={16} />);
assert.match(star, /viewBox="0 0 24 24"/, '八角星是 24x24 视图');
assert.match(star, /fill="currentColor"/, '八角星跟随 currentColor');
assert.match(star, /var\(--cc-accent\)/, '八角星用 accent token');
assert.match(star, /aria-hidden="true"/, '八角星是装饰，读屏跳过');

// Both marks are token-only: a raw color here would break every skin but one.
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
for (const [label, markup] of [['wordmark', wordmark], ['mark', star]] as const) {
  assert.doesNotMatch(markup, RAW_COLOR, `${label}: 不能有写死的颜色`);
}

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
assert.match(html, /<title>Claudia<\/title>/, '标签页标题是 Claudia');
assert.match(html, /<html lang="es">/, '页面语言是西语');
assert.match(html, /rel="icon"[^>]*claudia-mark\.svg/, '图标指向 claudia-mark.svg');
assert.match(html, /name="theme-color" content="#0a0b0d"/, 'theme-color 是皮肤底色');
assert.match(html, /rel="preload" as="font"[^>]*texgyreheros-bold\.otf/, '预载 Heros');
assert.match(html, /rel="preload" as="font"[^>]*DINishCondensed-Black\.woff2/, '预载 DINish Condensed');
assert.doesNotMatch(html, /openchatcut-icon\.png/, 'index.html 不再引用上游图标');

console.log('ClaudiaMarks.verify: ok（字标、八角星、标签页与图标）');
