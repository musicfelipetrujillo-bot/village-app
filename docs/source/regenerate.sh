#!/bin/bash
# Regenerate docs/source/*.md from the PDFs in /Users/gp/Desktop/The Village/.
# Run whenever the source PDFs change. Requires poppler (`brew install poppler`).
set -euo pipefail
SRC="/Users/gp/Desktop/The Village"
OUT="$(cd "$(dirname "$0")" && pwd)"
for pdf in "$SRC"/*.pdf; do
  name="$(basename "$pdf" .pdf)"
  pdftotext -layout "$pdf" "$OUT/$name.md"
  echo "wrote $OUT/$name.md"
done
