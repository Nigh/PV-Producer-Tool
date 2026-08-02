// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import type { ColorPalette, UpdateContext } from '../core/types';

export abstract class BaseEffect {
  abstract readonly name: string;
  /** Mark as true for GPU/CPU-heavy effects — engine will skip frames when many effects are active */
  readonly heavy: boolean = false;
  protected container!: PIXI.Container;
  protected config: Record<string, any> = {};
  protected palette!: ColorPalette;
  protected renderer?: PIXI.Renderer;
  private _ownContainer!: PIXI.Container;

  init(
    parentLayer: PIXI.Container,
    config: Record<string, any>,
    palette: ColorPalette,
    renderer?: PIXI.Renderer,
  ): void {
    this._ownContainer = new PIXI.Container();
    parentLayer.addChild(this._ownContainer);
    this.container = this._ownContainer;
    this.config = config;
    this.palette = palette;
    this.renderer = renderer;
    this.setup();
  }

  protected abstract setup(): void;
  abstract update(ctx: UpdateContext): void;

  destroy(): void {
    try {
      // 先摘 filter 再 destroy，避免 Pixi v8 渲染管线读到已销毁 TextureSource.alphaMode
      this._ownContainer.removeChildren().forEach(c => {
        try {
          detachFiltersDeep(c);
          c.destroy({ children: true });
        } catch { /* already gone */ }
      });
      detachFiltersDeep(this._ownContainer);
      this._ownContainer.destroy();
    } catch { /* container already destroyed */ }
  }
}

/** 递归清空 filters，销毁前调用。 */
export function detachFiltersDeep(root: PIXI.Container): void {
  const walk = (node: PIXI.Container) => {
    if (node.filters?.length) node.filters = null;
    for (const child of node.children) {
      if (child instanceof PIXI.Container) walk(child);
    }
  };
  walk(root);
}