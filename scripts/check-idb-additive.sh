#!/usr/bin/env bash
# scripts/check-idb-additive.sh
#
# CI-grep gate enforcing the additive-only invariant on IndexedDB migrations.
#
# Per `src/utils/persistence/migrationRegistry.js` authoring rule #2 + the
# semantic test in `__tests__/migrationRegistry.test.js`, no migration may
# remove a store or an index. This gate catches the source-code primitive
# (calls to deleteObjectStore / deleteIndex) — the registry test catches the
# data-shape primitive (storesRemoved must stay []). Different failure modes;
# both required.
#
# Mirrors scripts/check-refresher-writers.sh pattern. Hook into
# scripts/smart-test-runner.sh pre-check + CI pipeline.
#
# Resolves SYSTEM_MODEL.md §11 TD-16 (Refactor Sprint Item 3).

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────

# The file under audit. Migrations live in exactly one place.
MIGRATIONS_FILE="src/utils/persistence/migrations.js"

# Forbidden IDB destructive APIs. Allowlist is empty — there is no legitimate
# reason to call these inside migrations. If we ever need to (future archival
# protocol), the decision belongs in a new migration shape, not a slipped-in
# call.
FORBIDDEN_PATTERN='(deleteObjectStore|deleteIndex)\s*\('

# ─── Check ───────────────────────────────────────────────────────────────

if [[ ! -f "$MIGRATIONS_FILE" ]]; then
  echo "❌ IDB additive-only check: $MIGRATIONS_FILE not found"
  exit 1
fi

violations=$(
  grep -nE "$FORBIDDEN_PATTERN" "$MIGRATIONS_FILE" 2>/dev/null || true
)

if [[ -n "$violations" ]]; then
  echo "❌ DESTRUCTIVE IDB API CALL DETECTED IN $MIGRATIONS_FILE"
  echo ""
  echo "$violations"
  echo ""
  echo "Per src/utils/persistence/migrationRegistry.js authoring rule #2,"
  echo "migrations are additive-only. Forbidden APIs: deleteObjectStore, deleteIndex."
  echo ""
  echo "Removing a store or index breaks replay from any prior version. If the"
  echo "intent is truly to retire a store/index, that decision belongs in a"
  echo "new migration shape (deprecation + read-tolerance + scheduled removal),"
  echo "not a direct delete call."
  exit 1
fi

echo "✅ IDB additive-only check: OK"
echo "   - No deleteObjectStore / deleteIndex calls in $MIGRATIONS_FILE."
