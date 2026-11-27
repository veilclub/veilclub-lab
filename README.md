# VEIL LAB

獨立的靜態網站企劃庫。此儲存庫與 VEIL 正式網站 `veilclub.github.io` 分離；貓尾草自有美術和資料，不共用 VEIL 素材。

## 貓尾草 CATTAIL

- [網站首頁及貓咪名簿](./sites/cattail/index.html)
- [貓咪點餐冊](./sites/cattail/order.html)
- [共用貓咪資料](./sites/cattail/assets/cattail-data.js)
- [點餐冊互動程式](./sites/cattail/assets/cattail-order.js)
- [點餐冊樣式](./sites/cattail/assets/cattail-order.css)
- [獨立成員介紹頁](./sites/cattail/members.html)

名簿沿用紙本翻頁與分類書籤，現有 15 位成員；點餐冊則使用獨立的卡片滑動、抽卡、貓爪印章和點餐紙介面。

### 消費清單與限制

- 一般消費 6 項；貓咪限定服務依共用成員資料的 `specialService` 欄位顯示。
- 消費清單只存在當前瀏覽器頁面，支援調整數量、計算選購小計及複製文字。
- 入場費 50,000 Gil（含當日套餐）另計，特殊加購以櫃台確認為準。
- 不收款、不自動送出訂單、不涉及 Supabase；此階段僅提供互動展示和消費清單。
- 名簿、成員介紹及點餐冊直接引用 `assets/members/` 的 15 張英文檔名 WebP；不使用舊內嵌肖像。

## 貓尾草美術隔離

- 暖棕、奶油白、鼠尾草綠、蜂蜜棕、柔粉；手作繪本、自然紙材及柔和暖光。
- 四角材質使用 `sites/cattail/assets/corners/` 的生成圖層；CSS 僅負責定位、尺寸及互動。
- 不混用水晶庭、VEIL 或其他品牌的美術、資料與素材。
- 跑輪目前使用 `assets/cats/tabby-legacy/atlas.webp`；名稱雖有 legacy，仍是現行運行素材，勿刪除。

## 專案原則

- HTML / CSS / 原生 JavaScript，無需打包。
- 每個網站放在 `sites/<project>/`，互不干擾。
- 根目錄 `index.html` 為企劃選單。
- GitHub Pages 部署來源：main 分支、/(root)。

預期測試網址：
- https://veilclub.github.io/veilclub-lab/
- https://veilclub.github.io/veilclub-lab/sites/cattail/
- https://veilclub.github.io/veilclub-lab/sites/cattail/order.html
