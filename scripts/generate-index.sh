#!/bin/bash
# generate-index.sh - Regenerate codebase indexes for token optimization
#
# Generates three index files:
# 1. STRUCTURE.md - Directory tree and file counts
# 2. SYMBOLS.md - Exported functions and constants
# 3. PATTERNS.md - Code patterns and conventions (mostly static)
#
# Usage: bash scripts/generate-index.sh [--full]
#   --full: Regenerate all indexes including PATTERNS.md
#
# Run: On commit, manual, or when index-freshness hook warns

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INDEX_DIR="$PROJECT_ROOT/.claude/index"
TIMESTAMP=$(date +%Y-%m-%d)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Create index directory if needed
mkdir -p "$INDEX_DIR"

log_info "Generating codebase indexes..."

#############################################
# 1. Generate STRUCTURE.md
#############################################

log_info "Generating STRUCTURE.md..."

# Count files
TOTAL_FILES=$(find "$PROJECT_ROOT/src" -type f \( -name "*.js" -o -name "*.jsx" \) | wc -l | tr -d ' ')
TOTAL_DIRS=$(find "$PROJECT_ROOT/src" -type d | wc -l | tr -d ' ')
TEST_FILES=$(find "$PROJECT_ROOT/src" -type f -name "*.test.*" | wc -l | tr -d ' ')

# Get main file line counts
POKER_LINES=$(wc -l < "$PROJECT_ROOT/src/PokerTracker.jsx" 2>/dev/null | tr -d ' ' || echo "0")
ROUTER_LINES=$(wc -l < "$PROJECT_ROOT/src/ViewRouter.jsx" 2>/dev/null | tr -d ' ' || echo "0")
PROVIDERS_LINES=$(wc -l < "$PROJECT_ROOT/src/AppProviders.jsx" 2>/dev/null | tr -d ' ' || echo "0")

