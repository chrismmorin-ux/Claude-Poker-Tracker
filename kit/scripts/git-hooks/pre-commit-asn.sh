#!/usr/bin/env bash
# Pre-commit AS-N / Market Dynamics Assessment validator.
# Phase 1 G2 enforcement surface per framework-spec.md §4.2, with broader
# path scope per .claude/workstream/runs/run-corr-md-001/artifacts/phase-3/decide-audit.md
# (the /decide usage ratio of 0.50–0.55 made pre-commit load-bearing, not optional).
#
# Two scopes:
#   Narrow (validator block): ADR / program YAML / program charter files.
#     Runs node kit/scripts/cwos-asn-validate.js on each. Exits non-zero
#     blocks the commit.
#   Broad (meta-check):       engine files, command files, template files.
#     If a NEW file in these paths is staged AND no ADR-*.md is staged,
#     block — the /decide gate was bypassed. Exits non-zero.
#
# No bypass flag in phase 1 (framework-spec §4.2 — structural failures are
# cheap to clear). --no-verify is the emergency escape; bypass events are
# phase-2 scope to log.
#
# Install via: bash kit/scripts/install-git-hooks.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
VALIDATOR="$REPO_ROOT/kit/scripts/cwos-asn-validate.js"

if [ ! -f "$VALIDATOR" ]; then
  # Validator not installed — skip. This prevents the hook from breaking
  # commits in repos that haven't adopted the framework yet.
  exit 0
fi

STAGED=$(git diff --cached --name-only --diff-filter=ACM)
if [ -z "$STAGED" ]; then
  exit 0
fi

FAIL=0

# ─── Scope A: validator block on narrow paths ──────────────────────────────

for FILE in $STAGED; do
  case "$FILE" in
    docs/adrs/ADR-*.md)
      # Grandfathering: only validate if file has Load-Bearing Assumptions
      # section OR is net-new. Per framework-spec §4.2.
      if [ "$(git log --all --oneline -- "$FILE" 2>/dev/null | wc -l)" = "0" ] \
         || grep -q "^##\s\+Load-Bearing\s\+Assumptions" "$FILE" 2>/dev/null; then
        if ! node "$VALIDATOR" --adr "$FILE" >/dev/null 2>&1; then
          echo "FAIL: $FILE" >&2
          node "$VALIDATOR" --adr "$FILE" 2>&1 | tail -20 >&2 || true
          FAIL=1
        fi
      fi
      ;;
    docs/programs/*.md)
      if [ "$(git log --all --oneline -- "$FILE" 2>/dev/null | wc -l)" = "0" ] \
         || grep -q "^##\s\+\(Load-Bearing\s\+\)\?Assumptions" "$FILE" 2>/dev/null; then
        if ! node "$VALIDATOR" --charter "$FILE" >/dev/null 2>&1; then
          echo "FAIL: $FILE" >&2
          node "$VALIDATOR" --charter "$FILE" 2>&1 | tail -20 >&2 || true
          FAIL=1
        fi
      fi
      ;;
    .claude/workstream/programs/prog-*.yaml|kit/templates/workstream/programs/prog-*.yaml)
      if [ "$(git log --all --oneline -- "$FILE" 2>/dev/null | wc -l)" = "0" ] \
         || grep -q "^assumptions:" "$FILE" 2>/dev/null; then
        if ! node "$VALIDATOR" --program "$FILE" >/dev/null 2>&1; then
          echo "FAIL: $FILE" >&2
          node "$VALIDATOR" --program "$FILE" 2>&1 | tail -20 >&2 || true
          FAIL=1
        fi
      fi
      ;;
  esac
done

# ─── Scope B: new capability files require a staged ADR ────────────────────
#
# Path list per decide-audit.md "Phase 1 G2 scope recommendation". The 2026-04-22
# audit found 0.50–0.55 of capability additions in the preceding 90 days shipped
# without a corresponding ADR — this gate closes the gap at commit time for
# NEW files only. Edits to existing files are not gated.

HAS_NEW_CAPABILITY=0
NEW_CAPABILITIES=""

for FILE in $STAGED; do
  # Skip .claude/commands/*.md — it's always a hardlink mirror of the
  # canonical kit/commands/*.md (or fleet/ / sim/). Treating it as a new
  # capability would double-block when a kit command is first pushed AND
  # cause false positives on fresh clones where the mirror is materializing.
  # Canonical source (kit/commands, fleet/commands, sim/commands) is still
  # gated below.
  case "$FILE" in
    .claude/commands/*.md) continue ;;
  esac
  case "$FILE" in
    engines/standard/*.md|engines/library/*/SKILL.md|\
    kit/commands/*.md|fleet/commands/*.md|sim/commands/*.md)
      if [ "$(git log --all --oneline -- "$FILE" 2>/dev/null | wc -l)" = "0" ]; then
        HAS_NEW_CAPABILITY=1
        NEW_CAPABILITIES="$NEW_CAPABILITIES $FILE"
      fi
      ;;
  esac
done

if [ "$HAS_NEW_CAPABILITY" = "1" ]; then
  # Must have an ADR staged in same commit.
  HAS_ADR=0
  for FILE in $STAGED; do
    case "$FILE" in
      docs/adrs/ADR-*.md) HAS_ADR=1 ;;
    esac
  done
  if [ "$HAS_ADR" = "0" ]; then
    echo "" >&2
    echo "BLOCK: new capability file(s) staged without an accompanying ADR:" >&2
    for F in $NEW_CAPABILITIES; do
      echo "  - $F" >&2
    done
    echo "" >&2
    echo "Run /decide to produce an ADR with Load-Bearing Assumptions and" >&2
    echo "Market Dynamics blocks, then re-stage. Or use --no-verify to bypass" >&2
    echo "(logged as G2 bypass in mda-metrics.yaml)." >&2
    FAIL=1
  fi
fi

if [ "$FAIL" != "0" ]; then
  echo "" >&2
  echo "AS-N / MDA validation failed." >&2
  echo "Run: node kit/scripts/cwos-asn-validate.js --all   for full details." >&2
  exit 1
fi

# Stamp successful hook execution so post-commit can detect --no-verify bypass
# by comparing this stamp's mtime against HEAD's commit timestamp.
mkdir -p "$REPO_ROOT/.git/cwos" 2>/dev/null || true
date +%s > "$REPO_ROOT/.git/cwos/last-precommit-run" 2>/dev/null || true

exit 0
