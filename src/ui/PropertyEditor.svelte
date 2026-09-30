<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { cloneConfig } from '../core/shotStyles';
  import { t } from '../i18n';
  import type { ColorPalette } from '../core/types';
  import { resolveColor } from '../core/types';
  import { describeValue, initialParameter, isColor } from '../core/effectParameters';
  import type { ParameterDefinition } from '../core/effectParameters';
  import PropertyEditor from './PropertyEditor.svelte';
  let { name, value, definition, palette, onchange, onunset, references = true }: {
    name: string; value: any; definition: ParameterDefinition; palette: ColorPalette;
    onchange: (value: any) => void; onunset?: () => void; references?: boolean;
  } = $props();
  let newKey = $state('');
  let jsonError = $state(false);
  const kind = $derived(isColor(value ?? definition.default) ? 'color' : definition.type);
  const effective = $derived(value === undefined ? definition.default : value);
  const children = $derived({ ...definition.children, ...Object.fromEntries(Object.keys(effective ?? {}).filter(k => !definition.children?.[k]).map(k => [k, describeValue(effective[k])])) });
  function number(input: HTMLInputElement) { if (input.checkValidity() && Number.isFinite(input.valueAsNumber)) onchange(input.valueAsNumber); }
  function replace(index: number, item: any) { const next = cloneConfig(effective ?? []); next[index] = item; onchange(next); }
  function move(index: number, dir: number) { const next = cloneConfig(effective); [next[index], next[index + dir]] = [next[index + dir], next[index]]; onchange(next); }
  function label(key: string) { const translated = t(('param_' + key) as any); return translated.startsWith('param_') ? key.replace(/([a-z])([A-Z])/g, '$1 $2') : translated; }
  function swatch(color: string) { const hex = resolveColor(color, palette); return hex.length <= 5 ? '#' + hex.slice(1, 4).split('').map(c => c + c).join('') : hex.slice(0, 7); }
</script>

<div class="property-field">
  <div class="property-heading"><span>{label(name)}</span>
    {#if value === undefined}<small>{t('parameter_default')}</small>{:else if onunset}<button class="btn btn-xs btn-ghost" onclick={onunset}>{t('reset')}</button>{/if}
  </div>
  {#if effective === undefined}
    <button class="btn btn-xs" onclick={() => onchange(initialParameter(definition))}>{t('set_override')}</button>
  {:else if kind === 'color'}
    <div class="color-editor">
      <input type="color" aria-label={label(name)} value={swatch(String(effective))} oninput={e => onchange(e.currentTarget.value)} />
      {#if references}<select class="select select-xs" aria-label={t('color_source')} value={String(effective).startsWith('$') ? effective : ''}
        onchange={e => onchange(e.currentTarget.value || resolveColor(String(effective), palette))}>
        <option value="">{t('independent_color')}</option>
        {#each ['background', 'primary', 'secondary', 'accent', 'text', 'line'] as token}<option value={'$' + token}>{t(('palette_' + token) as any)}</option>{/each}
      </select>{/if}
      <input class="input input-xs color-value" aria-label={t('color_value')} value={effective}
        onchange={e => { if (isColor(e.currentTarget.value) && (references || !e.currentTarget.value.startsWith('$'))) onchange(e.currentTarget.value); else e.currentTarget.value = effective; }} />
    </div>
  {:else if definition.options && kind === 'string'}
    <select class="select select-sm w-full" aria-label={label(name)} value={effective} onchange={e => onchange(e.currentTarget.value)}>
      {#each [...new Set([...definition.options, effective])] as option}<option value={option}>{option}</option>{/each}
    </select>
  {:else if kind === 'number'}
    <div class="parameter-number">
      {#if definition.min !== undefined && definition.max !== undefined}<input type="range" class="range range-xs" aria-label={label(name)} value={effective}
        min={definition.min} max={definition.max} step={definition.step ?? 'any'} oninput={e => number(e.currentTarget)} />{/if}
      <input type="number" class="input input-sm" aria-label={label(name)} value={effective} min={definition.min} max={definition.max} step={definition.step ?? 'any'} oninput={e => number(e.currentTarget)} />
    </div>
  {:else if kind === 'boolean'}
    <input type="checkbox" class="toggle toggle-sm" aria-label={label(name)} checked={effective} onchange={e => onchange(e.currentTarget.checked)} />
  {:else if kind === 'array'}
    <details class="property-collection"><summary>{t('array_items')} · {(effective ?? []).length}</summary>
      {#each effective ?? [] as item, i (i)}
        <div class="array-item"><div class="instance-actions">
          <button class="btn btn-xs" disabled={i === 0} onclick={() => move(i, -1)}>{t('move_up')}</button>
          <button class="btn btn-xs" disabled={i === effective.length - 1} onclick={() => move(i, 1)}>{t('move_down')}</button>
          <button class="btn btn-xs" onclick={() => onchange(effective.filter((_: any, j: number) => j !== i))}>{t('remove')}</button>
        </div>
          <PropertyEditor name={String(i + 1)} value={item} definition={definition.item ?? describeValue(item)} {palette} onchange={v => replace(i, v)} />
        </div>
      {/each}
      <button class="btn btn-xs" onclick={() => onchange([...(effective ?? []), initialParameter(definition.item ?? { type: 'string' })])}>{t('add_item')}</button>
    </details>
  {:else if kind === 'object'}
    <details class="property-collection"><summary>{t('object_fields')}</summary>
      {#each Object.entries(children) as [key, child] (key)}
        {#if !key.startsWith('_')}<PropertyEditor name={key} value={effective?.[key]} definition={child} {palette}
          onchange={v => onchange({ ...effective, [key]: v })} onunset={() => { const next = { ...effective }; delete next[key]; onchange(next); }} />{/if}
      {/each}
      <div class="instance-actions"><input class="input input-xs" aria-label={t('field_name')} placeholder={t('field_name')} bind:value={newKey} />
        <button class="btn btn-xs" disabled={!newKey.trim() || ['__proto__', 'constructor', 'prototype'].includes(newKey.trim())}
          onclick={() => { onchange({ ...effective, [newKey.trim()]: '' }); newKey = ''; }}>{t('add_item')}</button></div>
    </details>
  {:else if kind === 'string'}
    <input class="input input-sm w-full" aria-label={label(name)} value={effective} onchange={e => onchange(e.currentTarget.value)} />
  {:else}
    <textarea class="textarea textarea-sm w-full" aria-label={label(name)} value={JSON.stringify(effective, null, 2)}
      onchange={e => { try { onchange(JSON.parse(e.currentTarget.value)); jsonError = false; } catch { jsonError = true; } }}></textarea>
    {#if jsonError}<p role="alert">{t('invalid_parameter')}</p>{/if}
  {/if}
</div>
