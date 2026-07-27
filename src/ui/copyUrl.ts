// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import { t } from '../i18n';
import { showToast, attachModalDismiss } from '../core/uiHelpers';
import { encodeShareCode } from '../core/templateStore';
import { ui, getCurrentTemplateSnapshot } from './store.svelte';

/**
 * “复制 URL”弹窗。
 *
 * 模板的两种表达方式：
 * - 内置模板：`t=<index>`，链接短且稳定。
 * - 用户/AI/临时分享模板：必须把完整 TemplateConfig 编码进 `code=`，
 *   因为接收方机器没有发送方 localStorage 里的 `user-*` 模板。
 */
export function openCopyUrlModal(): void {
  const overlay = document.createElement('div');
  overlay.className = 'pv-modal-overlay';
  overlay.innerHTML = `
    <div class="pv-modal-box">
      <div class="pv-modal-body">
        <p class="pv-modal-title">${t('copy_url_settings')}</p>
        <label class="effect-toggle" style="margin-bottom:8px">
          <input type="checkbox" id="copy-url-bg-check" checked>
          <span>${t('copy_url_transparent_bg')}</span>
        </label>
        <label class="effect-toggle" style="margin-bottom:8px">
          <input type="checkbox" id="copy-url-tpl-check" checked>
          <span>${t('copy_url_use_template')}</span>
        </label>
      </div>
      <div class="pv-modal-footer">
        <button class="btn pv-modal-confirm">${t('copy_url_copy_btn')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.pv-modal-confirm')!.addEventListener('click', async () => {
    const bgCheck = overlay.querySelector('#copy-url-bg-check') as HTMLInputElement;
    const tplCheck = overlay.querySelector('#copy-url-tpl-check') as HTMLInputElement;

    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('panel', '0');
    if (bgCheck.checked) params.set('bg', '0');
    if (ui.npListening) params.set('np', '1');

    if (tplCheck.checked) {
      const { isCustom, config } = getCurrentTemplateSnapshot();
      if (isCustom) {
        try {
          // 自定义类模板不能用 `t=user-*` 分享，接收方无法解析到同一份本地模板。
          const code = await encodeShareCode(config);
          params.set('code', code);
        } catch (err) {
          console.warn('[PV] Encode share code failed, fallback to t=custom', err);
          params.set('t', 'custom');
        }
      } else {
        params.set('t', ui.selected);
      }
    }

    const url = baseUrl + '?' + params.toString();
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    overlay.remove();
    showToast(t('url_copied'));
  });

  attachModalDismiss(overlay);
}
