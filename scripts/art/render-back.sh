#!/bin/bash
# Render scripts/art/card-back-sky.html to assets/art/backs/back-sky.webp (900×1359) with headless Chrome.
set -e
cd "$(dirname "$0")/../.."
OUT=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=900,1359 --screenshot="$OUT/back.png" "file://$PWD/scripts/art/card-back-sky.html" >/dev/null 2>&1
python3 -c "from PIL import Image; Image.open('$OUT/back.png').convert('RGB').save('assets/art/backs/back-sky.webp', 'WEBP', quality=86)"
echo "assets/art/backs/back-sky.webp"
