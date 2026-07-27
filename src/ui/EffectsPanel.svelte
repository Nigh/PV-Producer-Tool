<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../i18n';
  import { effectCatalog } from '../core/effectCatalog';
  import { ui, scheduleCustomRebuild, saveCustomAs, importShareCode } from './store.svelte';

  function fxKey(e: typeof effectCatalog[0]): string {
    if (e.type === 'organicBlob') return 'fx_organicBlob_' + (e.config.shape ?? 'blob');
    return 'fx_' + e.type;
  }

  const categories = (() => {
    const cats: Record<string, { idx: number; label: string }[]> = {};
    effectCatalog.forEach((e, i) => {
      (cats[e.category] ??= []).push({ idx: i, label: t(fxKey(e) as any) || e.label });
    });
    return Object.entries(cats).map(([cat, items]) => ({
      label: t(('ecat_' + cat) as any) || cat,
      items,
    }));
  })();

  let saveOpen = $state(false);
  let saveName = $state('');
  let importOpen = $state(false);
  let importCode = $state('');
  let importError = $state(false);

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

<div class="controls controls-bottom">
  <details class="collapsible-section" open>
    <summary class="panel-title">{t('effects_library')}</summary>

    <div class="control-group">
      <div class="template-actions">
        <button class="btn btn-xs" title={t('save_tpl')} onclick={() => { saveOpen = true; saveName = ''; }}>{t('save_tpl')}</button>
        <button class="btn btn-xs" title={t('import_code')} onclick={() => { importOpen = true; importError = false; importCode = ''; }}>{t('import_code')}</button>
      </div>
    </div>

    {#if saveOpen}
      <div class="control-group">
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
      </div>
    {/if}

    {#if importOpen}
      <div class="control-group">
        <label for="share-code-text" class:label-error={importError}>
          {importError ? t('code_invalid') : t('import_code')}
        </label>
        <input id="share-code-text" type="text" class="input input-sm w-full font-mono" placeholder={t('paste_code')} bind:value={importCode} />
        <div class="template-actions">
          <button class="btn btn-xs" onclick={doImport}>{t('confirm')}</button>
          <button class="btn btn-xs" onclick={() => { importOpen = false; }}>{t('cancel')}</button>
        </div>
      </div>
    {/if}

    <div>
      {#each categories as cat (cat.label)}
        <details class="effect-category" open>
          <summary class="effect-category-title">{cat.label}</summary>
          <div class="effect-grid">
            {#each cat.items as item (item.idx)}
              <label class="effect-toggle">
                <input
                  type="checkbox" class="checkbox checkbox-xs"
                  bind:checked={ui.checkedEffects[item.idx]}
                  onchange={scheduleCustomRebuild}
                />
                <span>{item.label}</span>
              </label>
            {/each}
          </div>
        </details>
      {/each}
    </div>
  </details>
</div>
