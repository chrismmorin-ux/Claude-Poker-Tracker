# Range Engine — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read `.claude/context/POKER_THEORY.md` first.

This engine builds Bayesian player range models from observed actions. It is the analytical foundation — exploits are generated SEPARATELY in `exploitEngine/`.

## Core Principles

### 1. Bayesian, Not Frequentist
We use population priors (what typical 1/2 players do) updated by observations. With 3 hands of data, the prior dominates. With 30 hands, data dominates. We NEVER use p-values or z-tests in this engine. See `bayesianUpdater.js`.

### 2. Mixing Is Real — Never Zero Out Hands
A player can play the same hand different ways. AA can be limped (trap), opened, or 3-bet. When we see AA in the open range, we DO NOT set its weight in the limp range to zero. We only increase confidence that it's in the open range. See `RANGE_ENGINE_DESIGN.md` §4.3.

**The priors themselves obey this too (WS-302).** For years the rule was enforced on updates while `populationPriors.js` was violating it at construction — the positional charts zeroed 30-37% of the grid, and the 3-bet prior 97% of it. That is worse than an update-time zero, because §1's update rule is `prior[i] * ratio`: a cell that *starts* at zero can never be lifted by any amount of frequency evidence. `withEquitySupport` now gives every prior positive weight on all 169 cells, ranked by per-combo preflop equity, at unchanged range width.

**Structural zero vs epistemic zero — the distinction that decides whether a zero is a bug.**

| | Means | Example | Treatment |
|---|---|---|---|
| **Epistemic** | The hand is *unlikely* in this range | UTG opening 84s | Gets support. A zero here is a bug. |
| **Structural** | The scenario *cannot occur* | BB limping (§5) | Stays exactly zero. A floor here is a bug. |

The discriminator is mechanical rather than a hand-kept list: a grid that is *identically* zero is structural, and passes through untouched. Note that `BB.limpReraise` is **not** structural by this test — its grid is a non-zero *shape*, and what empties it is `SUBCLASS_SPLIT.threeBet.BB.limpReraise = 0` applied downstream in `updateSubclassRanges`. Two different mechanisms; do not conflate them.

### 3. Cross-Range Constraint: Per-Scenario Normalization
The three decision trees are normalized independently:
- **No raise faced**: `P(limp|h) + P(open|h) ≤ 1.0` per cell (fold is the complement)
- **Facing a raise**: `P(coldCall|h) + P(threeBet|h) ≤ 1.0` per cell (fold is the complement)
- **Facing a 3-bet**: `P(call4|h) + P(fourBet|h) ≤ 1.0` per cell (fold is the complement)

The scenarios are independent — a player's open range tells you nothing about their cold-call range, and neither tells you about their 4-bet range. Fold is not stored as a grid; it is derived within each scenario. This is enforced in `crossRangeConstraints.js`.

Normalization runs in **two passes**. Pass A normalizes the retained parents exactly as above. Pass B enforces **containment** — per cell, every subclass ≤ its parent and `Σ subclasses ≤ parent` — scaling *only* subclass grids. This subsumes the sibling-headroom rule rather than restating it: Pass A has already established `sibling + parent ≤ 1.0`, so `Σ subclasses ≤ parent` yields `sibling + Σ subclasses ≤ 1.0` for free. Parents are held fixed, which is what keeps `open` / `threeBet` / `coldCall` / `limp` bit-identical to their pre-taxonomy values.

### 4. Three Independent Decision Trees + Derived Subclasses
Preflop has three fundamentally different situations, **selected by the raise count already in the sequence** — not by a boolean, which can only separate two:
- **0 raises — no raise faced**: fold / limp / open raise
- **1 raise — facing a raise**: fold / cold-call / 3-bet
- **2+ raises — facing a 3-bet**: fold / call4 / 4-bet  *(WS-521 / WS-270)*

These are separate decision trees with separate frequency tracking and separate opportunity counters. A player's open range tells you NOTHING about their cold-call range. See `subActionExtractor.js`.

**A seat that cold-calls a 3-bet is `call4`, not `coldCall`** — the price and the opposing range make it a different decision, and `sequenceUtils.wouldBeColdCall` (a street-generic affordance predicate that cannot count raises) deliberately diverges from the taxonomy here.

