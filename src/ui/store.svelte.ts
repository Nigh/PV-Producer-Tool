// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// UI 状态层：Svelte 5 runes 包装 PVEngine。
// 模板状态的几个关键区分（沿袭自旧 main.ts）：
// 1. 内置模板：URL 参数 `t=` 指向模板索引即可。
// 2. 用户模板：可能包含精细 effect.config，分享时必须序列化完整模板。
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
import { cloneConfig, effectGroup, normalizePostFx, normalizeShotStyles, resolveShotStyle } from '../core/shotStyles';
import type { EffectEntry, EffectGroup, PostFxConfig, ShotStyle } from '../core/types';
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
  appliedText: DEFAULT_TEXT,

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
  project: cloneConfig(templates[0]) as TemplateConfig,
  styleRevision: 0,
  loopLine: null as number | null,
  textRevision: 0,
});

/** JSON 深拷贝：TemplateConfig 目前只含纯 JSON 数据。 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneTemplateConfig(template: TemplateConfig): TemplateConfig {
  return cloneJson(template);
}

/**
 * 完整项目快照；全片默认与逐镜配置不会随当前播放镜头改变。
 */
export function buildRuntimeTemplateSnapshot(_base: TemplateConfig, name = ui.project.name): TemplateConfig {
  const snapshot = cloneConfig($state.snapshot(ui.project));
  snapshot.name = name;
  snapshot.bpm = ui.bpm;
  snapshot.animationSpeed = ui.speed;
  snapshot.motionIntensity = ui.motion;
  snapshot.bgOpacity = ui.opacity;
  snapshot.shots = cloneConfig($state.snapshot(ui.shots));
  snapshot.lrc = ui.appliedText;
  return normalizeShotStyles(snapshot, configFor);
}

/** Editor state is authoritative; playback never writes back into it. */
export function editorStyle() {
  return resolveShotStyle(ui.project, ui.focusedLine ?? -1, engine.lyricLineCount);
}

let styleTimer: ReturnType<typeof setTimeout>;
function publishProject(immediate = false) {
  ui.styleRevision++;
  clearTimeout(styleTimer);
  const apply = () => engine.setProjectTemplate(buildRuntimeTemplateSnapshot(ui.project));
  if (immediate) apply(); else styleTimer = setTimeout(apply, 120);
}

export function flushProject() { publishProject(true); }

export function editStyle<K extends keyof ShotStyle>(key: K, value: NonNullable<ShotStyle[K]>) {
  const project = cloneConfig($state.snapshot(ui.project));
  if (ui.focusedLine === null) {
    if (key === 'effects') {
      const group = value as EffectGroup;
      project.palette = group.palette; project.effects = group.effects; project.features = group.features;
    }
    else project.postfx = value as PostFxConfig;
  } else {
    const styles = project.shotStyles ?? [];
    while (styles.length <= ui.focusedLine) styles.push(null);
    styles[ui.focusedLine] = { ...styles[ui.focusedLine], [key]: cloneConfig(value) };
    project.shotStyles = styles;
  }
  ui.project = project;
  ui.selected = 'custom';
  publishProject();
}

export function restoreStyle(key: keyof ShotStyle) {
  if (ui.focusedLine === null) return;
  const project = cloneConfig($state.snapshot(ui.project));
  const slot = project.shotStyles?.[ui.focusedLine];
  if (slot) delete slot[key];
  ui.project = project;
  publishProject();
}

export function editEffects(change: (group: EffectGroup) => void) {
  const group = cloneConfig($state.snapshot(editorStyle().effects.value));
  group.effects.forEach(e => { e.id ??= crypto.randomUUID(); });
  change(group);
  editStyle('effects', group);
}

export function addEffect(index: number): string {
  const preset = effectCatalog[index];
  const id = crypto.randomUUID();
  editEffects(group => group.effects.push({ id, type: preset.type, layer: preset.layer, config: cloneConfig(preset.config) }));
  return id;
}

export function editEffect(index: number, change: (entry: EffectEntry) => void) {
  editEffects(group => { if (group.effects[index]) change(group.effects[index]); });
}

export function editPostFx(key: keyof PostFxConfig, value: number) {
  if (!Number.isFinite(value)) return;
  editStyle('postfx', { ...editorStyle().postfx.value, [key]: value });
}

export function applyStyleTemplate(value: string, includePostFx = false) {
  const template = configFor(value);
  if (!template) return;
  editStyle('effects', cloneConfig(effectGroup(template)));
  if (includePostFx) editStyle('postfx', normalizePostFx(template.postfx));
}

export function saveEffectGroup(name: string) {
  const group = cloneConfig($state.snapshot(editorStyle().effects.value));
  ui.customTemplates.push({ name, ...group });
  saveCustomTemplates($state.snapshot(ui.customTemplates));
  showToast(t('style_saved'));
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
  ui.project.shots = cloneConfig($state.snapshot(shots));
  engine.setShots(cloneJson($state.snapshot(shots)) as (Shot | null)[]);
}

