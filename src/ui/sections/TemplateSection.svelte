<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { templates } from '../../templates';
  import { saveCustomTemplates } from '../../core/templateStore';
  import { ui, tplName, applyStyleTemplate, saveEffectGroup, saveCustomAs, exportShareCode, importShareCode, selectTemplate } from '../store.svelte';
  let picked = $state('0');
  let name = $state('');
  let code = $state('');
  let importing = $state(false);
  let invalid = $state(false);
  let deleteConfirm = $state(false);
  const options = $derived([
    ...templates.map((tpl, index) => ({ value: String(index), label: tplName(tpl) })),
    ...ui.customTemplates.map((tpl, index) => ({ value: 'user-' + index, label: tpl.name })),
    ...(ui.sharedTemplate ? [{ value: 'shared', label: ui.sharedTemplate.name }] : []),
  ]);
  async function loadCode() { try { await importShareCode(code.trim()); importing = false; invalid = false; } catch { invalid = true; } }
  function removeTemplate() {
    if (!picked.startsWith('user-')) return;
    ui.customTemplates.splice(Number(picked.slice(5)), 1);
    saveCustomTemplates($state.snapshot(ui.customTemplates)); picked = '0'; deleteConfirm = false;
  }
</script>
<div class="template-tools">
  <label for="style-template">{t('shot_template')}</label>
  <select id="style-template" class="select select-sm w-full" bind:value={picked} onchange={() => { deleteConfirm = false; }}>
    {#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
  </select>
  <div class="instance-actions"><button class="btn btn-xs" onclick={() => applyStyleTemplate(picked)}>{t('apply_effects')}</button>
    <button class="btn btn-xs" onclick={() => applyStyleTemplate(picked, true)}>{t('apply_effects_postfx')}</button></div>
  <input class="input input-sm w-full" aria-label={t('tpl_name_placeholder')} placeholder={t('tpl_name_placeholder')} bind:value={name} />
  <div class="instance-actions"><button class="btn btn-xs" disabled={!name.trim()} onclick={() => saveEffectGroup(name.trim())}>{t('save_effect_group')}</button>
    <button class="btn btn-xs" disabled={!name.trim()} onclick={() => saveCustomAs(name.trim())}>{t('save_project')}</button></div>
  <div class="instance-actions"><button class="btn btn-xs" onclick={exportShareCode}>{t('share_project')}</button>
    <button class="btn btn-xs" onclick={() => { importing = !importing; }}>{t('import_code')}</button>
    {#if picked.startsWith('user-')}<button class="btn btn-xs" onclick={() => { deleteConfirm = true; }}>{t('delete_tpl')}</button>
      <button class="btn btn-xs" onclick={() => { if (window.confirm(t('replace_project_confirm'))) selectTemplate(picked); }}>{t('open_project')}</button>{/if}</div>
  {#if deleteConfirm}<div class="instance-actions"><span>{t('confirm_delete')}</span><button class="btn btn-xs btn-error" onclick={removeTemplate}>{t('delete_tpl')}</button><button class="btn btn-xs" onclick={() => { deleteConfirm = false; }}>{t('cancel')}</button></div>{/if}
  {#if importing}<label for="project-code">{t('import_replaces_project')}</label><input id="project-code" class="input input-sm w-full" bind:value={code} placeholder={t('paste_code')} />
    {#if invalid}<p role="alert">{t('code_invalid')}</p>{/if}<button class="btn btn-xs" disabled={!code.trim()} onclick={loadCode}>{t('confirm')}</button>{/if}
</div>
