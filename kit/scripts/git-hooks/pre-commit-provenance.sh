#!/usr/bin/env bash
# Pre-commit provenance gate. Enforces INV-F2 (no rigor compression) by
# validating that staged program files declare engine substitutions
# explicitly rather than silently. See:
#   - system/intention.md INV-F2
#   - kit/templates/workstream/evidence/PROVENANCE.md
#   - WS-304
#
# Scope: any staged .claude/workstream/programs/prog-*.yaml or
#        kit/templates/workstream/programs/prog-*.yaml file.
#
# v1: validates last_run_by_protocol.<protocol>.engine matches
#     protocols.<protocol>.engine, OR has explicit spec_compliant: false
#     with a valid status. Pre-2026-05-06 runs grandfathered.
#
# Install via: bash kit/scripts/install-git-hooks.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
VALIDATOR="$REPO_ROOT/kit/scripts/cwos-provenance-validate.js"

# Validator may not exist on repos that haven't adopted WS-304 yet — skip silently.
if [ ! -f "$VALIDATOR" ]; then exit 0; fi

# Collect staged program files (added/copied/modified, not deleted).
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^(\.claude/workstream/programs/prog-[^/]+\.yaml|kit/templates/workstream/programs/prog-[^/]+\.yaml)$' || true)
if [ -z "$STAGED" ]; then exit 0; fi

# Strip prog-template.yaml — it has no last_run_by_protocol by design.
STAGED=$(echo "$STAGED" | grep -v '/prog-template\.yaml$' || true)
if [ -z "$STAGED" ]; then exit 0; fi

# Pipe staged paths to validator's --staged mode.
if ! echo "$STAGED" | node "$VALIDATOR" --staged >/dev/null 2>/tmp/cwos-provenance-stderr; then
  cat /tmp/cwos-provenance-stderr >&2
  echo "" >&2
  echo "Provenance gate failed. Run for details:" >&2
  echo "  echo \"<staged paths>\" | node kit/scripts/cwos-provenance-validate.js --staged" >&2
  echo "  node kit/scripts/cwos-provenance-validate.js --all" >&2
  rm -f /tmp/cwos-provenance-stderr
  exit 1
fi
rm -f /tmp/cwos-provenance-stderr

exit 0
