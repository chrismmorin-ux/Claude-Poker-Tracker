# Refinement clock calibration — logical-v1

> CALIBRATED 2026-08-07. Adopted constants live in
> `src/utils/exploitEngine/refinementWork.js` and are frozen as part of the clock version.
>
> RE-CALIBRATION RULE: re-run `scripts/backtest/calibrate-refinement-units.mjs` after any
> engine hot-path change. A re-calibration that changes only `REFINEMENT_UNITS_PER_MS`
> keeps the clock version (the unit's meaning is unchanged; only ms↔units pacing moves).
> A re-calibration that changes `COMBO_EVAL_COST` changes what a unit MEANS and MUST bump
> `REFINEMENT_CLOCK_VERSION` — chunk stamps and manifests then refuse cross-version blends
> automatically. The 2026-08-07 adoption replaced the bring-up placeholders BEFORE any
> 'logical-v1' artifact existed, so no bump was needed.

## What the constants mean

- `COMBO_EVAL_COST[boardLen]` — work units charged per sampled villain combo, ~µs of
  combo-evaluation work on the reference machine at calibration time.
- `REFINEMENT_UNITS_PER_MS` — converts `refinementBudgetMs` to a unit budget, so the
  shipped 2000 ms keeps its real-device meaning while becoming deterministic.
- `MAX_STAGE_SHARE` = 0.4 (DEC-036 cap-not-reserve; not calibrated here).

## Machine

- reference machine: MorinComputer (G16), Windows 11 Pro 10.0.26200, Node v24.11.1,
  calibrated 2026-08-07, idle, mains power. Total: 6,250,009 units / 19,603 ms of
  refinement wall time across the 12-scenario battery.

## Phase A — per-board-length combo-eval cost (µs/combo, medians)

```json
{
  "3": 160,
  "4": 152,
  "5": 1
}
```

## Phase B — units per ms, unbounded budget over the dumpGameTreeEV battery

| scenario | units | refinement ms | units/ms |
|---|---|---|---|
| flop-dry-noaction-tight | 394155 | 1239 | 318 |
| flop-dry-facing-bet-tight | 739287 | 2365 | 313 |
| flop-wet-noaction-wide | 1881675 | 6709 | 280 |
| flop-wet-facing-bet-wide | 1520332 | 4166 | 365 |
| flop-wet-facing-raise-full | 1552500 | 4983 | 312 |
| turn-noaction-wide | 56954 | 42 | 1356 |
| turn-facing-bet-tight | 25656 | 21 | 1222 |
| turn-wet-facing-bet-full | 77700 | 66 | 1177 |
| river-dry-noaction-wide | 448 | 4 | 112 |
| river-dry-facing-bet-tight | 102 | 1 | 102 |
| river-wet-noaction-full | 800 | 6 | 133 |
| river-paired-facing-bet-full | 400 | 1 | 400 |

**REFINEMENT_UNITS_PER_MS (measured): 319**

## Verification (§3) — logical-2000ms vs wall-2000ms baseline

The wall clock no longer exists in code, so a fresh pinned-slice wall baseline cannot be
produced; the baseline is the wall-era artifact `out/depth-ablation.json` (260 decisions,
wall 2000 ms, this machine, 2026-08-05 era). The slices differ, so this is a shape
comparison, not a row-paired one — stated rather than hidden.

- depthReached histogram, wall-2000 baseline (260 decisions):
  `{1: 45, 2: 141, 3: 74}` → depth ≥ 2 on 82.7% of decisions, depth 3 on 28.5%.
- depthReached histogram, logical-2000 (18-decision refined verification run, 2026-08-07):
  `{2: 8, 3: 3}` → depth ≥ 2 on 100%, depth 3 on 27.3% of the 11 engine-scored decisions;
  budgetBound on 8/11 (72.7%) — the budget binds without disabling (the "not uniformly
  false" tell holds), consistent with DEC-036's "partials are the normal case."
- Read: depth-3 shares agree closely (28.5% wall vs 27.3% logical); the logical run shows
  no depth-1 truncations where the wall baseline had 17% — plausible slice difference at
  n=11, worth re-checking on a larger pinned slice at next recalibration rather than
  adjusting now.
- adjustment applied: REFINEMENT_UNITS_PER_MS 300 (bring-up placeholder) → 319 (measured);
  COMBO_EVAL_COST {3:33,4:45,5:2} (placeholder) → {3:160,4:152,5:1} (measured), adopted
  pre-first-artifact so the clock version stays 'logical-v1'.
- Known proportionality limit (Phase B dispersion): turn-heavy scenarios pace at
  ~1,200-1,350 units/ms vs ~280-365 on flop scenarios — turn stages are cheap enough to
  complete under either clock, so the pacing constant is dominated by flop work, which is
  where the budget actually binds. Systematic given inputs, so determinism is unaffected;
  it means "2000 ms" describes flop-work pacing most precisely.
