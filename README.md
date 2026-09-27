# Mini PLM 產品巡禮

Mini PLM 的功能宣傳頁：<https://kevintsai1202.github.io/mini-plm-promo/>

## 內容

- 首頁 3D 動畫：用三章說明為什麼需要一套 PLM、資料怎麼收進同一套系統、各模組怎麼互相接手
- 一張範例變更單的旅程：往下捲時，系統地圖標出它經過的九個模組與模組之間的自動串接
- 實機畫面環與平台架構的爆炸視圖
- 配樂與音效由瀏覽器即時合成（Web Audio），按「播放動畫（含配樂）」或右上角的聲音鍵才會出聲

畫面擷取自開發環境，資料為測試與壓測資料。

## 檔案來源

網站檔案由私有 repo `mini-plm` 的 `docs/promo/` 產生，以下檔案**不要直接在這裡修改**，下次同步會被覆蓋：

- `index.html`、`promo.css`、`promo.js`、`sound.js`、`assets/`

本 repo 自己維護的檔案：`README.md`、`favicon.svg`、`og.jpg`（社群分享預覽圖）、`.nojekyll`、`scripts/`。

## 更新網站（PowerShell 7）

先在 `mini-plm` 修改 `docs/promo/`，再執行：

```powershell
# 只重新產生網站檔案
pwsh scripts/sync-from-mini-plm.ps1

# 產生後 commit 並 push，GitHub Pages 約一分鐘內更新
pwsh scripts/sync-from-mini-plm.ps1 -Push -Message "更新宣傳頁"
```

`-Source` 可指定 `docs/promo` 的位置（預設 `D:\GitHub\Mini-PLM\docs\promo`）；push 時用 `-GitHubUser` 指定的 gh 帳號（預設 `kevintsai1202`），不會切換 gh 的預設帳號。

## 使用的函式庫

- [three.js](https://threejs.org/) r128
- [GSAP](https://gsap.com/) 3.12.5 與 ScrollTrigger

兩者都從 cdnjs 載入並附 SRI 雜湊。
