# Sidebar Redesign Spec: Decision-First HUD

**Status:** Design spec (Session 1 of 6)
**Date:** 2026-04-11
**Replaces:** 3-tier glance/context/deep architecture from 2026-03-31

---

## Design Principle

The sidebar has one job: **reduce decision latency without increasing cognitive load.**

A player mid-hand has 15-30 seconds. Their cognitive budget is split between the table (bet sizing, physical reads, board texture, stack sizes) and the sidebar. The sidebar is a co-pilot, not a dashboard. Co-pilots don't read the instrument panel — they call out deviations.

**The bet:** A player who acts with correct confidence on one clear recommendation is better served than a player who sees all the data and second-guesses.

---

## 1. Decision-State Matrix

### The Six States

Every poker decision falls into one of six states. The sidebar detects which state the player is in and adapts Zones 2-3 content accordingly.

#### State 1: Aggressor, First to Act (OOP with initiative)
> "Should I bet? How much?"

| Zone | Content |
|------|---------|
| **Z1 Action Bar** | `BET 2/3 ($24)` or `CHECK` — action + sizing + EV edge |
| **Z2 Context** | `Fold eq: 67%` · `Your equity: 41%` · `SPR: 3.2` |
| **Z2 Response** | `If BET 2/3: Folds 67% · Calls 28% · Raises 5%` |
| **Z3 Villain** | "Tight-passive, over-folds to turn bets — 156 hands" |
| **Z3 Plan** | "Bet/fold. If called, check turn unless brick." |
| **Z3 Watch** | "Scary turns: A, K (reduces fold equity)" |

#### State 2: Aggressor, Facing Check (IP with initiative)
> "Should I barrel or pot-control?"

| Zone | Content |
|------|---------|
| **Z1 Action Bar** | `BET 1/2 ($18)` or `CHECK` — action + sizing + EV edge |
| **Z2 Context** | `Fold eq: 52%` · `Your equity: 55%` · `Board: wet` |
| **Z2 Response** | `If BET 1/2: Folds 52% · Calls 40% · Raises 8%` |
| **Z3 Villain** | "Loose-passive, calls too wide but folds rivers — 89 hands" |
| **Z3 Plan** | "Bet for thin value. If called, river bet only on bricks." |
| **Z3 Watch** | "Flush completes on 3 turn cards — check those" |

#### State 3: Caller, Facing Bet
> "Call, fold, or raise?"

| Zone | Content |
|------|---------|
| **Z1 Action Bar** | `CALL` or `FOLD` or `RAISE 2.5x` — action + EV edge |
| **Z2 Context** | `Your equity: 34%` · `Pot odds: 28%` · `Need: 28% to call` |
| **Z2 Response** | (Not shown — hero is reacting, not initiating) |
| **Z3 Villain** | "Aggressive — c-bets 78% of flops, barrel frequency drops on turns" |
| **Z3 Plan** | "Call. Float — villain gives up 62% of turns." |
| **Z3 Watch** | "Profitable float: villain's turn check-fold is high" |

#### State 4: Caller, First to Act (OOP without initiative)
> "Donk or check? Usually check — but what's the plan?"

| Zone | Content |
|------|---------|
| **Z1 Action Bar** | `CHECK` (almost always) or rare `BET` (donk) |
| **Z2 Context** | `Your equity: 38%` · `Villain range: capped` · `SPR: 5.1` |
| **Z2 Response** | `If CHECK: V bets 72% · V checks 28%` |
| **Z3 Villain** | "Aggressive PFA — bets most flops, slows on paired boards" |
| **Z3 Plan** | "Check/call. If villain checks, lead turn for value." |
| **Z3 Watch** | "Board pairs → villain shuts down (exploit: lead)" |

#### State 5: Preflop Standard
> "Open, fold, or 3-bet?"

