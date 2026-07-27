// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// xianii（深色，默认）/ xianii-light 主题切换，持久化到 localStorage。

const STORAGE_KEY = 'pv-tool-theme';

export const theme = $state({
  light: localStorage.getItem(STORAGE_KEY) === 'light',
});

function apply(): void {
  document.documentElement.setAttribute('data-theme', theme.light ? 'xianii-light' : 'xianii');
}

export function setTheme(light: boolean): void {
  theme.light = light;
  localStorage.setItem(STORAGE_KEY, light ? 'light' : 'dark');
  apply();
}

apply();
