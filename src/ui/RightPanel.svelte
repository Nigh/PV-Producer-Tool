<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t, locale } from '../i18n';
  import { showToast, showModal } from '../core/uiHelpers';
  import { ui, engine, toggleNowPlaying, aiGenerate } from './store.svelte';
  import { rec, recLabel, toggleRecording } from './recorder.svelte';
  import { openCopyUrlModal } from './copyUrl';
  import Slider from './Slider.svelte';

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

  // ── AI 生成 ──
  let aiPrompt = $state('');
  let aiApiKey = $state(localStorage.getItem('pv-tool-ai-api-key') || '');
  let aiApiUrl = $state(localStorage.getItem('pv-tool-ai-api-url') || '');
  let aiApiModel = $state(localStorage.getItem('pv-tool-ai-api-model') || '');

  function persistAiConfig() {
    localStorage.setItem('pv-tool-ai-api-key', aiApiKey.trim());
    localStorage.setItem('pv-tool-ai-api-url', aiApiUrl.trim());
    localStorage.setItem('pv-tool-ai-api-model', aiApiModel.trim());
  }

  async function onAiGenerate() {
    if (!aiApiKey.trim()) {
      showToast(t('ai_key_required'));
      return;
    }
    await aiGenerate(aiPrompt.trim(), aiApiKey.trim(), aiApiUrl.trim(), aiApiModel.trim());
  }
</script>

<div class="controls controls-right">
  <details class="collapsible-section" open>
    <summary class="panel-title">{t('postfx')}</summary>

    <Slider
      label={t('shake')} display={ui.shake.toFixed(2)}
      min={0} max={1} step={0.05} bind:value={ui.shake}
      oninput={() => { engine.shake = ui.shake; }}
    />
    <Slider
      label={t('zoom')} display={ui.zoom.toFixed(2)}
      min={-1} max={1} step={0.05} bind:value={ui.zoom}
      oninput={() => { engine.zoom = ui.zoom; }}
    />
    <Slider
      label={t('tilt')} display={`${(ui.tilt * 17.2).toFixed(0)}°`}
      min={-1} max={1} step={0.05} bind:value={ui.tilt}
      oninput={() => { engine.tilt = ui.tilt; }}
    />
    <Slider
      label={t('glitch')} display={ui.glitch.toFixed(2)}
      min={0} max={1} step={0.05} bind:value={ui.glitch}
      oninput={() => { engine.glitch = ui.glitch; }}
    />
    <Slider
      label={t('hue_shift')} display={`${ui.hue.toFixed(0)}°`}
      min={-180} max={180} step={5} bind:value={ui.hue}
      oninput={() => { engine.hueShift = ui.hue; }}
    />

    {#if ui.mediaLoaded}
      <div class="control-group">
        <span class="group-label">{t('media_position')}</span>
        <div class="slider-row">
          <span class="slider-label">{t('offset_x')}</span>
          <input type="range" class="range range-xs range-primary flex-1 min-w-0" min="-500" max="500" step="5"
            bind:value={ui.mediaX} oninput={() => engine.setMediaOffset(ui.mediaX, ui.mediaY)} />
          <span>{ui.mediaX}</span>
        </div>
        <div class="slider-row">
          <span class="slider-label">{t('offset_y')}</span>
          <input type="range" class="range range-xs range-primary flex-1 min-w-0" min="-500" max="500" step="5"
            bind:value={ui.mediaY} oninput={() => engine.setMediaOffset(ui.mediaX, ui.mediaY)} />
          <span>{ui.mediaY}</span>
        </div>
        <div class="slider-row">
          <span class="slider-label">{t('scale')}</span>
          <input type="range" class="range range-xs range-primary flex-1 min-w-0" min="0.5" max="3" step="0.05"
            bind:value={ui.mediaScale} oninput={() => engine.setMediaScale(ui.mediaScale)} />
          <span>{ui.mediaScale.toFixed(1)}x</span>
        </div>
      </div>
    {/if}
  </details>

  <details class="collapsible-section" open>
    <summary class="panel-title">{t('export')}</summary>

    <div class="control-group">
      <label class="effect-toggle">
        <input type="checkbox" class="checkbox checkbox-xs" bind:checked={ui.alphaMode}
          onchange={() => { engine.alphaMode = ui.alphaMode; }} />
        <span>{t('alpha_export')}</span>
        <span class="help-tip tooltip tooltip-left" data-tip={t('alpha_tip')}>?</span>
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
  </details>

  {#if locale === 'zh'}
    <details class="collapsible-section" open>
      <summary class="panel-title">{t('listen')}</summary>

      <div class="control-group">
        <label class="effect-toggle">
          <input type="checkbox" class="checkbox checkbox-xs" checked={ui.npListening} onchange={onNpToggle} />
          <span>{t('listen_now_playing')}</span>
          <span class="help-tip tooltip tooltip-left" data-tip={t('listen_np_tip')}>?</span>
        </label>
      </div>

      <div class="control-group copy-url-row">
        <button class="btn btn-sm flex-1" title={t('copy_url')} onclick={openCopyUrlModal}>{t('copy_url')}</button>
        <span class="help-tip tooltip tooltip-left" data-tip={t('copy_url_tip')}>?</span>
      </div>
    </details>
  {/if}

  <details class="collapsible-section" open>
    <summary class="panel-title">{t('ai_panel')}</summary>
    <div class="control-group">
      <textarea class="textarea textarea-sm w-full ai-prompt" rows="3"
        placeholder={t('ai_prompt_placeholder')} bind:value={aiPrompt}></textarea>
      <button class="btn btn-sm btn-primary w-full mt-2" disabled={ui.aiLoading} onclick={onAiGenerate}>
        {ui.aiLoading ? t('ai_generating') : t('ai_generate_btn')}
      </button>
    </div>
    <details class="collapsible-section ai-settings">
      <summary class="panel-title">⚙️ {t('ai_settings')}</summary>
      <div class="control-group">
        <label for="ai-api-key">{t('ai_api_key')}</label>
        <input id="ai-api-key" type="password" class="input input-sm w-full" placeholder="sk-..."
          bind:value={aiApiKey} onchange={persistAiConfig} />
      </div>
      <div class="control-group">
        <label for="ai-api-url">{t('ai_api_url')}</label>
        <input id="ai-api-url" type="text" class="input input-sm w-full" placeholder="https://api.deepseek.com"
          bind:value={aiApiUrl} onchange={persistAiConfig} />
      </div>
      <div class="control-group">
        <label for="ai-api-model">{t('ai_api_model')}</label>
        <input id="ai-api-model" type="text" class="input input-sm w-full" placeholder="deepseek-v4-flash"
          bind:value={aiApiModel} onchange={persistAiConfig} />
      </div>
    </details>
  </details>
</div>
