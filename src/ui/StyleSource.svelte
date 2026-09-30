<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../i18n';
  import { ui, editorStyle, restoreStyle } from './store.svelte';
  let { kind }: { kind: 'effects' | 'postfx' } = $props();
  const resolved = $derived(editorStyle()[kind]);
  const explicit = $derived(ui.focusedLine !== null && ui.project.shotStyles?.[ui.focusedLine]?.[kind] !== undefined);
</script>
<div class="style-source">
  <div><p>{ui.focusedLine === null ? t('project_default') : explicit ? t('style_explicit') : resolved.source < 0 ? t('inherits_default') : `${t('inherits_shot')} ${resolved.source + 1}`}</p>
    <small>{t('affects_shots')} {resolved.end < resolved.start ? t('no_shots') : `${resolved.start + 1}–${resolved.end + 1}`}</small></div>
  {#if explicit}<button class="btn btn-xs" onclick={() => restoreStyle(kind)}>{t('restore_inheritance')}</button>{/if}
</div>
