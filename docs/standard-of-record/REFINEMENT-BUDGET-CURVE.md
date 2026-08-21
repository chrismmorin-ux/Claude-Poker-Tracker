# Refinement budget coverage curve — the curve `DEFAULT_REFINEMENT_BUDGET_MS` is chosen from

> MEASURED 2026-08-20 (WS-594) on cm-node1, 60 boards per arm, six arms, via
> `scripts/backtest/probe-depth2-coverage.mjs`. The adopted constant lives in
> `src/utils/exploitEngine/refinementWork.js` (`DEFAULT_REFINEMENT_BUDGET_MS`).
>
> WHY THIS FILE EXISTS: WS-574's accept criterion is that the budget be "chosen from the
> coverage curve, not guessed, and the chosen value recorded with the curve that justified
> it." The reasoning was already written at the constant; the curve itself was not persisted,
> so the claim was checkable in principle and not re-checkable in practice. This is the
> artifact that makes it re-checkable. Sibling of `REFINEMENT-CLOCK-CALIBRATION.md`, and kept
> out of the engine source for the same reason that one is: a documentation edit to an engine
> file trips `check-engine-version-bump`, and bumping `ENGINE_VERSION` for a comment would
> stamp `predictionAudit` records with an engine era that never existed.

## The curve

`partial stages` is summed across the stage set over all 60 boards — the count of stage
executions that bailed before completing. Zero is full coverage.

| budget (logical ms) | per board | partial stages | verdict |
|--------------------:|----------:|---------------:|---------|
| 2 000 | 3 040 ms | **176** | clock binds |
| 8 000 | 8 778 ms | **31** | clock binds |
| 12 000 | 9 964 ms | **3** | clock does not bind |
| 16 000 | 9 541 ms | **0** | ← knee |
| 20 000 | 9 961 ms | **0** | ← shipped |
| 40 000 | 9 837 ms | **0** | ← bracket arm |

## What it settles

**16 000 is the knee.** It is the lowest budget reaching zero partial stages. The shipped
20 000 sits above it with headroom and is admissible.

**Cost is flat from the knee up.** 40 000 — double the shipped value — costs the same per
board as 16 000 (9 837 vs 9 541 ms; the spread across 16 000/20 000/40 000 is under 5% and
non-monotone, i.e. noise). Above the knee the budget buys nothing and costs nothing. That
makes the choice of 20 000 over 16 000 a free headroom margin rather than a latency trade.

**The pre-v129 default was not a smaller version of this — it was a different computation.**
At 2 000 there were 176 partial stages; `depth3Barrel` (barrel planning) was budget-gated on
every board, so it had never executed in production. Anything asserted about engine behaviour
under the 2 000 default was asserted about a truncated tree.

**There is no cheap-and-complete point.** 8 000 already costs 8 778 ms/board while still
leaving 31 partial stages. The ~3.3× wall-time increase over the truncated default is the
price of completing at all, not a property of the value chosen.

**The next constraint is not the budget.** The probe's own verdict at every arm ≥ 12 000:
*"CLOCK DOES NOT BIND — stages complete with full coverage, so the variance is the HARDCODED
SAMPLE COUNTS (16 per depth-2 sampler; DEPTH3_TURN_CARDS 6, DEPTH3_RIVER_CARDS 8,
DEPTH3_TURN_D3_RIVER_CARDS 10). Raising the budget would change nothing."* WS-594's bracket
arm was specified to detect exactly this, and it fired: sample counts are a different lever
and belong to a different ticket.

## What this does NOT say

**These are not table latencies.** Every figure is cm-node1 wall time for the REFINED answer.
What the founder sees at the table is the depth-1 fast path (WS-334, wired by WS-574), which
this curve says nothing about. The Galaxy S22 number is **unmeasured** and remains WS-574's
open accept criterion — "table latency to FIRST advice is unchanged and is measured, not
assumed."

**This is a coverage measurement, not a strategy claim.** No corpus quantity crosses into it,
so `.claude/rules/corpus-transfer-is-earned.md` does not bind here. It is not a Result Card
and makes no comparative claim about EV or model quality.

## Re-running it

```bash
node scripts/backtest/probe-depth2-coverage.mjs --boards 60 --budget <N> --out out/depth2-coverage-<N>.json
```

Six arms as WS-594's `compute_job` runs them: 2000, 8000, 12000, 16000, 20000, 40000.
`drawBoards` is seeded, so arms are paired across budgets and the first 40 boards are the
same boards WS-574's original in-session measurement used.

Re-run after any change to stage sample counts, to `COMBO_EVAL_COST`, or to the stage set —
each moves where the knee sits. Raw arm artifacts live on cm-node1 under the job's worktree;
per `.claude/rules/artifact-location.md` this file is the repo's record of them, not a copy.
