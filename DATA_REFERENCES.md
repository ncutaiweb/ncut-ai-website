# 共用資料引用

`data/site.json` 是網站內容來源。不要在首頁統計或系所介紹重複寫死會變動的人數。

文字中可使用 `{{stats.faculty.fullTime}}` 等引用。前台每次載入資料後才計算引用，因此來源 JSON 及部署產物保留引用，後台儲存也不會把引用改寫成當下的數字。

## 常用引用

| 引用 | 來源 |
| --- | --- |
| `{{stats.faculty.total}}` | 師資名單總筆數 |
| `{{stats.faculty.fullTime}}` | 專任教師筆數 |
| `{{stats.faculty.professor}}` | 專任教授筆數 |
| `{{stats.faculty.associateProfessor}}` | 專任副教授筆數 |
| `{{stats.faculty.assistantProfessor}}` | 專任助理教授筆數 |
| `{{stats.faculty.rankSummary}}` | 專任師資職級統計句子，含講師及未分類職稱 |
| `{{stats.staff.total}}` | 行政人員筆數 |
| `{{stats.labProfiles.total}}` | 實驗室資料筆數 |
| `{{stats.homeFeatures.total}}` | 教學特色資料筆數 |
| `{{stats.homeFeatures.titles}}` | 教學特色標題清單；首頁 AI 領域名稱及發展方向引用此值 |
| `{{identity.title}}` | 系所名稱 |
| `{{contact.phone}}` | 系辦電話 |

其他可計數清單：news、careerPaths、curriculumModules、studentResources、specialPrograms、campusLinks、awardSlides，格式為 `{{stats.清單名稱.total}}`，皆計算該清單的直接筆數，不是去重後人數或歷年成果總數。

## 後台操作

1. 在統計值或段落文字中輸入引用，例如「本系現有專任教師 {{stats.faculty.fullTime}} 位」。
2. 修改教師名單、職稱、聘任類別時，欄位下方的引用預覽立即重算。
3. 聘任類別為專任的教師納入專任統計。既有未填類別的資料沿用專任；新增兼任教師請改選「兼任」。
4. 職級以職稱中的「助理教授」「副教授」「教授」「講師」依序判別，兼任主管不影響職級。無法判別者列入其他職稱教師，避免消失於總數。
5. 儲存後重新整理本機前台即可更新。已開啟的頁面不會背景輪詢；GitHub Pages 必須完成 commit / push / 部署後，再重新整理才會更新。

後台與建置都會檢查找不到的引用及循環引用。不要將引用改回預覽顯示的數字，否則會失去自動更新能力。

## 自訂共用值

進階 JSON 可以新增 `facts` 物件，例如 `"facts": { "officeHours": "週一至週五 08:00–17:00" }`，再於多段文字引用 `{{facts.officeHours}}`。facts、identity、contact 的直接字串、數字、布林欄位可被引用，不支援任意程式或表達式。

日期、學年度、歷史得獎名次、學分門檻、房號及圖片內文字不是自動統計。歷史公告及 rpage-skin 獨立版型也不會被擅自轉成現況數字；圖片中文字仍須更新圖片。

## 維護與驗證

共用解析器為 `site-references.js`，前台、CMS、建置共用同一套規則。新增前台頁面時，在 `script.js` 前載入該檔案。

執行 `node --test tests/site-references.test.cjs` 與 `node scripts/build-pages.mjs`。
