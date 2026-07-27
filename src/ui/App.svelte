<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { ui, initApp } from './store.svelte';
  import './theme.svelte';
  import TemplateSection from './sections/TemplateSection.svelte';
  import PlaybackSection from './sections/PlaybackSection.svelte';
  import PostFxSection from './sections/PostFxSection.svelte';
  import ShotsSection from './sections/ShotsSection.svelte';
  import EffectsSection from './sections/EffectsSection.svelte';
  import AiSection from './sections/AiSection.svelte';
  import ExportSection from './sections/ExportSection.svelte';
  import SettingsSection from './sections/SettingsSection.svelte';

  const REPO_URL = 'https://github.com/Nigh/PV-Producer-Tool';

  const SECTIONS = [
    { id: 'template', title: t('nav_template'), sub: t('nav_template_sub'), component: TemplateSection },
    { id: 'playback', title: t('nav_playback'), sub: t('nav_playback_sub'), component: PlaybackSection },
    { id: 'shots', title: t('nav_shots'), sub: t('nav_shots_sub'), component: ShotsSection },
    { id: 'postfx', title: t('nav_postfx'), sub: t('nav_postfx_sub'), component: PostFxSection },
    { id: 'effects', title: t('nav_effects'), sub: t('nav_effects_sub'), component: EffectsSection },
    { id: 'ai', title: t('nav_ai'), sub: t('nav_ai_sub'), component: AiSection },
    { id: 'export', title: t('nav_export'), sub: t('nav_export_sub'), component: ExportSection },
    { id: 'settings', title: t('nav_settings'), sub: t('nav_settings_sub'), component: SettingsSection },
  ] as const;

  let container: HTMLDivElement;
  let active = $state<typeof SECTIONS[number]['id']>('template');
  let sidebarOpen = $state(!window.matchMedia('(max-width: 768px)').matches);

  const activeSection = $derived(SECTIONS.find((s) => s.id === active)!);

  onMount(() => {
    initApp(container);

    // 画布区域尺寸变化时通知 PIXI ResizePlugin（它只监听 window resize）。
    // ponytail: 用合成 resize 事件代替给引擎加 resize API，侧栏显隐/折叠即时生效。
    const ro = new ResizeObserver(() => window.dispatchEvent(new Event('resize')));
    ro.observe(container);

    // H 键隐藏/显示全部 UI（输入框聚焦或弹窗打开时忽略）
    const onKeydown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('.pv-modal-overlay')) return;
      if (e.key.toLowerCase() === 'h') {
        document.body.classList.toggle('pv-panels-hidden');
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('keydown', onKeydown);
      ro.disconnect();
    };
  });
</script>

<div class="app-shell">
  <aside class="sidebar" class:sidebar-closed={!sidebarOpen}>
    <div class="sidebar-header">
      <span class="sidebar-brand">{t('brand_title')}</span>
    </div>
    <div class="sidebar-body">
      <nav class="nav-rail">
        <ul class="menu menu-sm w-full p-0 gap-1">
          {#each SECTIONS as section (section.id)}
            <li>
              <button
                class="nav-item"
                class:menu-active={active === section.id}
                onclick={() => { active = section.id; }}
              >
                <span class="nav-item-title">{section.title}</span>
                {#if section.sub}
                  <span class="nav-item-sub">{section.sub}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </nav>
      <div class="nav-content">
        <div class="panel-title">{activeSection.title}</div>
        <activeSection.component />
      </div>
    </div>
    <div class="sidebar-footer">
      <button
        class="sidebar-collapse"
        title={t('collapse')}
        aria-label={t('collapse')}
        onclick={() => { sidebarOpen = false; }}
      >‹</button>
      <div class="hide-hint">{t('hint_press')} <kbd class="kbd kbd-xs">H</kbd> {t('hint_hide_panels')}</div>
    </div>
  </aside>

  {#if !sidebarOpen}
    <button
      class="sidebar-expand"
      title={t('expand')}
      aria-label={t('expand')}
      onclick={() => { sidebarOpen = true; }}
    >›</button>
  {/if}

  <main class="stage">
    <div id="pv-container" bind:this={container}>
      {#if ui.aiLoading}
        <div class="ai-loader-overlay">
          <div class="ai-loader-dots"></div>
          <div class="ai-loader-halo-wrapper">
            <div class="ai-loader-halo"></div>
            <div class="ai-loader-halo" style="animation-delay: 1.25s;"></div>
          </div>
          <div class="ai-loader-content">
            <div class="ai-loader-text">{t('ai_conceiving')}</div>
          </div>
        </div>
      {/if}
    </div>

    <footer class="pv-footer">
      <span class="pv-footer-desc">{t('footer_desc')}</span>
      <span class="pv-footer-sep">·</span>
      <a href={REPO_URL} target="_blank" rel="noopener" class="pv-footer-link">GitHub</a>
      <span class="pv-footer-sep">·</span>
      <a href="{REPO_URL}/graphs/contributors" target="_blank" rel="noopener" class="pv-footer-link">{t('footer_contributors')}</a>
    </footer>
  </main>
</div>