Since WS-256 each raise parent carries **derived subclasses**, classified in `lineTaxonomy.js` from sequence state (never hand labels, never position labels):

| Parent | Subclasses |
|--------|-----------|
| `open` | `openFirstIn` (nobody entered) · `isoRaise` (over ≥1 limper) |
| `threeBet` | `cold3Bet` (no callers between) · `squeeze` (≥1 caller between) · `limpReraise` (limped earlier this hand) |
| `fourBet` | `cold4Bet` (no prior voluntary action) · `fourBetAfterOpen` (this seat raised earlier) |

**Parents keep their pre-taxonomy meaning exactly** — every existing consumer of `open` / `threeBet` is unaffected. Full doctrine and range-shape expectations: [`POKER_THEORY.md §2.5`](../../../.claude/context/POKER_THEORY.md), ratified in DEC-025.

Three rules bind here:
1. **Subclasses shrink toward their parent** (§2.5.3), never toward an independent flat prior — in BOTH dimensions. The split is estimated against the parent's own count (`n_parent`, not the scenario-wide `N`), and the grid is **carved out of the parent's grid**, never built beside it. `updateSubclassRanges` in `bayesianUpdater.js`. A zero-observation subclass reproduces its parent's share; a child can never exceed its parent. Deriving subclass grids independently was the WS-256 review defect (DEC-025 Amendment 1) — it let `limpReraise[QQ] = 1.00` stand against `threeBet[QQ] = 0.58`.
2. **One hand can yield several decision points** (§2.5.4). A limp-reraise emits BOTH `limp` and `limpReraise` — the limp emission is load-bearing, since dropping it would make the limp range read as capped and invert §5.8's trap doctrine.
3. **`blind3Bet` is deliberately NOT a class.** Posted money is already carried by the position dimension, so a no-callers-between 3-bet from SB/BB *is* the blind case; the wider/merged shape lives in the `SB`/`BB` `cold3Bet` prior. Straddler 3-bets are the documented residual.

**Modelled since WS-521 / WS-270**: facing a 3-bet is the third scenario above. A raise over two or more prior raises is now the `fourBet` parent — it no longer counts in `threeBet` with `subAction: null`, so §2.5.3's `totalShare < 1` residual is claimed. The tree is priced by `FACED_3BET_FREQUENCIES_BY_ROLE` (measured, n = 6,531 over opener / cold / passive), blended over the villain's OWN realised role mix — see `faced3BetPopFreqs`. `FOUR_BET_FREQUENCIES` is **VESTIGIAL since the WS-521 follow-up (§2.5.5a) and has zero production readers**; this line used to call it the only measured table and that is no longer true. It is NOT dead weight and must not be deleted — it is the independent cross-check that licenses the `cold` and `passive` rows. Read POKER_THEORY §2.5.5a before touching either table.

**Still not modelled**: `overCall` (calling behind an existing caller). It was deferred *with* WS-270 in POKER_THEORY §2.5.5's previous text and is named in no ticket.

### 5. BB Has No Voluntary No-Raise Scenario
When BB checks without facing a raise, this is not a voluntary action — it's a forced option. BB is excluded from the no-raise decision tree: `NO_RAISE_FREQUENCIES.BB` is all zeros, and `actionExtractor.js` returns null for BB checks with no raise faced. This is correct poker theory — do not attempt to "fix" it.

### 6. Showdown Evidence Is Sacred
A showdown observation is the strongest possible evidence. When we see a hand at showdown:
1. Set its weight in the observed action to 1.0 (certainty)
2. Apply outcome-aware semantic boosting to similar hands: winning showdowns boost neighbors more strongly (0.30/0.25/0.20 for same category/nearby/broad) than losing showdowns (0.15/0.10/0.08), reflecting that winning hands are more likely to be in the player's intentional range
3. DO NOT reduce its weight in other action ranges (they might mix)
4. Record in `showdownAnchors` for permanent reference

## Anti-Patterns

### DO NOT use uniform priors
Population priors reflect what real 1/2 players do. A uniform prior says "AA is equally likely to be limped as folded from UTG" — this is absurd. Our priors encode that most players open premiums, limp speculative hands, and fold junk. See `populationPriors.js`.

