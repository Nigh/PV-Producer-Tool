<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { templates } from '../../templates';
  import {
    ui, tplName, selectTemplate, isCustomMode,
    deleteSelectedTemplate, exportShareCode, saveCustomAs, importShareCode,
  } from '../store.svelte';

  let deleteConfirm = $state(false);
  let saveOpen = $state(false);
  let saveName = $state('');
  let importOpen = $state(false);
  let importCode = $state('');
  let importError = $state(false);

  const isUserTemplate = $derived(ui.selected.startsWith('user-'));

  const templateOptions = $derived([
    ...templates.map((tp, i) => ({ value: String(i), label: tplName(tp) })),
    ...ui.customTemplates.map((tp, i) => ({ value: `user-${i}`, label: `⭐ ${tp.name}` })),
    ...(ui.sharedTemplate ? [{ value: 'shared', label: `↗ ${ui.sharedTemplate.name}` }] : []),
    { value: 'custom', label: t('custom') },
  ]);

  function pickTemplate(value: string) {
    deleteConfirm = false;
    selectTemplate(value);
  }

  function doSave() {
    const name = saveName.trim();
    if (!name) return;
    saveCustomAs(name);
    saveOpen = false;
    saveName = '';
  }

  async function doImport() {
    const code = importCode.trim();
    if (!code) return;
    try {
      await importShareCode(code);
      importOpen = false;
      importError = false;
      importCode = '';
    } catch (err) {
      importError = true;
      console.warn('[PV] Share code decode failed:', err);
    }
  }
</script>

<div class="control-group">
  <div class="template-buttons">
    {#each templateOptions as opt (opt.value)}
      <button
        class="btn btn-xs {ui.selected === opt.value ? 'btn-primary' : 'btn-neutral'}"
        onclick={() => pickTemplate(opt.value)}
      >{opt.label}</button>
    {/each}
  </div>
</div>

<div class="control-group">
  <div class="template-actions">
    {#if isCustomMode()}
      <button class="btn btn-xs" title={t('save_tpl')} onclick={() => { saveOpen = true; saveName = ''; }}>{t('save_tpl')}</button>
    {/if}
    <button class="btn btn-xs" title={t('import_code')} onclick={() => { importOpen = true; importError = false; importCode = ''; }}>{t('import_code')}</button>
    {#if isUserTemplate}
      <button class="btn btn-xs" onclick={exportShareCode}>{t('export_code')}</button>
      <button class="btn btn-xs" onclick={() => { deleteConfirm = true; }}>{t('delete_tpl')}</button>
    {/if}
  </div>

  {#if deleteConfirm && isUserTemplate}
    <div class="tpl-inline-input">
      <span class="tpl-confirm-text">
        {t('confirm_delete')} "{ui.customTemplates[parseInt(ui.selected.split('-')[1])]?.name}"？
      </span>
      <button class="btn btn-xs btn-error" onclick={() => { deleteConfirm = false; deleteSelectedTemplate(); }}>{t('delete_tpl')}</button>
      <button class="btn btn-xs" onclick={() => { deleteConfirm = false; }}>{t('cancel')}</button>
    </div>
  {/if}

  {#if saveOpen}
    <div class="tpl-inline-input">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text" class="input input-sm flex-1" placeholder={t('tpl_name_placeholder')}
        autofocus
        bind:value={saveName}
        onkeydown={(e) => {
          if (e.key === 'Enter') doSave();
          if (e.key === 'Escape') saveOpen = false;
        }}
      />
      <button class="btn btn-xs" onclick={doSave}>{t('confirm')}</button>
      <button class="btn btn-xs" onclick={() => { saveOpen = false; }}>{t('cancel')}</button>
    </div>
  {/if}

  {#if importOpen}
    <label for="share-code-text" class:label-error={importError}>
      {importError ? t('code_invalid') : t('import_code')}
    </label>
    <input id="share-code-text" type="text" class="input input-sm w-full font-mono" placeholder={t('paste_code')} bind:value={importCode} />
    <div class="template-actions">
      <button class="btn btn-xs" onclick={doImport}>{t('confirm')}</button>
      <button class="btn btn-xs" onclick={() => { importOpen = false; }}>{t('cancel')}</button>
    </div>
  {/if}
</div>
