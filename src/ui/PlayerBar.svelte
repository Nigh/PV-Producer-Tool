<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { ui, engine, clearLineFocus, togglePause } from './store.svelte';

  let isSeeking = $state(false);
  let seekValue = $state(0);

  function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  onMount(() => {
    let raf = 0;
    const tick = () => {
      ui.playbackTime = engine.playbackTime;
      ui.timelineDuration = engine.timelineDuration;
      if (!isSeeking && ui.timelineDuration > 0) {
        seekValue = ui.playbackTime / ui.timelineDuration;
      }
      // 非单句模式：选中跟随当前歌词段
      if (!ui.singleLineEdit) {
        const idx = engine.currentSegmentIndex;
        ui.focusedLine = idx >= 0 ? idx : null;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // 在播放条上主动控制播放 = 用户想自由浏览，自动退出句内循环
  function onSeek() {
    clearLineFocus();
    engine.seek(seekValue * engine.timelineDuration);
  }

  function seekSegment(dir: -1 | 1) {
    clearLineFocus();
    if (dir < 0) engine.seekPrevSegment(); else engine.seekNextSegment();
  }

</script>

<div class="player-bar">
  <button class="btn btn-sm btn-ghost player-icon-btn" title={t('lyric_prev')} aria-label={t('lyric_prev')} onclick={() => seekSegment(-1)}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4v12M15 5.5 7.5 10l7.5 4.5z" /></svg>
  </button>
  <button class="btn btn-sm btn-ghost player-icon-btn player-play" title={ui.paused ? t('play') : t('pause')} aria-label={ui.paused ? t('play') : t('pause')} onclick={togglePause}>
    {#if ui.paused}
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 8 5-8 5z" /></svg>
    {:else}
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg>
    {/if}
  </button>
  <button class="btn btn-sm btn-ghost player-icon-btn" title={t('lyric_next')} aria-label={t('lyric_next')} onclick={() => seekSegment(1)}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 4v12M5 5.5l7.5 4.5L5 14.5z" /></svg>
  </button>
  {#if ui.focusedLine !== null && ui.singleLineEdit}
    <button class="loop-chip" title={t('loop_exit')} onclick={clearLineFocus}>
      <span aria-hidden="true">↻</span> {t('loop_line')} {ui.focusedLine + 1} <span aria-hidden="true">×</span>
    </button>
  {/if}
  <input
    type="range" class="range range-xs range-primary player-seek"
    min="0" max="1" step="0.001"
    aria-label={t('timer_label')}
    bind:value={seekValue}
    oninput={onSeek}
    onpointerdown={() => { isSeeking = true; }}
    onpointerup={() => { isSeeking = false; }}
  />
  <span class="player-clock">{formatClock(ui.playbackTime)} / {formatClock(ui.timelineDuration)}</span>
</div>
