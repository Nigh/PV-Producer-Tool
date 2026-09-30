<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { effectCatalog } from '../../core/effectCatalog';
  import { effectParameters, describeValue, isColor } from '../../core/effectParameters';
  import { ui, editorStyle, editEffects, editEffect, addEffect } from '../store.svelte';
  import PropertyEditor from '../PropertyEditor.svelte';
  import StyleSource from '../StyleSource.svelte';
  import TemplateSection from './TemplateSection.svelte';
  let query = $state('');
  let libraryOpen = $state(false);
  let selected = $state(0);
  let attributeTab = $state<'colors' | 'properties'>('properties');
  const group = $derived(editorStyle().effects.value);
  const entry = $derived(group.effects[selected]);
  const definitions = $derived(entry ? effectParameters(entry) : {});
  const fields = $derived(Object.entries(definitions).filter(([key, def]) => !key.startsWith('_') &&
    (attributeTab === 'colors' ? isColor(entry?.config[key] ?? def.default) || /color/i.test(key) : !(isColor(entry?.config[key] ?? def.default) || /color/i.test(key)))));
  const unknown = $derived(entry ? Object.keys(entry.config).filter(key => !key.startsWith('_') && !definitions[key]) : []);
  const categories = $derived([...new Set(effectCatalog.map(e => e.category))].map(category => ({ category,
    items: effectCatalog.map((e, index) => ({ ...e, index })).filter(e => e.category === category && label(e).toLowerCase().includes(query.trim().toLowerCase())),
  })).filter(c => c.items.length));
  function label(e: { type: string; config: Record<string, any> }) {
    const key = 'fx_' + e.type + (e.type === 'organicBlob' ? '_' + (e.config.shape ?? 'blob') : '');
    const translated = t(key as any);
    return translated === key ? effectCatalog.find(p => p.type === e.type)?.label ?? e.type : translated;
  }
  function remove(index: number) { editEffects(g => g.effects.splice(index, 1)); selected = Math.max(0, Math.min(selected, group.effects.length - 1)); }
  function duplicate(index: number) { editEffects(g => { const copy = structuredClone(g.effects[index]); copy.id = crypto.randomUUID(); g.effects.splice(index + 1, 0, copy); }); selected = index + 1; }
  function sibling(index: number, dir: number) {
    const layer = group.effects[index]?.layer;
    for (let i = index + dir; i >= 0 && i < group.effects.length; i += dir) if (group.effects[i].layer === layer) return i;
    return -1;
  }
  function move(index: number, dir: number) {
    const target = sibling(index, dir); if (target < 0) return;
    editEffects(g => { [g.effects[index], g.effects[target]] = [g.effects[target], g.effects[index]]; }); selected = target;
  }
  function setProperty(key: string, value: any) { editEffect(selected, e => { e.config[key] = value; }); }
  $effect(() => { void ui.focusedLine; selected = 0; libraryOpen = false; });
</script>

