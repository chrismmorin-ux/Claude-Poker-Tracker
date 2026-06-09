#!/usr/bin/env bash
# pre-commit-graph-closure.sh — engine ↔ persona dispatch graph-closure check
# (WS-307 / ADR-044).
#
# Runs the graph-closure test when staged files might affect persona binding:
#   - engines/**           (new persona references in engine prose)
#   - personas/**          (frontmatter or filename changes)
#   - .claude/agents/**    (runtime agent files added/removed/edited)
#   - kit/scripts/cwos-engine-persona-validate.js  (validator itself changed)
#   - kit/scripts/__tests__/engine-persona-graph.test.js
#
# Skips the test when no relevant files are staged (fast path).
# Failure blocks the commit with a clear pointer to the validator.
#
# Install via: bash kit/scripts/install-git-hooks.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
TEST_FILE="$REPO_ROOT/kit/scripts/__tests__/engine-persona-graph.test.js"

# Skip if the test isn't installed (pre-WS-307 kit).
if [ ! -f "$TEST_FILE" ]; then
  exit 0
fi

STAGED=$(git diff --cached --name-only --diff-filter=ACMR)
if [ -z "$STAGED" ]; then
  exit 0
fi

NEEDS_RUN=0
for FILE in $STAGED; do
  case "$FILE" in
    engines/*|personas/*|.claude/agents/*)
      NEEDS_RUN=1
      break
      ;;
    kit/scripts/cwos-engine-persona-validate.js|\
    kit/scripts/__tests__/engine-persona-graph.test.js)
      NEEDS_RUN=1
      break
      ;;
  esac
done

if [ "$NEEDS_RUN" = "0" ]; then
  exit 0
fi

if ! node "$TEST_FILE" >/tmp/cwos-graph-closure-$$.log 2>&1; then
  echo "" >&2
  echo "BLOCK: engine ↔ persona graph-closure check failed." >&2
  echo "" >&2
  cat /tmp/cwos-graph-closure-$$.log >&2
  echo "" >&2
  echo "Run for details:" >&2
  echo "  node kit/scripts/cwos-engine-persona-validate.js --json" >&2
  echo "" >&2
  echo "Resolution rule (ADR-044): every persona reference in engine prose" >&2
  echo "must resolve to .claude/agents/<name>.md, and that agent's frontmatter" >&2
  echo "name: must equal the filename basename. No fallback." >&2
  rm -f /tmp/cwos-graph-closure-$$.log
  exit 1
fi

rm -f /tmp/cwos-graph-closure-$$.log
exit 0
