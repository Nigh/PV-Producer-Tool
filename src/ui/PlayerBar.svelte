<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { ui, engine } from './store.svelte';

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
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function onSeek() {
    engine.seek(seekValue * engine.timelineDuration);
  }

  function togglePause() {
    if (engine.paused) {
      engine.resume();
      ui.paused = false;
    } else {
      engine.pause();
      ui.paused = true;
    }
  }
</script>

<div class="player-bar">
  <button class="btn btn-sm btn-ghost" title={t('lyric_prev')} aria-label={t('lyric_prev')} onclick={() => engine.seekPrevSegment()}>⏮</button>
  <button class="btn btn-sm btn-ghost" title={ui.paused ? t('play') : t('pause')} aria-label={ui.paused ? t('play') : t('pause')} onclick={togglePause}>{ui.paused ? '▶' : '⏸'}</button>
  <button class="btn btn-sm btn-ghost" title={t('lyric_next')} aria-label={t('lyric_next')} onclick={() => engine.seekNextSegment()}>⏭</button>
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
