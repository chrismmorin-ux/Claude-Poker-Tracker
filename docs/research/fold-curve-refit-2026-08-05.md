# The fold curve was mis-anchored and capped — WS-283

Date: 2026-08-05 · Program: `domain-correctness` · Result Card:
`fold-curve-refit-2026-08-05.result-card.json` (`RC-WS283-FOLD-CURVE-SHAPE-2026-08-05`)
Follows: `engine-backtest-run-2026-07-26-pool-reference.md` Finding 2

> **CAVEAT, BINDING, REPEATED AT EVERY NUMBER.** Every figure below comes from the HandHQ
> corpus: **online cash only, July 2009, 50NL, Full Tilt + PokerStars, 3–9 handed**
> (SRC-011). The founder plays **live 9-handed 1/2–1/3**. Any claim about that game is
> **TRANSFERRED, not measured** — the top-ranked entry of the Suspected-Fault Register.
> This run changes the **shape** of the fold response and deliberately changes **no fold
> rate level**; see "What was deliberately not done".

## The ticket's premise was half right, and the half it got wrong matters

WS-283 said the model predicts a nearly flat ~45% fold rate across sizing buckets while the
field's rate climbs 41.5% → 58.0% → 84.6%, and diagnosed `logisticFoldResponse`'s `maxDelta`
and `midpoint`.

**The flatness is real. The attribution was wrong.** The number that filed the ticket came
from `scripts/backtest/run.mjs`, which scores `queryActionDistribution(model, street,
texture, posCategory, isAgg, isIP, facingAction, options)`. There is **no bet-size argument
in that signature**, and no bet size anywhere in the path behind it — `sizeBucket` is a
reporting slice applied afterwards. The prediction is independent of sizing *by
construction*, exactly flat, and the fold curve is not on that path at all. So:

- No change to the fold curve can move that harness's numbers. Re-running it would return a
  bit-identical lift — the same signature Finding 0 already used to establish that the
  Reference tier is inert. The de-confounding run the accept criteria ask for was performed
  and reported on 2026-07-26 (Finding 0, bit-identical to 16 significant figures), and it
  implicated neither the Reference tier nor the curve.
- The **fold curve is nonetheless wrong**, on the *production* fold-equity path, which is
  where the ticket's stated consequence (under-bluffing, under-sizing) actually lives. That
  is what was measured and fixed here, on an instrument built for the purpose.

## What was measured

An independent corpus pass over all 1,756 files / 1,070,493 hands, collecting every postflop
decision at which a seat faced a live bet: 1,139,119 decisions. Bet size is expressed on the
engine's own axis, `bet / pot-excluding-that-bet`, because the WS-273 report's `sizeBucket`
divides by the pot *including* it — two different numbers that look alike, and the confusion
is why the ticket's "33–66%" bucket is really `bet/pot ∈ [0.49, 1.94)`.

Leakage guard, **structural and two-level** — the fit function is never handed a scored row:

| | rows | k / n | marginal fold |
|---|---|---|---|
| **fit** | POOL players, days 1–11 | 98,273 / 178,174 | 0.5516 |
| **hold-out** | EVAL players, days 12–23 | 178,794 / 318,347 | 0.5616 |

## Root cause: two shape defects, neither reachable by a base-rate correction

**1. The anchor sat 0.40 pot-fractions too high.** `logisticFoldResponse` returns `baseFold`
at `fraction === midpoint` and nowhere else, while every caller passes an *unconditional*
fold rate. The midpoint must therefore be the sizing at which the field's conditional fold
rate equals its unconditional one. That is **0.35× pot** (over 0.30–0.70 the field folds
55.5% against a marginal of 56.1%), not 0.75× — at 0.70–1.00 it folds 60.7%, 4.6pp *above*
the marginal. Anchored at 0.75 on a curve with a steep left limb, the model subtracted from
the base at every sizing below it, and **71% of bets are below 0.75× pot**. This is why the
error changed *sign* with sizing instead of being a constant offset.

The docblock had said `baseFold` was "the fold rate at the reference size (half-pot)" while
the midpoint was 0.75 — the stated contract and the code disagreed for the life of the
parameter. Third instance of the shape `exploitEngine/CLAUDE.md` records: a label asserting
something the values contradict, with nothing checking.

**2. `maxDelta` capped the swing below the signal.** It bounds the *total* achievable swing.
At 0.25 the curve could span 25 points of fold rate across all sizings while the field spans
**~78** (6.4% at a 0.03× bet, 84.2% at 2.0×). No `midpoint` or `steepness` could have fitted
that; the ceiling itself was the defect, which is why the ticket's "refit the curve" is the
right instruction and "shift the base rate" was never going to work.

| | before | after |
|---|---|---|
| `maxDelta` | 0.25 | **0.95** |
| `midpoint` | 0.75 | **0.35** |
| `steepnessUp` / `steepnessDown` | 4.0 / 2.0 | **6.5 / 0.75** |
| `steepness` (symmetric fallback) | 3.0 | **1.0** |

## Residual versus sizing — before and after

Intercept calibrated out, so only shape is scored. **The slope is the number the ticket turns
on**: a flat offset that makes the average right while leaving the sizing dependence intact
is the bug restated.

```
HOLD-OUT (EVAL players, days 12-23, n = 318,347)
  n-weighted slope of (observed - predicted) on bet fraction   +0.1409  ->  +0.0078
  Brier                                                         0.24054 ->   0.23530
```

On the ticket's own three buckets, hold-out, base calibrated to the observed marginal:

