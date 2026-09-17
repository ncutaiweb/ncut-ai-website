# Codex 本地 CMS 維護規則

這份文件給未來接手本專案的 Codex 使用。當使用者要求維護系網內容、最新消息、教師資料、素材或 GitHub Pages 部署時，必須先閱讀本文件，再開始修改。

## 專案目標

本專案採用「本地 CMS + GitHub Pages 靜態前台」架構。

- 本地 CMS 只在系上控管網頁的電腦執行。
- GitHub Pages 只部署靜態前台，不執行 Python 後端。
- 前台資料主要來自 `data/site.json` 與 `data/official-pages.json`。
- 後台程式可以保留在 GitHub repo 中，但不會被部署到 Pages。

## 重要檔案

- `server.py`：本地 CMS 後端，只應綁定 `127.0.0.1`。
- `admin/index.html`：本地 CMS 管理介面。
- `admin/admin.js`：本地 CMS 前端邏輯。
- `admin/admin.css`：本地 CMS 樣式。
- `data/site.json`：主要網站內容資料。
- `data/official-pages.json`：舊站匯入或官方頁面資料。
- `assets/`：前台使用的圖片、影片、圖示。
- `assets/uploads/`：本地 CMS 上傳素材的建議位置。
- `scripts/build-pages.mjs`：產生 GitHub Pages 靜態部署包。
- `.github/workflows/pages.yml`：GitHub Pages 部署 workflow。
- `LOCAL_CMS_SECURITY.md`：本地 CMS 與 Windows / Microsoft 防護說明。
- `DEPLOY_GITHUB_PAGES.md`：GitHub Pages 部署說明。

## 不可破壞的架構規則

- 不要讓 GitHub Pages 依賴 `server.py`、`/api/*`、資料庫或任何後端服務。
- 不要把 `admin/`、`server.py`、`tools/`、`data/backups/` 加進 `dist/` 部署產物。
- 不要把本地 CMS 綁定到 `0.0.0.0`，除非使用者明確要求且了解區網暴露風險。
- 不要把密碼、token、GitHub PAT、API key 寫入 repo。
- 不要移除 `data/backups/` 與 `dist/` 的 `.gitignore` 規則。
- 不要直接修改 GitHub Pages 的部署方式，除非使用者明確要求。
- 不要把測試版改成正式系網名稱，除非使用者明確要求正式發布。

## 本地 CMS 啟動規則

建議啟動方式：

```powershell
cd D:\web\ncut-ai-website
$env:NCUT_ADMIN_PASSWORD="請使用者自行設定強密碼"
.\scripts\start-local-cms.ps1
```

本地 CMS 網址：

```text
http://127.0.0.1:8080/admin/
```

前台預覽網址：

```text
http://127.0.0.1:8080/
```

如果需要用測試連接埠，使用：

```powershell
$env:PORT="8092"
$env:HOST="127.0.0.1"
python server.py
```

測試完成後要關閉伺服器，不要留下不必要的背景程序。

## 修改最新消息規則

最新消息位於 `data/site.json` 的 `news` 陣列。

新增消息時應包含：

- `date`：格式必須是 `YYYY-MM-DD`
- `category`：例如 `系所公告`、`招生資訊`、`活動訊息`
- `title`：公告標題
- `summary`：簡短摘要
- `href`：連結，可為空字串、站內相對路徑或外部 URL
- `image`：圖片路徑，可為空字串或 `./assets/...`

建議把最新消息放在 `news` 陣列最前面。

修改後必須驗證：

```powershell
node -e "JSON.parse(require('fs').readFileSync('data/site.json','utf8'))"
node scripts\build-pages.mjs
```

## 修改教師資訊規則

會隨資料變動的人數或統計，請使用共用引用，不要改回固定數字。詳見 `DATA_REFERENCES.md`，例如 `{{stats.faculty.fullTime}}` 與 `{{stats.faculty.rankSummary}}`。來源 JSON 應保留引用；前台、後台與建置共用 `site-references.js`。新增兼任教師需設定 `employmentType: "partTime"`；未填類別沿用既有專任設定。修改引用規則後執行 `node tests/site-references.test.cjs`。

教師資料位於 `data/site.json` 的 `faculty` 陣列。

常用欄位：

- `name`
- `enName`
- `role`
- `email`
- `phone`
- `photo`
- `education`
- `expertise`
- `office`
- `lab`
- `detailHref`

修改教師排序時，必須注意 `detailHref` 是否仍對應正確，例如：

```text
./faculty-detail.html?id=0
./faculty-detail.html?id=1
```

如果重新排序 `faculty`，應同步重算每位教師的 `detailHref`，避免教師詳細頁指到錯的人。

## 修改行政人員規則

行政人員資料位於 `data/site.json` 的 `staff` 陣列。

常用欄位：

- `name`
- `role`
- `email`
- `phone`
- `duties`

`duties` 必須是字串陣列，不要寫成單一長字串。

## 修改首頁輪播規則

首頁輪播位於 `data/site.json` 的 `hero` 陣列。

常用欄位：

