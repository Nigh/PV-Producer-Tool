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

  const SECTIONS = [
    { id: 'template', label: t('template'), component: TemplateSection },
    { id: 'playback', label: t('nav_playback'), component: PlaybackSection },
    { id: 'shots', label: t('nav_shots'), component: ShotsSection },
    { id: 'postfx', label: t('postfx'), component: PostFxSection },
    { id: 'effects', label: t('effects_library'), component: EffectsSection },
    { id: 'ai', label: t('ai_panel'), component: AiSection },
    { id: 'export', label: t('export'), component: ExportSection },
    { id: 'settings', label: t('nav_settings'), component: SettingsSection },
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
      <span class="sidebar-brand">PV Tool</span>
    </div>
    <div class="sidebar-body">
      <nav class="nav-rail">
        <ul class="menu menu-xs w-full p-0 gap-1">
          {#each SECTIONS as section (section.id)}
            <li>
              <button
                class:menu-active={active === section.id}
                onclick={() => { active = section.id; }}
              >{section.label}</button>
            </li>
          {/each}
        </ul>
      </nav>
      <div class="nav-content">
        <div class="panel-title">{activeSection.label}</div>
        <activeSection.component />
      </div>
    </div>
    <div class="hide-hint">{t('hint_press')} <kbd class="kbd kbd-xs">H</kbd> {t('hint_hide_panels')}</div>
  </aside>

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
      <a href="https://github.com/DanteAlighieri13210914/pv-tool" target="_blank" rel="noopener" class="pv-footer-link">GitHub</a>
      <span class="pv-footer-sep">·</span>
      <a href="{import.meta.env.BASE_URL}contributors.html" target="_blank" class="pv-footer-link">{t('footer_contributors')}</a>
    </footer>
  </main>
</div>

<button class="sidebar-toggle" onclick={() => { sidebarOpen = !sidebarOpen; }}>
  {sidebarOpen ? '✕' : '☰'}
</button>
