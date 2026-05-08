# MW Equity Validation Harness

**Status:** v1 shipped (SPR-053, 2026-05-08)
**Owner:** chris
**Backing ticket:** WS-168
**Lives at:** `src/__dev__/mwEquityValidation/`

## Why this exists

The multiway Monte Carlo equity engine `handVsRangesMW` (shipped WS-095 / SPR-048) needs an external truth standard. Per the WS-168 validation principle, owner-articulated 2026-05-07:

> If `handVsRangesMW` correctly models multiway dynamics AND our range-behind model is reasonable, then deriving an opening range from first principles using our primitives should approximate solver charts. Magnitude of divergence drives priority.

The harness derives an opening range per position (UTG, BTN) by sweeping all 169 hand classes, computing EV(open) under a hand-authored scenario tree, and writing the result. It then compares to `PREFLOP_CHARTS[position]` (GTO 9-max 100bb cash, hand-authored from GTO Wizard) and emits a **divergence report** identifying:

- Combo-weighted Jaccard overlap (TP / (TP+FP+FN))
- Hands missing from derived (in solver chart, not in our derivation)
- Hands extra in derived (in our derivation, not in solver chart)
- Boundary EVs (|EV| < 0.5 BB — fragile decisions)
- **Confound decomposition** — explicit attribution of possible delta sources

**Non-blocking quality signal.** Per `feedback_validation_as_quality_signal.md` (memory, 2026-05-07), magnitude of divergence drives priority promotion: significantly off → P0/P1 fix; close → normal /next queue.

## Why this is a deliberately confounded comparison

The reference (`PREFLOP_CHARTS`) is GTO; the inputs we feed our derivation (population priors via `getPopulationPrior`) are calibrated to live 1/2 (looser, more passive than GTO). Owner intent (2026-05-08): _"create our own [derived range] and see how it compares to the GTO sourced preflop charts; identify the delta; improve our subsystems iteratively."_

We are NOT testing the engine in isolation. We are testing **the full first-principles path** — engine + Bayesian priors + scenario probabilities + EV math. The signal is: how close does our system come to solver-aligned ranges *without* solver methods?

The divergence report's confound section names the delta sources so the founder can attribute the gap correctly:
1. Population priors vs GTO frame
2. Joint-probability table authoring
3. 3-bet response model coarseness
4. Engine math (`handVsRangesMW`)
5. 5-bet recursion truncation
6. Chart-regime drift

If the engine math is right (covered by HU-degenerate parity tests), the dominant delta source should be #1 (population priors), which is the long-term improvement target.

## How to run

**Browser-only for v1.** The harness lives in `src/__dev__/` and is exposed as a window global in dev mode:

```bash
npm run dev
# Open http://localhost:5173
# Open the dev console:
> await window.__validateMWEquity('BTN')
# ~10–15 minutes; logs progress every 20 hand classes
> await window.__validateMWEquity('UTG')
# ~10 minutes
> window.__validateMWEquity.help()
```

The function returns `{ derivedEV, comparison, report (markdown), config, scenarioProbs, cache, elapsedMs }`. The markdown report is also `console.log`-ed at end of run.

**Defaults:**
- `openSize: 2.5 BB` — pinned to GTO 9-max chart regime
- `effStack: 100 BB`
- `mcTrials: 5000` per scenario-class
- `mcConvergenceThreshold: 0.02`

To override: `await window.__validateMWEquity('BTN', { mcTrials: 10000 })`.

**Smoke test (Node-runnable, ~200ms):**
```bash
npx vitest run src/utils/pokerCore/__tests__/mwEquityValidationSmoke.test.js
```
Verifies the math runs end-to-end on AA / 72o / JJ across all BTN + UTG scenarios at 200 trials. Catches regressions in the derivation path.

**Node CLI (deferred to v2).** The `scripts/validate-mw-equity.cjs` entry was deferred — runtime makes Node a poor fit (10+ min per position) and the dev console covers the founder's primary use case. v2 may revisit if CI integration becomes useful.

## Architecture

```
src/__dev__/mwEquityValidation/
  index.js                       — window global + dispatcher
  derivation.js                  — buildOpeningRange(position, opts)
  scenarios/
    heroResponse.js              — 3-tier strength bucket: heroResponseToThreeBet / heroResponseToSqueeze / heroResponseToFiveBetJam
    btnScenarios.js              — JOINT_PROBABILITIES_BTN 3×3 + 9-cell scenario EV
    utgScenarios.js              — UTG_SCENARIO_PROBS 5-cell truncation + scenario EV
  potMath.js                     — computeFlatScenarioPot / computeThreeBetCtx / computeFourBetCtx
  comparator.js                  — compareToReference: confusion matrix + missing/extra/boundary lists
  divergenceReport.js            — markdown formatter with confound decomposition
  cache.js                       — equity cache keyed by (handClassIdx, scenarioVillainRangesHash)

docs/projects/mw-equity-validation/
  mw-equity-validation.project.md  — this file (charter)
  baseline-2026-05-08.md           — first run divergence report (founder runs in browser)

src/utils/pokerCore/__tests__/
  mwEquityValidationSmoke.test.js  — 16 smoke assertions, ~200ms
```

