# MarkEdit → Typlog

[简体中文](README.md) · 繁體中文 · [English](README.en.md)

從 MarkEdit 目前文件讀取內文與圖片，上傳圖片、建立或更新 Typlog 草稿、設定作者並開啟後台編輯頁面。不需要 Textpack，也不依賴其他 MarkEdit 擴充功能。原文與本機圖片保持不變。

介面支援簡體中文、繁體中文與英文，依 macOS 偏好語言清單選擇支援的語言；沒有符合的語言時使用英文。修改系統語言後請重新啟動 MarkEdit。選單、設定、推送、進度與應用程式錯誤提示會切換語言；文章、標籤、網站名稱與作者名稱保持原樣。

## 安裝與首次設定

1. 在 Finder 複製 `dist/markedit-typlog.js`，再從 MarkEdit 的 **Extensions → Open Documents Folder** 開啟設定目錄，進入 `scripts` 並貼上；若無此資料夾，請先建立。目標路徑為 `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`。亦可執行 `Install.command`；若 macOS 阻止終端機存取應用程式資料，請使用 Finder。
2. 重新啟動 MarkEdit。
3. 選擇 **Extensions／擴充功能 → Typlog → 修改發佈設定…**。
4. 登入 Typlog 後，在 [API 權杖頁面](https://typlog.com/account/tokens)，點選「+ 新權杖」，輸入名稱，權限勾選 `profile` 和 `site` 核取方塊，即可產生新 API 權杖，將其複製到設定視窗。自動讀取 username 需要 `profile` 權限。
5. 點選「讀取帳號與網站」。帳號 username、網站 ID 與 slug 自動取得；若只有一個可存取的啟用中網站，便自動選取，否則從清單選擇。網站與作者設定會保留；預設以明文儲存，亦可選擇密碼加密。讀取失敗時，介面會分別說明原因並保留可用的既有設定；亦可切換至「手動設定」填寫。
6. 選取網站後自動取得本站作者。只有一位作者時自動填入；多位作者可點選「選擇文章作者…」勾選。選取「不設作者」可保持留空，重新整理或重新啟動不會再自動填入。切換網站會重新讀取其作者。
7. 網站需在 **Settings → Integrations** 啟用 XML-RPC。
8. 選擇 **Typlog → 推送為草稿…**。快速鍵為 **Control–Option–Command–Shift–T**。

首次使用本機圖片時，從 MarkEdit 的 **File → Grant Folder Access** 授權寫作與圖片所在目錄。這是 MarkEdit 原生的資料夾授權流程；公開 API 無法代替使用者選擇授權目錄。

作者留空則不設定作者，亦可在推送後到後台新增；留空不會移除既有草稿的作者。選取一位或多位作者時，透過 REST API 設定 `primary_authors`。提示優先顯示姓名與 username。推送前核對本站作者 ID，錯誤 ID 會在上傳或建立草稿前提示；設定後再次讀取文章驗證結果。

設定儲存在 `~/Library/Containers/app.cyan.markedit/Data/Documents/typlog-publisher/config.json`。**v0.3.1 起預設以明文儲存 Token**，首次儲存或使用舊版明文設定時會提醒，確認一次後無需反覆提醒或解鎖。能讀取設定檔及其備份的人可能取得 Token，請勿分享設定檔。MarkEdit 目前公開 API 沒有鑰匙圈讀寫介面。

密碼加密為可選設定，明文儲存無需設定密碼。請使用為此擴充功能單獨設定的本機加密密碼，與 Typlog 帳號登入密碼無關；設定或更改它不會修改 Typlog 登入密碼。加密用於防止設定檔中的 Token 被直接讀取，使用時仍需在應用程式記憶體中解密。

如需加密，在設定的「Token 儲存」標籤頁勾選「使用獨立密碼加密本機 Token」，儲存時設定至少 12 個字元的本機加密密碼。密碼與金鑰不會寫入檔案；加密採用 Web Crypto AES-256-GCM 與 PBKDF2-SHA-256（600,000 次迭代、隨機鹽，每次儲存使用新 IV）。**每次退出 MarkEdit 後再次開啟，或開啟新文件視窗時，都需要輸入本機加密密碼**；同一視窗內無需每次推送都解鎖。

改回明文：開啟發布設定，在「Token 儲存」取消勾選加密並儲存，輸入目前本機加密密碼。明文提醒僅首次出現，確認後不再重複，即使之後切換加密或替換 Token。如果本次開啟設定時已輸入密碼，則不會重複詢問。取消或密碼錯誤不會修改原加密記錄。升級不會自動將既有加密 Token 改為明文。

替換 Token：在「Token 儲存」點選「替換 Token…」，填寫新 Token 後重新讀取帳號與網站並儲存。忘記密碼時，可在解鎖視窗選擇重新設定，直接填寫新 Token，或點選「刪除本機 Token…」。解鎖後亦可在「Token 儲存」刪除。刪除本機記錄不會撤銷 Typlog 上的 Token，既有草稿關聯保留；撤銷需在 Typlog 後台操作。

輸入欄位遮蔽 Token，擴充功能不記錄或回顯 Token；安裝程式限制設定目錄權限。網站與帳號資訊仍是一般文字。磁碟備份與歷史快照不會隨儲存方式切換或本機刪除而清除。可分享本專案的擴充腳本；請勿分享整個 MarkEdit 設定目錄。

設定視窗使用與 MarkEdit 設定風格一致的頂部圖示選項卡：自動設定、手動設定和 Token 儲存。視窗寬度保持一致，高度隨目前頁面內容平滑變化；內容切換時輕微淡入。設定欄位統一靠左對齊，標籤位於控制項上方，說明緊接對應控制項；帳號、網站與作者按關聯分組，網站 slug 與 Site ID 並排呈現。三個頁面共用同一條靠左對齊線。使用 14px 本文與 13px 說明，支援深色模式與英文換行。「使用說明」與底部操作固定顯示；視窗較小時僅中間設定區捲動。說明包含 XML-RPC、圖片目錄授權與 Token 儲存方式。推送確認視窗逐項列出文章資訊。其他對話框沿用同一套字級、表單格線與按鈕。支援窄視窗、鍵盤操作，以及系統的減少動態效果、減少透明度與增加對比度偏好。Typlog 選單與視窗使用依官方 T 字形重繪的單色線圖。

## 圖片

先儲存 Markdown 文件，再使用標準圖片引用，例如：

```markdown
# 文章標題

![圖說](images/photo.jpg "優先顯示的圖說")

![另一張圖片](<images/中文 檔名.png>)
```

- 自動讀取相對於文件目錄的圖片，亦支援絕對路徑、`file://`、`~/` 與參照式圖片連結。TextBundle 的 `assets/` 路徑以套件目錄解析。其他擴充功能貼上並儲存為本機檔案的圖片亦可讀取。
- 支援 JPEG、PNG、GIF、WebP。內嵌 base64 圖片會上傳；網路圖片網址保持原樣。
- 同一個本機檔案重複引用只上傳一次。程式碼區塊與行內程式碼中的圖片語法不會被當成圖片上傳。
- HTML `<img>` 的寬高屬性會保留並轉為樣式；亦相容舊捷徑在圖片 title 中附帶尺寸的寫法，例如 `![替代文字](images/photo.jpg "圖說\" width=\"320px\" height=\"auto")`。
- 獨立圖片產生置中的 `<figure>` 與 `<figcaption>`。圖說優先取 `title`，其次取 `alt`；兩者都沒有時不產生圖說。
- HTML 模式支援 `<img src="…">`；`srcset` 若含本機圖片，會提示改用單一 `src`，不會將本機路徑悄悄推送。
- 圖片讀取失敗時，在 **File → Grant Folder Access** 授權圖片目錄，然後重試。
- 原來 Textpack 的 `typlog-media://photo.jpg` 亦可讀取文件目錄下的 `photo.jpg`，不需重新封裝。

Markdown 轉換使用隨擴充功能封裝的 markdown-it，排版可能與 Apple 的 RTF 轉換器不同。表格、圖片尺寸、圖說與特殊 Markdown 內容應在 Typlog 後台預覽；數學、Mermaid 等額外渲染功能未包含。

## 標題、標籤與 HTML

每次推送前顯示可編輯的標題與標籤。標題預設值依序取：開頭中繼資料的非空 `title` → 內文第一個真正的 H1 → 留空手動填寫。支援 `# 標題` 與 Setext H1；程式碼中的標題會略過。作為標題使用的開頭 H1 不會重複送入內文，後面的 H1 保留。

相容原捷徑的中繼資料格式：

```markdown
:::typlog-shortcut
title: 文章標題
tag: 寫作
tag: 生活
format: markdown
:::

內文。
```

開頭只有 `:::` 的中繼資料區塊亦支援，區塊不會提交為內文。`format: html` 可直接提交 HTML。`tag:` 可重複，亦支援 `tags:`。**英文逗號 `,` 與中文逗號 `，` 均可分隔標籤，推送視窗的輸入欄位也一樣**；重複標籤會去除。空的 `tag:` 表示明確不需要標籤。

## 推送與恢復

點選「推送為草稿…」後，第一個視窗顯示標題、標籤與「完成後自動開啟文章編輯頁面」。核取方塊首次預設選取；點選「繼續」後記住本次選擇，即使後續請求失敗亦會保留。選取時完成後直接開啟後台，否則顯示完成提示。

隨後的確認視窗列出網站、標題、標籤、本機圖片數量與作者，並明確顯示本次是「建立草稿」或「更新已有草稿」。確認前只查詢作者、檢查草稿狀態與讀取本機圖片；確認後才上傳或修改文章。

v0.1.4 起以**網站 slug、網站 ID 與已儲存文件的完整路徑**建立關聯，記錄後台 Post ID；不只看檔名，也不以標題或內文判斷新舊。首次透過 `metaWeblog.newPost` 建立草稿；此後修改內文、標題、標籤或圖片再推送，會透過 `metaWeblog.editPost` 更新同一 Post。兩者均設定 `post_status=draft`、`publish=false`。相同圖片沿用上傳網址，圖片內容改變則重新上傳。本機內容與作者設定未變時，僅沿用原草稿，不覆寫後台的手動修改。

草稿 ID 與圖片進度儲存在本機 `document-*.json`，不含權杖。文章已發佈、刪除或無法確認草稿狀態時會停止，不自動建立替代文章。更新失敗會重試同一 ID；作者設定失敗亦保留已儲存的草稿。若建立結果不確定，須先檢查後台，再填入已有文章 ID 恢復，或明確確認未產生後重新建立。無法儲存本機紀錄時會停止建立草稿。

舊版 `push-*.json` 在目前內容能匹配時自動遷移。升級前若已修改內文，或文件改名、移動，可能無法自動匹配；可在第一個視窗展開「關聯已有草稿」，填入後台草稿 ID，之後持續更新同一草稿。另一個網站使用獨立關聯。

更新僅替換腳本，保留帳號設定與推送紀錄。若舊版 `Window.fetch` 錯誤觸發恢復提示，請先查看後台是否已有草稿；確認沒有時才選擇「已確認未產生，重新建立」。新版已修正原生 fetch 的 Window 接收者要求。

請勿在多個視窗同時推送同一文件。首次使用需透過自己的設定與測試文章驗證實際帳號權限。

## 開發與驗證

```sh
npm ci --ignore-scripts
npm test
npm run build
```

62 項自動化測試通過，包含三種語言的啟動、完整翻譯覆蓋、佔位符、錯誤分類與標籤分隔。測試使用模擬 Typlog 回應，不讀取真實權杖、不存取真實帳號、不發佈文章。

參考：[MarkEdit API](https://github.com/MarkEdit-app/MarkEdit-api)、[MarkEdit 自訂與目錄權限](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization)、[Typlog XML-RPC](https://docs.typlog.com/en/article/marsedit/)、[Typlog API](https://api.typlog.com/)、[Typlog 品牌圖像](https://typlog.com/brand)。

## 授權

專案程式碼採用 [MIT License](LICENSE)。打包依賴的授權見 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。Typlog 名稱與品牌標識仍受其各自權利約束，MIT 不授予商標權。
