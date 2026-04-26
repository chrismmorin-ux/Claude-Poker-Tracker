#!/usr/bin/env bash
# scripts/check-refresher-writers.sh
#
# CI-grep gate for the Printable Refresher writer registry per
# `docs/projects/printable-refresher/WRITERS.md` §I-WR-1 enumeration.
#
# Asserts every put() / delete() against `userRefresherConfig` or
# `printBatches` originates from a registered writer file. Unregistered
# matches fail CI.
#
# Also enforces I-WR-5 append-only invariant on `printBatches`: zero
# delete() calls outside the explicit dev-mode batch deleter (which does
# not exist yet — Phase 5+).
#
# Mirrors the EAL writer-registry CI-grep pattern. Hook into
# `scripts/smart-test-runner.sh` pre-check + CI pipeline.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────

# Files allowed to call `.put(...)` or `.delete(...)` against the two stores.
# Anything outside this list is an unregistered writer.
ALLOWED_WRITER_FILES=(
  "src/utils/printableRefresher/writers.js"
  "src/utils/printableRefresher/__tests__/writers.test.js"
  "src/utils/persistence/refresherStore.js"
  "src/utils/persistence/__tests__/refresherStore.test.js"
  "src/utils/persistence/__tests__/refresherMigration.test.js"
  "src/utils/persistence/migrations.js"
)

# Files allowed to call `.delete(...)` against `printBatches` specifically
# (I-WR-5 append-only). Currently only the migration test fixture cleanup is
# permitted — there is no production batch-deleter.
ALLOWED_PRINTBATCHES_DELETE_FILES=(
  "src/utils/persistence/__tests__/refresherMigration.test.js"
  # Future: src/__dev__/printBatchDeleter.js with __DEV__ guard
)

# Build a single regex of allowed paths for grep -vE filtering.
make_filter_pattern() {
  local IFS='|'
  echo "$*"
}

ALLOWED_WRITERS_PATTERN=$(make_filter_pattern "${ALLOWED_WRITER_FILES[@]}")
ALLOWED_BATCHES_DELETE_PATTERN=$(make_filter_pattern "${ALLOWED_PRINTBATCHES_DELETE_FILES[@]}")

# ─── Check 1: writer-registry enumeration (I-WR-1) ───────────────────────

# Find any put()/delete() call against userRefresherConfig or printBatches.
# Pattern targets transaction.objectStore('storeName')... or .put()/.delete()
# with the store name as a string literal in nearby context.
violations=$(
  grep -rn -E "(put|delete)\s*\(" src/ --include="*.js" --include="*.jsx" 2>/dev/null \
    | grep -E "userRefresherConfig|printBatches|USER_REFRESHER_CONFIG_STORE_NAME|PRINT_BATCHES_STORE_NAME" \
    | grep -vE "$ALLOWED_WRITERS_PATTERN" \
    || true
)

if [[ -n "$violations" ]]; then
  echo "❌ UNREGISTERED PRF WRITER CALL DETECTED"
  echo ""
  echo "$violations"
  echo ""
  echo "Per docs/projects/printable-refresher/WRITERS.md §I-WR-1 enumeration,"
  echo "every put()/delete() against userRefresherConfig or printBatches must"
  echo "originate from a file in the registered writer list:"
  for f in "${ALLOWED_WRITER_FILES[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Adding a new writer requires persona-level review — see WRITERS.md §Amendment rule."
  exit 1
fi

# ─── Check 2: printBatches append-only (I-WR-5) ──────────────────────────

batch_deletes=$(
  grep -rn -E "\.delete\s*\(" src/ --include="*.js" --include="*.jsx" 2>/dev/null \
    | grep -E "printBatches|PRINT_BATCHES_STORE_NAME" \
    | grep -vE "$ALLOWED_BATCHES_DELETE_PATTERN" \
    || true
)

if [[ -n "$batch_deletes" ]]; then
  echo "❌ printBatches DELETE DETECTED (I-WR-5 append-only violation)"
  echo ""
  echo "$batch_deletes"
  echo ""
  echo "Per WRITERS.md §I-WR-5, printBatches is append-only. Mutating or"
  echo "deleting batch records invalidates staleness-diff (recorded snapshots"
  echo "must remain truthful at the print moment for selectStaleCards to work)."
  echo ""
  echo "If this is a true dev-tool need (e.g., bug repro), add the file to"
  echo "ALLOWED_PRINTBATCHES_DELETE_FILES with a __DEV__ guard."
  exit 1
fi

echo "✅ PRF writer registry check: OK"
echo "   - I-WR-1 enumeration: all put()/delete() calls registered."
echo "   - I-WR-5 append-only: zero printBatches deletes outside permitted scope."
