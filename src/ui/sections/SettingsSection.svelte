<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t, locale } from '../../i18n';
  import { showToast, showModal } from '../../core/uiHelpers';
  import { ui, engine, toggleNowPlaying } from '../store.svelte';
  import { theme, setTheme } from '../theme.svelte';

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

  // ── Now Playing（zh 限定）──
  async function onNpToggle(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    const ok = await toggleNowPlaying(checked);
    if (!ok) {
      const npFailLink = 'https://github.com/Widdit/now-playing-service';
      showModal(
        `<p class="pv-modal-title">${t('np_fail_title')}</p>
         <p>${t('np_fail_body')}</p>
         <p><a href="${npFailLink}" target="_blank" rel="noopener">${npFailLink}</a></p>`,
        t('modal_confirm'),
      );
    }
  }
</script>

<div class="control-group">
  <label class="effect-toggle">
    <input
      type="checkbox" class="toggle toggle-sm"
      checked={theme.light}
      onchange={(e) => setTheme((e.currentTarget as HTMLInputElement).checked)}
    />
    <span>{t('theme_light')}</span>
  </label>
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
  <label for="fps-select">{t('preview_fps')} <span class="opacity-70">{ui.fpsActual ? `(${ui.fpsActual} fps)` : ''}</span></label>
  <select id="fps-select" class="select select-sm w-full" bind:value={ui.fps} onchange={() => { engine.previewFps = ui.fps; }}>
    <option value={0}>{t('fps_unlimited')}</option>
    {#each [24, 30, 60, 120] as v (v)}
      <option value={v}>{v} fps</option>
    {/each}
  </select>
</div>

{#if locale === 'zh'}
  <div class="control-group">
    <label class="effect-toggle">
      <input type="checkbox" class="checkbox checkbox-xs" checked={ui.npListening} onchange={onNpToggle} />
      <span>{t('listen_now_playing')}</span>
      <span class="help-tip tooltip tooltip-top" data-tip={t('listen_np_tip')}>?</span>
    </label>
  </div>
{/if}
