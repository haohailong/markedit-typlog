#!/bin/zsh
set -euo pipefail
packageDir="${0:A:h}"
documentsDir="$HOME/Library/Containers/app.cyan.markedit/Data/Documents"
scriptsDir="$documentsDir/scripts"
configDir="$documentsDir/typlog-publisher"
extensionFile="$scriptsDir/markedit-typlog.js"
installerPreference=$(/usr/bin/defaults read -g AppleLanguages 2>/dev/null | /usr/bin/sed -n '2p' || true)
case "$installerPreference" in
  *zh-Hans*) installerLocale=zh-Hans ;;
  *zh-Hant*|*zh-TW*|*zh-HK*|*zh-MO*) installerLocale=zh-Hant ;;
  *zh*) installerLocale=zh-Hans ;;
  *) installerLocale=en ;;
esac
installerMessage() {
  case "$installerLocale:$1" in
    zh-Hans:missing) print -r -- '缺少 dist/markedit-typlog.js，请保持安装包目录完整。' ;;
    zh-Hant:missing) print -r -- '缺少 dist/markedit-typlog.js，請保持安裝套件目錄完整。' ;;
    en:missing) print -r -- 'Missing dist/markedit-typlog.js. Keep the installation folder intact.' ;;
    zh-Hans:blocked) print -r -- 'macOS 阻止了终端访问 MarkEdit 的应用目录，请改用 Finder 安装：' ;;
    zh-Hant:blocked) print -r -- 'macOS 阻止終端機存取 MarkEdit 的應用程式目錄，請改用 Finder 安裝：' ;;
    en:blocked) print -r -- 'macOS blocked terminal access to MarkEdit. Install with Finder instead:' ;;
    zh-Hans:finder) print -r -- '复制 dist/markedit-typlog.js → MarkEdit「Extensions → Open Documents Folder」→ scripts 文件夹中粘贴。' ;;
    zh-Hant:finder) print -r -- '複製 dist/markedit-typlog.js → MarkEdit「Extensions → Open Documents Folder」→ 貼入 scripts 資料夾。' ;;
    en:finder) print -r -- 'Copy dist/markedit-typlog.js → MarkEdit: Extensions → Open Documents Folder → paste into scripts.' ;;
    zh-Hans:backup) print -r -- "原扩展已备份到：$2" ;;
    zh-Hant:backup) print -r -- "原擴充功能已備份至：$2" ;;
    en:backup) print -r -- "Existing extension backed up to: $2" ;;
    zh-Hans:complete) print -r -- '安装完成。重新启动 MarkEdit，然后选择「扩展 → Typlog → 修改发布配置」。' ;;
    zh-Hant:complete) print -r -- '安裝完成。重新啟動 MarkEdit，然後選擇「擴充功能 → Typlog → 修改發佈設定」。' ;;
    en:complete) print -r -- 'Installed. Restart MarkEdit, then choose Extensions → Typlog → Publishing Settings.' ;;
    zh-Hans:note) print -r -- '扩展不会自动上传文章，也不会改变现有编辑器设置。' ;;
    zh-Hant:note) print -r -- '擴充功能不會自動上傳文章，也不會更動既有編輯器設定。' ;;
    en:note) print -r -- 'The extension does not automatically upload articles or change editor settings.' ;;
  esac
}

if [[ ! -f "$packageDir/dist/markedit-typlog.js" ]]; then
  installerMessage missing
  exit 1
fi
if ! mkdir -p "$scriptsDir" "$configDir"; then
  installerMessage blocked
  installerMessage finder
  exit 1
fi
chmod 700 "$configDir"
if [[ -f "$extensionFile" ]]; then
  backupFile="$packageDir/markedit-typlog-backup-$(date +%Y%m%d-%H%M%S).js"
  cp "$extensionFile" "$backupFile"
  installerMessage backup "$backupFile"
fi
cp "$packageDir/dist/markedit-typlog.js" "$extensionFile"
chmod 600 "$extensionFile"
if [[ -f "$configDir/config.json" ]]; then
  chmod 600 "$configDir/config.json"
fi
installerMessage complete
installerMessage note
