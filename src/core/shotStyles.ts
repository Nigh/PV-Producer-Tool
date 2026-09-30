// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
import type { EffectGroup, PostFxConfig, ShotStyle, TemplateConfig } from './types';

export function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizePostFx(value?: Partial<PostFxConfig>): PostFxConfig {
  return { shake: value?.shake ?? 0, zoom: value?.zoom ?? 0, tilt: value?.tilt ?? 0,
    glitch: value?.glitch ?? 0, hueShift: value?.hueShift ?? 0 };
}

export function effectGroup(template: TemplateConfig): EffectGroup {
  return { palette: template.palette, effects: template.effects, ...(template.features ? { features: template.features } : {}) };
}

/** -1 means the project default. Empty effects and zero postfx are explicit checkpoints. */
export function resolveShotStyle(template: TemplateConfig, index: number, lineCount: number) {
  const styles = template.shotStyles ?? [];
  function resolve<K extends keyof ShotStyle>(key: K, fallback: NonNullable<ShotStyle[K]>) {
    let source = -1;
    for (let i = Math.min(index, styles.length - 1); i >= 0; i--) {
      if (styles[i]?.[key] !== undefined) { source = i; break; }
    }
    const value = source < 0 ? fallback : styles[source]![key]!;
    const start = index < 0 ? 0 : index;
    let end = lineCount === 0 ? -1 : Math.max(start, lineCount - 1);
    for (let i = start + (index < 0 ? 0 : 1); i < lineCount; i++) {
      if (styles[i]?.[key] !== undefined) { end = i - 1; break; }
    }
    return { value, source, start, end };
  }
  return { effects: resolve('effects', effectGroup(template)),
    postfx: resolve('postfx', normalizePostFx(template.postfx)) };
}

/** Materialize old local template references once; new shares are self-contained. */
export function normalizeShotStyles(template: TemplateConfig, resolveTemplate: (id: string) => TemplateConfig | null) {
  const next = cloneConfig(template);
  const styles = next.shotStyles ?? [];
  next.shots?.forEach((shot, i) => {
    if (!shot?.template) return;
    const legacy = resolveTemplate(shot.template);
    if (!legacy) throw new Error(`Missing shot template: ${shot.template}`);
    if (!styles[i]?.effects) styles[i] = { ...styles[i], effects: cloneConfig(effectGroup(legacy)) };
    delete shot.template;
  });
  if (styles.some(Boolean)) next.shotStyles = styles;
  return next;
}