- `kicker`
- `title`
- `text`
- `image`
- `position`
- `video`
- `primary.label`
- `primary.href`
- `secondary.label`
- `secondary.href`

圖片與影片建議使用相對路徑：

```text
./assets/optimized/example.webp
./assets/videos/example.mp4
./assets/uploads/example.jpg
```

不要使用本機磁碟路徑，例如 `D:\...`。

## 修改內容頁規則

內容頁位於 `data/site.json` 的 `pages` 陣列。

常用欄位：

- `slug`
- `group`
- `title`
- `summary`
- `image`
- `sections`
- `links`

`slug` 會用於：

```text
page.html?slug=example
```

新增頁面時，`slug` 必須使用英文、數字與連字號，不要使用中文、空白或特殊符號。

## 修改學生資源規則

學生資源位於 `data/site.json` 的 `studentResources` 陣列。

常用欄位：

- `title`
- `category`
- `summary`
- `href`
- `children`

如果 `children` 存在，必須是陣列。

## 素材管理規則

新增圖片、影片或 PDF 時，優先放在：

```text
assets/uploads/
```

允許類型：

- PNG
- JPG / JPEG
- WebP
- GIF
- MP4
- PDF

不要透過後台上傳 SVG。SVG 若需要新增，必須由開發者檢查內容後手動加入。

所有前台引用素材都應使用相對路徑：

```text
./assets/uploads/file-name.jpg
```

不要使用：

```text
D:\web\ncut-ai-website\assets\...
file:///D:/...
```

## 測試版與正式版規則

目前如果仍是測試部署，可以使用：

```json
"identity": {
  "title": "系網測試版",
  "subtitle": "Website Preview - Testing Only",
  "searchIndexing": true
}
```

正式發布前，使用者明確確認後，才可改回正式名稱。

正式發布時應檢查：

- `data/site.json` 的 `identity.title`
- `identity.subtitle`
- `identity.copyright`
- `identity.searchIndexing`
- `identity.isOfficialSite`
- `manifest.webmanifest`
- `robots.txt`
- `sitemap.xml`
- `script.js` 中 SEO fallback 文字

如果使用 GitHub Pages 預設網址：

```text
https://ncutaiweb.github.io/ncut-ai-website/
```

`sitemap.xml` 與 `robots.txt` 應使用該網址。

如果未來改為正式網域：

```text
https://ai.ncut.edu.tw/
```

必須同步更新 `sitemap.xml`、`robots.txt` 與 GitHub Pages custom domain 設定。

## 修改後必跑檢查

每次修改程式或資料後，至少執行：

```powershell
python -m py_compile server.py
node --check script.js
node --check admin\admin.js
node scripts\build-pages.mjs
node -e "for (const f of ['data/site.json','manifest.webmanifest','dist/data/site.json','dist/manifest.webmanifest']) JSON.parse(require('fs').readFileSync(f,'utf8').replace(/^\uFEFF/,'')); console.log('JSON OK')"
git diff --check
```

如果只修改 `data/site.json`，仍然要跑：

```powershell
node scripts\build-pages.mjs
```

## Git 規則

提交前先看狀態：

```powershell
git status --short --branch
```

提交內容應該聚焦，不要把無關檔案一起 commit。

不要 commit：

- `dist/`
- `data/backups/`
- `__pycache__/`
- `tmp-*`
- 本機測試截圖
- 憑證、密碼、token

一般內容更新 commit 訊息範例：

```text
Update department news
Update faculty profile
Add homepage announcement
Refresh site assets
```

推送：

```powershell
git push origin main
```

推送後 GitHub Actions 會重新部署 GitHub Pages。

## Codex 操作原則

當使用者要求「新增消息」時：

1. 讀取本文件。
2. 讀取 `data/site.json`。
3. 找到 `news` 陣列。
4. 新增或修改指定消息。
5. 驗證 JSON 與 build。
6. 回報改了哪些欄位。
7. 只有在使用者要求時才 commit / push。

當使用者要求「修改老師資訊」時：

1. 讀取本文件。
2. 讀取 `data/site.json`。
3. 找到 `faculty` 陣列。
4. 精準修改指定教師。
5. 如果排序有變，檢查 `detailHref`。
6. 驗證 JSON 與 build。
7. 回報改了哪些欄位。
8. 只有在使用者要求時才 commit / push。

當使用者要求「正式發布」時：

1. 確認是否要從測試版改成正式系網名稱。
2. 檢查 SEO、manifest、robots、sitemap。
3. 執行 build。
4. commit。
5. push。
6. 檢查 GitHub Pages 網址是否回 `200 OK`。

## 安全提醒

私人 GitHub repo 可以降低原始碼外洩風險，但不代表不需要防護。

必須保留：

- 本地 CMS 只綁定 `127.0.0.1`
- 強密碼
- Windows Security
- Microsoft Defender Antivirus
- Windows Defender Firewall
- 不提交機密資料

如果使用者要求將 CMS 開放到區網或公開網路，必須先提醒風險，並建議改用正式後端平台、HTTPS、帳號權限、日誌與備份策略。
