#!/bin/sh
# D10: makes resources/icon.icns from resources/icon.png with the macOS tools sips and
# iconutil. Run after scripts/icon/render-icon.mjs; the ICNS is committed, so a build never
# needs this.
set -eu
cd "$(dirname "$0")/../.."
source=resources/icon.png
set_dir=resources/icon.iconset
rm -rf "$set_dir"
mkdir "$set_dir"
for size in 16 32 128 256 512; do
  double=$((size * 2))
  sips -z "$size" "$size" "$source" --out "$set_dir/icon_${size}x${size}.png" >/dev/null
  sips -z "$double" "$double" "$source" --out "$set_dir/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns -o resources/icon.icns "$set_dir"
rm -rf "$set_dir"
