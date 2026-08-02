<!-- PV Tool — Copyright (c) 2026 DanteAlighieri13210914
     Licensed under Non-Commercial License. See LICENSE for terms. -->
<script lang="ts">
  import { t } from '../../i18n';
  import { ui, engine, applyTextInput } from '../store.svelte';

  let textExpanded = $state(false);

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

  // ── 曲绘：选择后立刻 Auto Fit 应用 ──
  let mediaInput: HTMLInputElement;
  async function onMediaChange() {
    const file = mediaInput.files?.[0];
    if (!file) return;
    ui.mediaName = file.name;
    try {
      await engine.addMedia(file, 'fit');
      engine.effectOpacity = 0.3;
      ui.opacity = 0.3;
      ui.mediaLoaded = true;
      ui.mediaX = 0; ui.mediaY = 0; ui.mediaScale = 1;
    } catch (err) {
      console.warn('[PV] Media load failed:', err);
    }
    mediaInput.value = '';
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
</script>

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
