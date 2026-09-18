# bustop — 九巴巴士站 STOP ID 查詢 + 實時到站

KMB 巴士站查詢與「我的路線」實時到站工具。多頁靜態前端（Tailwind + Alpine.js via CDN），
資料由 data.gov.hk 預處理成唯讀靜態 JSON 托管於 Cloudflare Pages（無 DB）；僅實時 ETA 走一個 Pages Function 代理。

## Project
- Stack：Node 22（內置 `node:sqlite`，**零 npm 依賴**）後端腳本 + 靜態 HTML 前端 + Cloudflare Pages。
- 資料來源：[data.etabus.gov.hk/v1/transport/kmb](https://data.etabus.gov.hk/v1/transport/kmb)（九巴 KMB only）。
- 架構路線圖（Option C，靜態無 DB）：`build-db` → 本機 `bustop.db`（gitignore）→ `export-static` → `public/data/*.json`。
- 入口：前端 `public/index.html`；本機 server `server.js`（PORT 預設 8080）。

## Commands
- `npm run build-db` — 下載 data.gov.hk 原始資料，建本機 SQLite `bustop.db`（含預聚合 `stop_routes`，冪等，可重跑）。有網路才可跑。
- `npm run export-static` — 由 `bustop.db` 匯出唯讀 JSON 到 `public/data/`（`stops.json`、`routes_full.json`）。需先 build-db。
- `npm start` — 本機 server `localhost:8080`（提供 `public/` + `/api/eta/:id` 代理）。
- `npm run dev:pages` — `wrangler pages dev public` 本機預覽 Pages + Functions。
- 部署：`npx wrangler pages deploy public --project-name=bustop`（見 `wrangler.toml`）。
- **無測試框架 / 無 linter**。驗證靠 `npm run build-db && npm run export-static` 成功 + 手動開頁。

## Architecture
- `scripts/build-db.js` — 下載（帶重試）、建 schema、插入、預聚合「每站途經路線」`stop_routes`。
- `scripts/export-static.js` — DB → 靜態 JSON（前端搜尋/站序直接讀取，相對路徑）。
- `server.js` — 本機開發 server：靜態托管 `public/` + ETA 代理 `/api/eta/:id`。
- `functions/api/eta/[id].js` — Cloudflare Pages Function，唯一需要 Function 的地方；代理 data.gov.hk `/stop-eta/:id`（解決 CORS）。
- `public/*.html` — 三頁：`index.html`（我的路線，localStorage `bustop.myRoutes.v1`）、`search.html`、`eta.html`；共用 Alpine.js 單一 component 模式，`x-data` + 內聯 `<script>`。
- `public/app.js` — 三頁共用前端工具：`fetchJson`（帶重試）、`formatTime`、`saveSelection`/`restoreSelection`（以 `Object.assign({...}, bustop)` 併入各頁 component）。
- DB schema（在 `scripts/build-db.js` 內建立）：`stops`、`routes`、`route_stops`、`stop_routes`。

## Conventions
- **前端**：Tailwind + Alpine.js + Phosphor Icons 全走 CDN；單頁一個 Alpine component 函數（`x-data`），頁尾內聯 `<script>`（共用工具放 `public/app.js`，以 `Object.assign` 併入）；相對路徑讀 `/api` 與 `data/*.json`。
- **後端/腳本**：`'use strict'` CommonJS；工業強健重試模式（`fetchJson`/`fetchEta`，帶 attempt 次數 + 遞增 backoff）；`node:sqlite` `DatabaseSync`。ETA 代理用 `AbortController` 逾時，AbortError/ECONNRESET 皆視為可重試。
- **資料鍵**：車站主鍵 `stop`（STOP ID）；路線複合鍵 `(route, bound, service_type)`；`route|bound` 串接作站序鍵。
- 註解/使用者可見文字以**繁體中文**撰寫；錯誤訊息中英混用可接受。
- 產物（`bustop.db`、`data/`、`public/data/`、`node_modules/`、`.reasonix/`、`.wrangler/`）皆 gitignore，勿提交。

## Notes
（留白，供日後補充。）
