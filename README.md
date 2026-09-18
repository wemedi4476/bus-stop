# 巴士站 STOP ID 查詢工具 + 實時到站（我的路線）

多頁靜態前端（Tailwind CSS + Alpine.js）。可跑在本機 Node 或以 **Cloudflare Pages** 托管（**Option C：靜態資料、無資料庫**）。

- 資料來源：[data.gov.hk](https://data.gov.hk/) 的 eTA 開放資料（九巴 KMB）
- 資料以**唯讀靜態 JSON** 預先算好，放到 Pages/R2 由 CDN 提供，**不需要資料庫**（無 D1、無需雲端 DB）。
- 實時 ETA 由一個 Pages Function 代理 data.gov.hk（瀏覽器有 CORS 限制）。
- 技術：Node 22（內置 `node:sqlite`，**零 npm 依賴**）+ Tailwind + Alpine.js（CDN），部署用 `wrangler`（Cloudflare）。

## 特色
- **🏠 主頁「我的路線」**：收藏的巴士路線 + 每條**接下來 3 班**實時到站（幾分鐘後到站）。
- **🚏 巴士站查詢**：站名搜尋（繁/簡/英）→ 點路線看**完整站序 popup** →「＋ 加入我的路線」。
- **🕒 實時到站**：輸入 STOP ID 查詢該站所有途經路線的實時到站。
- 收藏存於瀏覽器 `localStorage`（`bustop.myRoutes.v1`），跨頁面共享、重新整理不消失。

## 架構（Option C：靜態資料無資料庫）

```
data.gov.hk eTA API（/stop /route /route-stop /stop-eta）
        │  ① npm run build-db        （下載 → 本機 SQLite bustop.db，含預聚合）
        ▼
      bustop.db（唯讀，僅建庫用）
        │  ② npm run export-static    （匯出唯讀靜態 JSON）
        ▼
      public/data/stops.json         （全部車站 + 每站途經路線）
      public/data/routes_full.json   （route|bound → 完整站序）
        │  ③ 托管 / 部署
        ▼
      Cloudflare Pages（public/ 靜態資產 + Functions）
        ├── index.html    我的路線
        ├── search.html   巴士站查詢（前端直接讀靜態 JSON 搜尋/站序）
        ├── eta.html      實時到站
        └── /api/eta/:id  functions/api/eta/[id].js（代理 data.gov.hk，僅此需 Function）
```

> 前端以**相對路徑**讀 `data/*.json` 與 `/api/eta/:id`，本機與 Cloudflare 皆可跑。

## 快速開始（本機）

```bash
npm run build-db       # ① 下載並建本機 SQLite（bustop.db）
npm run export-static  # ② 產生 static JSON 到 public/data/
npm start              # ③ 本機 server（預設埠 8080）提供 public/ 與 ETA 代理
# 瀏覽器 → http://localhost:8080
```

## 部署到 Cloudflare Pages

```bash
npm run build-db && npm run export-static
npx wrangler pages dev public        # 本機預覽 Pages + Functions
npx wrangler pages deploy public --project-name=bustop   # 上線
```

設定檔：`wrangler.toml`（`pages_build_output_dir = "public"`）。

## 檔案結構

```
public/                 # Pages 靜態資產（亦為本機 server 的 static root）
  index.html            # 主頁「我的路線」
  search.html           # 巴士站查詢
  eta.html              # 實時到站
  data/stops.json       # 匯出：全部車站 + 每站途經路線
  data/routes_full.json # 匯出：每路線完整站序
functions/api/eta/[id].js  # Pages Function：代理 data.gov.hk 實時 ETA
scripts/build-db.js     # 下載 + 建本機 SQLite（預聚合）
scripts/export-static.js# 由 bustop.db 匯出靜態 JSON
server.js               # 本機開發 server（public/ 靜態 + ETA 代理）
wrangler.toml           # Cloudflare Pages 設定
bustop.db               # 本機建庫產物（gitignore）
```

## 目前資料規模
6741 個站、30869 條「站-路線」配對、1312 個 route|bound 站序。

## 注意

- 僅涵蓋**九巴 (KMB)**；城巴/新巴或港鐵接駁需另接 API。
- data.gov.hk 即時 API 偶發不穩，Function 與 server 皆有重試。
- `bustop.db`、`data/`、`public/data/*.json` 為產物，`.gitignore` 排除（遠端部署可用建置流程產生）。
- **費用/限制**：Cloudflare Pages 免費額度即可負荷；本方案不需 D1（D1 有 5M rows/day 讀取上限）。