| Zone | Content |
|------|---------|
| **Z1 Action Bar** | `RAISE 2.5x ($6)` or `FOLD` or `CALL` |
| **Z2 Context** | `Position: CO` · `Open range: 28%` · `Villain VPIP: 45%` |
| **Z2 Response** | (Preflop — less relevant, but show fold equity if 3-betting) |
| **Z3 Villain** | "Fish at 45% VPIP — calls too wide preflop and postflop" |
| **Z3 Plan** | "Open for value. Post-flop: bet/fold most flops vs this villain." |
| **Z3 Watch** | "Flop archetypes: Set 2%, Top pair 18%, Draw 22%, Miss 58%" |

#### State 6: Preflop Contested (facing 3-bet/4-bet)
> "Fold, call, or 4-bet?"

| Zone | Content |
|------|---------|
| **Z1 Action Bar** | `CALL` or `FOLD` or `RAISE 2.2x ($48)` |
| **Z2 Context** | `Your equity: 42%` · `Pot odds: 31%` · `3-bet range: ~5%` |
| **Z2 Response** | `If 4-BET: Folds 55% · Calls 30% · 5-bets 15%` |
| **Z3 Villain** | "TAG — 3-bets 7% from BTN, polarized range" |
| **Z3 Plan** | "Call in position. Re-evaluate on flop texture." |
| **Z3 Watch** | "Villain's 3-bet range: premiums + some suited connectors" |

### State Detection Logic

```
classify(advice, liveContext, actionSequence):
  if street === 'preflop':
    if facing3BetOrHigher → State 6 (PREFLOP_CONTESTED)
    else → State 5 (PREFLOP_STANDARD)
  else (postflop):
    heroIsAggressor = hero was last raiser/bettor on prior street OR hero is PFA
    heroBetFacesCheck = villain checked to hero
    heroFacesBet = last action before hero is a bet/raise

    if heroFacesBet → State 3 (CALLER_FACING_BET)
    if heroIsAggressor AND heroBetFacesCheck → State 2 (AGGRESSOR_FACING_CHECK)
    if heroIsAggressor AND NOT heroBetFacesCheck → State 1 (AGGRESSOR_FIRST_TO_ACT)
    else → State 4 (CALLER_FIRST_TO_ACT)
```

---

## 2. Content Inventory Audit

### Elements CUT (removed from sidebar entirely)

| Element | Current Location | Rationale |
|---------|-----------------|-----------|
| Fold curve SVG | Deep panel | One fold% number replaces the graph. Players who understand fold curves need the number, not the visualization. |
| Fold% breakdown (8 adjustment factors) | Deep panel | Algorithm audit trail. If the model is good, trust its output. |
| Model audit section | Deep panel | "Model source: positional prior + 45 hands" is dev information, not player information. |
| Combo distribution bars | Deep panel | Useful for range thinking but not actionable in 20 seconds. |

### Elements DEMOTED (moved to between-hands only)

| Element | Current Location | New Location | Rationale |
|---------|-----------------|-------------|-----------|
| Vulnerability list | Deep panel (live) | Between-hands villain scouting | Generic exploit list isn't actionable mid-hand. Specific exploits surface in Plan Panel. |
| Street tendencies | Deep panel (live) | Between-hands villain scouting | Same — interesting, wrong timing. |
| All alternative recs (full detail) | Deep panel | Between-hands review | Multiple options with full EV breakdowns create ambivalence. Show EV delta for close decisions only. |
| Range breakdown by hand type | Deep panel | Between-hands deep panel | Distilled into "likely holds X or Y" in Plan Panel. |

### Elements REDESIGNED

| Element | Current Form | New Form |
|---------|-------------|----------|
| Unified header (action + villain + cards + pills) | One combined block (~200px) with accent bar, badges, cards, meta pills | Split into Zone 1 (Action Bar, 80px) + Zone 2 (Context Strip, 60px). Cards move to seat arc area. |
| Hand plan tree | Structured data: ifCall/ifRaise/nextStreet objects | Single English sentence: "Bet/fold. If called, check turn unless brick." |
| Villain model display | Style badge + headline + sample + confidence dot | One sentence: "Tight-passive, over-folds to turn bets — 156 hands" |
| Street card (street-adaptive content) | Complex multi-section: timeline, active players, range grid, fold%, blocker, range advantage | Collapsed into Zone 3 Plan Panel (3 lines) + between-hands deep panel |
| EV display | `+4.2bb` with colored text | `+4.2 edge` — framed as "edge" for player clarity |

