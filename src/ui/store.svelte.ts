// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// UI 状态层：Svelte 5 runes 包装 PVEngine。
// 模板状态的几个关键区分（沿袭自旧 main.ts）：
// 1. 内置模板：URL 参数 `t=` 指向模板索引即可。
// 2. 用户/AI 模板：可能包含 AI 生成的精细 effect.config，分享时必须序列化完整模板。
// 3. URL 分享模板：通过 `code=` 临时打开，不写入 localStorage，避免刷新/OBS 嵌入制造重复模板。
// 4. Custom 编辑态：基于当前模板编辑，保留已有 effect 参数；仅新增效果回退到 catalog 默认值。

import { PVEngine } from '../core/engine';
import { parseLrc } from '../core/lrc';
import { templates } from '../templates';
import { effectCatalog } from '../core/effectCatalog';
import type { TemplateConfig, Shot, ShotRect } from '../core/types';
import { t } from '../i18n';
import {
  loadCustomTemplates,
  saveCustomTemplates,
  encodeShareCode,
  decodeShareCode,
} from '../core/templateStore';
import { generateConfigFromAI } from '../core/aiService';
import { testNowPlayingConnection } from '../core/nowPlayingProvider';
import { showToast } from '../core/uiHelpers';
import type { AspectRatio } from '../core/shotAspect';
import { canvasAspect, maxCenteredRect, refitRectToAspect, shotNormAspect } from '../core/shotAspect';

export const engine = new PVEngine();

/** 默认示例 LRC（必须带时间戳）。 */
export const DEFAULT_TEXT = `[00:00.00]深夜東京
[00:03.00]の6畳半夢
[00:06.00]を見てた
[00:09.00]灯りの灯らない蛍光灯
[00:12.00]明日には消えてる電脳城`;

const ASPECT_KEY = 'pv-tool-aspect';
const BEAT_OFFSET_KEY = 'pv-tool-beat-offset';

function loadAspect(): AspectRatio {
  const v = localStorage.getItem(ASPECT_KEY);
  return v === '9:16' ? '9:16' : '16:9';
}