## Scope (v1)

- **Positions:** UTG and BTN bookends only
- **Inputs:** `getPopulationPrior(positionBucket, action)` from `rangeEngine/populationPriors.js` — Bayesian-engine-binding priors. NOT `archetypeRanges.js` (pedagogical) — see decision §1 below.
- **Game regime:** 9-max, 100 BB effective, no straddle, no limpers, no rake, openSize = 2.5 BB

## Decisions

### §1 Use populationPriors.js (not archetypeRanges.js) for villain ranges

Founder Q1 (2026-05-08): _"create our own [derived range] using our system."_ The "our system" = the engine + Bayesian priors path. `populationPriors.js` is canonical for the rangeEngine pipeline; `archetypeRanges.js` is explicitly pedagogical (per its file header) and not consumed by the rangeEngine. v1 uses populationPriors as the canonical engine input.

### §2 Hand-authored joint probability tables

`JOINT_PROBABILITIES_BTN` (9 cells, sums to 1.0) and `UTG_SCENARIO_PROBS` (5 cells, sums to 1.0) are hand-authored from live 1/2 baselines. Per WS-168 plan agent §C1: **do not multiply marginals from `FACED_RAISE_FREQUENCIES`** — SB and BB actions are not independent (squeezes, cold-4bets are conditional). v2 may swap in hand-history-derived joint tables.

### §3 5-scenario truncation for UTG

Full 3^8 = 6561-cell joint enumeration for UTG (8 opponents) is intractable. Truncated to:
- `allFold` — all 8 fold (~0.65)
- `oneCaller` — exactly 1 cold-caller (modal: BB) (~0.18)
- `oneThreeBettor` — exactly 1 3-bettor (modal: late position) (~0.10)
- `multiwayFlat` — 2+ cold-callers, no 3-bet (~0.04)
- `squeeze` — 1 caller + 1 3-bettor (~0.03)

Modal-position attribution: caller=BB, 3-bettor=LATE. v2 may decompose by which-position-acts.

### §4 Hero 3-bet response: 3-tier strength bucket

Per WS-168 plan agent §B2 option 1. Tiers via `handStrengthTier(idx)`:
- > 0.85 → 4-bet (AA, KK, QQ, AKs)
- > 0.70 → call (JJ, TT, 99, AKo, AQs)
- ≤ 0.70 → fold

Squeeze thresholds tighter (>0.90 / >0.78). 5-bet jam response: AA/KK/AKs snap-call, QQ/AKo mix, below QQ fold.

### §5 v1 simplifications

- **Caller folds 3-bet in squeeze branches** (live 1/2 capped-flat behavior). Caller's R becomes dead.
- **Rare cells `(3bet, call)` and `(3bet, 3bet)` for BTN** treated as `(3bet, fold)` — combined weight 0.013, negligible impact.
- **Villain's 4-bet-call range** approximated by THREEBET_RANGES (slight value-bias). Refinement: top-30% slice of 3-bet range. v2.
- **Effective stack pinned at 100 BB** for all recursion depth-3 (5-bet jam) calculations.

## What v2 should address (only if v1 baseline is "significantly off")

Per the validation-as-quality-signal principle, address only the highest-magnitude confound source(s) named in the v1 divergence report. Likely candidates if numbers diverge significantly:

1. Refine population priors (re-calibrate from hand-history if available)
2. Decompose joint probability tables per (sb_action, bb_action) using observed live data
3. Author per-position 3-bettor profiles (not single LATE bucket for UTG)
4. Per-position UTG decomposition (instead of 5-scenario truncation — model which-position-acts explicitly)
5. Top-30% slice for villain's 4-bet-call range
6. Mixed-frequency 3-bet response (instead of 3-tier hard bucket)
7. Add middle positions (UTG+1, MP1, MP2, HJ, CO) coverage
8. Add SB / BB derivation (needs decision-rule fix: EV(open) > EV(check), not > 0)

## What v2 should NOT do

- Add the harness to CI as a blocking test (runtime ~10–15 min × 2 positions ≠ CI scale)
- Move to production code (this is dev-only by design — `import.meta.env.DEV`-gated)
- Use archetypeRanges as inputs (would mix two range frames; pedagogical content not Bayesian-canonical)
- Drop the confound decomposition section (the framing is the value, not just the numbers)

## References

- WS-168 ticket: `.claude/workstream/queue/WS-168.yaml`
- SPR-053 sprint: `.claude/workstream/sprints/SPR-053.yaml`
- Plan: `C:\Users\chris\.claude\plans\prancy-seeking-feather.md`
- Memory: `feedback_validation_as_quality_signal.md`
- Engine source: `src/utils/pokerCore/monteCarloEquity.js:512-639` (`handVsRangesMW`)
- Reference data: `src/utils/pokerCore/rangeMatrix.js:200-210` (`PREFLOP_CHARTS`)
- Population priors: `src/utils/rangeEngine/populationPriors.js`
