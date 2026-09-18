# 需求文件 requirement.md — 巴士站查詢與實時到站系統（Cloudflare 托管）

> 文件版本：1.2
> 反映目前實作（Option C：靜態資料無資料庫，Cloudflare Pages 托管）

---

## 1. 專案概述

一套**九巴 (KMB) 巴士站與實時到站查詢系統**，多頁靜態前端 +（雲端）靜態資料托管。

- **資料來源**：[data.gov.hk](https://data.gov.hk/) 的 eTA 開放資料（九巴 KMB）
- **資料形式**：唯讀**靜態 JSON**，預先由本機建庫流程匯出，由 Cloudflare Pages/R2 CDN 服務（**不建雲端資料庫**）。
- **實時 ETA**：由一個 Cloudflare Pages Function 代理 data.gov.hk（瀏覽器有 CORS 限制）。
- **前端**：Tailwind CSS + Alpine.js（CDN）
- **主要頁面**：主頁「我的路線」、巴士站查詢、實時到站

---

## 2. 名詞定義

| 詞彙 | 定義 |
|---|---|
| 車站 (Stop / STOP ID) | 獨一無二的站點識別碼 |
| 路線 (Route) | 巴士路線編號 |
| 方向 (Bound / Dir) | `O`（出程）/ `I`（回程） |
| 途經路線 | 某車站所有會停靠的路線 |
| 我的路線 | 使用者選擇收藏的路線清單（localStorage 持久化） |
| 實時到站 (ETA) | 來自 data.gov.hk 的即時預計到站時間 |

---

## 3. 整體架構（Option C：靜態資料無資料庫）

```
data.gov.hk eTA API（/stop /route /route-stop /stop-eta）
        │  ① scripts/build-db.js（下載 → 本機 SQLite bustop.db，含預聚合）
        ▼
      bustop.db（唯讀，僅建庫用）
        │  ② scripts/export-static.js（匯出唯讀靜態 JSON）
        ▼
      public/data/stops.json         （全部車站 + 每站途經路線）
      public/data/routes_full.json   （route|bound → 完整站序）
        │  ③ 托管 / 部署
        ▼
      Cloudflare Pages
        ├── index.html    主頁「我的路線」
        ├── search.html   巴士站查詢
        ├── eta.html      實時到站
        └── /api/eta/:id  僅需此一 Function（代理 data.gov.hk）
```

前端以**相對路徑**讀 `data/*.json` 與 `/api/eta/:id`，本機（`node server.js`）與 Cloudflare 皆可跑。

**為何不用雲端資料庫**：全量資料為唯讀且僅 ~4.5MB（raw），匯出成靜態 JSON 用 CDN 提供最簡單、零 DB 成本與查詢限制。

---

## 4. 功能需求

### 4.1 雲端後端（Cloudflare Pages Function）

| 路徑 | 需求 |
|---|---|
| `GET /api/eta/:id` | 代理 data.gov.hk `/stop-eta/:id` 的實時到站（避免瀏覽器 CORS），自動重試、失敗回 502 |

> 其餘資料查詢（搜尋、站詳情、路線站序）皆由前端直接讀靜態 JSON，無需雲端 API/DB。

### 4.2 主頁「我的路線」（index.html）

1. **主頁即我的路線**：進入 `/` 即顯示收藏的所有路線。
2. **實時到站**：每條顯示**接下來 3 班**的預計到站，含距離（X 分鐘／即將到站／已開出）、時刻（HH:MM）、車號、方向、站名。
3. **操作**：✕ 移除、↻ 重新整理、顯示資料時間。
4. **空狀態**：無收藏時顯示引導並提供「前往巴士站查詢」。
5. **資料取得**：收藏存於 localStorage；EAT 即時資料以 STOP ID 走 `/api/eta/:id`。

### 4.3 巴士站查詢（search.html）

1. **站名搜尋**：前端直接由 `data/stops.json` 依繁/簡/英站名模糊比對（大小寫不敏感、包含比對）。
2. **顯示途經路線**：每站顯示所有途經路線及「往」的方向（路由資料內嵌於 stops.json）。
3. **路線完整站序 popup**：點路線顯示完整站序（資料延遲載入 `data/routes_full.json`，多 service_type 分組，以站數最多為主要走線）。
4. **收藏路線**：popup 內「＋ 加入我的路線／★ 已加入」，寫入 localStorage 與主頁共享。
5. **提示列**：顯示已收藏數量並指引到主頁。

### 4.4 實時到站（eta.html）

1. 輸入 STOP ID → 顯示站名（自 `data/stops.json` 查）與該站所有途經路線的實時到站。
2. 顯示路線、方向、目的地、未來數班「X 分鐘」與時間、備註、資料時間。
3. 空狀態與錯誤提示。

---

## 5. 跨頁面共享 —— 「我的路線」收藏機制

- **儲存**：瀏覽器 `localStorage`（key `bustop.myRoutes.v1`），存靜態欄位（key、STOP ID、站名、車號、方向、目的地），**不存**過期 ETA。
- **寫入**：查詢頁「加入／移除」時寫入。
- **讀取**：主頁載入時讀回並重新查詢 ETA；查詢頁載入時讀回以便 chip 顯示「★」。
- 重新整理或跨頁面後收藏不消失。

---

## 6. 靜態資料產物（取代資料庫）

| 檔案 | 內容 | 用途 |
|---|---|---|
| `public/data/stops.json` | 全部車站（id/繁/簡/英/經緯度）+ 每站途經路線（含目的地） | 搜尋 + 站詳情 |
| `public/data/routes_full.json` | `route|bound` → 站序（service_type + 依 seq 排序，含站名） | 路線 popup |

> 產生指令：`npm run build-db`（建本機 SQLite）→ `npm run export-static`（匯出 JSON）。
> 目前規模：6741 站、30869「站-路線」配對、1312 個 route|bound 站序。

---

## 7. 非功能需求

- **效能**：靜態 JSON 由 CDN 服務；搜尋在前端對 6.7k 站做包含比對，已足夠快速。
- **可重續下載**：`build-db` 對 `data/raw/` 已存在檔案略過，可斷點續跑。
- **容錯**：ETA 代理（Function）與本機 server 皆含重試。
- **跨來源**：后端回應含 `Access-Control-Allow-Origin: *`。
- **成本**：Cloudflare Pages 免費額度即可；本方案**不需 D1/R2 付費**。

---

## 8. 部署

```bash
npm run build-db && npm run export-static
npx wrangler pages dev public                         # 本機預覽 Pages + Functions
npx wrangler pages deploy public --project-name=bustop # 上線
```

設定：`wrangler.toml`（`pages_build_output_dir = "public"`）。

---

## 9. 限制與注意事項

- 僅涵蓋**九巴 (KMB)**；城巴/新巴或港鐵接駁需另接 API。
- data.gov.hk 即時 API 偶發不穩，代理有重試與錯誤回應。
- `bustop.db`、`data/`、`public/data/*.json` 為建置產物，`.gitignore` 排除（遠端以建置流程產生）。
- 收藏存於瀏覽器各網域（origin），由本機移至雲端網域後既有收藏不會自動帶過去。

---

## 10. 快速開始（本機）

```bash
npm run build-db       # ① 下載並建本機 SQLite
npm run export-static  # ② 匯出靜態 JSON 到 public/data
npm start              # ③ 本機 server（埠 8080）

瀏覽器開啟 http://localhost:8080
```
