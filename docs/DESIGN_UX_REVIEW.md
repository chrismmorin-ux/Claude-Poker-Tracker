# UX/UI Design Review - Final Draft

**Date:** 2026-03-05
**Status:** Approved design decisions, pending implementation

---

## Design Principles

Two distinct usage modes drive all decisions:

| Mode | Context | Priority |
|------|---------|----------|
| **Fast Capture** | During play, recording actions | Speed, minimal taps, low cognitive load |
| **Analytical Review** | Between hands or postgame | Information density, visualization, exploit generation |

---

## View Architecture (Revised)

| View | Purpose | Mode | Key Change |
|------|---------|------|------------|
| **Table** | Fast capture + at-a-glance exploit indicators on seated players | During play | Add exploit category badges per seat |
| **Stats** | Session-scoped aggregate stats for each seat (what happened today) | Quick glance | Replace hardcoded placeholders with real session stats |
| **Players** | Player identity, seat assignment, exploit CRUD, physical descriptions | Setup / between sessions | Already functional |
| **Analysis** *(new stub)* | Deliberate range work: 13x13 grids, board equity, exploit generation | Between sessions | New view |
| **Hand History** | Review recorded hands | Between sessions | No changes |
| **Sessions** | Session management, buy-ins, results | Between sessions | No changes |
| **Settings** | App configuration | Infrequent | No changes |

---

## Change 1: Table View — Exploit Category Badges

### Current State
- Seat shows: number, action badges above, position badge below, player name badge below
- No exploit information visible on the table

### Design
Below the player name badge, show **exploit category indicators** when a seated player has exploits.

```
     [action badges]
        [  5  ]        <-- seat button (colored by action)
        (D) or (SB)    <-- position badge
      [ Mike ]          <-- player name (blue pill)
    [! 3] [~ 2]         <-- exploit category badges (NEW)
```

#### Badge Format
Each category with exploits gets a small colored pill:
- **Weakness** `[! n]` — red background
- **Strength** `[* n]` — blue background
- **Tendency** `[~ n]` — yellow background
- **Note** `[i n]` — gray background

Where `n` = count of exploits in that category.

#### Statistical Confidence Coloring
Badge opacity/intensity scales with the dataset backing the exploit:

| Sample Size | Visual Treatment |
|-------------|-----------------|
| < 10 hands | 30% opacity — very faint, low confidence |
| 10-19 hands | 60% opacity — visible but muted |
| 20-49 hands | 85% opacity — solid |
| 50+ hands | 100% opacity + slight glow/ring — high confidence |

This gives at-a-glance understanding of "how much should I trust this exploit note?"

#### Interaction
- **Tap badge** → expand to show exploit text inline (tooltip/popover, not navigation)
- Keeps the user on the table view for quick reference during play

#### Data Flow
```
playerState.seatPlayers[seat] → playerId
player.exploits → group by category → count
usePlayerTendencies → tendencyMap[playerId].sampleSize → opacity
```

### Props Addition to SeatComponent
```jsx
// New props
exploitSummary: { weakness: number, strength: number, tendency: number, note: number } | null
sampleSize: number  // for confidence coloring
onExploitBadgeClick: (seat) => void  // optional: expand exploit popover
```

---

## Change 2: Stats View — Real Session-Scoped Stats

### Current State
- 9-seat grid with "45 hands" hardcoded on every seat
- Hardcoded placeholder stats (VPIP 32%, PFR 18%, etc.)
- No real data connection

### Design
Stats becomes the **session-level analysis view** — "what happened at this table today."

#### Seat Grid (top section)
Each seat card shows:
- Seat number
- **Actual hand count** for this session
- Player name (if assigned)
- Mini stat line: `VPIP / PFR / AF` (session-scoped)

#### Selected Seat Detail (bottom section)
When a seat is selected, show:

**Preflop Stats (session-scoped)**
| Stat | Description |
|------|-------------|
| VPIP | Voluntarily put in pot % |
| PFR | Preflop raise % |
| 3-bet | 3-bet frequency % |
| Limp | Limp frequency % |

**Postflop Stats (session-scoped)**
| Stat | Description |
|------|-------------|
| C-bet IP | Continuation bet in position % |
| C-bet OOP | Continuation bet out of position % |
| AF | Aggression factor |
| WTSD | Went to showdown % |
| Fold to C-bet | Fold to continuation bet % |

**Table-Level Exploits Placeholder (future)**
Below individual seat stats, a section stub:
```
--- Table Dynamics (Coming Soon) ---
Aggregate table tendencies will appear here.
```

This is where future table-level exploits live (e.g., "table is playing too tight preflop," "3-bet frequency is 2% across all seats — can open wider").

