<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { templates } from '../templates';
  import { showToast } from '../core/uiHelpers';
  import {
    ui, engine, tplName, selectTemplate,
    deleteSelectedTemplate, exportShareCode, applyTextInput,
  } from './store.svelte';
  import Slider from './Slider.svelte';

  const SWATCHES = [
    { color: '#ffffff', key: 'white' },
    { color: '#000000', key: 'black' },
    { color: '#1122ee', key: 'blue' },
    { color: '#8b1a1a', key: 'red' },
    { color: '#EEDD11', key: 'yellow' },
    { color: '#f5c6d0', key: 'pink' },
    { color: '#ED1C24', key: 'p5red' },
    { color: '#ABC5D2', key: 'light_blue' },
  ] as const;

  let deleteConfirm = $state(false);
  let textExpanded = $state(false);
  let isSeeking = $state(false);
  let pendingFile: File | null = $state(null);

  const isUserTemplate = $derived(ui.selected.startsWith('user-'));

  // 模板按钮网格（OBS 内嵌 Chromium 不响应 <select>，按钮可用）
  const templateOptions = $derived([
    ...templates.map((tp, i) => ({ value: String(i), label: tplName(tp) })),
    ...ui.customTemplates.map((tp, i) => ({ value: `user-${i}`, label: `⭐ ${tp.name}` })),
    ...(ui.sharedTemplate ? [{ value: 'shared', label: `↗ ${ui.sharedTemplate.name}` }] : []),
    { value: 'custom', label: t('custom') },
  ]);

  function onSelectChange(e: Event) {
    deleteConfirm = false;
    selectTemplate((e.currentTarget as HTMLSelectElement).value);
  }

  function pickTemplate(value: string) {
    deleteConfirm = false;
    selectTemplate(value);
  }

  function setCanvasColor(color: string) {
    ui.canvasColor = color;
    engine.canvasColor = color || null;
  }

  // ── 字体（Local Font Access API，仅 Chromium 桌面）──
  const fontApiAvailable = 'queryLocalFonts' in window;
  let fontBtnVisible = $state(true);

  async function loadLocalFonts(): Promise<void> {
    // queryLocalFonts 每个字重/样式一条，折叠为字体族
    const fonts: { family: string }[] = await (window as any).queryLocalFonts();
    const families = [...new Set(fonts.map((f) => f.family).filter(Boolean))].sort();
    if (!families.length) return;
    ui.fontFamilies = families;
    if (ui.fontFamily && !families.includes(ui.fontFamily)) ui.fontFamily = '';
    fontBtnVisible = false;
  }

  function onFontLoadClick() {
    loadLocalFonts().catch((err) => {
      console.warn('[PV] Local font access denied or failed:', err);
      showToast(t('load_fonts_failed'));
    });
  }

  function onFontChange() {
    // 引号包裹，含空格的字体名才是合法 CSS font stack
    engine.fontFamily = ui.fontFamily ? `"${ui.fontFamily}"` : null;
  }

  onMount(() => {
    if (!fontApiAvailable) return;
    // 仅当此前已授权时静默加载；首次访问需要用户点击（user activation）
    (navigator.permissions?.query({ name: 'local-fonts' as PermissionName }) ?? Promise.reject())
      .then((st) => { if (st.state === 'granted') return loadLocalFonts(); })
      .catch(() => { /* permission API unsupported: wait for button click */ });
  });

  // ── 文本输入（防抖应用）──
  let textTimer: ReturnType<typeof setTimeout>;
  function onTextInput() {
    clearTimeout(textTimer);
    textTimer = setTimeout(() => applyTextInput(ui.text), 400);
  }

  // ── LRC 导入 ──
  let lrcInput: HTMLInputElement;
  async function onLrcChange() {
    const file = lrcInput.files?.[0];
    if (!file) return;
    ui.lrcName = file.name;
    const content = await file.text();
    ui.text = content;
    applyTextInput(content);
    lrcInput.value = '';
  }

  // ── 媒体 ──
  let mediaInput: HTMLInputElement;
  function onMediaChange() {
    const file = mediaInput.files?.[0];
    if (file) {
      pendingFile = file;
      ui.mediaName = file.name;
      ui.mediaPicked = true;
    }
  }

  async function applyMedia() {
    if (!pendingFile) return;
    try {
      await engine.addMedia(pendingFile, ui.mediaMode);
      engine.effectOpacity = 0.7;
      ui.opacity = 0.7;
      ui.mediaLoaded = true;
      ui.mediaX = 0; ui.mediaY = 0; ui.mediaScale = 1;
    } catch (err) {
      console.warn('[PV] Media load failed:', err);
    }
    pendingFile = null;
  }

  // ── 音频 ──
  let audioInput: HTMLInputElement;
  async function onAudioChange() {
    const file = audioInput.files?.[0];
    if (!file) return;
    ui.audioName = file.name;
    await engine.beat.loadAudio(file);
    ui.audioLoaded = true;
    ui.audioPaused = false;
  }

  function toggleAudio() {
    if (engine.beat.paused) {
      engine.beat.resume();
      ui.audioPaused = false;
    } else {
      engine.beat.pause();
      ui.audioPaused = true;
    }
  }

  // ── 播放时间轴 ──
  function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  let seekValue = $state(0);
  onMount(() => {
    let raf = 0;
    const tick = () => {
      ui.playbackTime = engine.playbackTime;
      ui.timelineDuration = engine.timelineDuration;
      if (!isSeeking && ui.timelineDuration > 0) {
        seekValue = ui.playbackTime / ui.timelineDuration;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function onSeek() {
    engine.seek(seekValue * engine.timelineDuration);
  }

  function togglePause() {
    if (engine.paused) {
      engine.resume();
      ui.paused = false;
    } else {
      engine.pause();
      ui.paused = true;
    }
  }
</script>

<div class="controls">
  <details class="collapsible-section" open>
    <summary class="panel-title">{t('template')}</summary>
    <div class="control-group">
      <div class="template-buttons">
        {#each templateOptions as opt (opt.value)}
          <button
            class="btn btn-xs {ui.selected === opt.value ? 'btn-primary' : 'btn-neutral'}"
            onclick={() => pickTemplate(opt.value)}
          >{opt.label}</button>
        {/each}
      </div>
      <select class="select select-sm w-full" value={ui.selected} onchange={onSelectChange}>
        {#each templateOptions as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      {#if isUserTemplate}
        <div class="template-actions">
          <button class="btn btn-xs" onclick={() => { deleteConfirm = true; }}>{t('delete_tpl')}</button>
          <button class="btn btn-xs" onclick={exportShareCode}>{t('export_code')}</button>
        </div>
        {#if deleteConfirm}
          <div class="tpl-inline-input">
            <span class="tpl-confirm-text">
              {t('confirm_delete')} "{ui.customTemplates[parseInt(ui.selected.split('-')[1])]?.name}"？
            </span>
            <button class="btn btn-xs btn-error" onclick={() => { deleteConfirm = false; deleteSelectedTemplate(); }}>{t('delete_tpl')}</button>
            <button class="btn btn-xs" onclick={() => { deleteConfirm = false; }}>{t('cancel')}</button>
          </div>
        {/if}
      {/if}
    </div>

    <div class="control-group">
      <label for="canvas-color-swatches">{t('canvas_color')}</label>
      <div class="color-swatches" id="canvas-color-swatches">
        <button
          class="swatch"
          class:swatch-active={ui.canvasColor === ''}
          title={t('follow_template')}
          aria-label={t('follow_template')}
          onclick={() => setCanvasColor('')}
        ><span class="swatch-auto">A</span></button>
        {#each SWATCHES as sw (sw.color)}
          <button
            class="swatch"
            class:swatch-active={ui.canvasColor === sw.color}
            title={t(sw.key)}
            aria-label={t(sw.key)}
            style="background:{sw.color}"
            onclick={() => setCanvasColor(sw.color)}
          ></button>
        {/each}
      </div>
    </div>

    {#if fontApiAvailable}
      <div class="control-group">
        <label for="font-select">{t('font_label')}</label>
        <div class="font-pick-row">
          <select id="font-select" class="select select-sm flex-1 min-w-0" bind:value={ui.fontFamily} onchange={onFontChange}>
            <option value="">{t('follow_template')}</option>
            {#each ui.fontFamilies as family (family)}
              <option value={family}>{family}</option>
            {/each}
          </select>
          {#if fontBtnVisible}
            <button class="btn btn-sm shrink-0" title={t('load_local_fonts')} onclick={onFontLoadClick}>あ/A</button>
          {/if}
        </div>
      </div>
    {/if}

    <div class="control-group">
      <label for="text-input">{t('text_label')}</label>
      <textarea
        id="text-input"
        class="textarea textarea-sm w-full"
        rows={textExpanded ? 6 : 1}
        placeholder="深夜東京/の6畳半夢"
        bind:value={ui.text}
        oninput={onTextInput}
        onfocus={() => { textExpanded = true; }}
        onblur={() => { textExpanded = false; }}
      ></textarea>
    </div>

    <Slider
      label={t('seg_duration')} display={`${ui.segDuration.toFixed(1)}s`}
      min={1} max={10} step={0.5} bind:value={ui.segDuration}
      oninput={() => { engine.segmentDuration = ui.segDuration; }}
    />
    <Slider
      label={t('anim_speed')} display={`${ui.speed.toFixed(1)}x`}
      min={0} max={4} step={0.1} bind:value={ui.speed}
      oninput={() => { engine.animationSpeed = ui.speed; }}
    />
    <Slider
      label={t('motion_intensity')} display={`${ui.motion.toFixed(1)}x`}
      min={0} max={2} step={0.1} bind:value={ui.motion}
      oninput={() => { engine.motionIntensity = ui.motion; }}
    />
    <Slider
      label={t('bg_opacity')} display={`${Math.round(ui.opacity * 100)}%`}
      min={0} max={1} step={0.05} bind:value={ui.opacity}
      oninput={() => { engine.effectOpacity = ui.opacity; }}
    />

    <div class="control-group">
      <label for="media-pick-btn">{t('media')}</label>
      <div class="file-pick">
        <button id="media-pick-btn" class="btn btn-xs" onclick={() => mediaInput.click()}>{t('choose_file')}</button>
        <span class="file-pick-name">{ui.mediaName || t('no_file')}</span>
        <input type="file" accept="image/*,video/mp4,video/webm,video/mov" hidden bind:this={mediaInput} onchange={onMediaChange} />
      </div>
    </div>

    {#if ui.mediaPicked}
      <div class="control-group">
        <label for="media-mode">{t('media_mode')}</label>
        <select id="media-mode" class="select select-sm w-full" bind:value={ui.mediaMode}>
          <option value="fit">{t('auto_fit')}</option>
          <option value="free">{t('free_mode')}</option>
        </select>
        <button class="btn btn-sm" onclick={applyMedia}>{t('apply')}</button>
      </div>
    {/if}

    <div class="control-group">
      <label for="audio-pick-btn">{t('audio')}</label>
      <div class="file-pick">
        <button id="audio-pick-btn" class="btn btn-xs" onclick={() => audioInput.click()}>{t('choose_file')}</button>
        <span class="file-pick-name">{ui.audioName || t('no_file')}</span>
        <input type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac,.wma,.opus" hidden bind:this={audioInput} onchange={onAudioChange} />
      </div>
    </div>

    {#if ui.audioLoaded}
      <div class="control-group">
        <div class="audio-row">
          <button class="btn btn-sm" onclick={toggleAudio}>{ui.audioPaused ? t('play') : t('pause')}</button>
          <span class="audio-status">{ui.audioPaused ? t('paused') : t('playing')}</span>
        </div>
      </div>
    {/if}

    <div class="control-group">
      <label for="lrc-pick-btn">LRC</label>
      <div class="file-pick">
        <button id="lrc-pick-btn" class="btn btn-xs" onclick={() => lrcInput.click()}>{t('lrc_import')}</button>
        <span class="file-pick-name">{ui.lrcName || t('no_file')}</span>
        <input type="file" accept=".lrc,text/plain" hidden bind:this={lrcInput} onchange={onLrcChange} />
      </div>
    </div>

    <div class="control-group">
      <div class="timeline-header">
        <label for="seek-slider">{t('timer_label')} <span class="opacity-70">{formatClock(ui.playbackTime)} / {formatClock(ui.timelineDuration)}</span></label>
        <button class="btn btn-xs" onclick={togglePause}>{ui.paused ? '▶' : '⏸'}</button>
      </div>
      <input
        id="seek-slider"
        type="range" class="range range-xs range-primary w-full"
        min="0" max="1" step="0.001"
        bind:value={seekValue}
        oninput={onSeek}
        onpointerdown={() => { isSeeking = true; }}
        onpointerup={() => { isSeeking = false; }}
      />
    </div>

    <Slider
      label={t('bpm')} display={String(ui.bpm)}
      min={30} max={240} step={1} bind:value={ui.bpm}
      oninput={() => { engine.beat.bpm = ui.bpm; }}
    />
    <Slider
      label={t('beat_react')} display={ui.beatReact.toFixed(2)}
      min={0} max={1} step={0.05} bind:value={ui.beatReact}
      oninput={() => { engine.beatReactivity = ui.beatReact; }}
    />

    <div class="control-group">
      <label for="fps-select">{t('preview_fps')} <span class="opacity-70">{ui.fpsActual ? `(${ui.fpsActual} fps)` : ''}</span></label>
      <select id="fps-select" class="select select-sm w-full" bind:value={ui.fps} onchange={() => { engine.previewFps = ui.fps; }}>
        <option value={0}>{t('fps_unlimited')}</option>
        {#each [24, 30, 60, 120] as v (v)}
          <option value={v}>{v} fps</option>
        {/each}
      </select>
    </div>
  </details>

  <div class="hide-hint">{t('hint_press')} <kbd class="kbd kbd-xs">H</kbd> {t('hint_hide_panels')}</div>
</div>
