# 巴士站 STOP ID 查詢工具

一個簡單的單頁網頁應用，輸入巴士站名稱即可查詢對應的 **STOP ID**。

- **範疇**：九巴 (KMB) 巴士站
- **資料來源**：[data.gov.hk](https://data.gov.hk/) 的 eTA 巴士開放資料
  - API：`https://data.etabus.gov.hk/v1/transport/kmb/stop`
- **技術**：Tailwind CSS + Alpine.js（皆透過 CDN 載入，無需建置步驟）

## 功能

- 載入全部九巴巴士站資料（約 4,000+ 個）
- 以站名關鍵字即時搜尋（支援**繁體 / 簡體 / 英文**）
- 顯示 STOP ID、英/繁/簡名稱與座標
- 一鍵複製 STOP ID
- 一鍵在地圖（Google Maps）查看該站位置

## 使用方法

直接用瀏覽器開啟 `index.html` 即可，無需伺服器或建置。

## 實時到站查詢（`eta.html`）

輸入 **STOP ID**（可從 `index.html` 搜尋取得），即可查詢該站所有途經路線的實時到站時間。

- API：`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/{STOP_ID}`
- 返回：每條途經路線的下一班 / 未來數班的預計到站時間（顯示「X 分鐘」與時間）、行車方向（出程／回程）、目的地及備註（如「原定班次」）
- 只顯示九巴 (KMB) 班次；頁面會同時載入站名資料，將 STOP ID 對應到站名（載入失敗不影響查詢）
- 在 `index.html` 與 `eta.html` 之間可互相跳轉

## 注意

- 頁面需要網絡連線以下載巴士站資料；資料並非存在本地。
- 目前僅涵蓋**九巴 (KMB)** 的巴士站。如需要城巴/新巴或港鐵接駁巴士的 STOP ID，需要另外加入相應 API。
