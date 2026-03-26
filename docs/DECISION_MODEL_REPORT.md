# Decision Modeling System — Technical Report

## Executive Summary

The poker tracker's decision modeling pipeline is a multi-layer Bayesian system that transforms raw hand observations into villain behavioral models and hero action recommendations. It deliberately separates **what the villain does** from **what hero should do** — a design choice rooted in poker theory where the same villain weakness can demand different hero responses depending on board, position, stack depth, and hand.

The system excels at graceful degradation under sparse data, small-sample correctness, and context-sensitive modeling. It avoids the generic statistical traps (z-tests, linear assumptions, single-number summaries) that plague naive poker analysis.

---

## Architecture Overview

```
Raw Hand Data
    │
    ▼
┌──────────────────────┐
│  Decision Accumulator │  7-dimensional situation bucketing
│  (decisionAccumulator)│  street × texture × position × aggressor × IP × facing × action
└──────────┬───────────┘
           │
    ▼──────┴──────▼
┌─────────────┐  ┌─────────────────┐
│ Bayesian    │  │ Villain Decision │  Hierarchical Bayesian smoothing
│ Confidence  │  │ Model            │  6-level fallback from full context → prior
│ (Beta-CDF)  │  │ (Dirichlet)      │
└──────┬──────┘  └────────┬────────┘
       │                  │
       ▼                  ▼
┌─────────────┐  ┌─────────────────┐
│ Weakness    │  │ Game Tree       │  Depth-1 EV computation
│ Detector    │  │ Evaluator       │  per hero action candidate
└──────┬──────┘  └────────┬────────┘
       │                  │
       ▼                  ▼
┌──────────────────────────────────┐
│        Exploit Generator          │  Scoring: confidence × impact × risk dampening
│     + Live Action Advisor         │  Data quality gating before delivery
└──────────────────────────────────┘
```

Each layer has a single responsibility. No layer reaches past its neighbor.

---

## Where the System Excels

### 1. Hierarchical Bayesian Smoothing (Villain Decision Model)

The villain decision model queries a 6-level hierarchy for action distributions:

| Level | Context Dimensions | Example |
|-------|-------------------|---------|
| L1 | street + texture + position + aggressor + IP + facing | "Flop, wet, late position, defender, OOP, facing c-bet" |
| L2 | Drop texture | "Flop, any texture, late, defender, OOP, facing bet" |
| L3 | Drop IP/OOP | "Flop, any texture, late, defender, facing bet" |
| L4 | Drop position | "Flop, any texture, defender, facing bet" |
| L5 | Drop aggressor | "Flop, facing bet" |
| L6 | Population prior only | "Typical 1/2 live player" |

**Why this matters:** A villain with 30 total postflop decisions may have only 2 observations of "facing a c-bet on a wet flop in position as the defender." The hierarchy borrows strength from coarser slices rather than defaulting to either pure prior or unreliable point estimates.

**Transition thresholds:**
- **n < 3 at a level**: Falls through to the next level (MIN_EFFECTIVE_N = 3)
- **n = 10**: Data and prior are equally weighted (pseudocount = 10)
- **n = 30+**: Data dominates; model is "established"

**Sample case:** Villain has been seen 25 times. 8 of those are postflop situations facing a bet. Only 3 are on wet boards. The model uses L1 for wet boards (barely meets threshold), L2 for dry boards (collapses texture), and the blend naturally weights toward population priors more heavily where data is sparse.

### 2. Exact Bayesian Inference (Not Approximations)

The confidence system uses the **regularized incomplete Beta function** — exact Beta-Binomial posteriors, not normal approximations or z-tests.

```
P(true_fold% > 60% | 7 folds in 10 observations) = 1 - I_x(α + k, β + n - k)
```

where α, β come from per-stat population priors (e.g., VPIP: Beta(2.5, 7.5), C-Bet: Beta(5.5, 4.5)).

**Why this matters:** At n=10, a z-test would produce wildly overconfident p-values. The Beta posterior correctly reflects that 10 observations barely distinguish a 55% folder from a 70% folder.

**Continuous confidence curve:**
```
confidence = 0.10 + 0.83 × (1 - e^(-n/12))
```

| Hands Observed | Confidence | Quality Tier |
|---------------|------------|-------------|
| 0 | 0.10 | none |
| 5 | 0.38 | speculative |
| 10 | 0.57 | speculative |
| 20 | 0.77 | developing |
| 30 | 0.86 | established |
| 50 | 0.92 | established |
| ∞ | 0.93 | asymptote (prior never fully eliminated) |

The asymptote at 0.93 encodes the epistemological truth that you never fully know an opponent — they can always change gears.

### 3. Contextual Decision Tracking (7-Dimensional Bucketing)

Every postflop decision is indexed by 7 dimensions:

```
street : texture : posCategory : isAggressor : isIP : facingAction : contextualAction
```

**Contextual actions** are derived, not raw:
- Aggressor bets → `cbet`
- Defender bets → `donk`
- Aggressor checks → `check_give_up`
- After checks, opponent bets → `stab`

