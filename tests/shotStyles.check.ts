// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
import assert from 'node:assert/strict';
import { cloneConfig, effectGroup, normalizePostFx, normalizeShotStyles, resolveShotStyle } from '../src/core/shotStyles.ts';
import { encodeShareCode, decodeShareCode, validateTemplate } from '../src/core/templateStore.ts';
import type { TemplateConfig } from '../src/core/types.ts';

const base: TemplateConfig = { name: 'Test', palette: { background: '#000000', primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff', text: '#ffffff' },
  effects: [{ type: 'organicBlob', layer: 'decoration', config: { colors: ['#ff0000'], nested: { n: 2 } } }], postfx: { shake: 0.5 } };
const group = cloneConfig(effectGroup(base));
const project: TemplateConfig = { ...cloneConfig(base), shotStyles: [null, { postfx: normalizePostFx({ zoom: 0.3 }) }, { effects: group }, null, null,
  { effects: { palette: base.palette, effects: [] }, postfx: normalizePostFx() }] };
const resolved = resolveShotStyle(project, 2, 8);
assert.equal(resolved.effects.source, 2);
assert.equal(resolved.effects.end, 4);
assert.equal(resolved.postfx.source, 1);
assert.equal(resolved.postfx.end, 4);
assert.equal(resolveShotStyle(project, 4, 8).effects.value, group);
assert.equal(resolveShotStyle(project, 5, 8).effects.value.effects.length, 0);
assert.deepEqual(resolveShotStyle(project, 6, 8).postfx.value, normalizePostFx());
assert.equal(resolveShotStyle(project, 0, 8).effects.source, -1);
assert.equal(resolveShotStyle(project, 0, 8).postfx.value.shake, 0.5);
assert.equal(resolveShotStyle(project, -1, 0).effects.end, -1);
const copy = cloneConfig(group.effects[0]);
copy.config.nested.n = 7;
copy.config.colors[0] = '#ffffff';
assert.equal(group.effects[0].config.nested.n, 2);
assert.equal(group.effects[0].config.colors[0], '#ff0000');
delete project.shotStyles![2]!.effects;
assert.equal(resolveShotStyle(project, 3, 8).effects.source, -1);
assert.equal(resolveShotStyle(project, 3, 8).postfx.source, 1);
const legacy = { ...cloneConfig(base), shots: [{ rect: { x: 0, y: 0, w: 1, h: 1 }, template: 'user-1' }, null] };
const normalized = normalizeShotStyles(legacy, id => id === 'user-1' ? base : null);
assert.ok(!normalized.shots![0]!.template);
assert.deepEqual(normalized.shotStyles![0]!.effects, effectGroup(base));
assert.deepEqual(normalizeShotStyles(normalized, () => null), normalized);
assert.throws(() => normalizeShotStyles(legacy, () => null), /Missing shot template/);
assert.deepEqual(await decodeShareCode(await encodeShareCode(normalized)), normalized);
assert.deepEqual(await decodeShareCode(await encodeShareCode(base)), base);
assert.throws(() => validateTemplate({ ...base, effects: [{ type: 'x', layer: 'text', config: null }] }), /Invalid/);
assert.throws(() => validateTemplate({ ...base, shotStyles: [{ postfx: { zoom: 'bad' } }] }), /Invalid/);
assert.throws(() => validateTemplate({ ...base, shotStyles: [{ effects: { palette: {}, effects: [] } }] }), /Invalid/);
const saved = { ...normalized, lrc: '[00:00.00]line one\n[00:03.00]line two' };
assert.deepEqual(await decodeShareCode(await encodeShareCode(saved)), saved);
console.log('shot styles checks passed');
