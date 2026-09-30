<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { editorStyle, editPostFx, editStyle } from '../store.svelte';
  import { normalizePostFx } from '../../core/shotStyles';
  import type { PostFxConfig } from '../../core/types';
  import StyleSource from '../StyleSource.svelte';
  const values = $derived(editorStyle().postfx.value);
  const controls: { key: keyof PostFxConfig; label: 'shake' | 'zoom' | 'tilt' | 'glitch' | 'hue_shift'; min: number; max: number; step: number }[] = [
    { key: 'shake', label: 'shake', min: 0, max: 1, step: 0.05 },
    { key: 'zoom', label: 'zoom', min: -1, max: 1, step: 0.05 },
    { key: 'tilt', label: 'tilt', min: -1, max: 1, step: 0.05 },
    { key: 'glitch', label: 'glitch', min: 0, max: 1, step: 0.05 },
    { key: 'hueShift', label: 'hue_shift', min: -180, max: 180, step: 5 },
  ];
  function change(key: keyof PostFxConfig, input: HTMLInputElement) { if (input.checkValidity()) editPostFx(key, input.valueAsNumber); }
</script>
<StyleSource kind="postfx" />
<div class="settings-block-heading"><h2>{t('postfx')}</h2><button class="btn btn-xs" onclick={() => editStyle('postfx', normalizePostFx())}>{t('disable_postfx')}</button></div>
{#each controls as control (control.key)}
  <div class="property-field"><label for={'postfx-' + control.key}>{t(control.label)}</label>
    <div class="parameter-number"><input type="range" class="range range-xs" aria-label={t(control.label)} min={control.min} max={control.max} step={control.step} value={values[control.key]} oninput={e => change(control.key, e.currentTarget)} />
      <input id={'postfx-' + control.key} type="number" class="input input-sm" min={control.min} max={control.max} step={control.step} value={values[control.key]} oninput={e => change(control.key, e.currentTarget)} /></div>
  </div>
{/each}
