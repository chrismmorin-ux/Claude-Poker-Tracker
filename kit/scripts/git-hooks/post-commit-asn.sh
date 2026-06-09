#!/usr/bin/env bash
# Post-commit hook — logs --no-verify bypass events to mda-metrics.yaml.
#
# Detection heuristic: the pre-commit hook writes .git/cwos/last-precommit-run
# containing a unix timestamp on successful completion. If HEAD's commit time
# is NEWER than that stamp AND the commit staged files the validator covers,
# then pre-commit didn't run on this commit → bypass.
#
# This is a soft detection — it depends on the stamp file existing. A fresh
# clone that uses --no-verify on its first commit won't have a stamp yet, so
# no bypass is logged. That's acceptable: the primary use case is detecting
# bypasses on an already-active repo.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
STAMP="$REPO_ROOT/.git/cwos/last-precommit-run"
LOGGER="$REPO_ROOT/kit/scripts/cwos-bypass-log.js"

# No stamp yet → first-ever commit after install. Nothing to detect.
[ -f "$STAMP" ] || exit 0
[ -f "$LOGGER" ] || exit 0

HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
[ -z "$HEAD_SHA" ] && exit 0

HEAD_TIME=$(git log -1 --format=%ct HEAD 2>/dev/null || echo 0)
STAMP_TIME=$(cat "$STAMP" 2>/dev/null || echo 0)

# Only proceed if HEAD strictly newer than stamp.
if [ "$HEAD_TIME" -le "$STAMP_TIME" ] 2>/dev/null; then
  exit 0
fi

# Was any validator-covered file staged in the just-made commit?
CHANGED=$(git diff-tree --no-commit-id --name-only --diff-filter=ACM -r HEAD 2>/dev/null | \
  grep -E '^(docs/adrs/ADR-.*\.md|docs/programs/.*\.md|\.claude/workstream/programs/prog-.*\.yaml|kit/templates/workstream/programs/prog-.*\.yaml|engines/standard/.*\.md|engines/library/.*/SKILL\.md|kit/commands/.*\.md|fleet/commands/.*\.md|sim/commands/.*\.md)$' | \
  tr '\n' ',' | sed 's/,$//') || true

if [ -z "$CHANGED" ]; then
  exit 0
fi

# Bypass detected. Append to mda-metrics.yaml.
node "$LOGGER" --bypass --sha "$HEAD_SHA" --files "$CHANGED" 2>/dev/null || true
exit 0
