<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { showToast } from '../../core/uiHelpers';
  import { ui, aiGenerate } from '../store.svelte';

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
