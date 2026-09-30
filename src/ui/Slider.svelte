<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../i18n';

  let {
    label,
    display,
    min,
    max,
    step,
    value = $bindable(),
    oninput,
    defaultValue,
    onreset,
  }: {
    label: string;
    display: string;
    min: number;
    max: number;
    step: number;
    value: number;
    oninput?: () => void;
    defaultValue?: number;
    onreset?: () => void;
  } = $props();

  const id = $props.id();

  function changeNumber(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const next = input.valueAsNumber;
    if (Number.isFinite(next)) {
      value = Number(Math.min(max, Math.max(min, min + Math.round((next - min) / step) * step)).toFixed(4));
      oninput?.();
    }
    input.value = String(value);
  }
</script>

<div class="control-group slider-control">
  <div class="slider-heading">
    <label for={id}>{label} <span class="opacity-70">{display}</span></label>
    {#if defaultValue !== undefined && onreset}
      <button type="button" class="slider-reset" disabled={value === defaultValue} onclick={onreset} title={t('reset_to_default')}>{t('reset')}</button>
    {/if}
  </div>
  <div class="slider-inputs">
    <input
      id={id}
      type="range"
      class="range range-xs range-primary"
      {min} {max} {step}
      bind:value
      {oninput}
    />
    <input type="number" class="input input-xs slider-number" aria-label={`${label} — ${t('numeric_value')}`}
      {min} {max} {step} value={value} onchange={changeNumber} />
  </div>
</div>
