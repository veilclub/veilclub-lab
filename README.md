# VEIL LAB

VEIL 帳號下的獨立靜態網站企劃庫，與正式網站 `veilclub.github.io` 完全分離。

## 專案

- [貓尾草 CATTAIL](./sites/cattail/) — FFXIV 貓咪互動主題店；無指名服務

## 原則

- HTML / CSS / 原生 JavaScript；不使用 Supabase 或其他資料庫。
- 每個網站放在 `sites/<project>/`，互不干擾。
- 根目錄 `index.html` 為企劃選單。
- 發布 GitHub Pages 需到 Settings → Pages 選 Deploy from a branch、main、/(root)。

## 貓尾草後續資料

待補貓咪名稱、照片、性格標籤、特殊服務內容、Discord 邀請連結、正式 Logo。名簿篩選功能已做好，資料陣列目前保留空白，避免自行捏造角色。

GitHub Pages 啟用後，測試入口預計是：
- https://veilclub.github.io/veilclub-lab/
- https://veilclub.github.io/veilclub-lab/sites/cattail/
