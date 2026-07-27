<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { ui, engine } from '../store.svelte';
  import Slider from '../Slider.svelte';
</script>

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
