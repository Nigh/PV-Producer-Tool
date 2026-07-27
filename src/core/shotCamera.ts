// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// 静止画 MAD 分镜相机。持有原始大图（不受 GPU 纹理上限影响的 HTMLImage），
// 每个分镜按取景框从原图现切独立纹理（懒加载 + 缓存），双 sprite 实现
// 上一镜与当前镜的交叉转场。视图计算全部委托给 shotMath 的纯函数。

import * as PIXI from 'pixi.js';
import type { Shot } from './types';
import { expandRect, evalTransition, computeShotView } from './shotMath';

/** 取景框外的运动余量比例（供 Ken Burns 平移/推拉与 zoom 转场使用）。 */
const CROP_MARGIN = 0.3;

interface TexEntry {
  texture: PIXI.Texture;
  texScale: number;
  expRect: ReturnType<typeof expandRect>;
  key: string;
}

export class ShotCamera {
  container = new PIXI.Container();

  private img: HTMLImageElement | null = null;
  private shots: (Shot | null)[] = [];
  private maxTex = 4096;
  private cache = new Map<number, TexEntry>();

  private curSprite = new PIXI.Sprite();
  private prevSprite = new PIXI.Sprite();
  private curSlot = -1;

  constructor() {
    this.curSprite.anchor.set(0.5);
    this.prevSprite.anchor.set(0.5);
    this.prevSprite.visible = false;
    this.container.addChild(this.prevSprite, this.curSprite);
  }

  /** GPU 允许的最大纹理边长（引擎查询后注入）。 */
  setMaxTextureSize(size: number): void {
    this.maxTex = size;
  }

  /** 挂到 media 层。引擎 addMedia 清空该层后需要重新调用。 */
  attach(layer: PIXI.Container): void {
    if (this.container.destroyed) {
      // 容器被引擎的 removeChildren+destroy 波及时整体重建
      this.container = new PIXI.Container();
      this.curSprite = new PIXI.Sprite();
      this.prevSprite = new PIXI.Sprite();
      this.curSprite.anchor.set(0.5);
      this.prevSprite.anchor.set(0.5);
      this.prevSprite.visible = false;
      this.container.addChild(this.prevSprite, this.curSprite);
      this.clearCache();
      this.curSlot = -1;
    }
    if (this.container.parent !== layer) {
      layer.addChild(this.container);
    }
  }

  /** 从父层摘除（不销毁），供引擎在清空 media 层前调用。 */
  detach(): void {
    this.container.parent?.removeChild(this.container);
  }

  setImage(img: HTMLImageElement | null): void {
    this.img = img;
    this.clearCache();
    this.curSlot = -1;
  }

  setShots(shots: (Shot | null)[]): void {
    this.shots = shots;
    // 取景框变化的槽位作废缓存纹理
    for (const [slot, entry] of this.cache) {
      const shot = shots[slot];
      if (!shot || entry.key !== rectKey(shot)) {
        entry.texture.destroy(true);
        this.cache.delete(slot);
      }
    }
  }

  /** 有原图且至少定义了一个分镜时启用。 */
  get enabled(): boolean {
    return !!this.img && this.shots.some((s) => !!s);
  }

  /**
   * 每帧更新。index 为当前歌词行/文本段索引，t 为段内时间，duration 为段时长。
   * 分镜数组可稀疏：向前回退到最近定义的镜；index 之前无镜时用第一个有效镜。
   */
  update(index: number, t: number, duration: number, screenW: number, screenH: number): void {
    if (!this.enabled || this.container.destroyed) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    const slot = this.resolveSlot(index);
    if (slot < 0) {
      this.container.visible = false;
      return;
    }
    const shot = this.shots[slot]!;

    if (slot !== this.curSlot) {
      // 冻结上一镜的最终状态用于交叉转场
      if (this.curSlot >= 0 && this.curSprite.texture !== PIXI.Texture.EMPTY) {
        this.prevSprite.texture = this.curSprite.texture;
        this.prevSprite.position.copyFrom(this.curSprite.position);
        this.prevSprite.scale.copyFrom(this.curSprite.scale);
        this.prevSprite.visible = true;
      }
      this.curSlot = slot;
    }

    const entry = this.entryFor(slot, shot);
    if (!entry) {
      this.container.visible = false;
      return;
    }
    this.curSprite.texture = entry.texture;

    const inType = shot.in ?? 'fade';
    const outType = shot.out ?? 'fade';
    const view = computeShotView({
      imgW: this.img!.naturalWidth,
      imgH: this.img!.naturalHeight,
      rect: shot.rect,
      expRect: entry.expRect,
      texScale: entry.texScale,
      screenW, screenH,
      motion: shot.motion ?? 'none',
      inType, outType,
      t, duration,
    });
    this.curSprite.scale.set(view.scale);
    this.curSprite.position.set(view.x, view.y);
    this.curSprite.alpha = view.alpha;

    // 上一镜在入场窗口内淡出；cut 入场立即消失
    if (this.prevSprite.visible) {
      const { pIn } = evalTransition(inType, outType, t, duration);
      if (inType === 'cut' || pIn >= 1) {
        this.prevSprite.visible = false;
      } else {
        this.prevSprite.alpha = 1 - pIn;
      }
    }
  }

  destroy(): void {
    this.clearCache();
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }

  /** index 处的有效分镜槽位：向前回退；index 之前没有则取第一个非空。 */
  private resolveSlot(index: number): number {
    for (let i = Math.min(index, this.shots.length - 1); i >= 0; i--) {
      if (this.shots[i]) return i;
    }
    return this.shots.findIndex((s) => !!s);
  }

  private entryFor(slot: number, shot: Shot): TexEntry | null {
    const key = rectKey(shot);
    const cached = this.cache.get(slot);
    if (cached && cached.key === key) return cached;
    cached?.texture.destroy(true);
    this.cache.delete(slot);

    const img = this.img!;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const expRect = expandRect(shot.rect, CROP_MARGIN);
    const sw = Math.max(1, Math.round(expRect.w * iw));
    const sh = Math.max(1, Math.round(expRect.h * ih));
    const texScale = Math.min(1, this.maxTex / Math.max(sw, sh));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * texScale));
    canvas.height = Math.max(1, Math.round(sh * texScale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      img,
      Math.round(expRect.x * iw), Math.round(expRect.y * ih), sw, sh,
      0, 0, canvas.width, canvas.height,
    );

    const entry: TexEntry = {
      texture: PIXI.Texture.from(canvas),
      texScale,
      expRect,
      key,
    };
    this.cache.set(slot, entry);
    return entry;
  }

  private clearCache(): void {
    for (const entry of this.cache.values()) {
      entry.texture.destroy(true);
    }
    this.cache.clear();
  }
}

function rectKey(shot: Shot): string {
  const r = shot.rect;
  return `${r.x},${r.y},${r.w},${r.h}`;
}
