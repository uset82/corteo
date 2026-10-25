// Runnable contract check for reframe stabilization (Plan 5, OP-11). Pure math, no DOM:
// dead zone holds, minimum shot holds after a move, ease closes gradually, output stays in 0..1.
import assert from 'node:assert';
import { stabilizeFocalPath } from './stabilize';

const at = (x: number, y = 0.5) => ({ x, y });

// ── 1) Jitter inside the dead zone is ignored entirely ────────────────────────────────
const jitter = stabilizeFocalPath([at(0.5), at(0.55), at(0.45), at(0.52), at(0.48)], { fps: 30 });
assert.deepStrictEqual(jitter.map((p) => p.x), [0.5, 0.5, 0.5, 0.5, 0.5], 'a 10 % wobble never moves the crop');

// ── 2) A real jump moves, then holds for the minimum shot ─────────────────────────────
// interval 5 @ 30 fps = 0.1667 s per sample, ease 0.45 s → step ≈ 0.370 of the gap.
const jump = stabilizeFocalPath([at(0.2), at(0.8), at(0.8), at(0.8)], { fps: 30, intervalFrames: 5 });
const expectedFirstMove = 0.2 + (0.8 - 0.2) * (5 / 30) / 0.45;
assert.ok(Math.abs(jump[1].x - expectedFirstMove) < 0.01, `eased by interval/ease, got ${jump[1].x}`);
assert.strictEqual(jump[2].x, jump[1].x, 'the crop holds for the minimum shot after moving');
assert.strictEqual(jump[3].x, jump[1].x, 'and keeps holding inside 2 s');

// ── 3) After the shot elapses it may move again, still easing ─────────────────────────
const long = Array.from({ length: 20 }, () => at(0.9));
const settled = stabilizeFocalPath([at(0.1), ...long], { fps: 30, intervalFrames: 5, minShotSeconds: 0.5 });
assert.ok(settled[settled.length - 1].x > settled[1].x, 'the crop keeps closing on the target');
assert.ok(settled.every((p, i) => i === 0 || p.x >= settled[i - 1].x - 1e-9), 'it never overshoots backwards');

// ── 4) A short interval with a long ease moves less per sample than a coarse one ───────
const fine = stabilizeFocalPath([at(0.1), at(0.9)], { fps: 30, intervalFrames: 2 });
const coarse = stabilizeFocalPath([at(0.1), at(0.9)], { fps: 30, intervalFrames: 10 });
assert.ok(fine[1].x < coarse[1].x, 'denser sampling eases in smaller steps');

// ── 5) Output is clamped and degenerate inputs are safe ───────────────────────────────
const wild = stabilizeFocalPath([at(-2, 3), at(9, -4)], { fps: 30, intervalFrames: 60 });
for (const point of wild) {
  assert.ok(point.x >= 0 && point.x <= 1, `x in range: ${point.x}`);
  assert.ok(point.y >= 0 && point.y <= 1, `y in range: ${point.y}`);
}
assert.deepStrictEqual(stabilizeFocalPath([], { fps: 30 }), [], 'no samples → no output');
assert.deepStrictEqual(stabilizeFocalPath([at(0.3, 0.7)], { fps: 30 }), [at(0.3, 0.7)], 'one sample passes through');
assert.deepStrictEqual(stabilizeFocalPath([at(0.3), at(0.3)], { fps: 0 }), [at(0.3), at(0.3)], 'fps 0 falls back to 30, not NaN');

console.log('reframe/stabilize.verify: ok');
