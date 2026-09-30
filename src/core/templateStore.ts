// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from './types';

const STORAGE_KEY = 'pv-tool-custom-templates';
const SHARE_KEY = 'PV2026';

/** Validate imported structure without stripping unknown effect configuration fields. */
export function validateTemplate(value: unknown): asserts value is TemplateConfig {
  const template = value as TemplateConfig;
  const palette = (p: any) => p && ['background', 'primary', 'secondary', 'accent', 'text'].every(key => typeof p[key] === 'string');
  const effects = (entries: any) => Array.isArray(entries) && entries.every(e => e && typeof e.type === 'string'
    && ['background', 'decoration', 'media', 'text', 'overlay'].includes(e.layer)
    && e.config && typeof e.config === 'object' && !Array.isArray(e.config)
    && (e.enabled === undefined || typeof e.enabled === 'boolean')
    && (e.id === undefined || typeof e.id === 'string')
    && (e.palette === undefined || (e.palette && Object.values(e.palette).every(c => typeof c === 'string'))));
  const postfx = (p: any) => p && typeof p === 'object' && !Array.isArray(p)
    && ['shake', 'zoom', 'tilt', 'glitch', 'hueShift'].every(key => p[key] === undefined || (typeof p[key] === 'number' && Number.isFinite(p[key])));
  if (!template || typeof template.name !== 'string' || !template.name || !palette(template.palette) || !effects(template.effects)
    || (template.postfx !== undefined && !postfx(template.postfx))
    || (template.lrc !== undefined && typeof template.lrc !== 'string')
    || (template.shots !== undefined && (!Array.isArray(template.shots) || !template.shots.every(s => s === null || (s && s.rect
      && ['x', 'y', 'w', 'h'].every(key => typeof (s.rect as any)[key] === 'number' && Number.isFinite((s.rect as any)[key]))
      && s.rect.w > 0 && s.rect.h > 0))))
    || (template.shotStyles !== undefined && (!Array.isArray(template.shotStyles) || !template.shotStyles.every(s => s === null || (s && typeof s === 'object'
      && (s.effects === undefined || (palette(s.effects.palette) && effects(s.effects.effects)))
      && (s.postfx === undefined || postfx(s.postfx))))))) throw new Error('Invalid template data');
}

// ── LocalStorage persistence ──

export function loadCustomTemplates(): TemplateConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const templates: unknown = JSON.parse(raw);
    if (!Array.isArray(templates)) return [];
    return templates.filter(template => { try { validateTemplate(template); return true; } catch { return false; } });
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: TemplateConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function addCustomTemplate(template: TemplateConfig): TemplateConfig[] {
  const list = loadCustomTemplates();
  list.push(template);
  saveCustomTemplates(list);
  return list;
}

export function removeCustomTemplate(index: number): TemplateConfig[] {
  const list = loadCustomTemplates();
  list.splice(index, 1);
  saveCustomTemplates(list);
  return list;
}

// ── Share code: serialize → compress → XOR encrypt → base64 ──

function xorCipher(data: Uint8Array, key: string): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key.charCodeAt(i % key.length);
  }
  return result;
}

async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encodeShareCode(template: TemplateConfig): Promise<string> {
  const json = JSON.stringify(template);
  const raw = new TextEncoder().encode(json);
  const compressed = await compressBytes(raw);
  const encrypted = xorCipher(compressed, SHARE_KEY);
  return uint8ToBase64(encrypted);
}

export async function decodeShareCode(code: string): Promise<TemplateConfig> {
  const cleaned = code.trim().replace(/\s+/g, '');
  const encrypted = base64ToUint8(cleaned);
  const compressed = xorCipher(encrypted, SHARE_KEY);
  const raw = await decompressBytes(compressed);
  const json = new TextDecoder().decode(raw);
  const template = JSON.parse(json) as TemplateConfig;
  validateTemplate(template);
  return template;
}
