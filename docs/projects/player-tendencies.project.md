---
id: player-tendencies
name: Player Tendencies Analytics
status: pending
priority: P3
created: 2025-12-09
---

# Project: Player Tendencies Analytics

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Implement player tendency tracking as the PRIMARY analytics feature. Calculate and display VPIP, PFR, aggression factor, 3-bet%, and C-bet% for each player.

**Roadmap Location:** Phase 2, Sprint 2.4-2.5
**Depends On:** MVP complete
**Blocks:** Phase 3 advanced analytics

**User Priority:** This is the user's primary analytics focus per roadmap preferences.

---

## Context Files

Files to read before starting work:
- `src/reducers/gameReducer.js` - seatActions structure
- `src/reducers/playerReducer.js` - Player state
- `src/utils/persistence/hands.js` - Hand history access
- `src/constants/gameConstants.js` - ACTIONS, STREETS
- `src/components/views/PlayersView.jsx` - Where to display tendencies

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | VPIP/PFR calculation utilities |
| 2 | [ ] | Aggression and 3-bet/C-bet calculations |
| 3 | [ ] | Player profile tendency display |
| 4 | [ ] | TableView seat tendency badges |
| 5 | [ ] | Session stats (secondary) |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: VPIP/PFR Calculations <- CURRENT

### Goal
Create utility functions to calculate VPIP (Voluntarily Put In Pot) and PFR (Pre-Flop Raise) percentages.

### Task Delegation
- [ ] Run `/route <task>` for each subtask
- Calculation utilities: Claude (poker logic requires understanding)
- Test file: Could be `/local-test` with clear spec

### Files to Create
- [ ] `src/utils/tendencyCalculations.js` - Core calculation functions
- [ ] `src/utils/__tests__/tendencyCalculations.test.js` - Tests

### Formulas

**VPIP (Voluntarily Put In Pot %)**
```
VPIP = (hands where player voluntarily put money in preflop) / (total hands seen preflop)

"Voluntarily" means: OPEN, LIMP, CALL, THREE_BET, FOUR_BET
NOT counted: Posting blinds (forced), FOLD, ABSENT
```

**PFR (Pre-Flop Raise %)**
```
PFR = (hands where player raised preflop) / (total hands seen preflop)

Raises: OPEN, THREE_BET, FOUR_BET
NOT counted: LIMP, CALL, FOLD, ABSENT
```

### Data Requirements
Need to query hand history by player and aggregate preflop actions.

### Function Signatures
```javascript
// Calculate VPIP for a player
calculateVPIP(playerId, hands) → { vpip: number, sampleSize: number }

// Calculate PFR for a player
calculatePFR(playerId, hands) → { pfr: number, sampleSize: number }

// Helper: Get player's preflop actions from hand
getPlayerPreflopActions(playerId, hand) → Action[]
```

### Verification (Phase 1)
- [ ] VPIP calculation matches manual calculation
- [ ] PFR calculation matches manual calculation
- [ ] Edge cases handled (no hands, player never acted)
- [ ] Tests pass

---

## Phase 2: Aggression/3-bet/C-bet Calculations

### Goal
Add advanced tendency calculations.

### Files to Modify
- [ ] `src/utils/tendencyCalculations.js` - Add new functions

### Formulas

**Aggression Factor (AF)**
```
AF = (bets + raises) / calls

Across all streets (not just preflop)
```

**3-bet %**
```
3-bet% = (hands where player 3-bet) / (hands where player faced a raise)

3-bet = THREE_BET action
Faced raise = Someone opened before player acted
```

**C-bet % (Continuation Bet)**
```
C-bet% = (flops where player continuation bet) / (flops seen as preflop aggressor)

C-bet = Any bet on flop after raising preflop
Preflop aggressor = Made the last raise preflop
```

### Function Signatures
```javascript
calculateAggressionFactor(playerId, hands) → { af: number, sampleSize: number }
calculate3BetPercentage(playerId, hands) → { threeBet: number, sampleSize: number }
calculateCBetPercentage(playerId, hands) → { cbet: number, sampleSize: number }
```

### Verification (Phase 2)
- [ ] AF calculation accurate
- [ ] 3-bet% calculation accurate
- [ ] C-bet% calculation accurate
- [ ] Edge cases handled
- [ ] Tests pass

---

## Phase 3: Player Profile Display

### Goal
Display tendency stats on player profiles in PlayersView.

### Files to Create
- [ ] `src/components/ui/TendencyStats.jsx` - Stats display component
- [ ] `src/hooks/usePlayerTendencies.js` - Hook to calculate and cache tendencies

### Files to Modify
- [ ] `src/components/views/PlayersView.jsx` - Add tendency section to player card

### UI Design
```
Player Name
---------------------------
Hands: 47 sessions: 3

Tendencies:
VPIP: 24%    PFR: 18%
AF: 2.1      3-bet: 8%
C-bet: 67%

Style: TAG (Tight-Aggressive)
```

### Style Classification
Based on VPIP/PFR:
- **LAG** (Loose-Aggressive): VPIP > 30%, PFR > 20%
- **TAG** (Tight-Aggressive): VPIP 15-25%, PFR 15-20%
- **LP** (Loose-Passive): VPIP > 30%, PFR < 10%
- **NIT** (Tight-Passive): VPIP < 15%
- **Unknown**: < 20 hands sample

### Verification (Phase 3)
- [ ] Tendencies display on player card
- [ ] Style classification is accurate
- [ ] Sample size shown
- [ ] Loading state while calculating
- [ ] Tests pass

---

## Phase 4: TableView Badges

### Goal
Show tendency summary on seats during play.

### Files to Create
- [ ] `src/components/ui/TendencyBadge.jsx` - Small badge component

### Files to Modify
- [ ] `src/components/views/TableView/SeatComponent.jsx` - Add badge

### Badge Design
Small badge showing key tendency:
```
[24/18]  ← VPIP/PFR shorthand
```

Or style indicator:
```
[TAG]  ← Style classification
```

Toggle in settings which to show.

### Performance Considerations
- Cache tendency calculations
- Recalculate on hand completion (not continuously)
- Consider background calculation for large hand histories

### Verification (Phase 4)
- [ ] Badges appear on seats with assigned players
- [ ] Badges update after hand completion
- [ ] Performance is acceptable
- [ ] Toggle in settings works
- [ ] Tests pass

---

## Phase 5: Session Stats (Secondary)

### Goal
Add basic session statistics to StatsView.

### Files to Modify
- [ ] `src/components/views/StatsView.jsx` - Replace placeholder with real data

### Stats to Display
- Total hands played
- Total sessions
- Hours played
- Profit/Loss (if tracking money)
- Win rate per hour (if tracking money)

### Charts (Optional)
If adding charts, use Recharts:
```bash
npm install recharts
```

Simple line chart of profit over time.

### Verification (Phase 5)
- [ ] StatsView shows real data
- [ ] Calculations are accurate
- [ ] Chart renders (if implemented)
- [ ] Tests pass

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Player tendencies over session stats | User's primary analytics interest |
| 2025-12-09 | 20 hand minimum for style classification | Statistical significance |
| 2025-12-09 | Cache tendency calculations | Performance with large history |

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
  - [ ] CLAUDE.md (add tendencyCalculations, TendencyBadge)
  - [ ] docs/QUICK_REF.md (add tendency formulas)
  - [ ] docs/CHANGELOG.md (version entry)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
