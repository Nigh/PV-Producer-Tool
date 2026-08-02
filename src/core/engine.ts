// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import type { TemplateConfig, UpdateContext, ColorPalette, LayerType, MotionTargetInfo, LyricLine, Shot } from './types';
import { ShotCamera } from './shotCamera';
import { createEffect, BaseEffect } from '../effects';
import { extractDominantColors } from './colorExtractor';
import { MediaOutlineRenderer } from './mediaOutline';
import { GlitchFilter } from './glitchFilter';
import { BeatProvider } from './beatProvider';
import { MotionDetector } from './motionDetector';
import { NowPlayingProvider } from './nowPlayingProvider';
import type { NowPlayingTrack } from './nowPlayingProvider';

const EFFECT_LAYERS: LayerType[] = ['background', 'decoration', 'text', 'overlay'];

export class PVEngine {
  private app: PIXI.Application;
  private layers = new Map<LayerType, PIXI.Container>();
  private effectsRoot!: PIXI.Container;
  private activeEffects: BaseEffect[] = [];
  private palette: ColorPalette = {
    background: '#ffffff',
    primary: '#000000',
    secondary: '#666666',
    accent: '#ff0000',
    text: '#000000',
  };
  private currentTemplate: TemplateConfig | null = null;
  private userText = '';

  private _animationSpeed = 2;
  private _motionIntensity = 1;
  private textSegments: string[] = [''];
  private lyricTimeline: LyricLine[] | null = null;
  private lyricOffsetSeconds = 0;
  private lyricCursor = 0;
  private lastLyricTime = -1;
  private _segmentDuration = 3;
  private _srtTimeline: { startMs: number; endMs: number; text: string }[] | null = null;
  private _effectOpacity = 1;
  private _alphaMode = false;
  private _hueShift = 0;
  private _nowPlayingListening = false;
  private hueFilter: PIXI.ColorMatrixFilter;
  private glitchFilter: GlitchFilter;
  private bgFill!: PIXI.Graphics;

  private _shake = 0;
  private _zoom = 0;
  private _tilt = 0;
  private _glitch = 0;

  private mediaElement: HTMLVideoElement | HTMLImageElement | null = null;
  /** 原始全分辨率图片（不降采样），分镜相机从这里现切纹理。 */
  private originalImage: HTMLImageElement | null = null;
  private shotCamera: ShotCamera | null = null;
  private _shots: (Shot | null)[] = [];
  private outlineRenderer: MediaOutlineRenderer | null = null;
  private _outlineEnabled = false;
  private extractingColors = false;

  private motionDetector: MotionDetector | null = null;
  private _motionDetectionEnabled = false;
  private motionTargets: MotionTargetInfo[] = [];

  private invertFilter: PIXI.ColorMatrixFilter | null = null;
  private _invertMediaEnabled = false;
  private _thresholdMediaEnabled = false;

  readonly beat = new BeatProvider();
  private _beatReactivity = 0.5;

  private _nativeDPR = 1;
  private _currentResolution = 1;
  private _resizeParent: HTMLElement | null = null;
  private _loading = false;
  private _bgColorOverride: string | null = null;
  private _fontFamilyOverride: string | null = null;
  private _tick = 0;
  private _playbackTime = 0;
  private _paused = false;
  private _time = 0;
  private _lastFrameTime = 0;
  private _fpsFrames = 0;
  private _fpsWindowStart = 0;
  /** Called about once per second with the measured render FPS. */
  onFpsUpdate: ((fps: number) => void) | null = null;

  // Now Playing state
  private npProvider: NowPlayingProvider | null = null;
  private _npActive = false;
  private _npPaused = false;
  private _npTime = 0;
  private _npDuration = 0;
  private _npTrack: NowPlayingTrack | null = null;
  private _npSavedUserText: string | null = null;

  constructor() {
    this.app = new PIXI.Application();
    this.hueFilter = new PIXI.ColorMatrixFilter();
    this.glitchFilter = new GlitchFilter();
  }

