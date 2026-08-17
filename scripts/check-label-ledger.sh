#!/usr/bin/env bash
# scripts/check-label-ledger.sh
#
# CI gate enforcing the Label & Foundation Ledger (WS-445), the sibling of
# scripts/check-sor-additive.sh and scripts/check-idb-additive.sh.
#
# A "label-shaped input" is any discrete key standing between raw game data and
# a numeric engine parameter — a position label, a style label, a hand-strength
# bucket, a board-texture category, an SPR zone, a size bucket. POKER_THEORY
# §7.1 and exploitEngine/CLAUDE.md forbid them as decision inputs in four
# separate documented forms, with worked examples. A survey at HEAD found 49
# families anyway, and an AST harvest found 145 constructs. Prose was tried and
# it did not work; this is the mechanism that replaces it.
#
# WHY THIS DELEGATES TO NODE rather than grepping, and it is the same reason
# check-sor-additive.sh does — inverted. That gate diffs a baseline because
# DELETING a line leaves no token to search for. This one diffs because ADDING a
# label table leaves no distinctive token either: IMPACT_MAP, REALIZATION_TABLE
# and BUCKET_MIDPOINT share no lexical marker. The construct has an AST shape
# and no name, so the checker parses rather than greps.
#
# THE PROPERTY THAT MAKES IT SURVIVE: `--update` writes newly harvested
# constructs with `ledger: null`, and a null ledger is itself a violation. So
# re-snapshotting records that a construct EXISTS; it never asserts anyone
# THOUGHT ABOUT IT. The only way to green this gate is a human writing a ledger
# row or a reasoned exclusion.
#
# Hook into scripts/smart-test-runner.sh pre-check + CI pipeline.

set -euo pipefail

CHECKER="scripts/standardOfRecord/check-label-ledger.mjs"

if [[ ! -f "$CHECKER" ]]; then
  echo "❌ Label & Foundation Ledger check: $CHECKER not found"
  exit 1
fi

node "$CHECKER"
