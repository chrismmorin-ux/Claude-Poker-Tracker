# Bayesian Range Engine - Design Specification v2

**Status**: DRAFT v2 - Incorporating feedback
**Scope**: Preflop first, architecture supports postflop extension

---

## 1. Problem Statement

The current exploit system uses frequency-based z-tests to detect deviations from GTO thresholds. This works for broad tendencies ("plays too many hands") but cannot answer the critical question:

**Given that Villain took action A from position P, what hands could they have, and how should Hero respond?**

The engine must:
- Infer Villain's hand distribution from observed actions
- Update beliefs with Bayesian inference as data arrives
- Account for MIXING (same hand can appear in multiple action lines)
- Never assume GTO — use population priors, let data override
- Quantify deviations from GTO in a compact, memorable format (PIPs)
- Translate into exploits only when the data firmly supports them
- Support bet sizing, pot odds, and EV calculations

---

## 2. Existing Infrastructure

| Module | What it does | Reuse? |
|--------|-------------|--------|
| `rangeMatrix.js` | 13x13 grid, combo enumeration, GTO preflop charts (9 pos) | **Yes** - core data structure + GTO baseline |
| `equityCalculator.js` | Monte Carlo hand-vs-range and range-vs-range | **Yes** - EV calculations |
| `handEvaluator.js` | 5-card hand ranking | **Yes** - postflop equity |
| `boardTexture.js` | Wet/dry/paired board classification | **Yes** - postflop extension |
| `handTimeline.js` | Ordered action timeline per hand | **Yes** - action extraction |
| `positionUtils.js` | 9 position names, 4 categories, IP/OOP | **Extend** - add 5-cat model |
| `tendencyCalculations.js` | VPIP, PFR, AF, 3bet, cbet frequencies | **Yes** - frequency priors |
| `positionStats.js` | Stats partitioned by position category | **Extend** - 5 categories |
| `exploitSuggestions.js` | Z-test based exploit rules | **Keep** alongside range exploits |

### Data Already Captured (per hand in IndexedDB)
- `actionSequence`: ordered `{ seat, action, street, order }` entries
- `allPlayerCards`: `{ [seat]: [card1, card2] }` - showdown observations
- `seatPlayers`: `{ [seat]: playerId }`
- `communityCards`: 5-element array
- `gameState.dealerButtonSeat`: position reference

### New Data Needed
- `actionSequence` entries gain `amount` and `potRelative` fields for bet sizing
- New `rangeProfiles` IndexedDB object store for persisted profiles

---

## 3. Position Model: 5 Categories

SB, BB, and LATE play drastically differently when played correctly. Using 4 categories that lump SB+BB together loses critical information.

```
Position    | Seats in 9-handed | Preflop Dynamics
------------|-------------------|------------------------------------------
EARLY       | UTG, UTG+1        | Tightest, most players behind
MIDDLE      | MP1, MP2          | Moderate, still many behind
LATE        | HJ, CO, BTN       | Widest opens, positional advantage
SB          | SB                | Forced money in, OOP postflop always
BB          | BB                | Forced money in, closes action, defends wide
```

The existing `POSITION_CATEGORIES` in `positionUtils.js` has 4 categories with BLINDS combined.
We add a new 5-category mapping:

```js
export const RANGE_POSITION_CATEGORIES = {
  EARLY:  ['UTG', 'UTG+1'],
  MIDDLE: ['MP1', 'MP2'],
  LATE:   ['HJ', 'CO', 'BTN'],
  SB:     ['SB'],
  BB:     ['BB'],
};
```

GTO baseline ranges per category (derived from existing `PREFLOP_CHARTS`):
- EARLY: average of UTG + UTG+1 charts
- MIDDLE: average of MP1 + MP2 charts
- LATE: average of HJ + CO + BTN charts
- SB: SB chart
- BB: BB chart

---

## 4. Core Model

### 4.1 The Fundamental Question

For player V, given they took action A from position P:

