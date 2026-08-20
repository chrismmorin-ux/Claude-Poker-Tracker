#!/usr/bin/env bash
# scripts/check-guide-ledger.sh
#
# CI gate enforcing the guide form and its observance protocol (prog-guide-authority),
# the sibling of scripts/check-label-ledger.sh, check-sor-additive.sh and
# check-idb-additive.sh.
#
# Founder directive 2026-08-16: "put a monitor on when this is used, so we have good
# observance protocols of the information."
#
# WHY IT MEASURES INERTNESS AND NOT ONLY CONFORMANCE. A standard with zero instances
# passes every conformance check trivially and prints a green tick. That is precisely
# prog-strategy-of-record's own baseline finding — 7 of 13 standardOfRecord modules,
# 1,679 lines, zero non-test consumers, under 304 passing tests. A gate that cannot
# distinguish "perfectly obeyed" from "never used" is the failure it exists to catch.
# So inertness is a violation on a deadline, owned and dated in the baseline's __meta.
#
# WHY IT PARSES DATA AND NOT PROSE. Every Guide carries a fenced ```guide-standing```
# JSON block declaring its conditioning set, what it marginalizes over, its Weighting
# and its Census counts. Grepping prose for "weighting" would pass on the word appearing
# in a sentence that disclaims it.
#
# THE PROPERTY THAT MAKES IT SURVIVE: `--update` writes newly discovered documents with
# `ledger: null`, and a null ledger is itself a violation. Re-snapshotting records that a
# document EXISTS; it never asserts anyone DECIDED anything about it.
#
# Hook into scripts/smart-test-runner.sh pre-check + CI pipeline.

set -euo pipefail

CHECKER="scripts/standardOfRecord/check-guide-ledger.mjs"

if [[ ! -f "$CHECKER" ]]; then
  echo "❌ Guide Authority observance check: $CHECKER not found"
  exit 1
fi

node "$CHECKER"
