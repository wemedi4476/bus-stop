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

## 注意

- 頁面需要網絡連線以下載巴士站資料；資料並非存在本地。
- 目前僅涵蓋**九巴 (KMB)** 的巴士站。如需要城巴/新巴或港鐵接駁巴士的 STOP ID，需要另外加入相應 API。
