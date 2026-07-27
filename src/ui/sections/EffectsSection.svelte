<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { effectCatalog } from '../../core/effectCatalog';
  import { ui, isCustomMode, selectTemplate, scheduleCustomRebuild } from '../store.svelte';

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

  function onEffectChange() {
    // 非 Custom 模式下改动勾选 → 自动切入 Custom（继承当前模板的 effect 参数）
    if (!isCustomMode()) {
      selectTemplate('custom');
    } else {
      scheduleCustomRebuild();
    }
  }
</script>

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
              onchange={onEffectChange}
            />
            <span>{item.label}</span>
          </label>
        {/each}
      </div>
    </details>
  {/each}
</div>
