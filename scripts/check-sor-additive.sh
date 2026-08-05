#!/usr/bin/env bash
# scripts/check-sor-additive.sh
#
# CI gate enforcing the additive-only invariant on the Standard-of-Record
# schemas (WS-328), the sibling of scripts/check-idb-additive.sh.
#
# Same discipline, same reason. The IDB gate exists because removing a store or
# an index breaks replay from any prior version. A Result Card has the identical
# property: a card written in anchor generation 1 must still parse in generation
# 5, or the Ladder cannot rebase and every historical figure becomes unreadable
# at exactly the moment someone needs to check it.
#
# ONE DIFFERENCE, and it is why this delegates to node rather than grepping.
# The IDB violation has a source-code primitive to search for
# (`deleteObjectStore(`). Deleting a field descriptor from an array leaves no
# token behind, so there is nothing to grep. The check therefore compares the
# LIVE schemas against a committed baseline snapshot —
# scripts/standardOfRecord/schema-baseline.json — which is the same role
# __tests__/migrationRegistry.test.js plays for the IDB registry.
#
# Hook into scripts/smart-test-runner.sh pre-check + CI pipeline.

set -euo pipefail

CHECKER="scripts/standardOfRecord/check-additive.mjs"

if [[ ! -f "$CHECKER" ]]; then
  echo "❌ Standard-of-Record additive-only check: $CHECKER not found"
  exit 1
fi

node "$CHECKER"
