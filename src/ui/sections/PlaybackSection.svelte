<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import { ui, engine, applyTextInput } from '../store.svelte';
  import Slider from '../Slider.svelte';

  let textExpanded = $state(false);
  let isSeeking = $state(false);
  let pendingFile: File | null = $state(null);

  // ── LRC 文本（防抖应用）──
  let textTimer: ReturnType<typeof setTimeout>;
  function onTextInput() {
    clearTimeout(textTimer);
    textTimer = setTimeout(() => applyTextInput(ui.text), 400);
  }

  // ── LRC 导入 ──
  let lrcInput: HTMLInputElement;
  async function onLrcChange() {
    const file = lrcInput.files?.[0];
    if (!file) return;
    ui.lrcName = file.name;
    const content = await file.text();
    ui.text = content;
    applyTextInput(content);
    lrcInput.value = '';
  }

  // ── 曲绘 ──
  let mediaInput: HTMLInputElement;
  function onMediaChange() {
    const file = mediaInput.files?.[0];
    if (file) {
      pendingFile = file;
      ui.mediaName = file.name;
      ui.mediaPicked = true;
    }
  }

  async function applyMedia() {
    if (!pendingFile) return;
    try {
      await engine.addMedia(pendingFile, ui.mediaMode);
      engine.effectOpacity = 0.7;
      ui.opacity = 0.7;
      ui.mediaLoaded = true;
      ui.mediaX = 0; ui.mediaY = 0; ui.mediaScale = 1;
    } catch (err) {
      console.warn('[PV] Media load failed:', err);
    }
    pendingFile = null;
  }

  // ── 音频 ──
  let audioInput: HTMLInputElement;
  async function onAudioChange() {
    const file = audioInput.files?.[0];
    if (!file) return;
    ui.audioName = file.name;
    await engine.beat.loadAudio(file);
    ui.audioLoaded = true;
    ui.audioPaused = false;
  }

  function toggleAudio() {
    if (engine.beat.paused) {
      engine.beat.resume();
      ui.audioPaused = false;
    } else {
      engine.beat.pause();
      ui.audioPaused = true;
    }
  }

  // ── 播放时间轴 ──
  function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  let seekValue = $state(0);
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

<div class="control-group">
  <label for="seek-slider">{t('timer_label')} <span class="opacity-70">{formatClock(ui.playbackTime)} / {formatClock(ui.timelineDuration)}</span></label>
  <input
    id="seek-slider"
    type="range" class="range range-xs range-primary w-full"
    min="0" max="1" step="0.001"
    bind:value={seekValue}
    oninput={onSeek}
    onpointerdown={() => { isSeeking = true; }}
    onpointerup={() => { isSeeking = false; }}
  />
  <div class="timeline-controls">
    <button class="btn btn-sm" title={t('lyric_prev')} aria-label={t('lyric_prev')} onclick={() => engine.seekPrevSegment()}>⏮</button>
    <button class="btn btn-sm" title={ui.paused ? t('play') : t('pause')} aria-label={ui.paused ? t('play') : t('pause')} onclick={togglePause}>{ui.paused ? '▶' : '⏸'}</button>
    <button class="btn btn-sm" title={t('lyric_next')} aria-label={t('lyric_next')} onclick={() => engine.seekNextSegment()}>⏭</button>
  </div>
</div>

<div class="control-group">
  <label for="text-input">{t('text_label')}</label>
  <textarea
    id="text-input"
    class="textarea textarea-sm w-full"
    rows={textExpanded ? 6 : 3}
    placeholder={'[00:00.00]深夜東京\n[00:03.00]の6畳半夢'}
    bind:value={ui.text}
    oninput={onTextInput}
    onfocus={() => { textExpanded = true; }}
    onblur={() => { textExpanded = false; }}
  ></textarea>
</div>

<div class="control-group">
  <label for="lrc-pick-btn">LRC</label>
  <div class="file-pick">
    <button id="lrc-pick-btn" class="btn btn-xs" onclick={() => lrcInput.click()}>{t('lrc_import')}</button>
    <span class="file-pick-name">{ui.lrcName || t('no_file')}</span>
    <input type="file" accept=".lrc,text/plain" hidden bind:this={lrcInput} onchange={onLrcChange} />
  </div>
</div>

<div class="control-group">
  <label for="audio-pick-btn">{t('audio')}</label>
  <div class="file-pick">
    <button id="audio-pick-btn" class="btn btn-xs" onclick={() => audioInput.click()}>{t('choose_file')}</button>
    <span class="file-pick-name">{ui.audioName || t('no_file')}</span>
    <input type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac,.wma,.opus" hidden bind:this={audioInput} onchange={onAudioChange} />
  </div>
</div>

{#if ui.audioLoaded}
  <div class="control-group">
    <div class="audio-row">
      <button class="btn btn-sm" onclick={toggleAudio}>{ui.audioPaused ? t('play') : t('pause')}</button>
      <span class="audio-status">{ui.audioPaused ? t('paused') : t('playing')}</span>
    </div>
  </div>
{/if}

<div class="control-group">
  <label for="media-pick-btn">{t('media')}</label>
  <div class="file-pick">
    <button id="media-pick-btn" class="btn btn-xs" onclick={() => mediaInput.click()}>{t('choose_file')}</button>
    <span class="file-pick-name">{ui.mediaName || t('no_file')}</span>
    <input type="file" accept="image/*,video/mp4,video/webm,video/mov" hidden bind:this={mediaInput} onchange={onMediaChange} />
  </div>
</div>

{#if ui.mediaPicked}
  <div class="control-group">
    <label for="media-mode">{t('media_mode')}</label>
    <select id="media-mode" class="select select-sm w-full" bind:value={ui.mediaMode}>
      <option value="fit">{t('auto_fit')}</option>
      <option value="free">{t('free_mode')}</option>
    </select>
    <button class="btn btn-sm" onclick={applyMedia}>{t('apply')}</button>
  </div>
{/if}

<Slider
  label={t('anim_speed')} display={`${ui.speed.toFixed(1)}x`}
  min={0} max={4} step={0.1} bind:value={ui.speed}
  oninput={() => { engine.animationSpeed = ui.speed; }}
/>
<Slider
  label={t('motion_intensity')} display={`${ui.motion.toFixed(1)}x`}
  min={0} max={2} step={0.1} bind:value={ui.motion}
  oninput={() => { engine.motionIntensity = ui.motion; }}
/>
<Slider
  label={t('bg_opacity')} display={`${Math.round(ui.opacity * 100)}%`}
  min={0} max={1} step={0.05} bind:value={ui.opacity}
  oninput={() => { engine.effectOpacity = ui.opacity; }}
/>
