#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$ROOT_DIR/build"
FIREFOX_DIR="$BUILD_DIR/firefox"
CHROME_DIR="$BUILD_DIR/chrome"

COMMON_FILES=(
  content.js
  extension-api.js
  popup.css
  popup.html
  popup.js
  styles.css
)

copy_common_files() {
  local target_dir="$1"

  for file in "${COMMON_FILES[@]}"; do
    cp "$ROOT_DIR/$file" "$target_dir/"
  done

  cp -R "$ROOT_DIR/_locales" "$target_dir/"
}

echo "Validating shared extension sources..."
node "$ROOT_DIR/scripts/validate.mjs"

rm -rf "$BUILD_DIR"
mkdir -p "$FIREFOX_DIR/icons" "$CHROME_DIR/icons"

copy_common_files "$FIREFOX_DIR"
copy_common_files "$CHROME_DIR"

node "$ROOT_DIR/scripts/build-manifest.mjs" firefox "$FIREFOX_DIR/manifest.json"
node "$ROOT_DIR/scripts/build-manifest.mjs" chrome "$CHROME_DIR/manifest.json"

cp \
  "$ROOT_DIR/icons/icon-48.png" \
  "$ROOT_DIR/icons/icon-48.svg" \
  "$ROOT_DIR/icons/icon-96.svg" \
  "$FIREFOX_DIR/icons/"
cp "$ROOT_DIR/icons/"*.png "$CHROME_DIR/icons/"

rm -f "$ROOT_DIR/fb-feed-filter.xpi" "$ROOT_DIR/fb-feed-filter-chrome.zip"

(
  cd "$FIREFOX_DIR"
  zip -qr "$ROOT_DIR/fb-feed-filter.xpi" . -x "*.DS_Store" "*.git*"
)

(
  cd "$CHROME_DIR"
  zip -qr "$ROOT_DIR/fb-feed-filter-chrome.zip" . -x "*.DS_Store" "*.git*"
)

echo "Build complete:"
echo "  Firefox: $ROOT_DIR/fb-feed-filter.xpi"
echo "  Chrome:  $ROOT_DIR/fb-feed-filter-chrome.zip"
echo "  Chrome unpacked directory: $CHROME_DIR"
