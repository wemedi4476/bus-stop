#!/usr/bin/env node
/**
 * build-db.js — 下载並預處理 data.gov.hk 的九巴 (KMB) 資料，寫入本機 SQLite (bustop.db)。
 *
 *  階段 1 (fetch)：下載 /stop /route /route-stop 原始 JSON，落盤到 data/raw/（帶重試）。
 *  階段 2 (build) ：讀盤 → 建立 schema → 插入資料 → 預聚合「每站途經路線」(stop_routes)。
 *
 *  用法： node scripts/build-db.js
 *        （重跑可：重新下載並重建資料庫，冪等）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const API = 'https://data.etabus.gov.hk/v1/transport/kmb';
const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const DB_PATH = path.join(ROOT, 'bustop.db');

const ENDPOINTS = ['/stop', '/route', '/route-stop'];

async function fetchJson(pathname, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(API + pathname, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
      console.log(`  [retry ${i + 1}] ${pathname}: ${e.message}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function fetchStage() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const ep of ENDPOINTS) {
    const file = path.join(RAW_DIR, ep.replace('/', '') + '.json');
    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
      console.log(`skip ${ep} (already downloaded)`);
      continue;
    }
    console.log(`downloading ${ep} ...`);
    const json = await fetchJson(ep);
    fs.writeFileSync(file, JSON.stringify(json));
    const n = (json.data || []).length;
    console.log(`  saved ${path.basename(file)} (${n} records, ${fs.statSync(file).size} bytes)`);
  }
}

function buildStage() {
  console.log('building SQLite database ...');
  if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH); // 冪等：重建
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE stops (
      stop TEXT PRIMARY KEY,
      name_tc TEXT, name_sc TEXT, name_en TEXT,
      lat TEXT, lng TEXT
    );
    CREATE TABLE routes (
      route TEXT, bound TEXT, service_type INTEGER,
      orig_tc TEXT, dest_tc TEXT, dest_sc TEXT, dest_en TEXT,
      PRIMARY KEY (route, bound, service_type)
    );
    CREATE TABLE route_stops (
      route TEXT, bound TEXT, service_type INTEGER,
      seq INTEGER, stop TEXT
    );
    CREATE INDEX idx_route_stops_stop ON route_stops(stop);
  `);

  const load = (name) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, name), 'utf8')).data || [];

  const stops = load('stop.json');
  const routes = load('route.json');
  const routeStops = load('route-stop.json');

  db.exec('BEGIN');
  {
    const ins = db.prepare('INSERT INTO stops (stop, name_tc, name_sc, name_en, lat, lng) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of stops) ins.run(s.stop, s.name_tc || '', s.name_sc || '', s.name_en || '', s.lat || '', s.long || '');
  }
  {
    const ins = db.prepare('INSERT INTO routes (route, bound, service_type, orig_tc, dest_tc, dest_sc, dest_en) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of routes) ins.run(r.route, r.bound, r.service_type, r.orig_tc || '', r.dest_tc || '', r.dest_sc || '', r.dest_en || '');
  }
  {
    const ins = db.prepare('INSERT INTO route_stops (route, bound, service_type, seq, stop) VALUES (?, ?, ?, ?, ?)');
    for (const x of routeStops) ins.run(x.route, x.bound, x.service_type, x.seq, x.stop);
  }
  db.exec('COMMIT');

  // 預聚合：每站途經路線（按 route|bound 去重，取目的地）
  console.log('pre-aggregating stop_routes ...');
  db.exec(`
    DROP TABLE IF EXISTS stop_routes;
    CREATE TABLE stop_routes AS
      SELECT rs.stop, rs.route, rs.bound,
             MAX(r.dest_tc) AS dest_tc, MAX(r.dest_en) AS dest_en
      FROM route_stops rs
      JOIN routes r USING (route, bound)
      GROUP BY rs.stop, rs.route, rs.bound;
    CREATE INDEX idx_stop_routes_stop ON stop_routes(stop);
    CREATE INDEX idx_stop_routes_route ON stop_routes(route);
  `);

  // 統計
  const stats = {
    stops: db.prepare('SELECT COUNT(*) AS n FROM stops').get().n,
    routes: db.prepare('SELECT COUNT(*) AS n FROM routes').get().n,
    route_stops: db.prepare('SELECT COUNT(*) AS n FROM route_stops').get().n,
    stop_routes: db.prepare('SELECT COUNT(*) AS n FROM stop_routes').get().n,
    stops_with_routes: db.prepare('SELECT COUNT(DISTINCT stop) AS n FROM stop_routes').get().n,
  };
  console.log('database written:', DB_PATH, '->', stats);
  db.close();
  return stats;
}

(async () => {
  try {
    await fetchStage();
    const st = buildStage();
    console.log('DONE. avg routes/stop =', (st.stop_routes / st.stops_with_routes).toFixed(1));
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();
