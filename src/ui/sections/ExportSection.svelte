<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t, locale } from '../../i18n';
  import { ui, engine } from '../store.svelte';
  import { rec, recLabel, toggleRecording } from '../recorder.svelte';
  import { openCopyUrlModal } from '../copyUrl';
</script>

<div class="control-group">
  <label class="effect-toggle">
    <input type="checkbox" class="checkbox checkbox-xs" bind:checked={ui.alphaMode}
      onchange={() => { engine.alphaMode = ui.alphaMode; }} />
    <span>{t('alpha_export')}</span>
    <span class="help-tip tooltip tooltip-top" data-tip={t('alpha_tip')}>?</span>
  </label>
</div>

<div class="control-group rec-group">
  <button class="btn btn-sm rec-btn" class:recording={rec.recording} title={t('rec')} onclick={toggleRecording}>
    <span class="rec-icon"></span>
    <span>{recLabel()}</span>
  </button>
  {#if rec.timer}
    <span class="rec-timer">{rec.timer}</span>
  {/if}
</div>

{#if locale === 'zh'}
  <div class="control-group copy-url-row">
    <button class="btn btn-sm flex-1" title={t('copy_url')} onclick={openCopyUrlModal}>{t('copy_url')}</button>
    <span class="help-tip tooltip tooltip-top" data-tip={t('copy_url_tip')}>?</span>
  </div>
{/if}
