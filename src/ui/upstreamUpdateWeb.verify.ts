// BQ-2 gate: in the browser the editor must not call GitHub on boot. Only the
// desktop build, whose updater owns the release channel, checks by itself.
// `npx tsx src/ui/upstreamUpdateWeb.verify.ts`
import assert from 'node:assert/strict';

let fetches = 0;
const globals = globalThis as Record<string, unknown>;
globals.fetch = (...args: unknown[]): Promise<unknown> => {
  fetches += 1;
  return Promise.reject(new Error(`unexpected fetch: ${String(args[0])}`));
};
// A browser window: no openChatCutDesktop bridge.
globals.window = { open: (): void => undefined };

const upstream = await import('./upstreamUpdate');

assert.equal(upstream.hasDesktopUpdateSupport(), false, '浏览器里没有桌面更新通道');
upstream.startAutomaticUpstreamUpdateCheck();
await new Promise((resolve) => setTimeout(resolve, 60));

assert.equal(fetches, 0, '网页版开机不得请求上游版本接口');

console.log('upstreamUpdateWeb.verify: ok（网页版不再自动请求上游版本）');