#### Data Source
Session-scoped stats require filtering `getAllHands()` by the current session's hand IDs, then running the same `buildPlayerStats` / `derivePercentages` pipeline but scoped to that subset.

New utility needed:
```javascript
// src/utils/sessionStats.js
buildSessionStats(sessionHandIds, allHands) → { [seat]: statsObject }
```

---

## Change 3: Analysis View (New Stub)

### Purpose
Deliberate, computationally intensive analysis done between sessions. This is where range visualization, equity calculations, and algorithmic exploit generation will live.

### Two-Tier Analysis Model

| Tier | Name | When | Compute Cost |
|------|------|------|-------------|
| 1 | **Running** | Automatic, during session | Low — incremental stat updates |
| 2 | **Deliberate** | On-demand, between sessions | High — range construction, equity sims |

### Stub Layout

```
+------------------------------------------+
| Analysis                    [Back to Table] |
+------------------------------------------+
|                                            |
|  Select a player to analyze:               |
|  [Player Dropdown]  [Session Filter]       |
|                                            |
+------------------------------------------+
|                                            |
|  RANGE ESTIMATION          | BOARD EQUITY  |
|  (Coming Soon)             | (Coming Soon) |
|                                            |
|  13x13 grid placeholder    | Flop/Turn/    |
|  "Requires 20+ hands"      | River equity   |
|                             | vs estimated  |
|                             | range         |
+------------------------------------------+
|                                            |
|  EXPLOIT GENERATION (Coming Soon)          |
|  "Statistical inferences from behavior     |
|   patterns — requires deliberate compute"  |
|                                            |
+------------------------------------------+
```

### 13x13 Range Grid (Future Implementation)

Standard poker range matrix:
- 13 rows x 13 columns (A through 2)
- Pairs on diagonal (AA, KK, ... 22)
- Suited combos above diagonal (AKs, AQs, ...)
- Offsuit combos below diagonal (AKo, AQo, ...)
- Color-coded by estimated action frequency:
  - **Green** = likely in range (open/call/3-bet)
  - **Red** = likely folded
  - **Yellow** = marginal / uncertain
- Opacity scales with confidence (same principle as exploit badges)

Range estimation method:
1. VPIP % → approximate range width
2. Position-aware: UTG range != BTN range
3. Action-specific: open-raise range != calling range != 3-bet range
4. Shown cards refine the estimate (Bayesian update)

### Board Equity Analysis (Future Implementation)

Given an estimated range + board texture:
- Compute equity distribution of range categories
- Identify which combos hit/miss the board
- Infer calling range vs. folding range
- Suggest exploitative actions

Example flow:
```
Player X: estimated 15% open-raise range from UTG
Flop: T-5-8 rainbow
→ ~30% of range connects (TT, 88, 55, AT, KT, QT, JT, T9)
→ ~70% of range whiffs (AK, AQ, AJ, KQ, KJ, QJ, JJ-99 have overcards only)
→ Exploit: high fold equity on flop bet
```

---

## Change 4: Navigation Update

### Current Sidebar Navigation
Stats | Hand History | Sessions | Players | Settings

### Updated Navigation
Stats | Analysis | Hand History | Sessions | Players | Settings

Analysis gets added to the sidebar with a distinctive icon (chart/grid icon).

---

## Implementation Phases

### Phase 1: Table View Exploit Badges (DONE - v118)
- Created `ExploitBadges` UI component (`src/components/ui/ExploitBadges.jsx`)
- Wired exploit data + sample size into SeatComponent via TableView
- Confidence-based opacity scaling from usePlayerTendencies sampleSize
- Tap-to-expand popover with outside-click dismiss

### Phase 2: Stats View — Real Session Data
- Build `sessionStats` utility (filter hands by session, compute per-seat)
- Replace hardcoded stats with real session-scoped data
- Add table-level exploits placeholder section

### Phase 3: Analysis Stub
- Add Analysis view component with placeholder layout
- Add to navigation/routing
- 13x13 grid component (display only, no computation yet)
- Player/session selection UI

### Phase 4: Statistical Engine (Future)
- Range estimation from VPIP/PFR + position + shown cards
- Board texture equity computation
- Algorithmic exploit generation
- Deliberate compute scheduling

---

## Open Design Questions (for future iteration)

1. Should the 13x13 grid be interactive (click to toggle combos in/out of estimated range)?
2. Should exploit generation be automatic ("we detected a pattern") or user-initiated ("analyze this player")?
3. How should range estimates update when a player shows cards at showdown? (Bayesian refinement)
4. Should table-level exploits surface on the table view, or only in Stats?