This distinction is critical. A bet after checking means something completely different from a continuation bet. Collapsing them into "bet" destroys the signal.

**Range narrowing per bucket:** Each accumulated decision carries an `avgSegmentation` — the average breakdown of the villain's range into nuts/strong/marginal/draw/air when they take that action in that situation. This is computed by narrowing their preflop range through the board and action, then segmenting.

### 4. Game Tree EV (Not Rule-Based Recommendations)

The game tree evaluator computes EV for each candidate hero action:

```
EV(bet) = P(fold) × pot
        + P(call) × (heroEquity_vs_callRange × totalPot × realization - betSize)
        + P(raise) × (bestResponseEV - betSize)
```

**Key design choices:**

- **Bucket equity anchors** approximate sub-range equity without per-bucket Monte Carlo:
  - vs Nuts: 8%, vs Strong: 30%, vs Marginal: 55%, vs Draw: 50%, vs Air: 88%
  - Anchors are **scaled** so weighted average = base equity, then recalculated after removing fold/call/raise sub-ranges

- **MC refinement only for top 2 candidates** — keeps total compute under 135ms

- **Equity realization discounting** by street and position:
  - Flop OOP: 70% realization (you'll be outmaneuvered on later streets)
  - River IP: 100% (no more streets to lose value)

**Sample case — why game tree beats rules:**

A villain "folds too much" (weakness detected: 55% fold rate on flop). A rule-based system says "bluff more." But hero holds K♠Q♠ on A♥7♦2♣. The game tree computes:
- P(fold) = 55% × pot = +EV from fold equity
- P(call) = 35% × (equity vs their calling range × pot - bet) — but their calling range is heavy Ax, so hero equity is ~25%
- **Net EV of bluffing: negative.** The fold equity doesn't overcome the poor equity when called.

The game tree correctly identifies that this is a "minimize losses" spot despite the villain weakness.

### 5. Weakness ≠ Exploit Separation

Weaknesses describe what the **villain** does wrong. Exploits describe what **hero** should do. These are never conflated.

| Weakness (Villain Observation) | NOT automatically... | Actual Exploit (Computed by Game Tree) |
|-------------------------------|---------------------|---------------------------------------|
| "Folds to pressure >55%" | "Bluff more" | Depends on hero hand, board, pot odds |
| "C-bets 80% on wet boards with 65% air" | "Raise c-bets" | Depends on hero equity, position, stack depth |
| "Never raises with strong hands" | "Bet big for value" | Depends on whether villain calls wider (station) or folds wider |
| "Calls too wide" | "Bluff less" | Actually: value bet wider AND bigger (uncapped calling range) |

The calling station example is particularly important. A naive system says "they call too much, don't bluff." The correct analysis: their calling range is **uncapped** (they slowplay everything), so the exploit is to **widen value bets and increase sizing**, not just reduce bluffs.

### 6. Data Quality Gating (Preventing Overconfident Bad Advice)

The live action advisor applies progressive gating:

| Sample Size | Quality Tier | Gating Behavior |
|-------------|-------------|-----------------|
| 0 hands | "none" | All recommendations tagged `[population estimate]` |
| 1-9 hands | "speculative" | Suppress fold-equity-only raises (bluffs with no backup plan) |
| 10-29 hands | "developing" | Full recommendations, labeled with confidence |
| 30+ hands | "established" | Full recommendation set, high confidence |

**Why suppress fold-equity bluffs under 10 hands:** A bluff that relies entirely on villain folding is catastrophic when the fold% estimate is wrong. With <10 observations, fold% confidence is ~0.50 — essentially a coin flip. The system gates these high-consequence, low-evidence plays.

---

## Noteworthy Transitions

### Prior → Data Dominance

```
Effective weight of observed data = n / (n + pseudocount)

n=0:   0%  data  (pure population prior)
n=3:   23% data  (first hierarchy level unlocks)
n=10:  50% data  (equal weighting — key transition)
n=30:  75% data  (model considered "established")
n=100: 91% data  (prior is minor correction)
```

The population priors (Dirichlet pseudocount = 10) encode "typical 1/2 live player":
- Facing no bet: 45% check, 55% bet
- Facing a bet: 45% fold, 40% call, 15% raise
- Facing a raise: 55% fold, 35% call, 10% raise

These priors are deliberately calibrated to low-stakes live play — not online, not high-stakes.

### Hierarchy Collapse Under Sparse Data

When a villain has 50 total decisions but only 2 in a specific L1 context:

```
L1 (full context):     n=2  → SKIP (below MIN_EFFECTIVE_N=3)
L2 (drop texture):     n=7  → USE (meets threshold, blend with prior)
L3 (drop IP):          n=12 → available but not needed
...
L6 (population prior): always available as backstop
```

The system never fabricates certainty from insufficient data. It explicitly acknowledges which level it's operating at and returns a `source` field.

### Preflop vs Postflop Decision Paths

```
┌─────────────────┐
│  Is street       │
│  preflop?        │
└───────┬─────────┘
   yes  │    no
   ▼    │    ▼
┌───────┐  ┌──────────────────┐
│Preflop│  │ Postflop Pipeline │
│Advisor│  │ (game tree +      │
│(stat- │  │  villain model +   │
│ based)│  │  range narrowing)  │
└───────┘  └──────────────────┘
```

Preflop uses stat-based fold estimation (VPIP, PFR, style classification, position priors) because the postflop pipeline requires board cards. The preflop advisor:
- Builds a baseline range from VPIP/PFR scaled against population prior
- Runs 1000-trial Monte Carlo (random runouts) for equity
- Estimates fold% from observed `foldTo3Bet` (if n≥5) or population prior + style adjustment
- Style multipliers: Fish/LP fold 40% less than population; Nits fold 15% more

### Confidence Gating Thresholds in Exploit Scoring

```
worthiness = confidence × impact × (1 - risk × (1 - confidence))
```

The `(1 - risk × (1 - confidence))` term is a dampening function:
- **High risk + low confidence** → heavy dampening (e.g., 0.7 risk × 0.7 uncertainty = 49% reduction)
- **Low risk + high confidence** → minimal dampening
- **High risk + high confidence** → acceptable (the evidence supports the risky play)

Priority tiers from composite score:
- ≥ 0.60: HIGH priority
- ≥ 0.35: MEDIUM priority
- < 0.35: LOW priority

### Personalized Multipliers from Showdown Data

When enough showdown data accumulates, `derivePersonalizedMultipliers()` replaces population-wide ACTION_MULTIPLIERS:

```
Population default: bet → {nuts: 0.35, strong: 0.30, marginal: 0.20, draw: 0.10, air: 0.05}
Observed villain:   bet → {nuts: 0.10, strong: 0.15, marginal: 0.20, draw: 0.15, air: 0.40}
                    ^ This villain bets with way too much air — widen calling range
```

The blend uses the same pseudocount weighting as the rest of the system, so it converges smoothly.

---

## Sample Walkthrough: Full Pipeline in Action

**Scenario:** Hero holds J♥T♥ on K♠9♥3♦ flop. Villain (UTG opener) c-bets 60% pot. 30 hands of history.

1. **Decision Accumulator** has 30 hands bucketed. 8 flop c-bet spots on dry/medium boards as aggressor.

2. **Villain Decision Model** queries L1: "flop, dry, early, aggressor, IP, facing no action → cbet."
   - n=8 at L1 (meets threshold). Blend: 8/(8+10) = 44% data, 56% prior.
   - Observed c-bet 75% (6/8). Population prior: 55%. Posterior: ~63%.
   - Their c-bet range segmentation: 20% nuts, 25% strong, 20% marginal, 15% draw, 20% air.

3. **Weakness Detector** checks: 20% air is within normal range (threshold is 25%). No "c-bets unprofitably" flag.

4. **Game Tree Evaluator** generates candidates:
   - **Fold**: EV = 0
   - **Call**: equity vs c-bet range ≈ 42% (gutshot + backdoor flush + overcards). EV = 0.42 × (pot + call) - call
   - **Raise to 2.5x**: queries villain model for "facing raise" → P(fold)=48%, P(call)=38%, P(reraise)=14%
     - Fold branch: 48% × pot = good
     - Call branch: equity vs calling range (drops air, some marginals) ≈ 35%
     - Net EV computed

5. **Result**: Call is highest EV. Reasoning: "42% equity with drawing potential — correct call at these pot odds."

6. **Data Quality**: 30 hands = "established" tier. No gating applied. Confidence: 0.86.

---

## Design Principles Preserved

| Principle | How Enforced |
|-----------|-------------|
| Bayesian over frequentist | Beta-CDF exact inference; Dirichlet priors; no z-tests anywhere |
| Population priors as starting point | Every model starts from calibrated 1/2 live priors |
| Consequence-weighted confidence | worthiness formula dampens high-risk plays with low evidence |
| Weakness ≠ Exploit | Separate layers; weakness carries no hero action labels |
| Position matters | Every decision bucket includes position category |
| Calling station ≠ weak range | Segmentation distinguishes "calls wide" from "calls weak" |
| Fold equity ≠ fold frequency | Full EV formula includes equity-when-called |
| Graceful degradation | 6-level hierarchy; continuous confidence; progressive gating |

---

## Known Limitations

1. **Depth-1 tree only** — doesn't model multi-street consequences (e.g., "if I bet flop and get called, what happens on turn?"). Equity realization discounting partially compensates.

2. **Bucket equity anchors are static** — the calibrated anchors (nuts=8%, air=88%) work well for typical spots but can be off in extreme board textures.

3. **Preflop uses separate path** — the postflop pipeline (game tree + villain model) doesn't run preflop because it requires board cards. The preflop advisor is simpler and stat-based.

4. **Style classification lag** — style labels (TAG, LAG, Fish, Nit) update with tendencies, which require cross-session data. Early sessions use "Unknown" style, which gets no fold% adjustment.

5. **No multi-way modeling** — the system is heads-up focused. In multi-way pots, it models only the primary villain.