function loadBeatOffset(): number {
  const n = Number(localStorage.getItem(BEAT_OFFSET_KEY));
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export function tplName(tpl: TemplateConfig): string {
  return tpl.nameKey ? t(tpl.nameKey as any) : tpl.name;
}

export const ui = $state({
  // 模板选择：'0'..'N' 内置索引 | 'user-N' | 'shared' | 'custom'
  selected: '0',
  customTemplates: loadCustomTemplates() as TemplateConfig[],
  sharedTemplate: null as TemplateConfig | null,
  checkedEffects: effectCatalog.map(() => false),

  // 运行参数（与引擎 setter 双向同步）
  speed: 2,
  motion: 1,
  opacity: 1,
  bpm: 120,
  beatOffset: loadBeatOffset(),
  beatReact: 0.5,
  aspectRatio: loadAspect() as AspectRatio,
  fps: 0,
  fpsActual: 0,
  shake: 0,
  zoom: 0,
  tilt: 0,
  glitch: 0,
  hue: 0,

  // 媒体
  mediaName: '',
  mediaLoaded: false,
  mediaX: 0,
  mediaY: 0,
  mediaScale: 1,

  // 音频 / 歌词
  audioName: '',
  audioLoaded: false,
  audioPaused: false,
  lrcName: '',
  text: DEFAULT_TEXT,

  // 播放时间轴
  playbackTime: 0,
  timelineDuration: 0,
  paused: false,

  // 静止画分镜（按歌词行/文本段索引对齐，可稀疏）
  shots: [] as (Shot | null)[],
  /** 分镜编辑器聚焦的歌词行（编辑目标）；null = 未聚焦 */
  focusedLine: null as number | null,
  /** 选中歌词时是否自动进入句内循环预览 */
  singleLineEdit: true,

  // 杂项
  canvasColor: '',
  fontFamilies: [] as string[],
  fontFamily: '',
  alphaMode: false,
  npListening: false,
  aiLoading: false,
});

export const isCustomMode = () => ui.selected === 'custom';

/** JSON 深拷贝：TemplateConfig 目前只含纯 JSON 数据。 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneTemplateConfig(template: TemplateConfig): TemplateConfig {
  return cloneJson(template);
}

/**
 * 以模板为基底、用引擎当前运行态（bpm/速度/透明度/postfx）覆盖后的快照。
 * 保存/导出/复制 URL 时用户期望拿到的是屏幕上正在看的效果。
 */
export function buildRuntimeTemplateSnapshot(base: TemplateConfig, name = base.name): TemplateConfig {
  const snapshot = cloneTemplateConfig(base);
  snapshot.name = name;
  snapshot.bpm = engine.beat.bpm;
  snapshot.animationSpeed = engine.animationSpeed;
  snapshot.bgOpacity = engine.effectOpacity;
  snapshot.postfx = {
    shake: engine.shake,
    zoom: engine.zoom,
    tilt: engine.tilt,
    glitch: engine.glitch,
    hueShift: engine.hueShift,
  };
  // 分镜属于运行态：保存/分享时带上当前编辑的分镜
  if (engine.shots.some((s) => !!s)) {
    snapshot.shots = cloneJson(engine.shots);
  } else {
    delete snapshot.shots;
  }
  return snapshot;
}

/** 将分镜数组补齐/截到指定行数（空槽填 null，与歌词行索引对齐）。 */
export function padShots(shots: (Shot | null)[], len: number): (Shot | null)[] {
  const out: (Shot | null)[] = shots.slice(0, Math.max(0, len));
  while (out.length < len) out.push(null);
  return out;
}

/** 更新分镜列表（编辑器 → 引擎）。 */
export function setShots(shots: (Shot | null)[]): void {
  ui.shots = shots;
  engine.setShots(cloneJson($state.snapshot(shots)) as (Shot | null)[]);
}

/** 聚焦一句歌词；singleLineEdit 开启时锁句内循环并跳到句中段，否则跳到句首。 */
export function focusLine(index: number): void {
  ui.focusedLine = index;
  if (ui.singleLineEdit) {
    engine.loopSegment = index;
    const start = engine.segmentStartTime(index);
    const end = engine.segmentEndTime(index);
    engine.seek(Math.max(0, start + Math.max(0, end - start) / 2));
  } else {
    engine.loopSegment = null;
    engine.seek(engine.segmentStartTime(index));
  }
}

/** 取消歌词聚焦（退出句内循环）。 */
export function clearLineFocus(): void {
  ui.focusedLine = null;
  engine.loopSegment = null;
}

/** 切换单句编辑：开时对当前选中行立刻进入句内循环；关时只解除循环。 */
export function setSingleLineEdit(on: boolean): void {
  ui.singleLineEdit = on;
  if (on && ui.focusedLine !== null) {
    focusLine(ui.focusedLine);
  } else {
    engine.loopSegment = null;
  }
}

/** 播放/暂停切换（播放条与全局快捷键共用）。 */
export function togglePause(): void {
  if (engine.paused) {
    engine.resume();
    ui.paused = false;
  } else {
    engine.pause();
    ui.paused = true;
  }
}

export function setAspectRatio(ar: AspectRatio): void {
  if (ui.aspectRatio === ar) return;
  ui.aspectRatio = ar;
  localStorage.setItem(ASPECT_KEY, ar);
  // 已有分镜按中心重算比例，避免自由框残留
  const img = engine.sourceImage;
  if (img && ui.shots.some((s) => !!s)) {
    const normAsp = shotNormAspect(canvasAspect(ar), img.naturalWidth, img.naturalHeight);
    const next = ui.shots.map((s) =>
      s ? { ...s, rect: refitRectToAspect(s.rect, normAsp) } : null,
    );
    setShots(next);
  }
  engine.setDesignAspect(ar);
}

export function setBeatOffset(val: number): void {
  const v = Math.max(0, Math.min(1, val));
  ui.beatOffset = v;
  engine.beat.beatOffset = v;
  localStorage.setItem(BEAT_OFFSET_KEY, String(v));
}

/** 当前画幅下，原图内最大居中取景框。 */
export function fullFrameShotRect(): ShotRect {
  const img = engine.sourceImage;
  const asp = canvasAspect(ui.aspectRatio);
  if (!img) return maxCenteredRect(asp);
  return maxCenteredRect(shotNormAspect(asp, img.naturalWidth, img.naturalHeight));
}

/**
 * Custom 面板勾选项与模板 effects 的稳定匹配 key。
 * organicBlob 在 catalog 里有 blob/wave/cloud 多个同 type 变体，需把 shape 纳入。
 */
export function effectSelectionKey(
  entry: Pick<TemplateConfig['effects'][number], 'type' | 'config'>,
): string {
  if (entry.type === 'organicBlob') {
    return `${entry.type}:${entry.config?.shape ?? 'blob'}`;
  }
  return entry.type;
}

/**
 * 根据勾选状态生成自定义模板。勾选项命中当前模板已有 effect 时复用其完整
 * config（保留 AI/分享模板的精细参数），只有新增勾选才用 catalog 默认值。
 */
export function buildCustomTemplate(): TemplateConfig {
  const curTpl = engine.currentTemplateConfig;
  const existingEffects = new Map<string, TemplateConfig['effects']>();
  curTpl?.effects.forEach((effect) => {
    const key = effectSelectionKey(effect);
    const pool = existingEffects.get(key) ?? [];
    pool.push(cloneJson(effect));
    existingEffects.set(key, pool);
  });

  const effects: TemplateConfig['effects'] = [];
  ui.checkedEffects.forEach((checked, idx) => {
    if (!checked) return;
    const preset = effectCatalog[idx];
    const existing = existingEffects.get(effectSelectionKey(preset))?.shift();
    effects.push(existing ?? { type: preset.type, layer: preset.layer, config: { ...preset.config } });
  });

  const template = curTpl
    ? buildRuntimeTemplateSnapshot(curTpl, 'Custom')
    : {
      name: 'Custom',
      palette: {
        background: '#ffffff',
        primary: '#000000',
        secondary: '#888888',
        accent: '#ff3366',
        text: '#000000',
      },
      effects,
      bpm: engine.beat.bpm,
      animationSpeed: engine.animationSpeed,
      bgOpacity: engine.effectOpacity,
      postfx: {
        shake: engine.shake,
        zoom: engine.zoom,
        tilt: engine.tilt,
        glitch: engine.glitch,
        hueShift: engine.hueShift,
      },
    };
  template.effects = effects;
  return template;
}

/** 引擎运行态 → UI 滑块。 */
export function syncFromEngine(): void {
  ui.speed = engine.animationSpeed;
  ui.opacity = engine.effectOpacity;
  ui.bpm = engine.beat.bpm;
  ui.shake = engine.shake;
  ui.zoom = engine.zoom;
  ui.tilt = engine.tilt;
  ui.glitch = engine.glitch;
  ui.hue = engine.hueShift;
  ui.shots = engine.shots;
}

/** 模板配置 → Custom 勾选状态。 */
export function syncCheckedEffects(config: TemplateConfig): void {
  const configKeys = new Set(config.effects.map(effectSelectionKey));
  ui.checkedEffects = effectCatalog.map((preset) => configKeys.has(effectSelectionKey(preset)));
}

function configFor(val: string): TemplateConfig | null {
  if (val === 'shared') return ui.sharedTemplate;
  if (val.startsWith('user-')) {
    return ui.customTemplates[parseInt(val.split('-')[1])] ?? null;
  }
  const idx = parseInt(val);
  return !isNaN(idx) && idx >= 0 && idx < templates.length ? templates[idx] : null;
}

const syncChannel = new BroadcastChannel('pv-tool-sync');

/** 模板切换入口（模板管理、URL 参数、跨窗口同步共用）。 */
export function selectTemplate(val: string, broadcast = true): void {
  if (val === 'custom') {
    ui.selected = 'custom';
    engine.loadTemplate(buildCustomTemplate());
    engine.resetShotTemplateTracking('custom');
  } else {
    const config = configFor(val);
    if (!config) {
      ui.selected = '0';
      engine.loadTemplate(templates[0]);
      engine.resetShotTemplateTracking('0');
      syncCheckedEffects(templates[0]);
      syncFromEngine();
      return;
    }
    ui.selected = val;
    engine.loadTemplate(config);
    engine.resetShotTemplateTracking(val);
    syncCheckedEffects(config);
    syncFromEngine();
  }
  if (broadcast && val !== 'custom') {
    syncChannel.postMessage({ type: 'template', value: val });
  }
}

syncChannel.addEventListener('message', (ev) => {
  const { type, value } = ev.data;
  if (type !== 'template' || value === 'custom') return;
  if (configFor(value)) selectTemplate(value, false);
});

let customRebuildTimer: ReturnType<typeof setTimeout>;
/** Custom 勾选变化后防抖重建模板。 */
export function scheduleCustomRebuild(): void {
  if (!isCustomMode()) return;
  clearTimeout(customRebuildTimer);
  customRebuildTimer = setTimeout(() => {
    try {
      engine.loadTemplate(buildCustomTemplate());
    } catch (err) {
      console.warn('[PV] Custom template rebuild failed:', err);
    }
  }, 300);
}

/** 提供给复制 URL 的当前模板快照。 */
export function getCurrentTemplateSnapshot(): { isCustom: boolean; config: TemplateConfig } {
  const val = ui.selected;
  if (val === 'custom') {
    return { isCustom: true, config: buildCustomTemplate() };
  }
  if (val === 'shared' && ui.sharedTemplate) {
    return { isCustom: true, config: buildRuntimeTemplateSnapshot(ui.sharedTemplate) };
  }
  if (val.startsWith('user-')) {
    const idx = parseInt(val.split('-')[1]);
    const config = ui.customTemplates[idx] ?? engine.currentTemplateConfig ?? templates[0];
    return { isCustom: true, config: buildRuntimeTemplateSnapshot(config) };
  }
  const idx = parseInt(val);
  const config = !isNaN(idx) && idx >= 0 && idx < templates.length
    ? templates[idx]
    : engine.currentTemplateConfig ?? templates[0];
  return { isCustom: false, config: buildRuntimeTemplateSnapshot(config) };
}

/** 保存 Custom 为用户模板。 */
export function saveCustomAs(name: string): void {
  const tpl = { ...buildCustomTemplate(), name };
  ui.customTemplates.push(tpl);
  saveCustomTemplates(ui.customTemplates);
  selectTemplate(`user-${ui.customTemplates.length - 1}`);
}

export function deleteSelectedTemplate(): void {
  const val = ui.selected;
  if (!val.startsWith('user-')) return;
  ui.customTemplates.splice(parseInt(val.split('-')[1]), 1);
  saveCustomTemplates(ui.customTemplates);
  selectTemplate('0');
}

export async function exportShareCode(): Promise<void> {
  const val = ui.selected;
  if (!val.startsWith('user-')) return;
  const idx = parseInt(val.split('-')[1]);
  // 导出运行态快照，避免调过速度/透明度/postfx 后导出的仍是初始值。
  const code = await encodeShareCode(buildRuntimeTemplateSnapshot(ui.customTemplates[idx]));
  try { await navigator.clipboard.writeText(code); } catch { /* noop */ }
  showToast(t('code_copied'));
}

/** 导入分享码；失败时抛出，由调用方展示错误。 */
export async function importShareCode(code: string): Promise<void> {
  const tpl = await decodeShareCode(code);
  ui.customTemplates.push(tpl);
  saveCustomTemplates(ui.customTemplates);
  selectTemplate(`user-${ui.customTemplates.length - 1}`);
}

/** 文本输入应用：仅接受带时间戳的 LRC。 */
export function applyTextInput(rawText: string): boolean {
  const hasTimestamps = /\[\d{1,2}:\d{2}/.test(rawText);
  if (hasTimestamps) {
    const parsed = parseLrc(rawText);
    if (parsed.length > 0) {
      engine.setLyricTimeline(parsed);
      return true;
    }
  }
  showToast(t('lrc_required'));
  return false;
}

/** AI 生成模板并保存为用户模板。 */
export async function aiGenerate(prompt: string, apiKey: string, apiUrl: string, model: string): Promise<void> {
  ui.aiLoading = true;
  try {
    const config = await generateConfigFromAI(prompt, apiKey, apiUrl, model);
    ui.customTemplates.push(config);
    saveCustomTemplates(ui.customTemplates);
    selectTemplate(`user-${ui.customTemplates.length - 1}`);
    showToast(t('ai_generate_success'));
  } catch (err) {
    console.error('[PV] AI generate config execution failed:', err);
    showToast(t('ai_generate_error'));
  } finally {
    ui.aiLoading = false;
  }
}

let npConnecting = false;
/**
 * 切换 Now Playing 监听。开启前先测试本地服务连通性；
 * 返回 false 表示连接失败（调用方负责提示），状态已回滚。
 */
export async function toggleNowPlaying(on: boolean): Promise<boolean> {
  if (!on) {
    ui.npListening = false;
    engine.nowPlayingListening = false;
    return true;
  }
  if (npConnecting) {
    ui.npListening = false;
    return true;
  }
  npConnecting = true;
  const ok = await testNowPlayingConnection();
  npConnecting = false;
  if (!ok) {
    ui.npListening = false;
    return false;
  }
  ui.npListening = true;
  engine.nowPlayingListening = true;
  return true;
}

/** 引擎初始化 + URL 参数恢复。App.svelte onMount 调用一次。 */
export async function initApp(container: HTMLElement): Promise<void> {
  await engine.init(container, ui.aspectRatio);
  engine.beat.beatOffset = ui.beatOffset;
  // 逐句模板：引擎按分镜切换模板时经这里解析选择值并回写 UI 状态
  engine.templateResolver = (sel) => configFor(sel);
  engine.onShotTemplateApplied = (sel) => {
    ui.selected = sel;
    const config = configFor(sel);
    if (config) syncCheckedEffects(config);
    syncFromEngine();
  };
  applyTextInput(DEFAULT_TEXT);
  engine.onFpsUpdate = (fps) => { ui.fpsActual = fps; };

  const urlParams = new URLSearchParams(window.location.search);

  const codeParam = urlParams.get('code');
  if (codeParam !== null) {
    try {
      const decodedTpl = await decodeShareCode(codeParam);
      // 分享链接是“打开看看/OBS 嵌入”等临时场景，只放入临时 shared 选项，
      // 不写入 localStorage，避免每次刷新产生重复模板。
      ui.sharedTemplate = cloneTemplateConfig(decodedTpl);
      selectTemplate('shared', false);
    } catch (err) {
      console.warn('[PV] Failed to load config from URL code parameter:', err);
      selectTemplate('0', false);
    }
  } else {
    const tParam = urlParams.get('t');
    if (tParam !== null && configFor(tParam)) {
      selectTemplate(tParam, false);
    } else {
      selectTemplate('0', false);
    }
  }

  if (urlParams.get('bg') === '0') {
    engine.alphaMode = true;
    ui.alphaMode = true;
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  }

  if (urlParams.get('panel') === '0') {
    document.body.classList.add('pv-panels-hidden');
  }

  if (urlParams.get('np') === '1') {
    toggleNowPlaying(true).catch(() => { ui.npListening = false; });
  }
}