<StyleSource kind="effects" />
  <details class="property-collection"><summary>{t('shot_palette')}</summary>
    {#each Object.entries(group.palette) as [key, value] (key)}
      <PropertyEditor name={'palette_' + key} {value} definition={{ type: 'color' }} palette={group.palette} references={false}
    onchange={v => editEffects(g => { g.palette[key as keyof typeof g.palette] = v; g.features = { ...g.features, autoExtractColors: false }; })} />
    {/each}
  </details>
<details class="property-collection"><summary>{t('media_processing')}</summary>
  {#each [{ key: 'autoExtractColors', label: 'auto_colors' }, { key: 'mediaOutline', label: 'feature_outline' }, { key: 'motionDetection', label: 'feature_motion' }, { key: 'invertMedia', label: 'feature_invert' }, { key: 'thresholdMedia', label: 'feature_threshold' }] as feature}
    <label class="loop-option"><input type="checkbox" class="checkbox checkbox-xs" checked={!!group.features?.[feature.key as keyof typeof group.features]} onchange={e => editEffects(g => { g.features = { ...g.features, [feature.key]: e.currentTarget.checked }; })} />{t(feature.label as any)}</label>
  {/each}
</details>

<div class="settings-block-heading">
  <h2>{t('applied_effects')} · {group.effects.length}</h2>
  <div class="instance-actions"><button class="btn btn-sm btn-primary" aria-expanded={libraryOpen} onclick={() => { libraryOpen = !libraryOpen; }}>{t('add_effect')}</button>
    <button class="btn btn-xs" disabled={!group.effects.length} onclick={() => editEffects(g => { g.effects = []; })}>{t('clear_effects')}</button></div>
</div>
{#if libraryOpen}
  <div class="effect-library">
    <input type="search" class="input input-sm w-full" aria-label={t('search_effects')} placeholder={t('search_effects')} bind:value={query} />
    {#if !categories.length}<p class="editor-empty">{t('effects_empty')}</p>{/if}
    {#each categories as category (category.category)}
      <details open><summary>{t(('ecat_' + category.category) as any)}</summary>
        <div class="effect-grid">{#each category.items as item (item.index)}<button class="effect-add" onclick={() => { addEffect(item.index); selected = group.effects.length - 1; libraryOpen = false; }}>{label(item)}</button>{/each}</div>
      </details>
    {/each}
  </div>
{/if}
<div class="effect-instances">
  {#if !group.effects.length}<p class="editor-empty">{t('no_applied_effects')}</p>{/if}
  {#each group.effects as effect, index (index)}
    <div class="effect-instance" class:selected={selected === index} class:disabled={effect.enabled === false}>
      <button class="instance-select" aria-pressed={selected === index} onclick={() => { selected = index; }}>{label(effect)} <small>{index + 1} · {t(('layer_' + effect.layer) as any)}</small></button>
      <div class="instance-actions">
        <label><input type="checkbox" class="checkbox checkbox-xs" aria-label={t('effect_enabled')} checked={effect.enabled !== false} onchange={e => editEffect(index, fx => { fx.enabled = e.currentTarget.checked; })} /></label>
        <button class="btn btn-xs" onclick={() => duplicate(index)}>{t('duplicate')}</button>
        <button class="btn btn-xs" disabled={sibling(index, -1) < 0} onclick={() => move(index, -1)}>{t('move_up')}</button>
        <button class="btn btn-xs" disabled={sibling(index, 1) < 0} onclick={() => move(index, 1)}>{t('move_down')}</button>
        <button class="btn btn-xs" onclick={() => remove(index)}>{t('remove')}</button>
      </div>
    </div>
  {/each}
</div>
{#if entry}
  <section class="effect-inspector" aria-label={label(entry)}>
    <div class="inspector-tabs"><button class="btn btn-sm" class:btn-primary={attributeTab === 'colors'} onclick={() => { attributeTab = 'colors'; }}>{t('coloring')}</button>
      <button class="btn btn-sm" class:btn-primary={attributeTab === 'properties'} onclick={() => { attributeTab = 'properties'; }}>{t('properties')}</button></div>
    {#if attributeTab === 'colors'}
      <details class="property-collection"><summary>{t('instance_palette')}</summary>
        {#each Object.entries(group.palette) as [key, value] (key)}
          <PropertyEditor name={'palette_' + key} value={entry.palette?.[key as keyof typeof group.palette]} definition={{ type: 'color', default: value }} palette={group.palette} references={false}
            onchange={v => editEffect(selected, e => { e.palette = { ...e.palette, [key]: v }; })}
            onunset={() => editEffect(selected, e => { if (e.palette) delete e.palette[key as keyof typeof group.palette]; })} />
        {/each}
      </details>
    {/if}
    {#each fields as [key, definition] (key)}
      <PropertyEditor name={key} value={entry.config[key]} {definition} palette={{ ...group.palette, ...entry.palette }}
        onchange={value => setProperty(key, value)} onunset={() => editEffect(selected, e => { delete e.config[key]; })} />
    {/each}
    {#if unknown.length}<details class="property-collection"><summary>{t('advanced_properties')}</summary>
      {#each unknown as key (key)}<PropertyEditor name={key} value={entry.config[key]} definition={describeValue(entry.config[key])} palette={{ ...group.palette, ...entry.palette }}
        onchange={value => setProperty(key, value)} onunset={() => editEffect(selected, e => { delete e.config[key]; })} />{/each}
    </details>{/if}
  </section>
{/if}
<details class="template-manager"><summary>{t('template_manager')}</summary><TemplateSection /></details>
