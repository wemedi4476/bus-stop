#!/usr/bin/env node
/**
 * server.js — 從本機 SQLite (bustop.db) 提供九巴巴士站 API + 托管前端頁面。
 *
 *  API：
 *    GET /api/search?q=關鍵字  站名搜尋（繁/簡/英），含每站途經路線數
 *    GET /api/stop/:id         該站詳情 + 所有途經路線（含「往」方向）
 *    GET /api/eta/:id          即時到站（代理 data.gov.hk /stop-eta/:id）
 *    GET /api/stats            整體統計
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
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'bustop.db');
const PORT = process.env.PORT || 8080;
const ETA_API = 'https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/';

if (!fs.existsSync(DB_PATH)) {
  console.error(`database not found: ${DB_PATH}`);
  console.error('請先執行： npm run build-db');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });

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
  res.end(typeof objOrText === 'string' ? objOrText : JSON.stringify(objOrText));
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

function apiSearch(res, q) {
  const kw = `%${q}%`;
  const rows = db.prepare(`
    SELECT s.stop, s.name_tc, s.name_sc, s.name_en, s.lat, s.lng,
           (SELECT COUNT(*) FROM stop_routes sr WHERE sr.stop = s.stop) AS route_count
    FROM stops s
    WHERE s.name_tc LIKE ? ESCAPE '\\' OR s.name_sc LIKE ? ESCAPE '\\' OR s.name_en LIKE ? ESCAPE '\\'
    ORDER BY s.name_tc
    LIMIT 100
  `).all(kw, kw, kw);
  send(res, 200, { q, count: rows.length, data: rows });
}

function apiStats(res) {
  const stats = {
    stops: db.prepare('SELECT COUNT(*) AS n FROM stops').get().n,
    routes: db.prepare('SELECT COUNT(*) AS n FROM routes').get().n,
    stop_routes: db.prepare('SELECT COUNT(*) AS n FROM stop_routes').get().n,
    stops_with_routes: db.prepare('SELECT COUNT(DISTINCT stop) AS n FROM stop_routes').get().n,
  };
  stats.avg_routes_per_stop = +(stats.stop_routes / stats.stops_with_routes).toFixed(1);
  send(res, 200, stats);
}

function serveStatic(res, urlPath) {
  let file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden');
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
    if (p === '/api/stats') return apiStats(res);
    if (p === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return send(res, 400, { error: "missing 'q' parameter" });
      return apiSearch(res, q);
    }
    let m = p.match(/^\/api\/stop\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      const stop = db.prepare('SELECT stop, name_tc, name_sc, name_en, lat, lng FROM stops WHERE stop = ?').get(id);
      if (!stop) return send(res, 404, { error: 'STOP not found', stop: id });
      const routes = db.prepare('SELECT route, bound, dest_tc, dest_en FROM stop_routes WHERE stop = ? ORDER BY route').all(id);
      return send(res, 200, { ...stop, routes });
    }
    m = p.match(/^\/api\/eta\/(.+)$/);
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
  console.log('  DB:', DB_PATH);
});
