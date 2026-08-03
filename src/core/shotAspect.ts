// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { ShotRect } from './types';

export type AspectRatio = '16:9' | '9:16';

export function canvasAspect(ar: AspectRatio): number {
  return ar === '9:16' ? 9 / 16 : 16 / 9;
}

/** 逻辑画布固定分辨率（预览 CSS 等比缩放，导出与排版不随窗口变）。 */
export function designSize(ar: AspectRatio): { w: number; h: number } {
  return ar === '9:16' ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
}

/** 原图归一化坐标下，使裁切区投影到画布后等于 canvasAsp 的 w/h。 */
export function shotNormAspect(canvasAsp: number, imgW: number, imgH: number): number {
  return canvasAsp * (imgH / Math.max(imgW, 1e-9));
}

/** 图内最大且居中的固定比例矩形。 */
export function maxCenteredRect(normAsp: number): ShotRect {
  if (normAsp >= 1) {
    const w = 1;
    const h = w / normAsp;
    return { x: 0, y: (1 - h) / 2, w, h };
  }
  const h = 1;
  const w = h * normAsp;
  return { x: (1 - w) / 2, y: 0, w, h };
}

/** 保持中心，把矩形改成目标比例并夹进 [0,1]。 */
export function refitRectToAspect(r: ShotRect, normAsp: number): ShotRect {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let w = Math.sqrt(Math.max(r.w * r.h * normAsp, 1e-12));
  let h = w / normAsp;
  if (w > 1) { w = 1; h = w / normAsp; }
  if (h > 1) { h = 1; w = h * normAsp; }
  const x = Math.min(1 - w, Math.max(0, cx - w / 2));
  const y = Math.min(1 - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}

/** 从锚点拖到指针，生成固定比例矩形（向拖拽方向展开）。 */
export function aspectRectFromDrag(
  ax: number, ay: number, px: number, py: number, normAsp: number, minSize: number,
): ShotRect {
  const dw = px - ax;
  const dh = py - ay;
  const rawW = Math.abs(dw);
  const rawH = Math.abs(dh);
  let w: number;
  let h: number;
  if (rawW / Math.max(rawH, 1e-9) > normAsp) {
    w = Math.max(rawW, minSize);
    h = w / normAsp;
  } else {
    h = Math.max(rawH, minSize);
    w = h * normAsp;
  }
  if (w > 1) { w = 1; h = w / normAsp; }
  if (h > 1) { h = 1; w = h * normAsp; }
  let x = dw >= 0 ? ax : ax - w;
  let y = dh >= 0 ? ay : ay - h;
  x = Math.min(1 - w, Math.max(0, x));
  y = Math.min(1 - h, Math.max(0, y));
  return { x, y, w, h };
}

/** 右下角缩放：以左上角为锚，锁比例。 */
export function aspectRectFromResize(
  base: ShotRect, px: number, py: number, normAsp: number, minSize: number,
): ShotRect {
  const rawW = Math.max(minSize, px - base.x);
  const rawH = Math.max(minSize, py - base.y);
  let w: number;
  let h: number;
  if (rawW / rawH > normAsp) {
    w = rawW;
    h = w / normAsp;
  } else {
    h = rawH;
    w = h * normAsp;
  }
  if (base.x + w > 1) { w = 1 - base.x; h = w / normAsp; }
  if (base.y + h > 1) { h = 1 - base.y; w = h * normAsp; }
  if (w < minSize) { w = minSize; h = w / normAsp; }
  if (h < minSize) { h = minSize; w = h * normAsp; }
  return { x: base.x, y: base.y, w, h };
}
