#!/usr/bin/env node
/**
 * server.js — 本機開發 server：托管 public/ 靜態前端 + 代理 data.gov.hk 實時 ETA。
 *
 *  Option C（靜態資料無資料庫）：前端與靜態 JSON 放 public/，與 Cloudflare Pages 同結構，
 *  故本機無需 SQLite 資料庫，只需靜態托管 + ETA 代理。
 *
 *  API：
 *    GET /api/eta/:id          即時到站（代理 data.gov.hk /stop-eta/:id）
 *  靜態：
 *    GET /                     回傳 index.html
 *    GET /eta.html             回傳 eta.html
 *
 *  用法： node server.js   （可用環境變數 PORT 改埠號，預設 8080）
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const ETA_API = 'https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function send(res, status, objOrText, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  if (Buffer.isBuffer(objOrText)) {
    res.end(objOrText);
  } else {
    res.end(typeof objOrText === 'string' ? objOrText : JSON.stringify(objOrText));
  }
}

async function fetchEta(stopId, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(ETA_API + encodeURIComponent(stopId), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

function serveStatic(res, urlPath) {
  // Option C：前端與靜態資料放 public/（與 Cloudflare Pages 同結構，本機開發對齊）
  const root = path.join(ROOT, 'public');
  let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root)) return send(res, 403, 'forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found', path: urlPath });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    send(res, 200, buf, type);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    const m = p.match(/^\/api\/eta\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      return fetchEta(id).then(
        (json) => send(res, 200, json),
        (e) => send(res, 502, { error: 'ETA fetch failed: ' + e.message })
      );
    }
    return serveStatic(res, p);
  } catch (e) {
    return send(res, 500, { error: 'server error: ' + e.message });
  }
});

server.listen(PORT, () => {
  console.log(`bustop server running at http://localhost:${PORT}`);
  console.log('  Static: public/');
});
