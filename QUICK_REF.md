# ⚡ QUICK REFERENCE CARD - Poker Tracker v103

## 🎯 ESSENTIAL INFO
- **Version**: v103 (All Refactoring Complete ✅)
- **File**: poker_tracker_wireframes_v103.tsx (1958 lines)

## 📖 MUST-READ DOCS
1. **POKER_TRACKER_SPEC_V103.md** ⭐ (3k tokens) - READ FIRST
2. **CHANGELOG_v103.md** (2k tokens) - What changed
3. **PROJECT_SUMMARY.md** (2k tokens) - Quick overview

## 🏗️ CODE ORGANIZATION
```
Lines 1-10:      Imports + Debug (DEBUG flag, log helper)
Lines 11-107:    Constants (CONSTANTS, ACTIONS, SEAT_ARRAY)
Lines 109-242:   Helper Functions (11 pure functions)
Lines 244-408:   UI Components (PositionBadge, CardSlot, etc.)
Lines 410+:      Main Component
```

## 🔧 VARIABLE NAMES (v103)
| Variable | Purpose |
|----------|---------|
| `currentView` | SCREEN.TABLE or SCREEN.STATS |
| `isShowdownViewOpen` | Showdown view open |
| `dealerButtonSeat` | Seat with dealer button |
| `highlightedBoardIndex` | Community card 0-4 |
| `highlightedHoleSlot` | Hole card 0-1 |
| `highlightedSeat` | Selected seat in showdown |

## 🧩 COMPONENT PROPS

### CardSlot
```jsx
<CardSlot
  card={string|null}
  variant="table|hole-table|showdown|selector"
  isHighlighted={boolean}
  isHidden={boolean}
  status={null|'folded'|'absent'|'mucked'|'won'}
  onClick={function}
  canInteract={boolean}
/>
```

### PositionBadge
```jsx
<PositionBadge
  type="dealer|sb|bb|me"
  size="small|large"
  draggable={boolean}
  onDragStart={function}
/>
```

### VisibilityToggle
```jsx
<VisibilityToggle
  visible={boolean}
  onToggle={function}
  size="small|large"
/>
```

### DiagonalOverlay
```jsx
<DiagonalOverlay status={SEAT_STATUS.FOLDED|SEAT_STATUS.ABSENT|'mucked'|'won'|null} />
```

## 🎨 COLORS
| Action | Color |
|--------|-------|
| Fold | Red |
| Call/Check | Blue |
| Open/Cbet/Won | Green |
| 3bet/Stab | Yellow |
| 4bet/Donk/CR | Orange |
| Limp/Muck | Gray |

## 📦 HELPER FUNCTIONS
| Function | Purpose |
|----------|---------|
| `log()` | Debug logging with prefix |
| `isFoldAction(action)` | Check if fold |
| `isRedCard(card)` | Check if hearts/diamonds |
| `getCardAbbreviation(card)` | A♥ → Ah |
| `getHandAbbreviation(cards)` | Cards → AhTd |
| `getActionDisplayName(action)` | Action → display name |
| `getActionColor(action)` | Action → Tailwind (showdown) |
| `getSeatActionStyle(action)` | Action → {bg, ring} (table) |
| `getOverlayStatus(...)` | Determine overlay status |

## 🎬 EVENT HANDLERS
| Handler | Purpose |
|---------|---------|
| `handleNextHandFromShowdown` | Close + next hand |
| `handleClearShowdownCards` | Clear showdown cards |
| `handleCloseShowdown` | Close showdown |
| `handleCloseCardSelector` | Close card selector |
| `handleMuckSeat(seat)` | Mark mucked |
| `handleWonSeat(seat)` | Mark winner |
| `handleSetMySeat(seat)` | Set my seat |

## ✅ REFACTORING STATUS - ALL COMPLETE
- ✅ Chunk 1: Constants extraction (v102)
- ✅ Chunk 2: UI Components extraction (v103)
- ✅ Chunk 3: Helper Functions extraction (v103)
- ✅ Chunk 4: Simplify Complex Functions (v103)
- ✅ Chunk 5: Event Handler Cleanup (v103)

## 📊 FILE STATS
| Version | Lines | Change |
|---------|-------|--------|
| v101 | ~2063 | baseline |
| v102 | 2228 | +165 |
| v103 | 1958 | **-270 (12.1%)** |

## 🐛 DEBUG
- Set `DEBUG = false` at line 8 to disable logging
- All logs prefixed with `[PokerTracker]`

| Problem | Solution |
|---------|----------|
| White screen | Syntax error |
| Action not recording | Check ACTIONS.* |
| Colors wrong | Check getActionColor/getSeatActionStyle |
| Card not showing | Check CardSlot props |

## 🚫 DON'T
- Read full .tsx unnecessarily (50k+ tokens!)
- Use hardcoded action strings (use ACTIONS.*)
- Create inline card/badge rendering (use components)
- Use hardcoded [1,2,3,4,5,6,7,8,9] (use SEAT_ARRAY)
- Use hardcoded `<= 9` (use CONSTANTS.NUM_SEATS)