| bucket | bet/pot | n | k | actual | before | after |
|---|---|---|---|---|---|---|
| 0–33 | < 0.4925 | 113,599 | 52,475 | 46.2% | −1.4pp | −1.6pp |
| **33–66** | 0.4925–1.9412 | 202,261 | 124,399 | **61.5%** | **+6.1pp** | **−2.0pp** |
| 66–100 | ≥ 1.9412 | 2,487 | 1,920 | 77.2% | +9.8pp | −8.2pp |

Per street, and on the adjacent population the curve is also applied to:

| slice | n | slope before → after | Brier before → after |
|---|---|---|---|
| flop | 181,424 | +0.0763 → −0.0358 | 0.23803 → 0.23668 |
| turn | 87,257 | +0.2123 → +0.0549 | 0.24267 → 0.23405 |
| river | 49,666 | +0.1697 → +0.0222 | 0.23820 → 0.22844 |
| facing a **raise** (never merged into the fit) | 45,293 | +0.1842 → +0.0522 | 0.23210 → 0.22007 |

**The inverse conditional, because it reads the opposite way.** P(fold | big bet) is high;
P(big bet | fold) is tiny. Of all folds in the fit set, only **1.2%** came against bets ≥ 2×
pot and 33.3% against bets under half pot. Both are true. A reader who takes "villains fold
84% to overbets" as licence to overbet is reading the first and ignoring that the base rate
of the opportunity — from the corpus's own sizing distribution, not the model's — is 0.4%.

## What was deliberately not done

- **No fold-rate LEVEL changed.** `POPULATION_PRIORS.bet.fold` and `STAT_PRIORS.foldToCbet`
  (0.45, founder estimates of the *live* pool) are untouched. With the base pinned at 0.45,
  the 33–66 bucket error goes +17.3pp → +9.2pp: the shape correction closes about half, and
  the remaining ~9pp is the live-vs-online base-rate gap, which under the ratified WS-259
  separation this corpus may not close. The corpus supplies the gradient; the §6.5a hierarchy
  supplies the level.
- **`FOLD_CURVE_STREET_MODS` values are unchanged.** Refit per street, all three streets
  return essentially the same shape (`maxDelta` 0.95/1.00/0.95, `midpoint` 0.35/0.35/0.35),
  and applying the shipped multipliers on top of the fitted curve is *worse* on the hold-out
  (flop 0.23668 → 0.23723, river 0.22844 → 0.22885). At ~5e-4 that is an order of magnitude
  under the population-curve effect — a null result, not a licence to invert them. What was
  removed is the **assertion**: the poker-theory justification ("flop → lower midpoint …
  river → higher midpoint, sharper sigmoid") is refuted and is now recorded as an unsupported
  tie-break, per Finding 3b's own prescription.
- **The functional form is unchanged.** Below ~0.15× pot the fitted curve still over-predicts
  folding by 3–13 points; a bounded logistic in raw pot fraction cannot reach a 6% floor.
  The principled fix is to re-express it in the price villain is offered, `s / (1 + 2s)`
  (§6.2) — the variable §11.4 already uses preflop — but that is a much wider change.
- **Per-style curves remain a founder estimate.** `computeFoldCurveForStyle`'s multipliers
  carried a comment claiming they were "calibrated against live 1/2 showdown data". No such
  calibration exists in the repo; the claim is withdrawn, the values are left.

## Fallout, and one shadow left in place

The old midpoint had been **copied** into two other places, which is how a constant change
becomes a behaviour change somewhere nobody was looking:

- `preflopFoldResolver` linearised the pot-fraction → pot-odds change of variables *at the
  old midpoint* (`1 / 0.16`). Carrying that forward multiplied the preflop response by ~2.9×
  and drove squeeze fold-through into its 0.05 clamp — every caller equally foldable, the
  WS-274 defect returning. It now applies the map **exactly** (`f = r / (1 − 2r)`,
  displacement taken relative to `REFERENCE_POT_ODDS`), which needs no constant, can never be
  steeper than the curve it comes from, and deletes a knob instead of retuning one.
- `gameTreeEquity.multiwayFoldPct` still defaults `betFraction = 0.75`. Both production call
  sites pass an explicit fraction, so it is reachable only from tests — **recorded, not
  fixed**, because that file was owned by concurrent work.
- `logisticFoldResponse`'s own default arguments were literals that happened to match
  `POPULATION_CURVE`. They now read it, and a test asserts they cannot drift apart.

## Reproduce

```bash
node scripts/foldCurve/mine-fold-vs-sizing.mjs    # ~7 min  -> out/fold-vs-sizing.json
node scripts/foldCurve/fit-fold-curve.mjs         # ~2 min  -> residual tables, before/after
node scripts/foldCurve/emit-result-card.mjs       #         -> the Result Card
```

Deal Book `handhq-FTP+PS-0.5-c4074f1d`,
`sha256:c4074f1d18655297cbe6dcf19d6935d0fabd71863e7e0b2f423f13d1be641b08`.
Disclaimer register `FR-1+e3867c10fc2a`. No RNG anywhere in this instrument —
`unseededSources: []` is a positive claim of bit-reproducibility and it holds.

The hold-out is also pinned as a test fixture in
`src/utils/exploitEngine/__tests__/foldCurveShape.test.js`, so the curve cannot regress
without a red suite. Four of its assertions fail against the pre-WS-283 constants.

## Open

1. Re-express the curve in required equity `s / (1 + 2s)` and re-measure the sub-0.15× floor.
2. Per-style and per-street curves from a per-segment corpus split, or delete the multipliers.
3. `queryActionDistribution` has no sizing dimension at all. Finding 1 of the pool-reference
   run showed the personalised model is worth **nothing** facing aggression (n=3,121, lift
   −0.2%) — a model that cannot see the bet size it is responding to is a candidate
   explanation, and it is testable by adding `sizeBucket` to `HIERARCHY_ORDER` and re-running
   the WS-285 bake-off. This is the highest-value follow-up this run points at.
