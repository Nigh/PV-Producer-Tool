// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// 分镜相机的纯函数核心：给定分镜定义与段内时间，算出 sprite 的
// 缩放/位置/透明度。全部为 time 的纯函数，seek/倒放天然正确，
// 不依赖有状态的补间。tests/shotMath.check.ts 覆盖这里的映射。

import type { ShotRect, ShotMotion, ShotTransition } from './types';

/** cover 缩放：让 rect（源图像素尺寸）铺满屏幕。 */
export function coverScale(rectW: number, rectH: number, screenW: number, screenH: number): number {
  return Math.max(screenW / rectW, screenH / rectH);
}

/**
 * 取景框向外扩张 margin 比例（各边 margin/2），并夹取到 [0,1]。
 * 扩张出的边缘供过程运动（推拉/平移）与 zoom 转场使用，避免采样越界露黑边。
 */
export function expandRect(rect: ShotRect, margin: number): ShotRect {
  const mx = rect.w * margin / 2;
  const my = rect.h * margin / 2;
  const x = Math.max(0, rect.x - mx);
  const y = Math.max(0, rect.y - my);
  return {
    x,
    y,
    w: Math.min(1 - x, rect.w + mx * 2),
    h: Math.min(1 - y, rect.h + my * 2),
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** smoothstep 缓动，转场与运动共用。 */
export function ease(p: number): number {
  const t = clamp01(p);
  return t * t * (3 - 2 * t);
}

/** 过程运动（Ken Burns）：返回 zoom 倍率与以 rect 尺寸为单位的平移。 */
export function evalMotion(motion: ShotMotion, p: number): { zoom: number; dx: number; dy: number } {
  const t = ease(p);
  const PAN = 0.08;   // 平移总行程：rect 尺寸的 ±8%
  const ZOOM = 0.12;  // 推拉幅度：12%
  switch (motion) {
    case 'zoomIn': return { zoom: 1 + ZOOM * t, dx: 0, dy: 0 };
    case 'zoomOut': return { zoom: 1 + ZOOM * (1 - t), dx: 0, dy: 0 };
    case 'panLeft': return { zoom: 1, dx: PAN * (1 - 2 * t), dy: 0 };
    case 'panRight': return { zoom: 1, dx: PAN * (2 * t - 1), dy: 0 };
    case 'panUp': return { zoom: 1, dx: 0, dy: PAN * (1 - 2 * t) };
    case 'panDown': return { zoom: 1, dx: 0, dy: PAN * (2 * t - 1) };
    default: return { zoom: 1, dx: 0, dy: 0 };
  }
}

export interface TransitionState {
  /** 入场进度 0..1（1 = 入场完成） */
  pIn: number;
  /** 出场剩余 0..1（1 = 尚未开始出场，0 = 段结束瞬间） */
  pOut: number;
  alpha: number;
  /** 屏幕宽度比例的额外水平位移（slide 转场用） */
  slideX: number;
  /** 转场附加 zoom 倍率（zoom 转场的急推效果） */
  zoomBoost: number;
}

/** 转场时间窗：段时长的 1/4，夹在 0.15s..0.6s。 */
export function transitionWindow(duration: number): number {
  return Math.min(0.6, Math.max(0.15, duration * 0.25));
}

/**
 * 入/出转场的参数化求值。t 为段内时间，duration 为段时长。
 * 入场用 t/TR，出场用 (duration-t)/TR；两者的 alpha 取最小值。
 */
export function evalTransition(
  inType: ShotTransition,
  outType: ShotTransition,
  t: number,
  duration: number,
): TransitionState {
  const TR = transitionWindow(duration);
  const pIn = ease(clamp01(t / TR));
  const pOut = ease(clamp01((duration - t) / TR));

  let alpha = 1;
  let slideX = 0;
  let zoomBoost = 1;

  switch (inType) {
    case 'fade': alpha = Math.min(alpha, pIn); break;
    case 'slide': slideX += (1 - pIn) * 0.2; break;
    case 'zoom': zoomBoost *= 1 + (1 - pIn) * 0.35; break;
    // cut: 无入场动画
  }
  switch (outType) {
    case 'fade': alpha = Math.min(alpha, pOut); break;
    case 'slide': slideX -= (1 - pOut) * 0.2; break;
    case 'zoom': zoomBoost *= 1 + (1 - pOut) * 0.35; break;
    // cut: 无出场动画
  }

  return { pIn, pOut, alpha, slideX, zoomBoost };
}

export interface ShotViewInput {
  imgW: number;
  imgH: number;
  /** 取景框（归一化） */
  rect: ShotRect;
  /** 纹理实际裁切区域（归一化，含运动余量） */
  expRect: ShotRect;
  /** 纹理像素 / 源图像素 的比值（≤1，超限大图被降采样时 <1） */
  texScale: number;
  screenW: number;
  screenH: number;
  motion: ShotMotion;
  inType: ShotTransition;
  outType: ShotTransition;
  /** 段内时间（秒） */
  t: number;
  /** 段时长（秒） */
  duration: number;
}

export interface ShotView {
  /** sprite 缩放（相对纹理像素） */
  scale: number;
  /** sprite 位置（anchor 0.5 = expRect 中心落点） */
  x: number;
  y: number;
  alpha: number;
}

/**
 * 分镜相机的完整视图计算：cover 铺满 + 过程运动 + 入/出转场。
 * sprite 的 anchor 假定为 0.5（即 expRect 中心）。
 */
export function computeShotView(input: ShotViewInput): ShotView {
  const { imgW, imgH, rect, expRect, texScale, screenW, screenH, t, duration } = input;

  const rw = rect.w * imgW;
  const rh = rect.h * imgH;
  const s0 = coverScale(rw, rh, screenW, screenH);

  const motion = evalMotion(input.motion, duration > 0 ? clamp01(t / duration) : 0);
  const trans = evalTransition(input.inType, input.outType, t, duration);

  const zt = s0 * motion.zoom * trans.zoomBoost;
  const displayScale = zt / texScale;

  // 目标点：rect 中心 + 运动平移（源图像素坐标）
  const px = (rect.x + rect.w / 2) * imgW + motion.dx * rw;
  const py = (rect.y + rect.h / 2) * imgH + motion.dy * rh;
  // sprite anchor 所在的 expRect 中心（源图像素坐标）
  const ex = (expRect.x + expRect.w / 2) * imgW;
  const ey = (expRect.y + expRect.h / 2) * imgH;

  return {
    scale: displayScale,
    x: screenW / 2 - (px - ex) * zt + trans.slideX * screenW,
    y: screenH / 2 - (py - ey) * zt,
    alpha: trans.alpha,
  };
}