```
P(hand = h | action = A, position = P)
  = P(A | h, P) * P(h) / P(A | P)
```

### 4.2 Preflop Action Space

```
Total Range (100% of hands dealt)
  |-- FOLD
  |-- LIMP (when no raise faced)
  |-- OPEN RAISE (when no raise faced)
  |-- COLD CALL (vs a raise)
  |-- 3-BET (vs a raise)
  |-- SQUEEZE (vs raise + caller(s))
```

### 4.3 Mixing: A Hard Requirement

**We CANNOT exclude a hand from a range just because we saw it in another range.**

A player might:
- Open AA 70% of the time and limp it 30% (trapping)
- Cold-call AKs sometimes and 3-bet it other times
- Play the same hand differently based on reads, mood, or table dynamics

Therefore, every hand has a weight in EVERY action range. These weights represent
the probability that the player takes action A when dealt hand h from position P.

```
For hand h = AKs, position = LATE:
  P(open | AKs, LATE) = 0.75
  P(3bet | AKs, LATE) = 0.20
  P(coldCall | AKs, LATE) = 0.05
  P(limp | AKs, LATE) = 0.00
  P(fold | AKs, LATE) = 0.00

  SUM = 1.00 (must sum to 1 across all actions for any given hand)
```

**What we CAN say from showdown data:**
- "Hand h IS in range A" (certainty, when observed)
- "Hand h has at least X% mixing weight in range A" (from observed frequency)

**What we CANNOT say without strong supporting data:**
- "Hand h is NOT in range B" (requires many observations with NO appearance)
- "This player never limps premiums" (requires many limp showdowns, all non-premium)

The system should form hypotheses and test them, not make assumptions.

### 4.4 Population Priors (Not GTO)

The priors reflect what typical live low-stakes players actually do, NOT what GTO says:

```
Typical live 1/2 - 1/3 player prior:
- Limps speculative hands (small pairs, suited connectors, suited aces)
- Opens with broadways, medium+ pairs, strong aces
- 3-bets mainly QQ+, AKs (maybe AKo) unless proven otherwise
- P(limp | AA) = 0.05 (rare but not zero — mixing is possible)
- P(open | AA) = 0.90
- P(3bet | AA) = 0.05
- Cold-calls with medium pairs, suited broadways
```

These priors have low effective weight (~5 virtual observations) and get
overwhelmed by real data quickly. Purpose: reasonable estimates when n < 5.

### 4.5 Bayesian Update Rules

#### From observed action frequency:
When we observe player V take action A from position P, we increment counts and
the overall frequency shifts the range width for that action.

#### From showdown observation (most powerful):
When player V shows hand H after taking action A from position P:
1. Set the mixing weight of H in range A to at least the observed frequency
2. Infer about SIMILAR hands (if they open KTs, similar suited broadways get
   higher weight in the open range)
3. Update behavioral flags (trapping, mixing, etc.)
4. **DO NOT set H's weight in other ranges to zero** — they might mix

#### From sub-action sequences:
Limp then fold vs limp then call vs limp then reraise tells us about the
strength distribution WITHIN the limp range:
- High limp-fold → limp range includes hands they abandon easily
- High limp-call → limp range is "sticky" (medium strength, willing to see flop)
- Any limp-reraise → limp range is UNCAPPED (can contain strong hands)

