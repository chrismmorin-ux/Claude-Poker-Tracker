#!/usr/bin/env bash
# scripts/check-refresher-bundle.sh
#
# CI-grep gate for the Printable Refresher bundle-import policy per
# `docs/projects/printable-refresher/print-css-doctrine.md` §Forbidden
# mechanisms.
#
# Asserts that the PRF namespace + render path does NOT import any
# rasterization or PDF-generation library:
#   - html2canvas — rasterizes DOM to canvas. Loses crisp text at small font
#     sizes; the doctrine forbids this for laminate-glance legibility.
#   - jspdf / pdf-lib — JS PDF generators. Slow, heavy, and produce non-text-
#     selectable output. The doctrine uses browser-native window.print() with
#     a CSS-driven @page layout instead.
#
# Hook into `scripts/smart-test-runner.sh` pre-check + CI pipeline. Mirrors
# `check-refresher-writers.sh` shape.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────

# Forbidden import patterns — bare import lines or require() calls.
# Each entry is a regex matching any reasonable JS/TS import shape.
FORBIDDEN_PATTERNS=(
  "from ['\"]html2canvas"
  "require\\s*\\(\\s*['\"]html2canvas"
  "from ['\"]jspdf"
  "require\\s*\\(\\s*['\"]jspdf"
  "from ['\"]pdf-lib"
  "require\\s*\\(\\s*['\"]pdf-lib"
)

# Directories scanned for forbidden imports. Limited to the PRF surface
# tree + utility namespace + hooks + context to minimize false positives.
SCAN_PATHS=(
  "src/components/views/PrintableRefresherView"
  "src/utils/printableRefresher"
  "src/hooks/useRefresherConfig.js"
  "src/hooks/useRefresherPersistence.js"
  "src/hooks/useRefresherView.js"
  "src/contexts/RefresherContext.jsx"
  "src/reducers/refresherReducer.js"
)

# ─── Run ─────────────────────────────────────────────────────────────────

violations=""

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  for path in "${SCAN_PATHS[@]}"; do
    if [[ -e "$path" ]]; then
      hits=$(grep -rnE "$pattern" "$path" --include="*.js" --include="*.jsx" 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        violations+="$hits"$'\n'
      fi
    fi
  done
done

if [[ -n "$violations" ]]; then
  echo "❌ FORBIDDEN BUNDLE IMPORT DETECTED IN PRF NAMESPACE"
  echo ""
  echo "$violations"
  echo "Per docs/projects/printable-refresher/print-css-doctrine.md §Forbidden mechanisms,"
  echo "the Printable Refresher render path must use browser-native window.print() with"
  echo "CSS-driven @page layout. Rasterization (html2canvas) and JS PDF generation"
  echo "(jspdf / pdf-lib) lose crisp text at the index-card scale (10pt body floor)"
  echo "and produce non-text-selectable output."
  echo ""
  echo "Refactor to native print pipeline OR amend the doctrine via persona-level review."
  exit 1
fi

echo "✅ PRF bundle-import check: OK"
echo "   - No html2canvas / jspdf / pdf-lib imports in PRF namespace."
