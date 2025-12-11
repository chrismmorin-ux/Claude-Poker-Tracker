---
id: range-analysis
name: Range Analysis Tools
status: pending
priority: P4
created: 2025-12-09
---

# Project: Range Analysis Tools

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Add professional-level range analysis tools: hand range input matrix, equity calculator, and range vs range comparisons.

**Roadmap Location:** Phase 3, Sprint 3.2
**Depends On:** Phase 2 complete (player tendencies, cloud sync)
**Blocks:** Nothing (expansion feature)

---

## Context Files

Files to read before starting work:
- `src/constants/gameConstants.js` - RANKS, SUITS
- `src/components/views/` - View component patterns
- npm packages: `poker-hand-evaluator`, `pokersolver` (research before implementing)

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Hand range input component |
| 2 | [ ] | Equity calculator integration |
| 3 | [ ] | Range vs range comparison |
| 4 | [ ] | Save/load custom ranges |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: Hand Range Input Component <- CURRENT

### Goal
Create a visual 13x13 matrix for selecting hand ranges.

### Files to Create
- [ ] `src/components/ui/RangeMatrix.jsx` - Range selection matrix
- [ ] `src/components/views/RangeView.jsx` - Range analysis view
- [ ] `src/utils/rangeUtils.js` - Range notation utilities

### Range Matrix Design
```
     A   K   Q   J   T   9   8   7   6   5   4   3   2
A   [AA][AKs][AQs][AJs][ATs]...
K   [AKo][KK][KQs][KJs]...
Q   [AQo][KQo][QQ][QJs]...
J   ...
```

- Diagonal: Pocket pairs (AA, KK, QQ, etc.)
- Above diagonal: Suited hands (AKs, AQs, etc.)
- Below diagonal: Offsuit hands (AKo, AQo, etc.)

### Interaction
- Click cell to toggle
- Click+drag to select multiple
- Shift+click for contiguous selection
- Right-click for quick presets

### Range Notation
Standard notation: "AA,KK,AKs,AQs,AKo"
Shorthand: "AA-QQ" for ranges

### Verification (Phase 1)
- [ ] Matrix renders correctly
- [ ] Cell selection works
- [ ] Range notation output is correct
- [ ] Tests pass

---

## Phase 2: Equity Calculator

### Goal
Integrate or build equity calculation for hand vs hand/range.

### Research Required
Evaluate existing npm packages:
- `poker-hand-evaluator` - Hand evaluation
- `pokersolver` - Hand ranking
- `holdem` - Full equity calculator

Decision: Use existing package vs build from scratch.

### Files to Create
- [ ] `src/utils/equityCalculator.js` - Equity calculation wrapper

### Features
1. **Hand vs Hand** - Calculate equity of two specific hands
2. **Hand vs Range** - One hand against a range of hands
3. **Range vs Range** - Two ranges against each other
4. **Board Texture** - Factor in community cards

### Calculation Method
Monte Carlo simulation:
1. Deal random runouts (10,000+ iterations)
2. Evaluate hands at showdown
3. Calculate win/tie percentages

### Performance Considerations
- Run calculation in Web Worker
- Show progress for long calculations
- Cache recent calculations

### Verification (Phase 2)
- [ ] Hand vs hand equity is accurate
- [ ] Range calculations work
- [ ] Performance is acceptable (< 2 seconds)
- [ ] Tests pass

---

## Phase 3: Range vs Range Comparison

### Goal
Create UI for comparing two ranges with equity display.

### Files to Modify
- [ ] `src/components/views/RangeView.jsx` - Add comparison mode

### UI Design
```
┌─────────────────────────────────────────────┐
│           Range Analysis                     │
├─────────────────┬───────────────────────────┤
│  Player 1       │  Player 2                 │
│  [Range Matrix] │  [Range Matrix]           │
│                 │                           │
│  Hands: 169     │  Hands: 84                │
│  (13.2%)        │  (6.5%)                   │
├─────────────────┴───────────────────────────┤
│           Board: [K♠][7♥][2♦][_][_]         │
├─────────────────────────────────────────────┤
│  Player 1 Equity: 54.3%                     │
│  Player 2 Equity: 45.7%                     │
│                                             │
│  [Calculate Equity]                         │
└─────────────────────────────────────────────┘
```

### Features
- Side-by-side range matrices
- Board card selection
- Equity calculation button
- Results display

### Verification (Phase 3)
- [ ] Two-range comparison works
- [ ] Board cards factor into calculation
- [ ] Results display clearly
- [ ] Tests pass

---

## Phase 4: Save/Load Ranges

### Goal
Allow users to save and load custom ranges.

### Files to Create
- [ ] `src/utils/persistence/ranges.js` - Range persistence

### Files to Modify
- [ ] `src/components/views/RangeView.jsx` - Add save/load UI

### Saved Range Schema
```javascript
{
  id: string,
  name: string,           // "UTG Open Range"
  notation: string,       // "AA-QQ,AKs-ATs,AKo"
  category: string,       // "Open", "3-bet", "Call", "Custom"
  position: string | null,// "UTG", "MP", "CO", "BTN", "SB", "BB"
  createdAt: number,
  updatedAt: number,
}
```

### Preset Ranges
Include common starting ranges:
- UTG Open
- MP Open
- CO Open
- BTN Open
- SB Open/3-bet
- BB Defense

### Verification (Phase 4)
- [ ] Save range works
- [ ] Load range populates matrix
- [ ] Preset ranges available
- [ ] Ranges persist across sessions
- [ ] Tests pass

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Defer to Phase 3 | Focus on core analytics first |
| 2025-12-09 | Research existing packages | Don't reinvent equity calculation |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-09 | Initial | Planning | Created project file from roadmap |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing
- [ ] Documentation updated:
  - [ ] CLAUDE.md (add RangeMatrix, RangeView, equityCalculator)
  - [ ] docs/CHANGELOG.md (version entry)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
