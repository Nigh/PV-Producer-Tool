// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

export type LayerType = 'background' | 'decoration' | 'media' | 'text' | 'overlay';

export interface ColorPalette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export interface EffectEntry {
  type: string;
  layer: LayerType;
  config: Record<string, any>;
}

export interface TemplateConfig {
  name: string;
  nameKey?: string;
  palette: ColorPalette;
  effects: EffectEntry[];
  bpm?: number;
  animationSpeed?: number;
  bgOpacity?: number;
  postfx?: {
    shake?: number;
    zoom?: number;
    tilt?: number;
    glitch?: number;
    hueShift?: number;
  };
  features?: {
    mediaOutline?: boolean;
    autoExtractColors?: boolean;
    motionDetection?: boolean;
    invertMedia?: boolean;
    thresholdMedia?: boolean;
  };
  /** 静止画 MAD 分镜列表，按歌词行/文本段索引对齐（可稀疏，null 槽位表示沿用上一镜）。 */
  shots?: (Shot | null)[];
}

/** 分镜取景框，归一化到原图尺寸（0..1）。 */
export interface ShotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ShotTransition = 'cut' | 'fade' | 'slide' | 'zoom';

export type ShotMotion =
  | 'none'
  | 'zoomIn'
  | 'zoomOut'
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown';

/** 单句歌词对应的静止画分镜：取景框 + 入/出转场 + 过程运动 + 逐句效果覆盖。 */
export interface Shot {
  rect: ShotRect;
  in?: ShotTransition;
  out?: ShotTransition;
  motion?: ShotMotion;
  /** 模板选择值（'0'..'N' 内置 | 'user-N'）；空 = 沿用上一镜的模板。 */
  template?: string;
  /** 以下为空 = 跟随全局默认。 */
  animationSpeed?: number;
  motionIntensity?: number;
  bgOpacity?: number;
}

export interface MotionTargetInfo {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
}

export interface UpdateContext {
  time: number;
  deltaTime: number;
  fps: number;
  /** Seconds elapsed since the current text segment / lyric line started */
  segmentTime: number;
  screenWidth: number;
  screenHeight: number;
  palette: ColorPalette;
  animationSpeed: number;
  motionIntensity: number;
  currentText: string;
  beatIntensity: number;
  motionTargets: MotionTargetInfo[];
}

export interface Beat {
  time: number;
  type: 'kick' | 'snare' | 'accent';
}

export interface LyricChar {
  text: string;
  startTime: number;
  endTime: number;
}

export interface LyricPhrase {
  chars: LyricChar[];
  startTime: number;
  endTime: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface Segment {
  type: 'verse' | 'chorus' | 'bridge';
  startTime: number;
  endTime: number;
}

export interface MusicData {
  bpm: number;
  beats: Beat[];
  lyrics: LyricPhrase[];
  segments: Segment[];
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function resolveColor(color: string, palette: ColorPalette): string {
  if (color === '$line') {
    return luminance(palette.background) > 0.55 ? '#999999' : '#ffffff';
  }
  if (color.startsWith('$')) {
    const key = color.slice(1) as keyof ColorPalette;
    return palette[key] || '#000000';
  }
  return color;
}