#!/bin/sh
# Rebuild 포토착착-개발웹-발표-4장.pdf from index.html
set -e
cd "$(dirname "$0")"
mkdir -p fonts
base_p="https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0"
[ -f fonts/PretendardVariable.woff2 ] || curl -fsSL -o fonts/PretendardVariable.woff2 \
  "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2"
for w in 4Regular 6SemiBold 7Bold 8ExtraBold; do
  [ -f "fonts/Paperlogy-${w}.woff2" ] || curl -fsSL -o "fonts/Paperlogy-${w}.woff2" \
    "${base_p}/Paperlogy-${w}.woff2"
done
CHROME="${CHROME:-google-chrome-stable}"
"$CHROME" --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer --hide-scrollbars \
  --virtual-time-budget=15000 \
  --print-to-pdf="$(pwd)/포토착착-개발웹-발표-4장.pdf" \
  "file://$(pwd)/index.html"
echo "wrote $(pwd)/포토착착-개발웹-발표-4장.pdf"
