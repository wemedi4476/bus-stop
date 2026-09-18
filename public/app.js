// app.js — 三個頁面共用的前端工具：時間格式、帶重試的 JSON 抓取、我的路線收藏。
'use strict';

const API_BASE = '/api';
const SEL_STORAGE_KEY = 'bustop.myRoutes.v1';

// 帶遞增 backoff 重試的 JSON 抓取（ETA 上游偶發不穩）
async function fetchJson(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr;
}

// 以 Object.assign(bustop, {...}) 併入各頁 Alpine component，方法內用 this.* 取用
const bustop = {
  formatTime(dt) {
    if (!(dt instanceof Date) || isNaN(dt)) return '';
    const p = n => String(n).padStart(2, '0');
    return p(dt.getHours()) + ':' + p(dt.getMinutes());
  },

  saveSelection() {
    try {
      // 只存靜態欄位，不存每次刷新後的 etas/loading/error
      const slim = this.selection.map(it => ({
        key: it.key, stop: it.stop, stopName: it.stopName,
        route: it.route, bound: it.bound, dest_tc: it.dest_tc, group: it.group
      }));
      localStorage.setItem(SEL_STORAGE_KEY, JSON.stringify(slim));
    } catch (e) { /* 忽略：儲存失敗不阻斷 */ }
  },

  restoreSelection() {
    try {
      const raw = localStorage.getItem(SEL_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      // 舊資料無 group 欄位，預設歸入「上班」
      this.selection = arr.map(s => Object.assign({}, s, {
        group: (s.group === 'work' || s.group === 'home') ? s.group : 'work',
        etas: [], loading: false, error: ''
      }));
    } catch (e) { /* 忽略 */ }
  }
};
