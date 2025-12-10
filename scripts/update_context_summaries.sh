#!/bin/bash
# update_context_summaries.sh - Regenerate .claude/context/* files based on git changes
#
# Usage: ./scripts/update_context_summaries.sh [--all] [--dry-run]
#   --all      Regenerate all context files regardless of changes
#   --dry-run  Show what would be regenerated without making changes
#
# This script detects changed files and selectively regenerates context summaries.
# It uses a local model (deepseek-coder) via LM Studio to parse and summarize.
#
# Requirements:
#   - LM Studio running with deepseek-coder-7b model
#   - curl for API calls
#   - jq for JSON parsing

set -e

CONTEXT_DIR=".claude/context"
LM_STUDIO_URL="http://localhost:1234/v1/chat/completions"
MODEL="deepseek-coder-7b-instruct"
MAX_TOKENS=800
DRY_RUN=false
REGENERATE_ALL=false
BRANCH_NAME="chore/update-context-$(date +%Y%m%d)"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --all) REGENERATE_ALL=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# Get changed files from git
get_changed_files() {
  git status --porcelain | awk '{print $2}'
}

# Determine which context files need regeneration based on changed paths
needs_regeneration() {
  local changed_files="$1"
  local context_file="$2"

  case "$context_file" in
    "STATE_SCHEMA.md")
      echo "$changed_files" | grep -qE "^src/reducers/|^src/contexts/" && return 0
      ;;
    "PERSISTENCE_OVERVIEW.md")
      echo "$changed_files" | grep -qE "^src/utils/persistence/|^src/hooks/use.*Persistence" && return 0
      ;;
    "RECENT_CHANGES.md")
      # Always regenerate if any source files changed
      echo "$changed_files" | grep -qE "^src/" && return 0
      ;;
    "HOTSPOTS.md")
      echo "$changed_files" | grep -qE "^src/reducers/|^src/hooks/|^src/utils/persistence/" && return 0
      ;;
    "CONTEXT_SUMMARY.md")
      # Regenerate if package.json or major structure changed
      echo "$changed_files" | grep -qE "^package.json|^src/PokerTracker.jsx|^src/contexts/" && return 0
      ;;
  esac
  return 1
}

# Call local model to regenerate a context file
regenerate_context_file() {
  local context_file="$1"
  local prompt=""

  case "$context_file" in
    "CONTEXT_SUMMARY.md")
      prompt="Generate a project context summary for a React poker tracker. Include: version from package.json, architecture overview, key patterns, critical files table. Max 800 tokens, markdown format."
      ;;
    "STATE_SCHEMA.md")
      prompt="Generate a one-page state schema reference. List all 5 reducers (game, card, ui, session, player) with their state shapes in compact JS object notation. Max 800 tokens."
      ;;
    "PERSISTENCE_OVERVIEW.md")
      prompt="Generate a persistence layer overview. Include: module structure, object stores table, key functions list, hooks. Max 800 tokens."
      ;;
    "RECENT_CHANGES.md")
      prompt="Generate a recent changes summary. List last 4 versions with 3-4 bullet points each. Include files changed table. Max 800 tokens."
      ;;
    "HOTSPOTS.md")
      prompt="Generate a hotspots file listing critical/fragile files. Include: critical files table with risk levels, complex logic table, integration points, test requirements. Max 800 tokens."
      ;;
  esac

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would regenerate: $context_file"
    return 0
  fi

  echo "Regenerating: $context_file"

  # Call LM Studio API (pseudo-code - actual implementation depends on your setup)
  # response=$(curl -s -X POST "$LM_STUDIO_URL" \
  #   -H "Content-Type: application/json" \
  #   -d "{
  #     \"model\": \"$MODEL\",
  #     \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}],
  #     \"max_tokens\": $MAX_TOKENS
  #   }")
  #
  # content=$(echo "$response" | jq -r '.choices[0].message.content')
  # echo "$content" > "$CONTEXT_DIR/$context_file"

  echo "  -> Would call: $MODEL with prompt for $context_file"
  echo "  -> Target: $CONTEXT_DIR/$context_file"
}

# Main execution
echo "=== Context Summary Update Script ==="
echo "Dry run: $DRY_RUN"
echo "Regenerate all: $REGENERATE_ALL"
echo ""

# Ensure context directory exists
mkdir -p "$CONTEXT_DIR"

# Get changed files
CHANGED=$(get_changed_files)

if [ -z "$CHANGED" ] && [ "$REGENERATE_ALL" = false ]; then
  echo "No changed files detected. Use --all to force regeneration."
  exit 0
fi

echo "Changed files detected:"
echo "$CHANGED" | sed 's/^/  /'
echo ""

# Context files to check
CONTEXT_FILES="CONTEXT_SUMMARY.md STATE_SCHEMA.md PERSISTENCE_OVERVIEW.md RECENT_CHANGES.md HOTSPOTS.md"

# Determine which to regenerate
REGEN_LIST=""
for cf in $CONTEXT_FILES; do
  if [ "$REGENERATE_ALL" = true ] || needs_regeneration "$CHANGED" "$cf"; then
    REGEN_LIST="$REGEN_LIST $cf"
  fi
done

if [ -z "$REGEN_LIST" ]; then
  echo "No context files need regeneration based on changes."
  exit 0
fi

echo "Files to regenerate:$REGEN_LIST"
echo ""

# Regenerate each file
for cf in $REGEN_LIST; do
  regenerate_context_file "$cf"
done

echo ""
echo "=== Proposed Git Commands (do not run automatically) ==="
echo "git checkout -b $BRANCH_NAME"
echo "git add $CONTEXT_DIR/"
echo "git commit -m \"chore: update context summaries\""
echo ""
echo "Review changes before committing. Script complete."
