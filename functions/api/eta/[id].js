// Cloudflare Pages Function：代理 data.gov.hk 的實時到站（避免瀏覽器 CORS）
// GET /api/eta/:id
const ETA_API = 'https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

const FETCH_TIMEOUT_MS = 8000;  // 單次對上游連接逾時，防止掛起/重設

async function fetchOne(id, timeoutMs) {
  // 用 AbortController 設逾時：上游若連線懸置或被重設(ECONNRESET)，
  // 我們主動中止並視為可重試的錯誤，避免噪音與卡住。
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ETA_API + encodeURIComponent(id), {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEta(id, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchOne(id, FETCH_TIMEOUT_MS);
    } catch (e) {
      // AbortError、ECONNRESET 等一律視為可重試
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw lastErr;
}

export async function onRequestGet(context) {
  const params = context.params || {};
  const id = decodeURIComponent(params.id || '');
  if (!id) {
    return new Response(JSON.stringify({ error: 'missing stop id' }), { status: 400, headers: CORS });
  }
  try {
    const json = await fetchEta(id);
    return new Response(JSON.stringify(json), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'ETA fetch failed: ' + (e && e.message) }), { status: 502, headers: CORS });
  }
}