### Elements KEPT (unchanged or minimally adjusted)

| Element | Notes |
|---------|-------|
| Seat arc | Works well for spatial awareness. Keep as-is. |
| Tournament bar | Already compact. Keep M-ratio, ICM, blinds, timer. |
| Status bar | Infrastructure. Keep connection dot + hand count. |
| Pipeline health strip | Infrastructure. Keep for debugging. |
| Recovery banner | Error handling. Keep. |
| Board cards display | Move from header to near seat arc for spatial coherence. |
| Hero hole cards | Move from header to near seat arc. |

### Elements ADDED

| Element | Location | What It Shows | Rationale |
|---------|----------|--------------|-----------|
| Mix frequency indicator | Zone 1 | `BET 60% / CHECK 40%` when engine recommends mixed strategy | Decision-critical for players who play mixed strategies. Currently computed but invisible. |
| Risk signal | Zone 1 | Small H/M/L badge next to sizing | EV is the average; variance matters for tournaments/ICM/short stacks. |
| Villain response probabilities | Zone 2 | `If BET 2/3: Folds 67% · Calls 28% · Raises 5%` | The most natural question a player asks. Currently computed, not shown. |
| Showdown anchors | Zone 3 | "S3 showed 72o bluff in similar spot (hand #47)" | Memory augmentation — what a live coach would mention. |
| Post-fold reflection | Between-hands | "You folded. Engine: call (+1.2bb). Difference: small." | Creates learning loop without shaming. |
| Session focus reminder | Between-hands | One strategic note for the session | Prep for next hand. |

---

## 3. Between-Hands Experience

60% of sidebar time is between hands. Three distinct modes:

### Mode A: Post-Fold Reflection (0-10 seconds after hero folds)

```
┌─────────────────────────────────────────┐
│  You folded                             │
│  Engine recommended: CALL (+1.2 bb)     │
│  Difference: small — marginal spot      │
└─────────────��───────────────────────────┘
```

- Brief, non-judgmental
- Shows what the engine recommended and the EV difference
- "small/medium/large" qualitative label, not just the number
- Only appears when hero had a profitable alternative

### Mode B: Observing Hand (10 sec after fold until hand ends)

```
┌──────────────���──────────────────────────┐
│  SCOUTING — Seat 3 (Fish, 45h)         │
│                                         │
│  Folds to river bets 72%               │
│  Slowplays top pair often               │
│  Low check-raise frequency              │
│                                         │
│  Anchor: Showed 72o bluff vs S5 (#47)  │
└─────────────────────────────────────────┘
```

- Top 3 actionable patterns for the villain(s) still in the hand
- Showdown anchors when relevant
- Villain focus: whoever is in the biggest pot or is hero's likely next opponent

### Mode C: Waiting for Next Deal (hand ended, idle)

```
┌─────────────────────────────────────────┐
│  Session: +$24.50 (12 hands)            │
│  ████████████████░░░░░░░░ +3.4 bb/100   │
│                                         │
│  Next hand focus:                       │
│  S3 (Fish) — target with turn bets     │
│  S7 (TAG) — avoid bluffing rivers       │
│                                         │
│  [Tournament: M 4.2 · Lvl 3 · 45/87]  │
└────────────────���────────────────────────┘
```

- Stack trajectory: simple progress bar + bb/100
- Top 2 opponent notes for next hand
- Tournament info if applicable

### Mode Transitions

```
hero folds → Mode A (10 sec timer)
timer expires → Mode B (while hand is live)
hand ends → Mode C
new deal → exit between-hands, enter live zones
```

---

## 4. Visual Design Spec

### Typography (3 sizes only)

| Size | Use | Font | Weight |
|------|-----|------|--------|
| **Large** (24px) | Action word in Zone 1 only. One per screen. | System sans-serif | 700 (bold) |
| **Medium** (14px) | Sizing, key numbers, plan sentences, villain read | Monospace for numbers, sans-serif for prose | 500 (medium) |
| **Small** (11px) | Labels, confidence indicators, secondary context | System sans-serif | 400 (regular) |

