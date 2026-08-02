// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// shotMath 纯函数自检（无框架）。运行：
//   node --experimental-strip-types tests/shotMath.check.ts

import assert from 'node:assert/strict';
import {
  coverScale, expandRect, ease, evalMotion, evalTransition,
  transitionWindow, computeShotView, shotRunRange, shotRunMotionClock,
  resolveShotOutTransition,
} from '../src/core/shotMath.ts';
import {
  canvasAspect, shotNormAspect, maxCenteredRect, refitRectToAspect, aspectRectFromDrag,
  designSize,
} from '../src/core/shotAspect.ts';

// ── coverScale：cover 语义 = 两个方向都至少铺满 ──
assert.equal(coverScale(1000, 1000, 1920, 1080), 1.92);
assert.equal(coverScale(1920, 1080, 1920, 1080), 1);
// 竖长 rect 铺横屏：宽度方向主导
assert.equal(coverScale(500, 2000, 1920, 1080), 1920 / 500);

// ── expandRect：扩张 + 边界夹取 ──
{
  const e = expandRect({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 0.3);
  assert.ok(Math.abs(e.x - 0.37) < 1e-9 && Math.abs(e.w - 0.26) < 1e-9);
}
{
  // 贴着左上角：不能出界
  const e = expandRect({ x: 0, y: 0, w: 0.2, h: 0.2 }, 0.3);
  assert.equal(e.x, 0);
  assert.equal(e.y, 0);
}
{
  // 贴着右下角：w/h 被夹回
  const e = expandRect({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 0.5);
  assert.ok(e.x + e.w <= 1 + 1e-9 && e.y + e.h <= 1 + 1e-9);
}

// ── ease：端点与单调性 ──
assert.equal(ease(0), 0);
assert.equal(ease(1), 1);
assert.equal(ease(-5), 0);
assert.equal(ease(5), 1);
for (let i = 1; i <= 10; i++) {
  assert.ok(ease(i / 10) >= ease((i - 1) / 10));
}

// ── evalMotion：端点状态 ──
assert.deepEqual(evalMotion('none', 0.5), { zoom: 1, dx: 0, dy: 0 });
assert.equal(evalMotion('zoomIn', 0).zoom, 1);
assert.ok(Math.abs(evalMotion('zoomIn', 1).zoom - 1.12) < 1e-9);
assert.ok(Math.abs(evalMotion('zoomOut', 0).zoom - 1.12) < 1e-9);
assert.equal(evalMotion('zoomOut', 1).zoom, 1);
// panRight：从 -PAN 到 +PAN（画面内容向左走 = 镜头向右摇）
assert.ok(evalMotion('panRight', 0).dx < 0 && evalMotion('panRight', 1).dx > 0);
assert.ok(evalMotion('panLeft', 0).dx > 0 && evalMotion('panLeft', 1).dx < 0);
assert.ok(evalMotion('panDown', 1).dy > 0 && evalMotion('panUp', 1).dy < 0);
// 幅度倍率：0 = 无运动，2 = 两倍行程
assert.deepEqual(evalMotion('zoomIn', 1, 0), { zoom: 1, dx: 0, dy: 0 });
assert.ok(Math.abs(evalMotion('zoomIn', 1, 2).zoom - 1.24) < 1e-9);
assert.ok(Math.abs(evalMotion('panRight', 1, 2).dx - 2 * evalMotion('panRight', 1).dx) < 1e-9);

// ── transitionWindow：1/4 段长，夹 0.15..0.6 ──
assert.equal(transitionWindow(2), 0.5);
assert.equal(transitionWindow(0.2), 0.15);
assert.equal(transitionWindow(10), 0.6);

// ── evalTransition ──
{
  // 段中间：转场完全结束，无痕迹
  const s = evalTransition('fade', 'fade', 2, 4);
  assert.equal(s.alpha, 1);
  assert.equal(s.slideX, 0);
  assert.equal(s.zoomBoost, 1);
}
{
  // 段起点：fade 入场从 0 开始
  const s = evalTransition('fade', 'cut', 0, 4);
  assert.equal(s.alpha, 0);
}
{
  // 段终点：fade 出场归零；cut 入场不影响
  const s = evalTransition('cut', 'fade', 4, 4);
  assert.equal(s.alpha, 0);
}
{
  // cut/cut：任何时刻都无转场痕迹
  for (const t of [0, 0.1, 2, 3.9, 4]) {
    const s = evalTransition('cut', 'cut', t, 4);
    assert.equal(s.alpha, 1);
    assert.equal(s.slideX, 0);
    assert.equal(s.zoomBoost, 1);
  }
}
{
  // slide 入场：起点有正向位移并衰减到 0
  const s0 = evalTransition('slide', 'cut', 0, 4);
  const s1 = evalTransition('slide', 'cut', 0.25, 4);
  assert.ok(s0.slideX > s1.slideX && s1.slideX > 0);
  assert.equal(evalTransition('slide', 'cut', 2, 4).slideX, 0);
}
{
  // zoom 入场：起点急推（>1）收敛到 1
  assert.ok(evalTransition('zoom', 'cut', 0, 4).zoomBoost > 1.3);
  assert.equal(evalTransition('zoom', 'cut', 2, 4).zoomBoost, 1);
}

// ── computeShotView：段中间的静态 cover 布局 ──
{
  // 1000×1000 源图，rect 为中心 50%（500×500px），无运动、无转场痕迹的时刻
  const rect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const view = computeShotView({
    imgW: 1000, imgH: 1000,
    rect,
    expRect: rect,          // 无扩张的极简情形
    texScale: 1,
    screenW: 1000, screenH: 500,
    motion: 'none', inType: 'cut', outType: 'cut',
    t: 2, duration: 4,
  });
  // cover：max(1000/500, 500/500) = 2
  assert.equal(view.scale, 2);
  // rect 中心与 expRect 中心重合 → sprite 落在屏幕中心
  assert.equal(view.x, 500);
  assert.equal(view.y, 250);
  assert.equal(view.alpha, 1);
}
{
  // 纹理降采样补偿：texScale=0.5 时显示 scale 翻倍，位置不变
  const rect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const view = computeShotView({
    imgW: 1000, imgH: 1000, rect, expRect: rect, texScale: 0.5,
    screenW: 1000, screenH: 500,
    motion: 'none', inType: 'cut', outType: 'cut', t: 2, duration: 4,
  });
  assert.equal(view.scale, 4);
  assert.equal(view.x, 500);
}
{
  // expRect 偏移补偿：anchor 在 expRect 中心，rect 中心仍要落屏幕中心
  const rect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const expRect = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }; // 中心同为 (0.5, 0.5)
  const view = computeShotView({
    imgW: 1000, imgH: 1000, rect, expRect, texScale: 1,
    screenW: 1000, screenH: 500,
    motion: 'none', inType: 'cut', outType: 'cut', t: 2, duration: 4,
  });
  assert.equal(view.x, 500);
  assert.equal(view.y, 250);
}
{
  // 运动平移：panRight 末端 sprite 向左偏（镜头右摇 = 内容左移）
  const rect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
  const base = computeShotView({
    imgW: 1000, imgH: 1000, rect, expRect: rect, texScale: 1,
    screenW: 1000, screenH: 500,
    motion: 'none', inType: 'cut', outType: 'cut', t: 4, duration: 4,
  });
  const panned = computeShotView({
    imgW: 1000, imgH: 1000, rect, expRect: rect, texScale: 1,
    screenW: 1000, screenH: 500,
    motion: 'panRight', inType: 'cut', outType: 'cut', t: 4, duration: 4,
  });
  assert.ok(panned.x < base.x);
}

// ── resolveShotOutTransition：切镜/沿用不透底 ──
assert.equal(resolveShotOutTransition('fade', 0, -1), 'fade'); // 末镜可淡出
assert.equal(resolveShotOutTransition('fade', 0, 0), 'cut');   // 沿用同镜
assert.equal(resolveShotOutTransition('fade', 0, 1), 'cut');   // 切到下一镜
assert.equal(resolveShotOutTransition('slide', 0, 1), 'slide'); // 非 fade 保留
assert.equal(resolveShotOutTransition('zoom', 0, 0), 'cut');

// ── shotRunRange：稀疏分镜的连续覆盖区间 ──
{
  const shots = [{}, null, null, {}, null] as (object | null)[];
  assert.deepEqual(shotRunRange(shots, 0), { start: 0, end: 2 });
  assert.deepEqual(shotRunRange(shots, 3), { start: 3, end: 4 });
  assert.deepEqual(shotRunRange([{}], 0), { start: 0, end: 0 });
}

// ── shotRunMotionClock：三等长句跨镜时第二句中点 ≈ 0.5 ──
{
  const starts = [0, 3, 6];
  const ends = [3, 6, 9];
  const clock = shotRunMotionClock({
    runStart: 0,
    runEnd: 2,
    index: 1,
    segmentT: 1.5,
    startAt: (i) => starts[i]!,
    endAt: (i) => ends[i]!,
  });
  assert.ok(Math.abs(clock.duration - 9) < 1e-9);
  assert.ok(Math.abs(clock.t / clock.duration - 0.5) < 1e-9);
}

// ── shotAspect：画幅锁定矩形 ──
assert.equal(canvasAspect('16:9'), 16 / 9);
assert.equal(canvasAspect('9:16'), 9 / 16);
assert.deepEqual(designSize('16:9'), { w: 1920, h: 1080 });
assert.deepEqual(designSize('9:16'), { w: 1080, h: 1920 });
{
  // 正方形原图 + 16:9 画布 → 归一化框 w/h = 16/9
  const na = shotNormAspect(16 / 9, 1000, 1000);
  assert.ok(Math.abs(na - 16 / 9) < 1e-9);
  const full = maxCenteredRect(na);
  assert.ok(Math.abs(full.w / full.h - na) < 1e-9);
  assert.ok(full.w <= 1 + 1e-9 && full.h <= 1 + 1e-9);
}
{
  const r = refitRectToAspect({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 16 / 9);
  assert.ok(Math.abs(r.w / r.h - 16 / 9) < 1e-6);
  assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 1 + 1e-9);
}
{
  const d = aspectRectFromDrag(0.2, 0.2, 0.6, 0.3, 16 / 9, 0.05);
  assert.ok(Math.abs(d.w / d.h - 16 / 9) < 1e-6);
}

console.log('shotMath.check: all assertions passed');