# Count by category
VIEW_COUNT=$(find "$PROJECT_ROOT/src/components/views" -name "*.jsx" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
UI_COUNT=$(find "$PROJECT_ROOT/src/components/ui" -maxdepth 1 -name "*.jsx" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
HOOK_COUNT=$(find "$PROJECT_ROOT/src/hooks" -name "*.js" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
REDUCER_COUNT=$(find "$PROJECT_ROOT/src/reducers" -name "*.js" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
CONTEXT_COUNT=$(find "$PROJECT_ROOT/src/contexts" -name "*.jsx" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
CONST_COUNT=$(find "$PROJECT_ROOT/src/constants" -name "*.js" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
UTIL_COUNT=$(find "$PROJECT_ROOT/src/utils" -maxdepth 1 -name "*.js" ! -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')

cat > "$INDEX_DIR/STRUCTURE.md" << EOF
# Codebase Structure Index
**Generated**: $TIMESTAMP | **Files**: $TOTAL_FILES | **Directories**: $TOTAL_DIRS

## Directory Tree

\`\`\`
src/
├── PokerTracker.jsx ($POKER_LINES lines) - Main orchestrator
├── ViewRouter.jsx ($ROUTER_LINES lines) - View switching logic
├── AppProviders.jsx ($PROVIDERS_LINES lines) - Context wrapper
├── main.jsx - Entry point
│
├── components/
│   ├── views/ ($VIEW_COUNT view components)
│   └── ui/ ($UI_COUNT UI components)
│
├── contexts/ ($CONTEXT_COUNT context providers)
├── reducers/ ($REDUCER_COUNT reducers)
├── hooks/ ($HOOK_COUNT custom hooks)
├── constants/ ($CONST_COUNT constant files)
└── utils/ ($UTIL_COUNT utility files)
\`\`\`

## File Count Summary

| Directory | Files | Tests |
|-----------|-------|-------|
| src/components/views | $VIEW_COUNT | ~15 |
| src/components/ui | $UI_COUNT | ~17 |
| src/contexts | $CONTEXT_COUNT | 0 |
| src/reducers | $REDUCER_COUNT | ~7 |
| src/hooks | $HOOK_COUNT | ~10 |
| src/constants | $CONST_COUNT | ~3 |
| src/utils | $UTIL_COUNT | ~12 |
| **Total** | **$TOTAL_FILES** | **$TEST_FILES** |

## Critical Files (Touch With Care)

| File | Lines | Criticality | Reason |
|------|-------|-------------|--------|
| PokerTracker.jsx | $POKER_LINES | HIGH | Main state orchestration |
| gameReducer.js | ~250 | HIGH | Core game state |
| persistence.js | ~200 | HIGH | IndexedDB access |
| gameConstants.js | ~150 | MEDIUM | ACTIONS, SCREEN constants |
| ViewRouter.jsx | $ROUTER_LINES | MEDIUM | All view routing |

## Test Coverage

- **Total tests**: 2,310+
- **Test files**: $TEST_FILES
- **Framework**: Vitest
- **Run**: \`npm test\`
EOF

log_success "STRUCTURE.md generated"

#############################################
# 2. Generate SYMBOLS.md
#############################################

log_info "Generating SYMBOLS.md..."

# Extract exports
EXPORTS_FILE=$(mktemp)

# Get exports from utils
grep -rh "^export const\|^export function" "$PROJECT_ROOT/src/utils/"*.js 2>/dev/null | head -40 >> "$EXPORTS_FILE" || true

# Get exports from hooks
grep -rh "^export default\|^export const" "$PROJECT_ROOT/src/hooks/"*.js 2>/dev/null | head -20 >> "$EXPORTS_FILE" || true

# Get exports from constants
grep -rh "^export const" "$PROJECT_ROOT/src/constants/"*.js 2>/dev/null | head -15 >> "$EXPORTS_FILE" || true

EXPORT_COUNT=$(wc -l < "$EXPORTS_FILE" | tr -d ' ')

cat > "$INDEX_DIR/SYMBOLS.md" << EOF
# Symbol Index
**Generated**: $TIMESTAMP | **Exports**: $EXPORT_COUNT+

## Constants (Most Used)

| Constant | File | Description |
|----------|------|-------------|
| \`ACTIONS\` | src/constants/gameConstants.js | All action types |
| \`SCREEN\` | src/constants/gameConstants.js | View/screen identifiers |
| \`SEAT_ARRAY\` | src/constants/gameConstants.js | Array [0-8] for seats |
| \`PRIMITIVE_ACTIONS\` | src/constants/primitiveActions.js | Base actions |
| \`DEFAULT_SETTINGS\` | src/constants/settingsConstants.js | Settings defaults |

## Utility Functions (Key)

### actionUtils.js
- \`getActionDisplayName(action, isFoldAction, ACTIONS)\` → string
- \`getActionColor(action, isFoldAction, ACTIONS)\` → string
- \`getSeatActionStyle(action, isFoldAction, ACTIONS)\` → string

### cardUtils.js
- \`assignCardToSlot(cards, card, slot)\` → array
- \`removeCardFromArray(cards, card)\` → array
- \`getCardAbbreviation(card, suitAbbrev)\` → string

### persistence.js
- \`initDB()\` → Promise<IDBDatabase>
- \`saveHand(hand)\` → Promise
- \`loadHands()\` → Promise<array>
- \`saveSession(session)\` → Promise
- \`loadSessions()\` → Promise<array>

## React Hooks

| Hook | Purpose |
|------|---------|
| \`useActionUtils\` | Action helper functions |
| \`useAppState\` | Aggregated app state |
| \`usePersistence\` | Generic persistence |
| \`usePlayerFiltering\` | Player list filtering |
| \`useSessionPersistence\` | Session CRUD |
| \`useToast\` | Toast notifications |

## Context Providers

| Context | Provides |
|---------|----------|
| \`GameContext\` | gameState, gameDispatch |
| \`UIContext\` | uiState, uiDispatch |
| \`SessionContext\` | sessionState, sessionDispatch |
| \`PlayerContext\` | playerState, playerDispatch |
| \`SettingsContext\` | settingsState, settingsDispatch |

## Quick Lookups

**Action handling**: \`src/utils/actionUtils.js\` + \`src/reducers/gameReducer.js\`
**Card logic**: \`src/utils/cardUtils.js\` + \`src/hooks/useCardSelection.js\`
**Persistence**: \`src/utils/persistence.js\`
**State shapes**: \`.claude/context/STATE_SCHEMA.md\`
EOF

rm -f "$EXPORTS_FILE"
log_success "SYMBOLS.md generated"

#############################################
# 3. Update PATTERNS.md timestamp only (mostly static)
#############################################

if [ "$1" = "--full" ] || [ ! -f "$INDEX_DIR/PATTERNS.md" ]; then
  log_info "Generating PATTERNS.md (full mode)..."

  cat > "$INDEX_DIR/PATTERNS.md" << 'EOF'
# Code Patterns Index
**Generated**: $TIMESTAMP

## Where to Find Things

| Looking For | Location |
|-------------|----------|
| State management | `src/reducers/*.js` |
| Action types | `src/constants/gameConstants.js` → `ACTIONS` |
| Screen/View names | `src/constants/gameConstants.js` → `SCREEN` |
| Seat iteration | `SEAT_ARRAY` from gameConstants |
| Database access | `src/utils/persistence.js` |
| Event handlers | `src/PokerTracker.jsx` lines 150-600 |
| View routing | `src/ViewRouter.jsx` |

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Reducer | `*Reducer.js` | `gameReducer.js` |
| Hook | `use*.js` | `useSessionPersistence.js` |
| Context | `*Context.jsx` | `GameContext.jsx` |
| View | `*View.jsx` | `TableView.jsx` |
| Constants | SCREAMING_SNAKE | `ACTIONS`, `SEAT_ARRAY` |

## State Update Pattern

```javascript
// Correct: Use dispatch
const { dispatch } = useContext(GameContext);
dispatch({ type: 'RECORD_ACTION', payload: { seat, action } });

// WRONG: Direct mutation
// state.seats[seat].actions.push(action); // NEVER
```

## Handler Pattern

```javascript
// All handlers must use useCallback
const handleAction = useCallback((seat, action) => {
  dispatch({ type: 'RECORD_ACTION', payload: { seat, action } });
}, [dispatch]); // Include all dependencies
```

## Import Pattern

```javascript
// Constants passed as params (dependency injection)
const displayName = getActionDisplayName(action, isFold, ACTIONS);
```

## Anti-Patterns (Avoid)

| Don't | Do Instead |
|-------|------------|
| `state.x = y` | `dispatch({ type, payload })` |
| Hardcoded `[0,1,2,3,4,5,6,7,8]` | Use `SEAT_ARRAY` |
| Magic strings `"open"` | Use `ACTIONS.OPEN` |
| Template Tailwind `bg-${color}` | Static classes |
EOF

  log_success "PATTERNS.md generated"
else
  log_info "PATTERNS.md exists (use --full to regenerate)"
fi

#############################################
# Summary
#############################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "INDEX GENERATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Generated files:"
echo "  .claude/index/STRUCTURE.md"
echo "  .claude/index/SYMBOLS.md"
if [ "$1" = "--full" ]; then
  echo "  .claude/index/PATTERNS.md"
fi
echo ""
echo "Total tokens saved per read: ~2,000 (vs raw source)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
