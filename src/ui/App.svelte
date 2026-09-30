<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { ui, engine, initApp, exitLineLoop, togglePause } from './store.svelte';
  import './theme.svelte';
  import PlaybackSection from './sections/PlaybackSection.svelte';
  import PlayerBar from './PlayerBar.svelte';
  import ShotsSection from './sections/Workbench.svelte';
  import ExportSection from './sections/ExportSection.svelte';
  import SettingsSection from './sections/SettingsSection.svelte';

  const REPO_URL = 'https://github.com/Nigh/PV-Producer-Tool';

  const SECTIONS = [
    { id: 'playback', title: t('nav_playback'), sub: t('nav_playback_sub'), component: PlaybackSection },
    { id: 'shots', title: t('workbench'), sub: t('nav_shots_sub'), component: ShotsSection },
    { id: 'settings', title: t('nav_settings'), sub: t('nav_settings_sub'), component: SettingsSection },
    { id: 'export', title: t('nav_export'), sub: t('nav_export_sub'), component: ExportSection },
  ] as const;

  let container: HTMLDivElement;
  let active = $state<typeof SECTIONS[number]['id']>('playback');
  let sidebarOpen = $state(true);

  const activeSection = $derived(SECTIONS.find((s) => s.id === active)!);

  onMount(() => {
    initApp(container);

    // 全局快捷键（输入框聚焦或弹窗打开时忽略）
    const onKeydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('.pv-modal-overlay')) return;
      if (e.key === 'Escape') { exitLineLoop(); return; }
      if ((e.target as HTMLElement).closest('button, a, summary')) return;
      if (e.key.toLowerCase() === 'h') {
        document.body.classList.toggle('pv-panels-hidden');
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        exitLineLoop();
        engine.seekPrevSegment();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        exitLineLoop();
        engine.seekNextSegment();
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('keydown', onKeydown);
    };
  });
</script>

<div class="app-shell">
  <aside class="sidebar" class:sidebar-closed={!sidebarOpen} class:sidebar-wide={active === 'shots'}>
    <div class="sidebar-header">
      <span class="brand-mark" aria-hidden="true">PV</span>
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
                aria-current={active === section.id ? 'page' : undefined}
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
        <header class="panel-heading">
          <h1>{activeSection.title}</h1>
          {#if activeSection.sub}<p>{activeSection.sub}</p>{/if}
        </header>
        <activeSection.component />
      </div>
    </div>
    <div class="sidebar-footer">
      <button
        class="sidebar-collapse"
        title={t('collapse')}
        aria-label={t('collapse')}
        onclick={() => { sidebarOpen = false; }}
      ></button>
      <div class="hide-hint">{t('hint_press')} <kbd class="kbd kbd-xs">H</kbd> {t('hint_hide_panels')}</div>
    </div>
  </aside>

  {#if !sidebarOpen}
    <button
      class="sidebar-expand"
      title={t('expand')}
      aria-label={t('expand')}
      onclick={() => { sidebarOpen = true; }}
    ></button>
  {:else}
    <button class="sidebar-scrim" aria-label={t('collapse')} onclick={() => { sidebarOpen = false; }}></button>
  {/if}

  <main class="stage">
    <div class="stage-viewport">
      <div class="frame-area">
      <div
        id="pv-container"
        class="pv-frame"
        data-aspect={ui.aspectRatio}
        bind:this={container}
      >

      </div>
      </div>

      <footer class="pv-footer">
        <span class="pv-footer-desc">{t('footer_desc')}</span>
        <span class="pv-footer-sep">·</span>
        <a href={REPO_URL} target="_blank" rel="noopener" class="pv-footer-link">GitHub</a>
        <span class="pv-footer-sep">·</span>
        <a href="{REPO_URL}/graphs/contributors" target="_blank" rel="noopener" class="pv-footer-link">{t('footer_contributors')}</a>
      </footer>
      <PlayerBar />
    </div>
  </main>
</div>
