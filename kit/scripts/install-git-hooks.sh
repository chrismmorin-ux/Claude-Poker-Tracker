#!/usr/bin/env bash
# install-git-hooks.sh — wires kit/scripts/git-hooks/*.sh into .git/hooks/.
# Idempotent: safe to re-run. Preserves any existing hook by chaining it.
#
# Usage:
#   bash kit/scripts/install-git-hooks.sh
#
# Installs:
#   pre-commit  — kit/scripts/git-hooks/pre-commit-asn.sh
#                  (AS-N / Market Dynamics validator, phase-1 G2 surface)

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "Not inside a git repository." >&2
  exit 1
fi

HOOK_SRC_DIR="$REPO_ROOT/kit/scripts/git-hooks"
HOOK_DST_DIR="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOK_SRC_DIR" ]; then
  echo "Hook source dir missing: $HOOK_SRC_DIR" >&2
  exit 1
fi

mkdir -p "$HOOK_DST_DIR"

# Install pre-commit + post-commit dispatchers that invoke each installed
# CWOS hook in kit/scripts/git-hooks/{pre,post}-commit-*.sh. This lets
# additional hooks be added without overwriting each other.

install_dispatcher() {
  local PHASE="$1"    # pre-commit | post-commit
  local DISPATCHER="$HOOK_DST_DIR/$PHASE"
  cat > "$DISPATCHER" <<EOF
#!/usr/bin/env bash
# CWOS $PHASE dispatcher — invokes every kit/scripts/git-hooks/$PHASE-*.sh.
# Installed by kit/scripts/install-git-hooks.sh. Re-run to refresh.
set -e
REPO_ROOT=\$(git rev-parse --show-toplevel)
HOOK_DIR="\$REPO_ROOT/kit/scripts/git-hooks"
if [ ! -d "\$HOOK_DIR" ]; then exit 0; fi
FAIL=0
for HOOK in "\$HOOK_DIR"/$PHASE-*.sh; do
  [ -f "\$HOOK" ] || continue
  if ! bash "\$HOOK"; then FAIL=1; fi
done
exit \$FAIL
EOF
  chmod +x "$DISPATCHER"
}

install_dispatcher "pre-commit"
install_dispatcher "post-commit"
chmod +x "$HOOK_SRC_DIR"/*.sh 2>/dev/null || true

echo "Installed hooks:"
echo "  $HOOK_DST_DIR/pre-commit   (chains pre-commit-*.sh)"
echo "  $HOOK_DST_DIR/post-commit  (chains post-commit-*.sh)"
echo ""
echo "Current CWOS hook set:"
for HOOK in "$HOOK_SRC_DIR"/*.sh; do
  [ -f "$HOOK" ] || continue
  base=$(basename "$HOOK")
  case "$base" in
    pre-commit-*|post-commit-*) echo "  - $base" ;;
  esac
done