/** 聚焦一句歌词；singleLineEdit 开启时锁句内循环并跳到句中段，否则跳到句首。 */
export function focusLine(index: number): void {
  ui.focusedLine = index;
  if (ui.singleLineEdit) {
    ui.loopLine = index;
    engine.loopSegment = index;
    const start = engine.segmentStartTime(index);
    const end = engine.segmentEndTime(index);
    engine.seek(Math.max(0, start + Math.max(0, end - start) / 2));
  } else {
    exitLineLoop();
    engine.seek(engine.segmentStartTime(index));
  }
}

/** 取消歌词聚焦（退出句内循环）。 */
export function clearLineFocus(): void {
  ui.focusedLine = null;
  exitLineLoop();
}

export function exitLineLoop() {
  ui.loopLine = null;
  engine.loopSegment = null;
}

/** 切换单句编辑：开时对当前选中行立刻进入句内循环；关时只解除循环。 */
export function setSingleLineEdit(on: boolean): void {
  ui.singleLineEdit = on;
  if (on && ui.focusedLine !== null) {
    focusLine(ui.focusedLine);
  } else {
    exitLineLoop();
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

export function buildCustomTemplate(): TemplateConfig {
  return buildRuntimeTemplateSnapshot(ui.project);
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
  const config = val === 'custom' ? buildCustomTemplate() : configFor(val);
  if (!config) return;
  ui.project = normalizeShotStyles(config, configFor);
  ui.selected = val;
  ui.shots = cloneConfig(ui.project.shots ?? []);
  ui.speed = config.animationSpeed ?? 2;
  ui.motion = config.motionIntensity ?? 1;
  ui.opacity = config.bgOpacity ?? 1;
  ui.bpm = config.bpm ?? 120;
  clearLineFocus();
  engine.loadTemplate(ui.project);
  if (config.lrc !== undefined) applyTextInput(config.lrc);
  flushProject();
  if (broadcast && val !== 'custom') syncChannel.postMessage({ type: 'template', value: val });
}

syncChannel.addEventListener('message', (ev) => {
  const { type, value } = ev.data;
  if (type !== 'template' || value === 'custom') return;
  if (configFor(value)) selectTemplate(value, false);
});

export function getCurrentTemplateSnapshot(): { isCustom: boolean; config: TemplateConfig } {
  flushProject();
  return { isCustom: true, config: buildRuntimeTemplateSnapshot(ui.project) };
}

/** 保存 Custom 为用户模板。 */
export function saveCustomAs(name: string): void {
  const tpl = { ...buildCustomTemplate(), name };
  ui.customTemplates.push(tpl);
  saveCustomTemplates(ui.customTemplates);
  showToast(t('style_saved'));
}

export async function exportShareCode(): Promise<void> {
  const code = await encodeShareCode(buildRuntimeTemplateSnapshot(ui.project));
  try { await navigator.clipboard.writeText(code); } catch { /* noop */ }
  showToast(t('code_copied'));
}

/** 导入分享码；失败时抛出，由调用方展示错误。 */
export async function importShareCode(code: string): Promise<void> {
  const tpl = normalizeShotStyles(await decodeShareCode(code), configFor);
  ui.customTemplates.push(tpl);
  saveCustomTemplates(ui.customTemplates);
  selectTemplate(`user-${ui.customTemplates.length - 1}`);
}

/** 文本输入应用：仅接受带时间戳的 LRC。 */
export function applyTextInput(rawText: string): boolean {
  if (!rawText.trim()) {
    if ((ui.shots.some(Boolean) || ui.project.shotStyles?.some(Boolean)) && !window.confirm(t('trim_shots_confirm'))) {
      ui.text = ui.appliedText;
      return false;
    }
    ui.text = ui.appliedText = '';
    ui.shots = [];
    ui.project.shots = [];
    ui.project.shotStyles = [];
    clearLineFocus();
    engine.setText('');
    ui.textRevision++;
    flushProject();
    return true;
  }
  const hasTimestamps = /\[\d{1,2}:\d{2}/.test(rawText);
  if (hasTimestamps) {
    const parsed = parseLrc(rawText);
    if (parsed.length > 0) {
      const n = parsed.length;
      if (ui.shots.slice(n).some(Boolean) || ui.project.shotStyles?.slice(n).some(Boolean)) {
        if (!window.confirm(t('trim_shots_confirm'))) { ui.text = ui.appliedText; return false; }
      }
      ui.shots = padShots(ui.shots, n);
      ui.project.shots = cloneConfig($state.snapshot(ui.shots));
      ui.project.shotStyles = Array.from({ length: n }, (_, i) => ui.project.shotStyles?.[i] ?? null);
      if (ui.focusedLine !== null && ui.focusedLine >= n) clearLineFocus();
      ui.text = rawText;
      ui.appliedText = rawText;
      ui.textRevision++;
      engine.setLyricTimeline(parsed);
      flushProject();
      return true;
    }
  }
  showToast(t('lrc_required'));
  return false;
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
  for (const key of ['pv-tool-ai-api-key', 'pv-tool-ai-api-url', 'pv-tool-ai-api-model']) localStorage.removeItem(key);
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
