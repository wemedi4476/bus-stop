#!/usr/bin/env node
/**
 * export-static.js — 把本機 SQLite (bustop.db) 匯出為**靜態 JSON**（供 Cloudflare Pages/R2 托管，無需資料庫）。
 *
 *  Option C：靜態資料、無 D1/Functions（除 ETA 代理外）。
 *
 *  產出：
 *    public/data/stops.json       —— 全部車站，含每站途經路線（搜尋 + 站詳情用）
 *    public/data/routes_full.json —— route|bound → 完整站序（路線 popup 用，延遲載入）
 *
 *  用法： node scripts/export-static.js   (先 npm run build-db)   
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'bustop.db');
const OUT_DIR = path.join(ROOT, 'public', 'data');

if (!fs.existsSync(DB_PATH)) {
  console.error(`database not found: ${DB_PATH}`);
  console.error('請先執行： npm run build-db');
  process.exit(1);
}
const db = new DatabaseSync(DB_PATH, { readOnly: true });

fs.mkdirSync(OUT_DIR, { recursive: true });

// 1) stops.json：車站 + 內嵌途經路線
const stops = db.prepare('SELECT stop, name_tc, name_sc, name_en, lat, lng FROM stops ORDER BY CAST(stop AS TEXT)').all();
const routeByStop = db.prepare('SELECT stop, route, bound, dest_tc, dest_en FROM stop_routes ORDER BY stop, route, bound').all();

const byStop = new Map();
for (const st of stops) {
  byStop.set(st.stop, {
    s: st.stop, tc: st.name_tc, sc: st.name_sc, en: st.name_en, lat: st.lat, lng: st.lng, routes: []
  });
}
for (const r of routeByStop) {
  const rec = byStop.get(r.stop);
  if (!rec) continue;
  rec.routes.push({ r: r.route, b: r.bound, d: r.dest_tc, de: r.dest_en });
}
const stopsArr = Array.from(byStop.values());
fs.writeFileSync(path.join(OUT_DIR, 'stops.json'), JSON.stringify(stopsArr));

// 2) routes_full.json：route|bound → variants（service_type + 依 seq 排序站序，含站名）
const rs = db.prepare(`
  SELECT rs.route, rs.bound, rs.service_type, rs.seq, rs.stop, s.name_tc
  FROM route_stops rs
  JOIN stops s ON s.stop = rs.stop
  ORDER BY rs.route, rs.bound, rs.service_type, CAST(rs.seq AS INTEGER)
`).all();

const full = {};
for (const x of rs) {
  const key = x.route + '|' + x.bound;
  if (!full[key]) full[key] = [];
  // 找對應 service_type variant
  let v = full[key].find(g => g.st === x.service_type);
  if (!v) { v = { st: x.service_type, stops: [] }; full[key].push(v); }
  v.stops.push({ q: Number(x.seq), s: x.stop, tc: x.name_tc });
}
// 每個 variant 內依 seq 排序（上面 SQL 已排序，保險再排）；並以站數最多的為主要 variant
for (const k of Object.keys(full)) {
  for (const v of full[k]) v.stops.sort((a, b) => a.q - b.q);
  full[k].sort((a, b) => b.stops.length - a.stops.length);
}
fs.writeFileSync(path.join(OUT_DIR, 'routes_full.json'), JSON.stringify(full));

// 摘要
const stSize = fs.statSync(path.join(OUT_DIR, 'stops.json')).size;
const rfSize = fs.statSync(path.join(OUT_DIR, 'routes_full.json')).size;
console.log('written:');
console.log('  public/data/stops.json       ', stSize, 'bytes,', stopsArr.length, 'stops');
console.log('  public/data/routes_full.json ', rfSize, 'bytes,', Object.keys(full).length, 'route|bound keys');

db.close();