Current design uses 7 font sizes (8px-16px). Reducing to 3 forces a clear reading hierarchy — the eye knows where to land.

### Color Semantics

**Action trust (the only semantic colors):**

| Color | Meaning | Hex | Use |
|-------|---------|-----|-----|
| Green | Confident value / clear +EV | `#4ade80` | Value bets, strong calls, confident recommendations |
| Yellow | Marginal / mixed / judgment call | `#fbbf24` | Mixed spots, thin value, close decisions |
| Red | Fold / high-risk / -EV | `#f87171` | Folds, high-variance bluffs, losing spots |

**Everything else:** Cool gray scale only.

| Role | Hex | Use |
|------|-----|-----|
| Primary text | `#e0e0e0` | Zone 1 action word, Zone 3 sentences |
| Secondary text | `#888888` | Zone 2 numbers, labels |
| Tertiary text | `#555555` | Timestamps, parentheticals |
| Surface (body) | `#111111` | Background (not pure black — reduces eye fatigue) |
| Surface (card) | `#1a1a2e` | Zone backgrounds |
| Surface (inset) | `#0d1117` | Deep panel background |
| Divider | `rgba(42, 42, 74, 0.3)` | Zone separators |

**Confidence as opacity:** Low-confidence information is visually dimmer. Model confidence maps directly to text opacity:
- Player model (high confidence): 100% opacity
- Mixed model: 80% opacity  
- Population estimate: 60% opacity

This is subtle but powerful — players stop trusting ghost-gray numbers.

**What's removed:** Category-differentiating accent colors (purple for depth, cyan for SPR, gold for street). Color means trust level, not data type.

### Spacing

| Rule | Value | Rationale |
|------|-------|-----------|
| Zone separation | 10px gap + 1px divider | Clear zone boundaries |
| Zone 1 vertical padding | 16px top/bottom | Action word needs room to breathe |
| Zone 2 number gaps | 16px between items | Prevent number run-together |
| Zone 3 line-height | 1.6 | Readable prose in plan sentences |
| Sidebar total width | 400px | Chrome side panel standard |

### Motion

| Trigger | Animation | Duration | Purpose |
|---------|-----------|----------|---------|
| Action changes | Opacity fade-swap | 150ms | Signals "this changed" |
| Plan panel auto-expand | Slide down | 200ms ease | Draws eye deliberately |
| Engine recomputing | Subtle border pulse | 2s period, 85-100% opacity | Shows processing without spinner |
| Mode transition (between-hands) | Cross-fade | 200ms | Smooth state change |

**No loading spinners.** Show last confident recommendation with pulse border while engine works.

**No decorative animation.** Motion is a signal, not a feature.

### Dark Theme

- Background: `#111` (near-black, not pure black)
- Card surfaces: `#1a1a2e` (slightly cool, creates depth)
- Text: `#e0e0e0` primary (not pure white — same eye fatigue reason)
- Left accent border: 2px on Zone 1, colored by action trust — differentiates sidebar from casino background

---

## 5. Wire Schema Changes

### Fields Already on Wire (inside `recommendations[]` array)

These fields are computed by the game tree, included in the `recommendations` array which passes through `pick()` by reference, and therefore already cross the wire. The sidebar just doesn't render them:

| Field | Path | Status |
|-------|------|--------|
| `villainResponse` | `recommendations[i].villainResponse` | Already on wire. Render in Zone 2. |
| `mixFrequency` | `recommendations[i].mixFrequency` | Already on wire. Render in Zone 1. |
| `risk` | `recommendations[i].risk` | Already on wire. Render as H/M/L badge. |
| `handPlan` | `recommendations[i].handPlan` | Already on wire. Convert to English in Zone 3. |
| `villainPrediction` | `recommendations[i].villainPrediction` | Already on wire. Use for confidence display. |
| `depth` | `recommendations[i].depth` | Already on wire. Use in Zone 2 context. |

### Fields Needing Wire Addition