  async init(parent: HTMLElement) {
    this._nativeDPR = Math.min(window.devicePixelRatio || 1, 3);
    this._currentResolution = this._nativeDPR;
    this._resizeParent = parent;

    await this.app.init({
      resizeTo: parent,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: this._nativeDPR,
      autoDensity: true,
      preserveDrawingBuffer: true,
    });
    parent.appendChild(this.app.canvas);
    this.app.ticker.maxFPS = 60;

    // Media layer at the very bottom
    const mediaLayer = new PIXI.Container();
    this.layers.set('media', mediaLayer);
    this.app.stage.addChild(mediaLayer);

    // All effect layers inside one container, on top of media
    this.effectsRoot = new PIXI.Container();
    this.app.stage.addChild(this.effectsRoot);

    // Solid background fill as the first child — ensures full coverage over media
    this.bgFill = new PIXI.Graphics();
    this.effectsRoot.addChild(this.bgFill);

    for (const layerType of EFFECT_LAYERS) {
      const container = new PIXI.Container();
      this.layers.set(layerType, container);
      this.effectsRoot.addChild(container);
    }

    this._lastFrameTime = performance.now();

    this.app.stage.filters = [this.hueFilter, this.glitchFilter];

    // 画布尺寸变化（画幅切换/侧栏折叠）后重建特效：多数特效在 setup()
    // 里按当时的屏幕尺寸摆放元素，只能整体重排。debounce 避免拖拽期间抖动。
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastW = this.app.screen.width;
    let lastH = this.app.screen.height;
    this.app.renderer.on('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        if ((w !== lastW || h !== lastH) && this.currentTemplate) {
          lastW = w;
          lastH = h;
          this.loadTemplate(this.currentTemplate);
        }
      }, 200);
    });

    this.app.ticker.add((ticker) => {
      const now = performance.now();
      const dt = (now - this._lastFrameTime) / 1000;
      this._lastFrameTime = now;

      // Measured FPS, reported once per second for the UI readout.
      this._fpsFrames++;
      if (now - this._fpsWindowStart >= 1000) {
        this.onFpsUpdate?.(Math.round((this._fpsFrames * 1000) / (now - this._fpsWindowStart)));
        this._fpsFrames = 0;
        this._fpsWindowStart = now;
      }

      if (!this._paused) {
        if (this._npActive) {
          // In Now Playing mode, advance time locally when not paused
          if (!this._npPaused) {
            this._npTime += dt;
            // NP 到曲终停住，避免计时冲过总时长
            if (this._npDuration > 0 && this._npTime >= this._npDuration) {
              this._npTime = this._npDuration;
              this._npPaused = true;
            }
          }
          this._time = this._npTime;
        } else if (this.beat.isAudioMode) {
          this._time = this.beat.currentTime;
        } else {
          this._time += dt;
          // 无音频自由跑：循环钳位，计时不超过 timelineDuration
          const dur = this.timelineDuration;
          if (dur > 0 && this._time >= dur) {
            this._time %= dur;
          }
        }
      }

      // ticker.deltaMS is real elapsed milliseconds. Do NOT derive seconds
      // from ticker.deltaTime / maxFPS: Pixi normalises deltaTime against a
      // fixed 60fps target (Ticker.targetFPMS), so that conversion is only
      // correct at 60fps and breaks once previewFps throttles the ticker.
      this.update(this._time, this._paused ? 0 : ticker.deltaMS / 1000);
    });
  }

  get paused() { return this._paused; }
  /**
   * 当前已加载模板的原始配置引用。
   *
   * UI 层用它作为保存/分享/Custom 编辑的模板基底，再叠加 engine 当前运行态
   * slider 参数生成快照。这里刻意只暴露 getter，不在引擎内处理持久化逻辑，
   * 保持 PVEngine 只负责渲染和运行状态。
   */
  get currentTemplateConfig() { return this.currentTemplate; }

  pause() {
    this._paused = true;
    this.beat.pause();
  }

  resume() {
    this._paused = false;
    this._lastFrameTime = performance.now();
    this.beat.resume();
  }

  seek(time: number) {
    const dur = this.timelineDuration;
    this._time = Math.max(0, dur > 0 ? Math.min(time, dur) : time);
    if (this._npActive) {
      this._npTime = this._time;
    } else if (this.beat.isAudioMode) {
      this.beat.seek(this._time);
    }
  }

  loadTemplate(template: TemplateConfig) {
    if (this._loading) return;
    this._loading = true;

    try {
      this.clearEffects();
      this.currentTemplate = template;
      this.palette = { ...template.palette };

      this.beat.bpm = template.bpm ?? 120;
      if (template.animationSpeed !== undefined) {
        this._animationSpeed = template.animationSpeed;
      }
      if (template.bgOpacity !== undefined) {
        this.effectOpacity = template.bgOpacity;
      }
      this._outlineEnabled = template.features?.mediaOutline ?? false;
      this._motionDetectionEnabled = template.features?.motionDetection ?? false;
      this._invertMediaEnabled = template.features?.invertMedia ?? false;
      this._thresholdMediaEnabled = template.features?.thresholdMedia ?? false;
      this.syncMotionDetector();
      this.syncInvertFilter();

      if (template.features?.autoExtractColors && this.mediaElement && !this.extractingColors) {
        this.applyExtractedColors();
      }

      if (this._bgColorOverride) {
        this.palette.background = this._bgColorOverride;
      }
      if (!this._alphaMode) {
        this.app.renderer.background.color = new PIXI.Color(this.palette.background).toNumber();
      }
      this.updateBgFill();

      for (const entry of template.effects) {
        const layer = this.layers.get(entry.layer);
        if (!layer) continue;

        const config = { ...entry.config };
        if (this.userText) {
          config._userText = this.textSegments[0] || this.userText;
        }
        if (this._fontFamilyOverride) {
          // Prepend so the user's font wins but the effect's own stack
          // stays as fallback for glyphs the local font doesn't cover.
          config.fontFamily = config.fontFamily
            ? `${this._fontFamilyOverride}, ${config.fontFamily}`
            : `${this._fontFamilyOverride}, "Noto Serif JP", "Yu Mincho", serif`;
        }

        try {
          const effect = createEffect(entry.type, layer, config, this.palette, this.app.renderer);
          this.activeEffects.push(effect);
        } catch (err) {
          console.warn(`[PVEngine] Failed to create effect "${entry.type}":`, err);
        }
      }

      if (template.postfx) {
        this._shake = template.postfx.shake ?? 0;
        this._zoom = template.postfx.zoom ?? 0;
        this._tilt = template.postfx.tilt ?? 0;
        this.glitch = template.postfx.glitch ?? 0;
        this.hueShift = template.postfx.hueShift ?? 0;
      }

      if (template.shots && !this._shotTemplateSwitch) {
        this.setShots(template.shots);
      }

      this.syncOutline();
      this.syncResolution();
    } finally {
      this._loading = false;
    }
  }

  setText(text: string) {
    this.clearLyricTimeline();
    this.userText = text;
    this.textSegments = text
      .split('/')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (this.textSegments.length === 0) {
      this.textSegments = [''];
    }
    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  set animationSpeed(val: number) { this._animationSpeed = val; }
  get animationSpeed() { return this._animationSpeed; }

  set motionIntensity(val: number) { this._motionIntensity = val; }
  get motionIntensity() { return this._motionIntensity; }

  set segmentDuration(val: number) { this._segmentDuration = val; }
  get segmentDuration() { return this._segmentDuration; }

  /**
   * GPU 实际允许的最大纹理边长。WebGL 从 context 查询，WebGPU 读 device
   * limits，均不可用时退回 4096。
   * ponytail: 上限夹到 8192 —— 16384² RGBA 单纹理就要 1GB 显存；
   * 需要更高精度时靠分镜相机按取景框现切，而不是抬高整图纹理。
   */
  get maxTextureSize(): number {
    const r = this.app.renderer as any;
    const gl: WebGLRenderingContext | undefined = r?.gl;
    const size = gl?.getParameter?.(gl.MAX_TEXTURE_SIZE)
      ?? r?.device?.limits?.maxTextureDimension2D
      ?? 4096;
    return Math.min(size, 8192);
  }

  /** 设置静止画分镜列表（按歌词行/文本段索引对齐，可稀疏）。 */
  setShots(shots: (Shot | null)[]): void {
    this._shots = shots;
    this.syncShotCamera();
  }

  get shots(): (Shot | null)[] {
    return this._shots;
  }

  /** 是否具备分镜播放条件（已载入静态图且至少一个分镜）。 */
  get shotsActive(): boolean {
    return !!this.shotCamera?.enabled;
  }

  /** 分镜相机取景用的原始全分辨率图片（仅静态图媒体时非空）。 */
  get sourceImage(): HTMLImageElement | null {
    return this.originalImage;
  }

  /** 分镜编辑器用：当前时间轴的全部行文本（歌词 / SRT / 纯文本段）。 */
  get segmentTexts(): string[] {
    if (this._srtTimeline) return this._srtTimeline.map(e => e.text);
    if (this.lyricTimeline && this.lyricTimeline.length > 0) {
      return this.lyricTimeline.map(l => l.text);
    }
    return this.textSegments;
  }

  /** 分镜编辑器用：指定行的起始播放时间（秒），供预览跳转。 */
  segmentStartTime(index: number): number {
    if (this._srtTimeline) return (this._srtTimeline[index]?.startMs ?? 0) / 1000;
    if (this.lyricTimeline && this.lyricTimeline.length > 0) {
      return (this.lyricTimeline[index]?.time ?? 0) - this.lyricOffsetSeconds;
    }
    return index * this._segmentDuration;
  }

  /** 当前播放所在的文本段/歌词行索引（段开始前为 -1）。 */
  get currentSegmentIndex(): number {
    return this.currentSegmentInfo(this._playbackTime).index;
  }

  /** 跳到上一句/段起点；已在首句则停在首句。 */
  seekPrevSegment(): void {
    const idx = Math.max(0, this.currentSegmentIndex);
    this.seek(this.segmentStartTime(Math.max(0, idx - 1)));
  }

  /** 跳到下一句/段起点；已在末句则停在末句。 */
  seekNextSegment(): void {
    const n = this.segmentTexts.length;
    if (n === 0) return;
    const idx = Math.max(0, this.currentSegmentIndex);
    this.seek(this.segmentStartTime(Math.min(n - 1, idx + 1)));
  }

  private syncShotCamera(): void {
    const hasShots = this._shots.some((s) => !!s);
    if (!this.originalImage || !hasShots) {
      this.shotCamera?.setShots(this._shots);
      if (this.shotCamera) this.shotCamera.container.visible = false;
      this.setBaseMediaVisible(true);
      return;
    }
    if (!this.shotCamera) {
      this.shotCamera = new ShotCamera();
    }
    this.shotCamera.setMaxTextureSize(this.maxTextureSize);
    this.shotCamera.attach(this.layers.get('media')!);
    this.shotCamera.setImage(this.originalImage);
    this.shotCamera.setShots(this._shots);
    this.setBaseMediaVisible(false);
  }

  /** 分镜启用时隐藏整图基底 sprite（media 层 children[0]）。 */
  private setBaseMediaVisible(visible: boolean): void {
    const base = this.layers.get('media')?.children[0];
    if (base && base !== this.shotCamera?.container) {
      base.visible = visible;
    }
  }

  /**
   * 当前文本段索引与段时长（秒）。歌词时间轴用行间隔，SRT 用条目区间，
   * 纯文本按 segmentDuration 均分循环。首行歌词之前 index 为 -1。
   */
  private currentSegmentInfo(time: number): { index: number; duration: number } {
    if (this._srtTimeline) {
      const ms = time * 1000;
      const idx = this._srtTimeline.findIndex(e => ms >= e.startMs && ms < e.endMs);
      if (idx < 0) return { index: -1, duration: this._segmentDuration };
      const e = this._srtTimeline[idx];
      return { index: idx, duration: Math.max(0.1, (e.endMs - e.startMs) / 1000) };
    }
    if (this.lyricTimeline && this.lyricTimeline.length > 0) {
      const t = Math.max(0, time + this.lyricOffsetSeconds);
      if (t < this.lyricTimeline[0].time) return { index: -1, duration: this._segmentDuration };
      const idx = this.lyricCursor;
      const next = this.lyricTimeline[idx + 1];
      const duration = next
        ? Math.max(0.1, next.time - this.lyricTimeline[idx].time)
        : this._segmentDuration;
      return { index: idx, duration };
    }
    const n = this.textSegments.length;
    const index = n > 1 ? Math.floor(time / this._segmentDuration) % n : 0;
    return { index, duration: this._segmentDuration };
  }

  setSrtTimeline(entries: { startMs: number; endMs: number; text: string }[] | null) {
    this._srtTimeline = entries;
    if (entries && entries.length > 0) {
      this.clearLyricTimeline();
    }
  }

  setLyricTimeline(lines: LyricLine[]): void {
    if (lines.length === 0) {
      this.clearLyricTimeline();
      return;
    }

    this._srtTimeline = null;
    this.lyricTimeline = [...lines].sort((a, b) => a.time - b.time);
    this.lyricCursor = 0;
    this.lastLyricTime = -1;

    this.userText = this.lyricTimeline[0].text;
    this.textSegments = [this.userText];

    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  clearLyricTimeline(): void {
    this.lyricTimeline = null;
    this.lyricCursor = 0;
    this.lastLyricTime = -1;
    this.lyricOffsetSeconds = 0;
  }

  get hasLyricTimeline(): boolean {
    return !!this.lyricTimeline && this.lyricTimeline.length > 0;
  }

  get lyricLineCount(): number {
    return this.lyricTimeline?.length ?? 0;
  }

  set lyricOffset(val: number) {
    this.lyricOffsetSeconds = val;
  }

  get lyricOffset(): number {
    return this.lyricOffsetSeconds;
  }

  /** Side-effect-only step: advance lyricCursor to whichever line is
   *  active at `time`. Must be called once per frame BEFORE the read
   *  functions getDisplayText / getSegmentTime, but the call site is
   *  explicit (not implicit through getDisplayText) — so the two reads
   *  can sit in any order in the ctx literal without an order-of-eval
   *  footgun for future maintainers. */
  private advanceLyric(time: number): void {
    if (this._srtTimeline) return;
    if (!this.lyricTimeline || this.lyricTimeline.length === 0) return;
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lastLyricTime) {
      this.lyricCursor = 0;
    }
    this.lastLyricTime = t;
    while (
      this.lyricCursor + 1 < this.lyricTimeline.length
      && this.lyricTimeline[this.lyricCursor + 1].time <= t
    ) {
      this.lyricCursor++;
    }
    while (
      this.lyricCursor > 0
      && this.lyricTimeline[this.lyricCursor].time > t
    ) {
      this.lyricCursor--;
    }
  }

  private getDisplayText(time: number): string {
    if (this._srtTimeline) {
      const ms = time * 1000;
      const entry = this._srtTimeline.find(e => ms >= e.startMs && ms < e.endMs);
      return entry?.text ?? '';
    }

    if (!this.lyricTimeline || this.lyricTimeline.length === 0) {
      const segIdx = this.textSegments.length > 1
        ? Math.floor(time / this._segmentDuration) % this.textSegments.length
        : 0;
      return this.textSegments[segIdx] || '';
    }

    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lyricTimeline[0].time) return '';
    return this.lyricTimeline[this.lyricCursor].text;
  }

  /** Seconds elapsed since the start of the current text segment / lyric
   *  line. Pure read — depends on lyricCursor, which advanceLyric() must
   *  have updated for the same `time` first. */
  private getSegmentTime(time: number): number {
    if (this._srtTimeline) {
      const ms = time * 1000;
      const entry = this._srtTimeline.find(e => ms >= e.startMs && ms < e.endMs);
      return entry ? time - entry.startMs / 1000 : 0;
    }
    if (!this.lyricTimeline || this.lyricTimeline.length === 0) {
      return time % this._segmentDuration;
    }
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lyricTimeline[0].time) return 0;
    return t - this.lyricTimeline[this.lyricCursor].time;
  }

  set effectOpacity(val: number) {
    this._effectOpacity = val;
    // bgFill + background 层一起透明，才能透出底下 media/分镜；
    // 不动 effectsRoot，避免歌词/装饰一并变淡。
    this.bgFill.alpha = val;
    const bg = this.layers.get('background');
    if (bg) bg.alpha = val;
  }
  get effectOpacity() { return this._effectOpacity; }

  set alphaMode(val: boolean) {
    this._alphaMode = val;
    const bgLayer = this.layers.get('background');
    if (val) {
      this.bgFill.visible = false;
      if (bgLayer) bgLayer.visible = false;
      this.app.renderer.background.alpha = 0;
    } else {
      this.bgFill.visible = true;
      if (bgLayer) bgLayer.visible = true;
      this.app.renderer.background.alpha = 1;
    }
  }
  get alphaMode() { return this._alphaMode; }

  // Now Playing listener toggle — connects or disconnects the WebSocket
  set nowPlayingListening(val: boolean) {
    if (this._nowPlayingListening === val) return;
    this._nowPlayingListening = val;

    if (val) {
      this.startNowPlaying();
    } else {
      this.stopNowPlaying();
    }
  }
  get nowPlayingListening() { return this._nowPlayingListening; }

  /** The current Now Playing track info, or null if not listening. */
  get nowPlayingTrack(): NowPlayingTrack | null {
    return this._npActive ? this._npTrack : null;
  }

  private startNowPlaying(): void {
    if (this.npProvider) return;

    this._npActive = true;
    this._npPaused = false;
    this._npTime = 0;
    this._npDuration = 0;
    this._npTrack = null;
    this._npSavedUserText = this.userText;

    this.npProvider = new NowPlayingProvider({
      onTrack: (track) => {
        this._npTrack = track;
        this._npDuration = track.duration;
        // Reset progress on track change
        this._npTime = 0;
        this._npPaused = false;
      },

      onLyric: (lines) => {
        if (lines && lines.length > 0) {
          this.setLyricTimeline(lines);
        } else {
          this.clearLyricTimeline();
          // Show track title as fallback text when no lyrics available
          if (this._npTrack) {
            this.userText = this._npTrack.title;
            this.textSegments = [this._npTrack.title];
          }
        }
      },

      onPauseState: (isPaused) => {
        this._npPaused = isPaused;
      },

      onProgress: (progressMs) => {
        this._npTime = progressMs / 1000;
      },

      onReplay: () => {
        this._npTime = 0;
        this._npPaused = false;
        this.lyricCursor = 0;
        this.lastLyricTime = -1;
      },
    });

    this.npProvider.connect();
  }

  private stopNowPlaying(): void {
    if (this.npProvider) {
      this.npProvider.destroy();
      this.npProvider = null;
    }
    this._npActive = false;
    this._npPaused = false;
    this._npTime = 0;
    this._npDuration = 0;
    this._npTrack = null;

    // Restore the original user text
    this.clearLyricTimeline();
    const saved = this._npSavedUserText;
    this._npSavedUserText = null;
    if (saved !== null) {
      this.userText = saved;
      this.textSegments = saved
        .split('/')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      if (this.textSegments.length === 0) {
        this.textSegments = [''];
      }
    }
    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  private updateBgFill() {
    if (!this.bgFill) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const pad = Math.max(w, h) * 0.5;
    this.bgFill.clear();
    this.bgFill.rect(-pad, -pad, w + pad * 2, h + pad * 2);
    this.bgFill.fill({ color: this.palette.background });
  }

  private getMediaSprite(): PIXI.Sprite | null {
    const layer = this.layers.get('media');
    return (layer?.children[0] as PIXI.Sprite) ?? null;
  }

  setMediaOffset(dx: number, dy: number): void {
    const s = this.getMediaSprite();
    if (!s) return;
    s.x = this.app.screen.width / 2 + dx;
    s.y = this.app.screen.height / 2 + dy;
    this.syncOutline();
  }

  setMediaScale(scale: number): void {
    const s = this.getMediaSprite();
    if (!s) return;
    const base = Math.max(
      this.app.screen.width / s.texture.width,
      this.app.screen.height / s.texture.height,
    );
    s.scale.set(base * scale);
    this.syncOutline();
  }

  getMediaState(): { offsetX: number; offsetY: number; scale: number } | null {
    const s = this.getMediaSprite();
    if (!s) return null;
    const base = Math.max(
      this.app.screen.width / s.texture.width,
      this.app.screen.height / s.texture.height,
    );
    return {
      offsetX: s.x - this.app.screen.width / 2,
      offsetY: s.y - this.app.screen.height / 2,
      scale: s.scale.x / base,
    };
  }

  set shake(val: number) { this._shake = val; }
  get shake() { return this._shake; }
  set zoom(val: number) { this._zoom = val; }
  get zoom() { return this._zoom; }
  set tilt(val: number) { this._tilt = val; }
  get tilt() { return this._tilt; }
  set glitch(val: number) {
    this._glitch = val;
    this.glitchFilter.intensity = val;
  }
  get glitch() { return this._glitch; }

  set beatReactivity(val: number) { this._beatReactivity = val; }
  get beatReactivity() { return this._beatReactivity; }

  /** Global font override (CSS family string); null = follow template. */
  set fontFamily(font: string | null) {
    if (font === this._fontFamilyOverride) return;
    this._fontFamilyOverride = font;
    // Effects bake fontFamily into their text objects at setup, so the
    // only way to apply the override is to rebuild the current template.
    if (this.currentTemplate) this.loadTemplate(this.currentTemplate);
  }
  get fontFamily() { return this._fontFamilyOverride; }

  /** Preview frame-rate cap; 0 means unlimited (display refresh rate). */
  set previewFps(fps: number) { this.app.ticker.maxFPS = fps > 0 ? fps : 0; }
  get previewFps() { return this.app.ticker.maxFPS; }

  set canvasColor(color: string | null) {
    this._bgColorOverride = color;
    if (color) {
      this.palette.background = color;
      this.app.renderer.background.color = new PIXI.Color(color).toNumber();
      this.updateBgFill();
    } else if (this.currentTemplate) {
      this.palette.background = this.currentTemplate.palette.background;
      this.app.renderer.background.color = new PIXI.Color(this.palette.background).toNumber();
      this.updateBgFill();
    }
  }
  get canvasColor() { return this._bgColorOverride; }

  set hueShift(degrees: number) {
    this._hueShift = degrees;
    this.hueFilter.matrix = [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0];
    this.hueFilter.hue(degrees, false);
  }
  get hueShift() { return this._hueShift; }

  async addMedia(file: File, mode: 'fit' | 'free' = 'fit'): Promise<void> {
    if (this._loading) return;
    this._loading = true;

    const url = URL.createObjectURL(file);

    try {
      const mediaLayer = this.layers.get('media')!;
      this.destroyOutline();
      // 先摘除分镜相机容器，避免被下面的 removeChildren+destroy 连带销毁
      this.shotCamera?.detach();
      mediaLayer.removeChildren().forEach(c => c.destroy({ children: true }));
      this.originalImage = null;
      this.shotCamera?.setImage(null);

      const isVideo = file.type.startsWith('video/');

      if (isVideo) {
        const video = document.createElement('video');
        video.src = url;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        await video.play();
        this.mediaElement = video;

        const texture = PIXI.Texture.from(video);
        const sprite = new PIXI.Sprite(texture);

        if (mode === 'fit') {
          const scale = Math.max(
            this.app.screen.width / video.videoWidth,
            this.app.screen.height / video.videoHeight
          );
          sprite.scale.set(scale);
        } else {
          const scale = Math.min(
            this.app.screen.width * 0.6 / video.videoWidth,
            this.app.screen.height * 0.6 / video.videoHeight
          );
          sprite.scale.set(scale);
        }

        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        mediaLayer.addChild(sprite);
      } else {
        const img = new Image();
        img.src = url;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
        });

        this.originalImage = img;

        // Downscale if image exceeds the GPU's actual max texture size
        const maxDim = this.maxTextureSize;
        if (img.naturalWidth > maxDim || img.naturalHeight > maxDim) {
          const downscale = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.naturalWidth * downscale);
          canvas.height = Math.round(img.naturalHeight * downscale);
          const dctx = canvas.getContext('2d')!;
          dctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const smallImg = new Image();
          smallImg.src = canvas.toDataURL();
          await new Promise<void>((res) => { smallImg.onload = () => res(); });
          this.mediaElement = smallImg;
        } else {
          this.mediaElement = img;
        }

        const texture = PIXI.Texture.from(this.mediaElement as HTMLImageElement);
        const sprite = new PIXI.Sprite(texture);

        if (mode === 'fit') {
          const scale = Math.max(
            this.app.screen.width / sprite.texture.width,
            this.app.screen.height / sprite.texture.height
          );
          sprite.scale.set(scale);
        } else {
          const scale = Math.min(
            this.app.screen.width * 0.6 / sprite.texture.width,
            this.app.screen.height * 0.6 / sprite.texture.height
          );
          sprite.scale.set(scale);
        }

        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        mediaLayer.addChild(sprite);

        this.syncShotCamera();
      }

      if (this.currentTemplate?.features?.autoExtractColors) {
        this.extractingColors = true;
        this.applyExtractedColors();
        this._loading = false;
        this.loadTemplate(this.currentTemplate);
        this.extractingColors = false;
        return;
      }

      this.syncOutline();
      this.syncMotionDetector();
    } catch (err) {
      console.warn('[PVEngine] addMedia failed:', err);
    } finally {
      URL.revokeObjectURL(url);
      this._loading = false;
    }
  }

  private applyExtractedColors(): void {
    if (!this.mediaElement) return;
    const colors = extractDominantColors(this.mediaElement);
    this.palette = {
      background: colors.primary,
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.complement,
      text: '#ffffff',
    };
  }

  private syncOutline(): void {
    if (!this._outlineEnabled || !this.mediaElement) {
      this.destroyOutline();
      return;
    }

    const mediaLayer = this.layers.get('media')!;
    const mediaSprite = mediaLayer.children[0] as PIXI.Sprite | undefined;
    if (!mediaSprite) return;

    if (this.outlineRenderer) return;

    const srcW = this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement.videoWidth
      : this.mediaElement.naturalWidth;
    const srcH = this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement.videoHeight
      : this.mediaElement.naturalHeight;

    this.outlineRenderer = new MediaOutlineRenderer(srcW, srcH);
    const os = this.outlineRenderer.sprite;
    os.anchor.set(0.5);
    os.x = mediaSprite.x;
    os.y = mediaSprite.y;
    os.width = mediaSprite.width;
    os.height = mediaSprite.height;
    mediaLayer.addChild(os);
  }

  private destroyOutline(): void {
    if (this.outlineRenderer) {
      this.outlineRenderer.destroy();
      this.outlineRenderer = null;
    }
  }

  private syncInvertFilter(): void {
    const mediaLayer = this.layers.get('media')!;
    // Each toggle re-allocates ColorMatrixFilter instances; destroy the
    // previous batch first so swapping invert/threshold modes back-and-
    // forth doesn't leak filter shaders. invertFilter is the one filter
    // we DO reuse across calls; skip it here so that the assignment
    // below re-attaches the same instance instead of touching a freshly
    // destroyed one. PIXI v8 types `mediaLayer.filters` as readonly
    // Filter[] | null | undefined, so normalise to an array first.
    const prev: PIXI.Filter[] = mediaLayer.filters
      ? Array.isArray(mediaLayer.filters)
        ? [...mediaLayer.filters]
        : [mediaLayer.filters as unknown as PIXI.Filter]
      : [];
    this.disposeFilters(prev.filter(f => f !== this.invertFilter));
    if (this._thresholdMediaEnabled) {
      // High-contrast B&W: desaturate → extreme contrast (threshold-like)
      const desat = new PIXI.ColorMatrixFilter();
      desat.desaturate();
      const contrast = new PIXI.ColorMatrixFilter();
      contrast.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      contrast.contrast(1.8, false);
      const bright = new PIXI.ColorMatrixFilter();
      bright.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      bright.brightness(1.15, false);
      mediaLayer.filters = [desat, contrast, bright];
      // invertFilter is unused in threshold mode; release it so the
      // next mode switch back to invert reallocates fresh.
      if (this.invertFilter) {
        try { this.invertFilter.destroy(); } catch { /* ignore */ }
        this.invertFilter = null;
      }
    } else if (this._invertMediaEnabled) {
      if (!this.invertFilter) {
        this.invertFilter = new PIXI.ColorMatrixFilter();
      }
      const m = this.invertFilter;
      m.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      m.desaturate();
      m.negative(false);
      const tint = new PIXI.ColorMatrixFilter();
      tint.matrix = [
        1.06, 0, 0, 0, 0.08,
        0, 1.02, 0, 0, 0.04,
        0, 0, 0.94, 0, 0,
        0, 0, 0, 1, 0,
      ];
      mediaLayer.filters = [this.invertFilter, tint];
    } else {
      if (this.invertFilter) {
        try { this.invertFilter.destroy(); } catch { /* ignore */ }
        this.invertFilter = null;
      }
      mediaLayer.filters = [];
    }
  }

  /**
   * Scale renderer resolution down when many effects are active.
   * Keeps visuals sharp with few effects, avoids GPU overload with many.
   * Mobile devices get more aggressive downscaling.
   */
  private syncResolution(): void {
    const n = this.activeEffects.length;
    const dpr = this._nativeDPR;
    const mobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    let target: number;
    if (mobile) {
      if (n <= 4) {
        target = Math.min(dpr, 2);
      } else if (n <= 8) {
        target = Math.min(dpr, 1.5);
      } else {
        target = 1;
      }
    } else {
      if (n <= 6) {
        target = dpr;
      } else if (n <= 12) {
        target = Math.min(dpr, 2);
      } else if (n <= 18) {
        target = Math.min(dpr, 1.5);
      } else {
        target = 1;
      }
    }

    // Round to avoid sub-pixel jitter
    target = Math.round(target * 4) / 4;

    if (target !== this._currentResolution) {
      this._currentResolution = target;
      this.app.renderer.resolution = target;
      if (this._resizeParent) {
        const w = this._resizeParent.clientWidth;
        const h = this._resizeParent.clientHeight;
        this.app.renderer.resize(w, h);
      }
    }
  }

  private syncMotionDetector(): void {
    if (this._motionDetectionEnabled && this.mediaElement instanceof HTMLVideoElement) {
      if (!this.motionDetector) {
        this.motionDetector = new MotionDetector();
      }
    } else {
      if (this.motionDetector) {
        this.motionDetector.destroy();
        this.motionDetector = null;
      }
      this.motionTargets = [];
    }
  }

  private clearEffects() {
    for (const e of this.activeEffects) {
      try { e.destroy(); } catch { /* already destroyed */ }
    }
    this.activeEffects = [];
    for (const [key, layer] of this.layers) {
      if (key !== 'media' && layer.children.length > 0) {
        try { layer.removeChildren().forEach(c => c.destroy()); } catch { /* safe */ }
      }
    }
  }

  /** 当前句显式设置的分镜（不向前回退：参数覆盖只对本句生效）。 */
  private currentShotOverride(lyricClock: number): Shot | null {
    const idx = this.currentSegmentInfo(lyricClock).index;
    return idx >= 0 ? this._shots[idx] ?? null : null;
  }

  /**
   * 当前句生效的模板选择值：本句未设则向前回退到最近定义（与取景框
   * resolveSlot 同语义）；全部未设返回 null（保持当前模板）。
   */
  private effectiveShotTemplate(lyricClock: number): string | null {
    const idx = this.currentSegmentInfo(lyricClock).index;
    for (let i = Math.min(idx, this._shots.length - 1); i >= 0; i--) {
      const tpl = this._shots[i]?.template;
      if (tpl !== undefined) return tpl;
    }
    return null;
  }

  /** UI 注入：把模板选择值（'0' | 'user-N'）解析成配置。 */
  templateResolver: ((sel: string) => TemplateConfig | null) | null = null;
  /** 逐句模板实际切换时回调（UI 同步下拉/勾选状态）。 */
  onShotTemplateApplied: ((sel: string) => void) | null = null;
  private _activeShotTemplateSel: string | null = null;

  private syncShotTemplate(lyricClock: number): void {
    if (!this.templateResolver) return;
    const sel = this.effectiveShotTemplate(lyricClock);
    if (sel === null || sel === this._activeShotTemplateSel) return;
    const config = this.templateResolver(sel);
    if (!config) return;
    this._activeShotTemplateSel = sel;
    // 逐句切换不能让模板快照里的 shots 覆盖当前分镜列表
    this._shotTemplateSwitch = true;
    try {
      this.loadTemplate(config);
    } finally {
      this._shotTemplateSwitch = false;
    }
    this.onShotTemplateApplied?.(sel);
  }
  private _shotTemplateSwitch = false;

  /** 外部直接换模板（模板管理/URL）后重置逐句追踪，避免误判未变。 */
  resetShotTemplateTracking(sel: string | null = null): void {
    this._activeShotTemplateSel = sel;
  }

  private update(time: number, deltaTime: number) {
    const lyricClock = this._npActive
      ? this._npTime
      : this.beat.isAudioMode
        ? this.beat.currentTime
        : time;
    this._playbackTime = lyricClock;

    // 逐句模板切换须在构建 ctx / 遍历特效之前完成
    this.syncShotTemplate(lyricClock);
    const shotOv = this.currentShotOverride(lyricClock);

    if (this.motionDetector && this.mediaElement instanceof HTMLVideoElement) {
      this.motionDetector.detect(this.mediaElement);
      const srcW = this.mediaElement.videoWidth || 1;
      const srcH = this.mediaElement.videoHeight || 1;
      this.motionTargets = this.motionDetector.getTargetsForDisplay(
        this.app.screen.width, this.app.screen.height, srcW, srcH,
      );
    }

    // Advance lyricCursor first; getDisplayText / getSegmentTime then
    // both read it as pure functions (call order in the ctx literal no
    // longer matters).
    this.advanceLyric(lyricClock);
    const ctx: UpdateContext = {
      time,
      deltaTime,
      // maxFPS is 0 when unthrottled; fall back to 60 so effects that
      // convert frame counts to seconds (e.g. filmGrain) never divide by 0.
      fps: this.app.ticker.maxFPS || 60,
      screenWidth: this.app.screen.width,
      screenHeight: this.app.screen.height,
      palette: this.palette,
      animationSpeed: shotOv?.animationSpeed ?? this._animationSpeed,
      motionIntensity: shotOv?.motionIntensity ?? this._motionIntensity,
      currentText: this.getDisplayText(lyricClock),
      segmentTime: this.getSegmentTime(lyricClock),
      beatIntensity: this.beat.getIntensity(lyricClock) * this._beatReactivity,
      motionTargets: this.motionTargets,
    };

    if (this.shotCamera?.enabled) {
      const seg = this.currentSegmentInfo(lyricClock);
      this.shotCamera.update(
        seg.index, ctx.segmentTime, seg.duration,
        ctx.screenWidth, ctx.screenHeight,
      );
    }

    this.updateBgFill();

    // 逐句背景透明度覆盖（bgFill + background 层一起，语义同 effectOpacity）
    const bgAlpha = shotOv?.bgOpacity ?? this._effectOpacity;
    this.bgFill.alpha = bgAlpha;
    const bgLayer = this.layers.get('background');
    if (bgLayer) bgLayer.alpha = bgAlpha;

    this.applyCameraFX(lyricClock);

    if (this.outlineRenderer && this.mediaElement) {
      this.outlineRenderer.update(this.mediaElement as HTMLVideoElement);
    }

    this._tick++;

    // Legacy render-loop guard for pre-v0.9.14 compatibility
    if (this._tick === 0x7fffffff) this._tick = 0;

    // Throttle heavy effects when many are active
    const n = this.activeEffects.length;
    const heavySkip = n > 15 ? 3 : n > 8 ? 2 : 0;

    for (const effect of this.activeEffects) {
      try {
        if (heavySkip && effect.heavy && this._tick % heavySkip !== 0) continue;
        effect.update(ctx);
      } catch (err) {
        console.warn(`[PVEngine] Effect "${effect.name}" update error:`, err);
      }
    }
  }

  private applyCameraFX(time: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2;
    const cy = h / 2;

    this.app.stage.pivot.set(cx, cy);

    let px = cx, py = cy;

    const beatShake = this.beat.getIntensity(time) * this._beatReactivity;
    const totalShake = this._shake + beatShake * 0.15;
    if (totalShake > 0 && !this._paused) {
      px += (Math.random() - 0.5) * totalShake * 30;
      py += (Math.random() - 0.5) * totalShake * 20;
    }

    this.app.stage.position.set(px, py);
    this.app.stage.scale.set(1 + this._zoom * 0.5);
    this.app.stage.rotation = this._tilt * 0.3;

    this.glitchFilter.time = time;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  get playbackTime(): number {
    const dur = this.timelineDuration;
    // 音频尾帧 currentTime 偶发略超 duration；显示/进度条一律钳住
    return dur > 0 ? Math.min(this._playbackTime, dur) : this._playbackTime;
  }

  get timelineDuration(): number {
    // When Now Playing is active, use NP-provided duration
    if (this._npActive && this._npDuration > 0) {
      return this._npDuration;
    }

    const audioDuration = this.beat.duration;
    if (Number.isFinite(audioDuration) && audioDuration > 0) {
      return audioDuration;
    }

    if (this.lyricTimeline && this.lyricTimeline.length > 0) {
      return Math.max(this.lyricTimeline[this.lyricTimeline.length - 1].time + 2, 1);
    }

    return Math.max(this.textSegments.length * this._segmentDuration, this._segmentDuration);
  }

  destroy() {
    this.stopNowPlaying();
    this.clearEffects();
    // Release media + render-side helpers explicitly. app.destroy(true,
    // true) tears down the PIXI tree (children + textures) but cannot
    // clean up our own subsystems (video decoder via mediaElement, motion
    // detector worker / canvas, outline renderer texture, BeatProvider
    // audio context, stage AND container-level filter shaders). Without
    // this, SPA hot-reload or re-init leaks accumulate.
    this.destroyOutline();
    if (this.motionDetector) {
      this.motionDetector.destroy();
      this.motionDetector = null;
    }
    if (this.mediaElement instanceof HTMLVideoElement) {
      try { this.mediaElement.pause(); } catch { /* ignore */ }
      this.mediaElement.src = '';
      this.mediaElement.load();
    }
    this.mediaElement = null;
    // BeatProvider.dispose() = audioCtx.close + source.disconnect +
    // analyser.disconnect + audioEl.pause + nulls — full cleanup. Plain
    // pause() leaks the AudioContext (browsers cap concurrent contexts
    // around 6 — SPA hot-reload would burn the budget within ~6 reloads).
    try { this.beat.dispose(); } catch { /* ignore */ }
    // stage-level filters explicitly destroyed because Container.destroy()
    // only nulls the _filterEffect ref — Shader.destroy() is what clears
    // the GL bind group. Pass nothing (default destroyPrograms=false) so
    // PIXI's shared shader-program cache stays alive for any other live
    // filter instances using the same program.
    this.disposeFilters(this.app.stage.filters);
    this.app.stage.filters = [];
    // Same treatment for any container-level filters set via
    // syncInvertFilter / syncOutline. Each layer may carry its own
    // ColorMatrixFilter / FilterEffect from the media post-processing
    // pipeline.
    for (const layer of this.layers.values()) {
      this.disposeFilters(layer.filters);
      if (layer.filters) layer.filters = [];
    }
    // Recursive children/texture cleanup. Default `app.destroy(true)` is
    // `app.destroy(true, false)` → stage.destroy(false) leaves the layer
    // containers / bgFill / effectsRoot detached but still referenced
    // from this.layers / this.bgFill — soft JS leak until the engine
    // itself is GC'd. true,true forces deep destroy.
    this.app.destroy(true, true);
  }

  private disposeFilters(filters: PIXI.Filter | readonly PIXI.Filter[] | null | undefined): void {
    if (!filters) return;
    const arr = Array.isArray(filters) ? filters : [filters];
    for (const f of arr) {
      try { f.destroy(); } catch { /* already destroyed */ }
    }
  }
}
