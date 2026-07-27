<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { ui, initApp, isCustomMode } from './store.svelte';
  import LeftPanel from './LeftPanel.svelte';
  import RightPanel from './RightPanel.svelte';
  import EffectsPanel from './EffectsPanel.svelte';

  let container: HTMLDivElement;
  let panelsHidden = $state(window.matchMedia('(max-width: 768px)').matches);

  onMount(() => {
    initApp(container);

    // H 键隐藏/显示全部面板（输入框聚焦或弹窗打开时忽略）
    const onKeydown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('.pv-modal-overlay')) return;
      if (e.key.toLowerCase() === 'h') {
        document.body.classList.toggle('pv-panels-hidden');
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });
</script>

<div class="panels-wrapper" class:panels-hidden={panelsHidden}>
  <LeftPanel />
  <RightPanel />
  {#if isCustomMode()}
    <EffectsPanel />
  {/if}
</div>

<button class="mobile-toggle" onclick={() => { panelsHidden = !panelsHidden; }}>
  {panelsHidden ? '☰' : '✕'}
</button>

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
