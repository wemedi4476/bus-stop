# 巴士站 STOP ID 查詢工具 + 實時到站

兩頁靜態前端（Tailwind CSS + Alpine.js）+ 一個本機 **Node + SQLite** 服務端。

- 資料來源：[data.gov.hk](https://data.gov.hk/) 的 eTA 開放資料（九巴 KMB）
- 目標：把全量 `route-stop`（約 3MB）在**服務端**預先下載、預處理進 SQLite，前端只做輕量查詢，避免每次在瀏覽器下載大資料以加快速度。
- 技術：Node 22（內置 `node:sqlite`，**零 npm 依賴**）+ Tailwind + Alpine.js（CDN）

## 架構 / 流程

```
data.gov.hk eTA API（/stop /route /route-stop）
        │  ① 下載 job：scripts/build-db.js
        ▼
      data/raw/*.json（原始下載，可重續）
        │  ② 預處理 → SQLite
        ▼
      bustop.db（stops / routes / route_stops / stop_routes 預聚合）
        │  ③ API
        ▼
      server.js（http://localhost:8080）
        │
        ├── index.html（站名搜尋 → STOP ID + 途經路線）
        └── eta.html（STOP ID → 實時到站）
```

## 快速開始

```bash
npm run build-db          # ① ② 下載並預處理進 SQLite（bustop.db）
npm start                 # ③ 啟動 API server（預設埠 8080，可用 PORT 覆寫）
# 開啟瀏覽器 → http://localhost:8080
```
> 重跑 `npm run build-db` 會重新下載並重建資料庫（冪等）；`data/raw/` 已存在的檔案會略過下載，可斷點續跑。

## 前端頁面

- **`index.html`** — 以站名搜尋（繁/簡/英）取得 `STOP ID`，並顯示每個站的**所有途經路線及「往」方向**。搜尋改由服務端 SQL 完成（`/api/search`），點結果時再個別取途經路線（`/api/stop/:id`），首屏不再全量下載。
- **`eta.html`** — 輸入 `STOP ID` 查詢所有途經路線的**實時到站時間**（路線、方向、目的地、未來數班的「X 分鐘」與時間、備註）。實時資料由 server 代理 data.gov.hk（`/api/eta/:id`），避免瀏覽器 CORS。
- 兩頁頂部可互相跳轉。

> 需經 server 提供（`http://localhost:8080`），**不能**用 `file://` 直接開啟（前端會呼叫本機 `/api`）。

## API

| 方法 / 路徑 | 說明 |
|---|---|
| `GET /api/search?q=關鍵字` | 站名搜尋（繁/簡/英），每站含 `route_count`，上限 100 |
| `GET /api/stop/:id` | 該站詳情 + 所有途經路線（`route`/`bound`/`dest_tc`/`dest_en`） |
| `GET /api/eta/:id` | 代理 data.gov.hk `/stop-eta/:id` 的實時到站 |
| `GET /api/stats` | 整體統計（站數、路線數、路線-站配對數、平均路線數/站） |
| `GET /`、`GET /eta.html` | 靜態前端頁面 |

## SQLite 表

| 表 | 內容 |
|---|---|
| `stops` | `stop`(PK)、`name_tc/sc/en`、`lat`、`lng` |
| `routes` | `route`+`bound`+`service_type`(PK)、`orig_tc`、`dest_tc/sc/en` |
| `route_stops` | `route`+`bound`+`service_type`+`seq`→`stop`（原始對應） |
| `stop_routes` | **預聚合**：每站途經路線（按 `route|bound` 去重），含目的地 |

目前建庫統計：6741 個站、1600 條路線方向、30869 條「站-路線」配對，平均每站 4.6 條路線。

## 注意

- 目前僅涵蓋**九巴 (KMB)** 巴士站；城巴/新巴或港鐵接駁巴士需另接 API。
- data.gov.hk 的 eTA 即時 API（`/stop-eta`）偶發連線不穩，服務端會自動重試。靜態資料（`/stop /route /route-stop`）約每天更新，重建資料庫即可取得最新資料。
- `bustop.db` 與 `data/` 由 .gitignore 排除，不入版。
