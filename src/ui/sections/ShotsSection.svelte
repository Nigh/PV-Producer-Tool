<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import type { Shot, ShotRect, ShotTransition, ShotMotion } from '../../core/types';
  import {
    ui, engine, setShots, padShots, fullFrameShotRect,
  } from '../store.svelte';
  import {
    canvasAspect, shotNormAspect, aspectRectFromDrag, aspectRectFromResize, refitRectToAspect,
  } from '../../core/shotAspect';
  import Slider from '../Slider.svelte';

  const TRANSITIONS: ShotTransition[] = ['cut', 'fade', 'slide', 'zoom'];
  const MOTIONS: ShotMotion[] = ['none', 'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown'];
  const MIN_SIZE = 0.05;

  let selected = $state(0);

  // 依赖 ui.text / ui.lrcName 触发重算；实际数据来自引擎
  const lines = $derived.by(() => {
    void ui.text;
    void ui.lrcName;
    return engine.segmentTexts;
  });

  const hasImage = $derived.by(() => {
    void ui.mediaLoaded;
    void ui.mediaName;
    return !!engine.sourceImage;
  });

  const currentShot = $derived(ui.shots[selected] ?? null);

  const normAsp = $derived.by(() => {
    void ui.aspectRatio;
    void ui.mediaLoaded;
    const img = engine.sourceImage;
    const asp = canvasAspect(ui.aspectRatio);
    if (!img) return asp;
    return shotNormAspect(asp, img.naturalWidth, img.naturalHeight);
  });

  // 歌词行数变化时补齐 shots 槽位，保证每句都有可编辑索引
  $effect(() => {
    const n = lines.length;
    if (n > 0 && ui.shots.length < n) {
      setShots(padShots(ui.shots, n));
    }
    if (selected >= n && n > 0) selected = n - 1;
  });

  // ── 原图缩略图（源图的 object URL 已释放，只能经 canvas 重绘）──
  let thumbCanvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    void ui.mediaLoaded;
    void ui.mediaName;
    const img = engine.sourceImage;
    if (!img || !thumbCanvas) return;
    const maxW = 560;
    const scale = Math.min(1, maxW / img.naturalWidth);
    thumbCanvas.width = Math.round(img.naturalWidth * scale);
    thumbCanvas.height = Math.round(img.naturalHeight * scale);
    thumbCanvas.getContext('2d')!.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
  });

  // ── 取景框拖拽（draw / move / resize）──
  let wrapper: HTMLDivElement | undefined = $state();
  // 拖拽期间的本地框（松手才提交到引擎，避免每帧重切纹理）
  let draftRect: ShotRect | null = $state(null);
  let dragMode: 'draw' | 'move' | 'resize' | null = null;
  let dragAnchor = { x: 0, y: 0 };      // draw: 起点；move: 指针相对框左上角偏移
  let dragBase: ShotRect | null = null; // move/resize 起始时的框

  const displayRect = $derived(draftRect ?? currentShot?.rect ?? null);

  function toNorm(e: PointerEvent): { x: number; y: number } {
    const b = wrapper!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    };
  }

  function clampMove(r: ShotRect): ShotRect {
    // 移动只夹位置，比例已由绘制/缩放保证
    const w = Math.min(1, Math.max(MIN_SIZE, r.w));
    const h = Math.min(1, Math.max(MIN_SIZE, r.h));
    return {
      x: Math.min(1 - w, Math.max(0, r.x)),
      y: Math.min(1 - h, Math.max(0, r.y)),
      w, h,
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (!wrapper) return;
    wrapper.setPointerCapture(e.pointerId);
    const p = toNorm(e);
    const r = displayRect;

    const onHandle = r
      && Math.abs(p.x - (r.x + r.w)) < 0.04
      && Math.abs(p.y - (r.y + r.h)) < 0.04;
    const inside = r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

    if (onHandle && r) {
      dragMode = 'resize';
      dragBase = { ...r };
    } else if (inside && r) {
      dragMode = 'move';
      dragBase = { ...r };
      dragAnchor = { x: p.x - r.x, y: p.y - r.y };
    } else {
      dragMode = 'draw';
      dragAnchor = p;
      draftRect = aspectRectFromDrag(p.x, p.y, p.x + MIN_SIZE, p.y + MIN_SIZE, normAsp, MIN_SIZE);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragMode) return;
    const p = toNorm(e);
    if (dragMode === 'draw') {
      draftRect = aspectRectFromDrag(dragAnchor.x, dragAnchor.y, p.x, p.y, normAsp, MIN_SIZE);
    } else if (dragMode === 'move' && dragBase) {
      draftRect = clampMove({ ...dragBase, x: p.x - dragAnchor.x, y: p.y - dragAnchor.y });
    } else if (dragMode === 'resize' && dragBase) {
      draftRect = aspectRectFromResize(dragBase, p.x, p.y, normAsp, MIN_SIZE);
    }
  }

  function onPointerUp() {
    if (dragMode && draftRect) {
      commitRect(refitRectToAspect(draftRect, normAsp));
    }
    dragMode = null;
    dragBase = null;
    draftRect = null;
  }

  function commitRect(rect: ShotRect) {
    const shots = padShots(ui.shots, lines.length);
    const prev = shots[selected];
    shots[selected] = { in: 'fade', out: 'fade', motion: 'none', ...prev, rect };
    setShots(shots);
  }

  function updateShot(patch: Partial<Shot>) {
    if (!currentShot) return;
    const shots = padShots(ui.shots, lines.length);
    shots[selected] = { ...currentShot, ...patch };
    setShots(shots);
  }

  function clearShot() {
    const shots = padShots(ui.shots, lines.length);
    shots[selected] = null;
    setShots(shots);
  }

  function copyPrevShot() {
    if (selected <= 0) return;
    const shots = padShots(ui.shots, lines.length);
    const prev = shots.slice(0, selected).reverse().find((s) => !!s);
    if (!prev) return;
    shots[selected] = { ...prev, rect: refitRectToAspect({ ...prev.rect }, normAsp) };
    setShots(shots);
  }

  function fillUnsetFullFrame() {
    const shots = padShots(ui.shots, lines.length);
    const rect = fullFrameShotRect();
    let changed = false;
    for (let i = 0; i < shots.length; i++) {
      if (!shots[i]) {
        shots[i] = { rect: { ...rect }, in: 'fade', out: 'fade', motion: 'none' };
        changed = true;
      }
    }
    if (changed) setShots(shots);
  }

  function selectLine(i: number) {
    selected = i;
    previewLine(i);
  }

  function previewLine(i: number) {
    engine.seek(Math.max(0, engine.segmentStartTime(i)));
  }
</script>

{#if !hasImage}
  <p class="shots-empty">{t('shots_need_image')}</p>
{:else}
  <p class="shots-empty">{t('shot_hint')}</p>

  <Slider
    label={t('bg_opacity')} display={`${Math.round(ui.opacity * 100)}%`}
    min={0} max={1} step={0.05} bind:value={ui.opacity}
    oninput={() => { engine.effectOpacity = ui.opacity; }}
  />

  <div
    class="shot-frame"
    role="application"
    aria-label={t('shot_hint')}
    bind:this={wrapper}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <canvas bind:this={thumbCanvas} class="shot-thumb"></canvas>
    {#if displayRect}
      <div
        class="shot-rect"
        style="left:{displayRect.x * 100}%;top:{displayRect.y * 100}%;width:{displayRect.w * 100}%;height:{displayRect.h * 100}%"
      >
        <span class="shot-rect-handle"></span>
      </div>
    {/if}
  </div>

  {#if !currentShot}
    <p class="shots-empty">{t('shot_unset')}</p>
  {/if}

  <div class="control-group">
    <div class="template-actions">
      <button class="btn btn-xs" onclick={fillUnsetFullFrame}>{t('shot_fill_unset')}</button>
      <button class="btn btn-xs" disabled={selected <= 0} onclick={copyPrevShot}>{t('shot_copy_prev')}</button>
    </div>
  </div>

  {#if currentShot}
    <div class="control-group">
      <div class="shot-opt-row">
        <label class="shot-opt">
          <span>{t('shot_in')}</span>
          <select class="select select-xs" value={currentShot.in ?? 'fade'}
            onchange={(e) => updateShot({ in: (e.currentTarget as HTMLSelectElement).value as ShotTransition })}>
            {#each TRANSITIONS as tr (tr)}
              <option value={tr}>{t(('tr_' + tr) as any)}</option>
            {/each}
          </select>
        </label>
        <label class="shot-opt">
          <span>{t('shot_out')}</span>
          <select class="select select-xs" value={currentShot.out ?? 'fade'}
            onchange={(e) => updateShot({ out: (e.currentTarget as HTMLSelectElement).value as ShotTransition })}>
            {#each TRANSITIONS as tr (tr)}
              <option value={tr}>{t(('tr_' + tr) as any)}</option>
            {/each}
          </select>
        </label>
        <label class="shot-opt">
          <span>{t('shot_motion')}</span>
          <select class="select select-xs" value={currentShot.motion ?? 'none'}
            onchange={(e) => updateShot({ motion: (e.currentTarget as HTMLSelectElement).value as ShotMotion })}>
            {#each MOTIONS as mo (mo)}
              <option value={mo}>{t(('mo_' + mo) as any)}</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="template-actions">
        <button class="btn btn-xs" onclick={() => previewLine(selected)}>{t('shot_preview')}</button>
        <button class="btn btn-xs btn-error" onclick={clearShot}>{t('shot_clear')}</button>
      </div>
    </div>
  {/if}

  <ul class="shot-lines">
    {#each lines as line, i (i)}
      <li>
        <button
          class="shot-line"
          class:shot-line-active={selected === i}
          onclick={() => selectLine(i)}
        >
          <span class="shot-line-dot" class:shot-line-dot-set={!!ui.shots[i]}></span>
          <span class="shot-line-idx">{i + 1}</span>
          <span class="shot-line-text">{line || '—'}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
