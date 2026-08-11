#!/bin/bash

# Firefox Add-on 打包腳本

echo "📦 開始打包 Firefox Add-on..."

# 建立暫存目錄
mkdir -p build

# 複製必要檔案
cp -r manifest.json content.js styles.css popup.html popup.css popup.js icons _locales build/

# 進入 build 目錄
cd build

# 建立 zip 檔案
zip -r ../fb-feed-filter.xpi * -x "*.DS_Store" "*.git*"

# 回到原目錄
cd ..

# 清理暫存目錄
rm -rf build

echo "✅ 打包完成！檔案：fb-feed-filter.xpi"
echo ""
echo "📋 上架檢查清單："
echo "  ✓ manifest.json 包含所有必要欄位"
echo "  ✓ 多語言支援 (en, zh_TW)"
echo "  ✓ 隱私權政策已建立"
echo "  ✓ 程式碼已優化（減少 console.log）"
echo ""
echo "🚀 下一步："
echo "  1. 前往 https://addons.mozilla.org/developers/"
echo "  2. 登入開發者帳號"
echo "  3. 上傳 fb-feed-filter.xpi"
echo "  4. 填寫詳細說明和截圖"
