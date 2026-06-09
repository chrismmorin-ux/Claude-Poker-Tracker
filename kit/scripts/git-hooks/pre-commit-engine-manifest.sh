#!/usr/bin/env bash
# Pre-commit engine-manifest gate. Validates staged engine-run manifests
# against the canonical schema (WS-305). Twin of pre-commit-provenance.sh.
# See:
#   - kit/templates/workstream/runs/MANIFEST.md
#   - kit/scripts/cwos-engine-manifest.js
#   - WS-305
#
# Scope: any staged .claude/workstream/runs/run-*/manifest.yaml file.
#
# Install via: bash kit/scripts/install-git-hooks.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
VALIDATOR="$REPO_ROOT/kit/scripts/cwos-engine-manifest.js"

# Validator may not exist on repos that haven't adopted WS-305 yet — skip silently.
if [ ! -f "$VALIDATOR" ]; then exit 0; fi

# Collect staged manifest files (added/copied/modified, not deleted).
STAGED=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -E '^\.claude/workstream/runs/run-[^/]+/manifest\.yaml$' || true)
if [ -z "$STAGED" ]; then exit 0; fi

FAIL=0
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  # Extract run-id from path
  RUN_ID=$(echo "$FILE" | sed -E 's|^\.claude/workstream/runs/(run-[^/]+)/manifest\.yaml$|\1|')
  if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "$FILE" ]; then
    echo "pre-commit-engine-manifest: could not parse run-id from $FILE" >&2
    FAIL=1
    continue
  fi
  if ! node "$VALIDATOR" validate --run-id "$RUN_ID" >/dev/null 2>/tmp/cwos-manifest-stderr; then
    cat /tmp/cwos-manifest-stderr >&2
    FAIL=1
  fi
done <<EOF
$STAGED
EOF

if [ "$FAIL" -ne 0 ]; then
  echo "" >&2
  echo "Manifest gate failed. Run for details:" >&2
  echo "  node kit/scripts/cwos-engine-manifest.js validate --run-id <run-NNN>" >&2
  echo "Schema: kit/templates/workstream/runs/MANIFEST.md" >&2
  rm -f /tmp/cwos-manifest-stderr
  exit 1
fi
rm -f /tmp/cwos-manifest-stderr
exit 0