**On limp-reraise specifically:**
The prior says limp-reraise is likely strong (trapping). But if showdown data
shows the player's strong hands always come from open/3bet lines, then
limp-reraise may actually be a bluff or semi-bluff. The system tracks this:
- If N limp-reraises and all showdowns from open/3bet show premiums → limp-reraise
  could be light (premiums aren't in the limp line)
- If a premium is shown after limp-reraise → confirmed trapping
- Data decides, not assumptions

#### Cross-range constraint:
All action weights for a given hand must sum to ~1.0 (accounting for noise).
If the open range gets wider, the fold range must get narrower, etc.

### 4.6 Confidence Tiers

```
Tier          | Hands at position | Showdowns | Meaning
--------------|-------------------|-----------|--------------------------------
Speculative   | < 5               | 0         | Mostly prior, low reliability
Low           | 5-15              | 0-1       | Some data, treat with caution
Moderate      | 15-40             | 2-4       | Data-driven, actionable
High          | 40+               | 5+        | Strong statistical basis
```

Each showdown observation counts as ~5 frequency observations for confidence.

---

## 5. PIPs Deviation System

### 5.1 Concept

PIPs (Position-relative Incremental Points) quantify how a player's range
deviates from GTO, measured within hand categories.

For someone who knows GTO ranges by heart, a PIP-based description instantly
communicates the shape of a player's range:

```
"Mike from LATE: Opens +2 pips pocket pairs, +1 suited connectors,
 -1 offsuit broadways. 80% confidence."
```

Translation: Mike opens two extra pair tiers (e.g., GTO says 55+ from CO,
Mike plays 33+), one extra suited connector tier (e.g., GTO says 76s+,
Mike plays 65s+), and drops one offsuit broadway tier (e.g., GTO says ATo+,
Mike plays AJo+).

### 5.2 Hand Categories for PIP Counting

Each category has a natural ordering from strongest to weakest:

```
1. POCKET PAIRS (13 tiers)
   AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22
   GTO EARLY: 77+ (7 tiers). Player opens 55+ → +2 pips.

2. SUITED ACES (12 tiers)
   AKs, AQs, AJs, ATs, A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s
   GTO EARLY: ATs+ (4 tiers). Player opens A8s+ → +2 pips.

3. SUITED BROADWAYS (non-ace, 10 tiers)
   KQs, KJs, KTs, K9s, K8s, ...
   QJs, QTs, Q9s, ...
   JTs, J9s, ...
   Grouped by high card. "+1 pip Kxs" = one extra suited king.

4. SUITED CONNECTORS (7 tiers)
   JTs, T9s, 98s, 87s, 76s, 65s, 54s
   GTO LATE(BTN): 65s+ (6 tiers). Player plays 54s+ → +1 pip.

5. SUITED GAPPERS (7 tiers)
   J9s, T8s, 97s, 86s, 75s, 64s, 53s
   Usually just "included" or "not included" with a count.

6. OFFSUIT BROADWAYS (10 tiers)
   AKo, AQo, AJo, ATo, KQo, KJo, KTo, QJo, QTo, JTo
   GTO EARLY: AKo only (1 tier). Player opens AQo+ → +1 pip.

7. OFFSUIT CONNECTORS (commonly overplayed)
   KQo, QJo, JTo, T9o, 98o, 87o
   Usually 0 in EP, a few in LP. Noted when present.
```

### 5.3 Computing PIPs

For each position category and hand category:

```
1. Get GTO baseline: count how many tiers are in the GTO range
2. Get player's estimated range: count how many tiers are in their range
3. PIP delta = player_tiers - gto_tiers
   Positive = wider than GTO (playing more hands in this category)
   Negative = tighter than GTO (playing fewer)
4. Confidence from sample size at this position
```

### 5.4 PIP Display Format

Compact, scannable, memorable:

```
MIKE from LATE (n=32, moderate confidence):
  Pairs: 22+ (+3 pips from GTO)
  Axs: A5s+ (GTO)
  SCs: 54s+ (+1 pip)
  KXs: K7s+ (+2 pips)
  Offsuit: ATo+, KJo+ (+1 pip, commonly overplayed)
  Opens ~28% (GTO ~24%)
```

The PIPs tell the story: "Mike opens too many pocket pairs, too many suited
kings, and one extra suited connector tier from late position."

---

## 6. Range Grid Visualization

### 6.1 The 13x13 Grid

A single 13x13 grid showing ALL action ranges simultaneously is the most
information-dense display possible. Each cell represents a hand class
(e.g., AKs, 77, QJo) and is color-coded by the player's primary action:

```
     A  K  Q  J  T  9  8  7  6  5  4  3  2
  A [O][O][O][O][O][O][L][L][ ][ ][ ][ ][ ]   O = Open (green)
  K [O][O][O][O][C][ ][ ][ ][ ][ ][ ][ ][ ]   L = Limp (yellow)
  Q [O][C][O][O][C][ ][ ][ ][ ][ ][ ][ ][ ]   C = Cold-call (blue)
  J [O][C][C][O][C][ ][ ][ ][ ][ ][ ][ ][ ]   3 = 3-bet (red)
  T [O][ ][ ][C][O][L][ ][ ][ ][ ][ ][ ][ ]   F = Fold (gray/empty)
  9 [L][ ][ ][ ][L][O][L][ ][ ][ ][ ][ ][ ]   ? = Unknown (dim)
  8 [L][ ][ ][ ][ ][L][O][L][ ][ ][ ][ ][ ]
  7 [L][ ][ ][ ][ ][ ][L][O][L][ ][ ][ ][ ]
  6 [ ][ ][ ][ ][ ][ ][ ][L][O][ ][ ][ ][ ]
  5 [L][ ][ ][ ][ ][ ][ ][ ][ ][O][ ][ ][ ]
  4 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][O][ ][ ]
  3 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][L][ ]
  2 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]

  Upper triangle = suited | Diagonal = pairs | Lower triangle = offsuit
```

### 6.2 Mixing Visualization

When a hand has significant weight in multiple action ranges, show the
dominant action with a secondary indicator:

- Solid color = primary action (>70% weight)
- Split/hatched = mixed (e.g., half green/half red for open/3bet mix)
- Border color = secondary action
- Brightness = confidence (brighter = more data)

### 6.3 Position Tabs

The grid has tabs for each position category (EARLY, MIDDLE, LATE, SB, BB).
Switching tabs shows the player's estimated range for that position.
A "diff vs GTO" toggle overlays the GTO range for comparison.

---

## 7. Bet Amount Tracking

### 7.1 Data Model Extension

`actionSequence` entries gain optional fields:

```js
{
  seat: 5,
  action: 'raise',
  street: 'preflop',
  order: 1,
  amount: 15,           // NEW: absolute dollar amount
  potRelative: 0.75,    // NEW: fraction of pot (0.33, 0.5, 0.75, 1.0, etc.)
}
```

Both fields are optional (backward compatible). `potRelative` is computed from
`amount` and current pot size at time of recording.

### 7.2 UI Quick-Click Presets

When recording a bet/raise, show quick-select buttons:

```
[ 1/3 pot ] [ 1/2 pot ] [ 3/4 pot ] [ Pot ] [ Custom: $____ ]
```

The pot size is tracked from the action sequence (blinds + all prior bets/calls).
Quick-click buttons compute the dollar amount automatically.

### 7.3 Sizing Profiles

Over time, accumulate per-player sizing data:

```
Player's betting profile:
  Preflop open size: avg 3.2x BB (range: 2.5-5x)
  Flop cbet size: avg 55% pot
  Value bet river: avg 70% pot
  Bluff river: avg 45% pot  ← if detectably different, major exploit
```

Sizing tells (different sizes for value vs bluff) are a future exploit source.

---

## 8. Exploit Architecture: Separate from Analysis

Exploits are a LAYER ON TOP of analysis, not embedded within it.

### 8.1 Why Separation Matters

The analysis layer answers: "What is this player's range?"
The exploit layer answers: "Given this range, what should I do?"

These are different questions with different error consequences:
- Analysis error: "We think they open 22% from LP" (off by 3% = minor)
- Exploit error: "Always 3-bet light vs their opens" (wrong = costly)

An exploit derived from an incorrect analysis assumption can be disastrous.
Example: if we ASSUME their limp range is capped (no premiums) and iso-raise
every time, but they actually trap with AA 30% of the time, we're walking
into a trap repeatedly.

### 8.2 Exploit Validation Requirements

Before an exploit is surfaced, it must pass:

1. **Data threshold**: minimum observations supporting the pattern
2. **Confidence level**: statistical significance of the deviation
3. **Consequence check**: what happens if the exploit is WRONG?
   - Low consequence: "value bet wider" (worst case: lose a small pot)
   - High consequence: "their limp is always weak, iso-raise 100%" (worst case: stacked)
4. **Counter-evidence check**: is there ANY data contradicting this exploit?

```
Exploit confidence tiers:
  SUGGESTED (low data, plausible hypothesis)
  SUPPORTED (moderate data, statistically significant)
  CONFIRMED (high data, confirmed by showdowns, safe to rely on)
```

### 8.3 Consequence-Weighted Confidence

High-consequence exploits require MORE evidence:

```
"Limp range is capped → iso-raise light"
  Consequence if wrong: get 3-bet or check-raised by a premium
  Required evidence: 10+ limps with 0 premiums at showdown (or 0 limp-reraises)
  Even then: hedge with "likely capped" not "definitely capped"

"They call cbets too wide → bet bigger for value"
  Consequence if wrong: they fold and you win a smaller pot (low cost)
  Required evidence: 5+ cbet calls with weak hands
```

### 8.4 Exploit Format

Each exploit includes:
- **What the data shows** (pure analysis, no assumption)
- **What to do** (the recommended action)
- **Why it works** (the logic, rooted in the data)
- **What could go wrong** (if the analysis is wrong)
- **Confidence and evidence** (sample size, showdowns)

```
EXPLOIT: Iso-raise his limps
  DATA: Limps 18% from LATE. 0 premiums in 6 limp showdowns.
        Limp-folds 45% (3/7). Limp-calls 55% (4/7). 0 limp-reraises.
  ACTION: Raise to 4x with top 25% (pairs, broadways, suited aces).
  LOGIC: His limp range is weak/speculative. You have equity edge
         and position. He folds 45% immediately = profit on dead money.
  RISK: If he starts trapping (limp-reraise), back off. Currently
        0/7 limp-reraises, but sample is moderate.
  CONFIDENCE: SUPPORTED (moderate data, no counter-evidence)
```

---

## 9. Range Profile Schema

### 9.1 IndexedDB Store

New object store `rangeProfiles` in IndexedDB v9:

```js
{
  keyPath: 'playerId',
  indexes: ['lastUpdated', 'userId']
}
```

### 9.2 Profile Structure

```js
const rangeProfile = {
  playerId: 'abc123',
  userId: 'guest',
  lastUpdated: Date.now(),
  schemaVersion: 1,
  totalHandsAnalyzed: 47,

  // Per-position range data (5 categories)
  positions: {
    EARLY: positionData,
    MIDDLE: positionData,
    LATE: positionData,
    SB: positionData,
    BB: positionData,
  },

  // Showdown evidence log
  showdownLog: [
    {
      handIndex: 130,            // rangeMatrix index
      handLabel: 'AKs',          // human-readable
      position: 'LATE',
      preflopAction: 'open',     // which action line
      // Future: postflop line, board context
      timestamp: 1709654400000,
    }
  ],

  // Behavioral traits (Bayesian posteriors)
  traits: {
    trapsPreflop: {
      posterior: 0.05,           // P(traps with premiums preflop)
      observations: 0,          // times premium seen in passive line
      opportunities: 7,         // total passive-line showdowns
    },
    splitsRangePreflop: {
      posterior: 0.10,           // P(mixes same hand across actions)
      evidence: [],              // hands seen in multiple action lines
    },
    positionallyAware: {
      posterior: 0.50,           // P(significantly different by position)
      chiSquarePValue: null,     // statistical test when enough data
    },
  },

  // PIPs deviation summary (computed, not stored raw)
  pips: {
    EARLY: { pairs: 0, suitedAces: 0, suitedBroadways: 0,
             suitedConnectors: 0, offsuitBroadways: 0, confidence: 'low' },
    MIDDLE: { ... },
    LATE: { ... },
    SB: { ... },
    BB: { ... },
  },

  // Bet sizing profile (Phase 2+)
  sizing: null,
};

// Per-position data structure
const positionData = {
  sampleSize: 12,

  // Observed action frequencies
  actions: {
    fold:     { count: 8,  opportunities: 12 },
    limp:     { count: 1,  noRaiseFaced: 10 },  // opportunities = no raise faced
    open:     { count: 2,  noRaiseFaced: 10 },
    coldCall: { count: 1,  facedRaise: 2 },
    threeBet: { count: 0,  facedRaise: 2 },
  },

  // Estimated ranges: 169 weights per action
  // Weight = P(player takes this action with this hand from this position)
  // Weights across actions for a given hand should sum to ~1.0
  ranges: {
    limp:     Float64Array(169),   // all hands have a weight, even if tiny
    open:     Float64Array(169),
    coldCall: Float64Array(169),
    threeBet: Float64Array(169),
    // fold is implicit: 1.0 - sum(other weights) for each hand
  },

  // Derived range widths (% of 1326 combos)
  rangeWidths: {
    limp: 8, open: 15, coldCall: 7, threeBet: 3,
  },

  // Sub-action patterns
  limpBehavior: {
    limpFold:  { count: 0, opportunities: 1 },
    limpCall:  { count: 1, opportunities: 1 },
    limpRaise: { count: 0, opportunities: 1 },
  },

  // Showdown observations at this position
  showdowns: [
    { handIndex: 130, action: 'open', count: 1 },
  ],
};
```

---

## 10. Algorithm Flow

### 10.1 Building a Profile from Hand History

```
For each hand H where player V participated:
  1. Determine V's position (seat + dealerButton → 5-cat)
  2. Extract V's preflop action from timeline:
     - No raise faced: fold / limp / open
     - Faced raise: fold / coldCall / threeBet
  3. Increment action counts for that position
  4. If showdown cards available for V:
     a. Record in showdownLog
     b. Map cards to rangeMatrix index
     c. Set that hand's weight in the observed action range = 1.0
     d. Infer about similar hands (see 10.2)
  5. If sub-actions observable (limp then fold/call/raise):
     a. Increment sub-action counts
```

### 10.2 Range Estimation

After counting actions, estimate ranges:

```
For each position P and action A:
  1. Start with population prior range for A at P
  2. Scale range width to match observed frequency:
     observed_freq = actions[A].count / actions[A].opportunities
     Scale the prior range to match this width
  3. Incorporate showdown evidence:
     For each showdown of hand h in action A at P:
       - Set range[A][h] = max(range[A][h], observed_mixing_weight)
       - Boost similar hands in same range
  4. Apply cross-range constraints:
     For each hand h:
       sum = range.limp[h] + range.open[h] + range.coldCall[h] + range.threeBet[h]
       Normalize so sum + fold_weight ≈ 1.0
  5. Compute PIP deviations vs GTO
```

### 10.3 Hypothesis Testing (Exploit Validation)

Before surfacing an exploit:

```
HYPOTHESIS: "Player's limp range is capped (no premiums)"

TEST:
  Evidence FOR:  N limp-line showdowns, 0 premiums
  Evidence AGAINST: any premium in limp line, any limp-reraise

  Model: Beta(premiums_seen + prior_a, non_premiums_seen + prior_b)
  Prior: a=0.5, b=2 (weak prior: slight lean toward "no premiums")

  After 6 showdowns, 0 premiums:
    P(capped) = Beta(0.5, 8) → mean = 0.06, 95% CI: [0, 0.23]
    "We estimate 6% chance of premium in limp line, could be up to 23%"

  After 15 showdowns, 0 premiums:
    P(capped) = Beta(0.5, 17) → mean = 0.03, 95% CI: [0, 0.12]
    "We estimate 3% chance, could be up to 12% — confident enough to exploit"

  If even 1 premium shows up:
    P(capped) = 0 (certainty: range is uncapped)
    Immediately invalidate any exploit assuming capped range
```

---

## 11. File Structure

```
src/utils/rangeEngine/
  index.js                    // Public API
  rangeProfile.js             // Profile schema, create/serialize/deserialize
  bayesianUpdater.js          // Core Bayesian update logic
  populationPriors.js         // Default priors for live low-stakes
  actionExtractor.js          // Extract actions from hand timeline
  showdownAnalyzer.js         // Process showdown evidence
  crossRangeConstraints.js    // Normalization, mutual exclusivity
  pipCalculator.js            // PIP deviation from GTO
  confidenceEstimator.js      // Confidence tiers and consequence weighting
  __tests__/
    bayesianUpdater.test.js
    actionExtractor.test.js
    showdownAnalyzer.test.js
    crossRangeConstraints.test.js
    pipCalculator.test.js

src/utils/rangeExploits/       // SEPARATE from analysis
  index.js                    // Public API
  exploitGenerator.js         // Generate exploits from profiles
  exploitValidator.js         // Hypothesis testing, consequence checks
  betSizing.js                // Optimal sizing calculations
  potOdds.js                  // Pot odds and EV
  __tests__/
    exploitGenerator.test.js
    exploitValidator.test.js
    betSizing.test.js

src/hooks/
  useRangeProfile.js          // Load/compute range profiles
  useBetSizing.js             // Bet sizing quick-click calculations

src/components/ui/
  RangeGrid.jsx               // 13x13 interactive range display
  PipSummary.jsx              // PIP deviation display
  BetSizeSelector.jsx         // Quick-click bet sizing UI
```

---

## 12. Phased Implementation

### Phase 1: Foundation + Preflop Range Profiling
- 5-position category model
- Action extraction from hand history
- Population priors
- Bayesian frequency updates
- Range profile persistence (new IndexedDB store)
- Seed test data with realistic players
- Basic range width display per position

### Phase 2: Showdown Integration + PIPs
- Showdown evidence extraction (allPlayerCards → range index)
- Hard evidence incorporation (mixing-aware)
- Cross-range constraint propagation
- PIP calculation vs GTO baseline
- PIP summary display
- 13x13 range grid visualization

### Phase 3: Exploit Generation (Separate Layer)
- Hypothesis-driven exploit generation
- Consequence-weighted confidence
- Exploit validation framework
- Sub-action patterns (limp-fold, limp-call, limp-raise)
- Cap detection with Beta distributions
- Exploit cards with data, action, logic, risk

### Phase 4: Bet Amount Tracking + Sizing
- Add amount/potRelative to actionSequence
- Quick-click bet size UI (1/3, 1/2, 3/4, pot, custom)
- Pot tracking during hand
- Per-player sizing profiles
- Value bet and bluff sizing recommendations
- Pot odds calculator

### Phase 5: Postflop Range Narrowing
- Board texture-aware range updates
- Per-street narrowing (preflop → flop → turn → river)
- Fast-play vs slow-play detection
- Board-specific tendencies
- Live range estimate during hand

---

## 13. Seed Data Design

### 13.1 Player Archetypes for Testing

Each archetype has position-aware behavior, showdown cards, and distinctive
patterns that the engine should detect:

```
1. TIGHT MIKE (Nit/TAG)
   - Opens only premiums from EP (QQ+, AKs, AKo)
   - Widens to ~20% from LP but still tight
   - Never limps
   - 3-bets QQ+ only
   - Showdowns: always strong hands
   - Engine should detect: tight ranges, no limp range, narrow 3bet

2. LOOSE LARRY (LAG)
   - Opens ~30% from EP, ~50% from LP
   - Occasionally limps suited connectors from EP
   - 3-bets ~12% (includes light 3bets)
   - Showdowns: wide variety including speculative hands from opens
   - Engine should detect: wide ranges, +3-4 pips across categories

3. LIMPY LOU (Passive fish)
   - Limps ~40% of hands from all positions
   - Rarely opens (only AA, KK)
   - Never 3-bets
   - Limp-calls almost always, limp-folds rarely
   - Showdowns: wide junk in limp line (J7o, T4s, etc.)
   - Engine should detect: huge limp range, near-zero open range
   - Limp range is WIDE but CAPPED (premiums go to open)

4. TRAPPING TOM (Deceptive)
   - Opens ~18% from LP (standard looking)
   - But ALSO limps ~8% including AA/KK ~30% of the time
   - Limp-reraises with premiums
   - Engine should detect: mixing, uncapped limp range, trap flag
   - CRITICAL TEST: engine must NOT assume limp range is capped

5. GTO GARY (Balanced)
   - Plays close to GTO charts by position
   - No limp range
   - Position-aware: tight EP, wide LP, defends BB
   - Engine should detect: near-zero PIP deviations, positionally aware
   - Should trigger few/no exploits

6. STATION SARAH (Calling station)
   - Cold-calls raises very wide (~60% when facing raise)
   - Rarely 3-bets (only AA)
   - Limp-calls everything
   - Never folds to cbets
   - Engine should detect: wide cold-call range, exploitable via value betting
```

### 13.2 Showdown Cards

Each player has specific showdown hands that anchor the range estimates:

```
TIGHT MIKE showdowns:
  - EP open → AKs (confirms strong EP opens)
  - LP open → AJs (confirms broadways in LP)
  - EP open → QQ (confirms premium opens)

LOOSE LARRY showdowns:
  - EP open → 87s (confirms speculative hands in EP opens!)
  - LP open → K7s (confirms wide suited in LP)
  - LP 3bet → AQo (confirms light 3bets)

LIMPY LOU showdowns:
  - Limp from LP → J7o (junk in limp range)
  - Limp from MP → T4s (more junk)
  - Open from EP → AA (premiums only when opening)
  - Limp from LP → 55 (small pair in limp range)

TRAPPING TOM showdowns:
  - Open from LP → AJs (normal open)
  - Limp from LP → AA (TRAP! engine must flag this)
  - Limp-reraise from MP → KK (TRAP confirmed)
  - Open from EP → TT (normal)

GTO GARY showdowns:
  - EP open → AQs (on-chart)
  - LP open → 76s (on-chart for LP)
  - BB defend → K9s (on-chart for BB)

STATION SARAH showdowns:
  - Cold-call → J8s (way too wide)
  - Cold-call → 64s (absurdly wide)
  - Limp-call → Q3o (junk)
```

---

## 14. Performance Considerations

- Range profiles: ~21 KB per player (169 * Float64 * 4 actions * 5 positions)
- Analysis: O(N) per player per hand iteration
- No web workers needed for Phases 1-4
- Phase 5 (live postflop) may benefit from a worker
- Monte Carlo equity: existing chunked async, ~100ms for 5000 trials

---

## 15. Glossary

| Term | Meaning |
|------|---------|
| **PIP** | Position-relative Incremental Point. One tier within a hand category relative to GTO. |
| **Mixing** | Playing the same hand with different actions across instances |
| **Capped** | Range excludes the strongest hands (no monsters possible) |
| **Uncapped** | Range can include very strong hands |
| **Elastic** | Fold frequency changes meaningfully with bet size |
| **Inelastic** | Calls regardless of bet size (calling station behavior) |
| **Fast-play** | Betting/raising immediately with strong hands |
| **Slow-play/Trap** | Passive action (check/call/limp) with strong hands |
| **Iso-raise** | Raising to isolate a single limper heads-up |
| **Population prior** | Starting assumption based on typical live player behavior |
| **Hard evidence** | Showdown observation — hand confirmed in range with certainty |
| **Consequence weight** | Higher-risk exploits require more evidence |
