// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
import { effectParameterInventory } from './effectParameterInventory';
import { effectCatalog } from './effectCatalog';
import type { EffectEntry } from './types';

export interface ParameterDefinition {
  type: string;
  default?: any;
  options?: any[];
  min?: number;
  max?: number;
  step?: number;
  children?: Record<string, ParameterDefinition>;
  item?: ParameterDefinition;
}

export function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|\$(background|primary|secondary|accent|text|line))$/i.test(value);
}

export function describeValue(value: any): ParameterDefinition {
  if (Array.isArray(value)) return { type: 'array', default: value, item: describeValue(value[0] ?? '') };
  if (value && typeof value === 'object') return { type: 'object', default: value,
    children: Object.fromEntries(Object.entries(value).map(([key, v]) => [key, describeValue(v)])) };
  return { type: isColor(value) ? 'color' : typeof value, default: value };
}

/** Runtime-dependent defaults remain unset until the user opts into overriding them. */
export function effectParameters(entry: EffectEntry): Record<string, ParameterDefinition> {
  const fields: Record<string, ParameterDefinition> = structuredClone(effectParameterInventory[entry.type] ?? {});
  const preset = effectCatalog.find(e => e.type === entry.type && (entry.type !== 'organicBlob' || e.config.shape === entry.config.shape))
    ?? effectCatalog.find(e => e.type === entry.type);
  for (const [key, value] of Object.entries(preset?.config ?? {})) {
    if (!fields[key]) continue;
    fields[key] = { ...fields[key], ...describeValue(value), ...(fields[key]?.options ? { options: fields[key].options } : {}) };
  }
  const booleans = ['outlineHalo', 'animate', 'fill', 'showCursorWhenDone'];
  const arrays = ['colors', 'shapes', 'windowsData', 'iconsData'];
  for (const [key, definition] of Object.entries(fields)) {
    if (definition.type === 'unknown') {
      definition.type = booleans.includes(key) ? 'boolean' : arrays.includes(key) ? 'array'
        : /color/i.test(key) ? 'color' : /text|chars|content|icon/i.test(key) ? 'string' : 'number';
    }
    if (isColor(definition.default)) definition.type = 'color';
    if (definition.default !== undefined && ['array', 'object'].includes(definition.type)) Object.assign(definition, describeValue(definition.default));
    if (definition.type === 'array' && definition.options) definition.item = { type: 'string', default: definition.options[0], options: definition.options };
  }
  if (fields.colors) fields.colors.item = { type: 'color', default: '$primary' };
  if (entry.type === 'shadowShapes' && fields.shapes) fields.shapes.item = { type: 'object', default: { type: 'square', x: 0.5, y: 0.5, size: 0.15, rotation: 0 }, children: {
    type: { type: 'string', default: 'square', options: ['square', 'diamond', 'rect'] },
    x: { type: 'number', default: 0.5 }, y: { type: 'number', default: 0.5 }, size: { type: 'number', default: 0.15, min: 0 }, rotation: { type: 'number', default: 0 },
  } };
  // Multiple windows accept the same complete fields as a single window.
  if (fields.windowsData) fields.windowsData.item = { type: 'object', children: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== 'windowsData')) };
  if (fields.iconsData) fields.iconsData.item = { type: 'object', children: {
    x: { type: 'number', default: 30 }, y: { type: 'number', default: 30 }, size: { type: 'number', default: 64, min: 1 },
    iconType: { type: 'string', default: 'paint', options: ['paint', 'notes'] }, label: { type: 'string', default: 'Icon' },
    labelColor: { type: 'color', default: '$text' },
  } };
  return fields;
}

export function initialParameter(definition: ParameterDefinition): any {
  if (definition.default !== undefined) return structuredClone(definition.default);
  if (definition.type === 'object') return {};
  if (definition.type === 'array') return [];
  if (definition.type === 'boolean') return false;
  if (definition.type === 'number') return definition.min ?? 0;
  if (definition.type === 'color') return '$primary';
  return '';
}
