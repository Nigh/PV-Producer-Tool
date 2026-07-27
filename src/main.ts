// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// 入口：挂载 Svelte UI。引擎与业务状态见 src/ui/store.svelte.ts。

import './app.css';
import { mount } from 'svelte';
import App from './ui/App.svelte';
import { t } from './i18n';

console.log('%cPV Tool%c solaris:0914', 'color:#6688cc;font-weight:bold', 'color:#888');

document.title = t('page_title');

mount(App, { target: document.querySelector('#app')! });