### DO NOT treat positions as interchangeable
UTG opens ~12%, BTN opens ~35%, BB defends ~40%. The same hand (e.g., KTs) might be a fold from UTG, an open from CO, and a 3-bet from BTN. All range estimation is per-position. See the 5-category model in `RANGE_ENGINE_DESIGN.md` §3.

### DO NOT collapse suited/offsuit
AKs and AKo are fundamentally different hands. AKs has ~3% more equity AND much better equity realization (flush draws, flush potential). Suited hands are in wider ranges than their offsuit counterparts. The 13x13 grid separates these (upper triangle = suited, lower = offsuit).

### DO NOT assume GTO
Our priors are POPULATION priors, not GTO. A typical 1/2 player limps small pairs, opens with broadways, and 3-bets only QQ+/AK. GTO opens wider, never limps, and 3-bets a polarized range. Using GTO as the prior would produce wildly wrong estimates for most live players.

### DO NOT treat observation counts as confidence directly
5 observations with 2 showdowns is MORE informative than 15 observations with 0 showdowns. Showdowns affect range weights via anchoring (setting weight to 1.0 with semantic boosting), providing stronger evidence than frequency observations alone. See `RANGE_ENGINE_DESIGN.md` §4.6.

### DO NOT narrow ranges by bucket label (AP-RL-01)
Range-narrowing decisions (how villain's range shrinks turn → river given a betting line) MUST be computed per-combo — equity update conditional on villain's action profile + board card — NOT from bucket-label heuristics like `if (combo.bucket >= TPGK_BUCKET)` or `POP_NARROWING_RATES[bucket]`. Bucket-keyed narrowing hides per-combo variance, which is the entire value of DS-54 multi-street range evolution. The doctrine generalizes to any range-narrowing code in the codebase, not just Range Lab. Full doctrine: [`POKER_THEORY.md §7.6 (AP-RL-01)`](../../../.claude/context/POKER_THEORY.md#76-range-narrowing-per-combo-derivation-not-bucket-heuristics-ap-rl-01).

## Key Concepts

### Population Priors
Starting beliefs based on typical live 1/2 behavior. ~10 virtual observations of weight (`PRIOR_WEIGHT = 10`) — a player needs ~10 real observations before data dominates the prior. Purpose: reasonable estimates when n < 10.

### PIPs (Position-relative Incremental Points)
Quantify how a player deviates from GTO within hand categories. "+2 pips pairs from LATE" = opens two extra pair tiers beyond GTO (e.g., 33+ instead of 55+). Computed in `pipCalculator.js`.

### Trait Detection
Binary behavioral traits detected from patterns:
- `trapsPreflop`: plays premiums in passive lines (limp AA, limp-reraise KK)
- `splitsRangePreflop`: same hand observed in multiple action lines
- `positionallyAware`: significantly different ranges by position (LP open rate > 1.5x EP open rate)

These traits are detected in `traitDetector.js` and fed to the exploit engine for modification.

### Sub-Action Patterns
What happens AFTER a limp reveals information ABOUT the limp range:
- High limp-fold → range includes hands they abandon (weak)
- High limp-call → range is "sticky" (medium, willing to see flop)
- Any limp-reraise → range is UNCAPPED (can contain monsters)

Extracted in `subActionExtractor.js`, summarized per position.

## File Responsibilities

| File | Does | Does NOT |
|------|------|----------|
| `bayesianUpdater.js` | Update range weights from observations | Generate exploits |
| `populationPriors.js` | Define starting range assumptions | Use GTO as baseline |
| `lineTaxonomy.js` | Derive preflop line tags from sequence state (§2.5) | Read hand records, positions, or showdowns |
| `actionExtractor.js` | Seat/position/showdown resolution + per-decision-point records | Classify lines (delegates to `lineTaxonomy`); postflop actions |
| `subActionExtractor.js` | Parse limp follow-up patterns | Direct range updates |
| `crossRangeConstraints.js` | Normalize weights to sum ≈ 1.0 | Override showdown evidence |
| `pipCalculator.js` | Compute PIP deviations vs GTO | Generate recommendations |
| `traitDetector.js` | Detect behavioral flags from patterns | Modify ranges |
| `rangeProfile.js` | Schema, create, serialize, deserialize | Compute anything |
| `index.js` | Public API surface | Internal implementation |
