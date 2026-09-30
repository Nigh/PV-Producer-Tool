<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { shotRunRange } from '../../core/shotMath';
  import { ui, engine, focusLine, clearLineFocus, setSingleLineEdit, exitLineLoop } from '../store.svelte';
  import ShotsSection from './ShotsSection.svelte';
  import EffectsSection from './EffectsSection.svelte';
  import PostFxSection from './PostFxSection.svelte';
  let tab = $state<'shots' | 'effects' | 'postfx'>('shots');
  let listOpen = $state(false);
  const lines = $derived.by(() => { void ui.textRevision; return engine.hasLyricTimeline ? engine.segmentTexts : []; });
  const framingGroups = $derived.by(() => {
    const groups: ({ start: number; end: number } | undefined)[] = [];
    let first = true;
    ui.shots.forEach((shot, slot) => {
      if (!shot || slot >= lines.length) return;
      // The camera also uses the first defined shot for preceding empty slots.
      const start = first ? 0 : slot;
      first = false;
      const end = Math.min(shotRunRange(ui.shots, slot).end, lines.length - 1);
      if (end > start) for (let i = start; i <= end; i++) groups[i] = { start, end };
    });
    return groups;
  });
  function clock(time: number) { return `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`; }
  function pick(index: number) { focusLine(index); listOpen = false; }
  const title = $derived(ui.focusedLine === null ? t('project_default') : `${t('shot_label')} ${ui.focusedLine + 1} · ${lines[ui.focusedLine] ?? ''}`);
</script>

<div class="workbench">
  <button class="btn btn-sm list-toggle" aria-expanded={listOpen} onclick={() => { listOpen = !listOpen; }}>{t('shot_list')}</button>
  <aside class="workbench-list" class:list-open={listOpen} aria-label={t('shot_list')}>
    <button class="shot-default" class:selected={ui.focusedLine === null} onclick={clearLineFocus}>{t('project_default')}</button>
    <ul>
      {#each lines as line, i (i)}
        {@const group = framingGroups[i]}
        <li class:framing-group={!!group} class:framing-group-start={group?.start === i} class:framing-group-end={group?.end === i}>
          <button class="workbench-line" class:selected={ui.focusedLine === i}
            class:playing={ui.playbackTime >= engine.segmentStartTime(i) && ui.playbackTime < engine.segmentEndTime(i)}
            aria-pressed={ui.focusedLine === i} onclick={() => pick(i)}>
            <span class="line-number" title={group ? `${t('shared_framing')} · ${group.start + 1}–${group.end + 1}` : undefined}>{String(i + 1).padStart(2, '0')}</span>
            {#if group}<span class="sr-only">{t('shared_framing')} · {group.start + 1}–{group.end + 1}</span>{/if}
            <span class="line-description"><strong>{line || '—'}</strong><small>{clock(engine.segmentStartTime(i))}–{clock(engine.segmentEndTime(i))}</small>
              <span class="line-markers">
                <span class:defined={!!ui.shots[i]}>{t('framing')}</span>
                <span class:defined={!!ui.project.shotStyles?.[i]?.effects}>{t('effects_library')}</span>
                <span class:defined={!!ui.project.shotStyles?.[i]?.postfx}>{t('postfx')}</span>
              </span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <label class="loop-option"><input type="checkbox" class="checkbox checkbox-xs" checked={ui.singleLineEdit}
      onchange={e => setSingleLineEdit(e.currentTarget.checked)} />{t('loop_on_select')}</label>
    {#if ui.loopLine !== null}<button class="btn btn-xs" onclick={exitLineLoop}>{t('loop_exit')}</button>{/if}
  </aside>
  <section class="workbench-editor">
    <header class="editor-target"><h2>{title}</h2>
      {#if ui.focusedLine !== null}<small>{clock(engine.segmentStartTime(ui.focusedLine))}–{clock(engine.segmentEndTime(ui.focusedLine))}</small>{/if}
    </header>
    <div class="workbench-tabs" role="tablist" aria-label={t('workbench')}>
      {#each ['shots', 'effects', 'postfx'] as id}
        <button id={'tab-' + id} role="tab" aria-selected={tab === id} aria-controls={'panel-' + id}
          tabindex={tab === id ? 0 : -1} class:active={tab === id}
          onclick={() => { tab = id as typeof tab; }}
          onkeydown={e => {
            const ids = ['shots', 'effects', 'postfx'] as const;
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const n = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (ids.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
              tab = ids[n]; document.getElementById('tab-' + tab)?.focus();
            }
          }}>{t(id === 'shots' ? 'nav_shots' : id === 'effects' ? 'effects_library' : 'postfx')}</button>
      {/each}
    </div>
    <div class="editor-body" id={'panel-' + tab} role="tabpanel" aria-labelledby={'tab-' + tab} tabindex="0">
      {#if tab === 'shots'}
        {#if ui.focusedLine === null}<p class="editor-empty">{t('shot_pick_line')}</p>{:else}<ShotsSection />{/if}
      {:else if tab === 'effects'}<EffectsSection />{:else}<PostFxSection />{/if}
    </div>
  </section>
</div>
