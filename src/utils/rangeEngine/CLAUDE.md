# Range Engine — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read `.claude/context/POKER_THEORY.md` first.

This engine builds Bayesian player range models from observed actions. It is the analytical foundation — exploits are generated SEPARATELY in `exploitEngine/`.

## Core Principles

### 1. Bayesian, Not Frequentist
We use population priors (what typical 1/2 players do) updated by observations. With 3 hands of data, the prior dominates. With 30 hands, data dominates. We NEVER use p-values or z-tests in this engine. See `bayesianUpdater.js`.

### 2. Mixing Is Real — Never Zero Out Hands
A player can play the same hand different ways. AA can be limped (trap), opened, or 3-bet. When we see AA in the open range, we DO NOT set its weight in the limp range to zero. We only increase confidence that it's in the open range. See `RANGE_ENGINE_DESIGN.md` §4.3.

### 3. Cross-Range Constraint: Per-Scenario Normalization
The two decision trees are normalized independently:
- **No raise faced**: `P(limp|h) + P(open|h) ≤ 1.0` per cell (fold is the complement)
- **Facing a raise**: `P(coldCall|h) + P(threeBet|h) ≤ 1.0` per cell (fold is the complement)

The two scenarios are independent — a player's open range tells you nothing about their cold-call range. Fold is not stored as a grid; it is derived within each scenario. This is enforced in `crossRangeConstraints.js`.

### 4. Two Independent Decision Trees
Preflop has two fundamentally different situations:
- **No raise faced**: fold / limp / open raise
- **Facing a raise**: fold / cold-call / 3-bet

These are separate decision trees with separate frequency tracking. A player's open range tells you NOTHING about their cold-call range. See `subActionExtractor.js`.

**Note**: Squeeze (vs raise + caller(s)) is documented in the design spec but not yet implemented in `RANGE_ACTIONS`.

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
| `actionExtractor.js` | Parse hand timeline into preflop actions | Postflop actions |
| `subActionExtractor.js` | Parse limp follow-up patterns | Direct range updates |
| `crossRangeConstraints.js` | Normalize weights to sum ≈ 1.0 | Override showdown evidence |
| `pipCalculator.js` | Compute PIP deviations vs GTO | Generate recommendations |
| `traitDetector.js` | Detect behavioral flags from patterns | Modify ranges |
| `rangeProfile.js` | Schema, create, serialize, deserialize | Compute anything |
| `index.js` | Public API surface | Internal implementation |