| Field | Source | Wire Target | Change Needed |
|-------|--------|-------------|---------------|
| `showdownAnchors` | `villainProfile.showdownAnchors` | `VILLAIN_PROFILE_FIELDS` | Add `'showdownAnchors'` to the array |
| `maturity` | `villainProfile.maturity` | `VILLAIN_PROFILE_FIELDS` | Add `'maturity'` to the array |

### Fields NOT Being Added (decision: skip)

| Field | Reason to Skip |
|-------|---------------|
| `awareness` dimensions | Data not reliable enough on anonymous sites to surface |
| `treeMetadata.cacheStats` | Dev-only metric |
| `treeMetadata.refinedActions` | Dev-only metric |
| `boardTexture.monotone` | Can be inferred from community cards client-side |

---

## 6. Zone Layout Spec

### Zone 1: Action Bar (80px, sticky, never scrolls)

```
┌── 2px accent border (action trust color) ──────────────┐
│                                                         │
│  BET          2/3 pot  ($24)              [M] risk     │
│  +4.2 edge   ·   67% villain folds                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Standard layout:**
- Row 1: Action word (24px bold, left) + sizing fraction + dollar amount (14px, right) + risk badge
- Row 2: EV edge (14px, green/yellow/red) + primary stat (fold equity or pot odds)

**Mixed spot layout:**
- Row 1: `BET 60%  ·  CHECK 40%` (both actions with frequencies)
- Row 2: `Bet: +0.3 bb  ·  Check: +0.1 bb` (both EVs)
- Visual: yellow accent border (marginal signal)

**Waiting/computing layout:**
- Row 1: `Analyzing...` (11px, muted, with border pulse)
- Row 2: Empty or last-known recommendation at 60% opacity

### Zone 2: Context Strip (60px, sticky below Zone 1)

```
┌──────────────────���──────────────────────────────────────┐
│  Equity: 34%    Pot odds: 28%    Model: 156h           │
│  If BET 2/3: Folds 67% · Calls 28% · Raises 5%        │
└───────────────────────────��─────────────────────────────┘
```

- Row 1: Three context numbers (state-dependent, see decision-state matrix)
- Row 2: Villain response probabilities (when hero is the actor)
- Monospace for all numbers, left-aligned with even spacing

### Zone 3: Plan Panel (120px default, collapsible)

```
┌─────────────────────────────────────────────��───────────┐
│  Tight-passive — over-folds to turn bets (156h)        │
│                                                         │
│  Plan: Bet/fold. If called, check turn unless brick.   │
│                                                         │
│  Watch: A, K on turn reduce fold equity sharply         │
│                                                         │
│  Anchor: S3 showed 72o bluff in similar spot (#47)     │
└─────────────────────────────────────────────────────────┘
```

- Line 1: Villain characterization (one sentence + sample size)
- Line 2: Hand plan (one sentence, plain English)
- Line 3: Watch/scary cards (one line)
- Line 4: Showdown anchor (when relevant, 0-1 anchors max)
- Auto-expands after 8 seconds of inaction

### Zone 4: Deep Panel (hidden by default, expand button)

Between-hands: See Section 3 above.
Mid-hand (only if explicitly expanded):
- All alternative recommendations with full EV breakdown
- Range breakdown by hand type (stacked bar)
- Villain street tendencies
- Combo stats

---

## 7. Implementation Order

| Session | Focus | Key Deliverable |
|---------|-------|----------------|
| 1 (this) | Design spec | This document |
| 2 | Zone 1 + Zone 2 | Action Bar + Context Strip replacing unified header |
| 3 | Zone 3 + state detection | Plan Panel + `classifyDecisionState()` + English generation |
| 4 | Between-hands | 3 modes: post-fold, observing, waiting |
| 5 | Visual overhaul | Typography, color, spacing, motion — full CSS rewrite |
| 6 | Integration + testing | Wire gaps, fixtures, visual harness, live test |

---

## 8. What This Spec Does NOT Cover

- **Seat arc** — kept as-is
- **Tournament bar** — kept as-is  
- **Pipeline health / recovery** — infrastructure, not redesign scope
- **Engine logic changes** — no game tree or villain model modifications
- **Main app sidebar** — this spec is for the Chrome extension side panel only
