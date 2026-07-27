<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  let {
    label,
    display,
    min,
    max,
    step,
    value = $bindable(),
    oninput,
  }: {
    label: string;
    display: string;
    min: number;
    max: number;
    step: number;
    value: number;
    oninput?: () => void;
  } = $props();
</script>

<div class="control-group">
  <label>
    {label} <span class="opacity-70">{display}</span>
    <input
      type="range"
      class="range range-xs range-primary w-full"
      {min} {max} {step}
      bind:value
      {oninput}
    />
  </label>
</div>
