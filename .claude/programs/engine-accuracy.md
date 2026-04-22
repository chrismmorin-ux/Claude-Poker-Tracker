# Program: Engine Accuracy

Status: GREEN (2026-04-21 — RT-108 CI gate shipped)
Owner: eng-engine (failure-engineer + systems-architect personas)
Last assessed: 2026-04-21 (RT-108 close)
Last verified against code: 2026-04-21

---

## Health Criteria

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| NaN in game tree output | 0 occurrences | — | Any | 0 (RT-2 NaN firewall active) |
| `stableSoftmax` used for all Math.exp | All calls | Missing in new code | Inline Math.exp | All calls (RT-12 resolved) |
| Fold equity includes equity-when-called | Always (INV-06) | — | Missing term | Always |
| Villain model uses 5-layer hierarchy | Correct order | Layers skipped | Labels as inputs | Correct |
| exploitEngine test count | > 500 | 400-500 | < 400 | 500+ (RT-19 added 502) |
| Game tree depth-2 eval time | < 100ms | 100-200ms | > 200ms | ~50ms (desktop, RT-7 pending for mobile) |
| Fold% sanity clamp active | [0.10, 0.85] | Wider range | No clamp | Active (26.2) |

## Active Backlog Items

- RT-35: Break handAnalysis → exploitEngine coupling (INV-08 fix)
- RT-38: Fix adjustedRealization double-discount + add floor
- RT-40: Worker restart counter reset after stability period
- RT-41: Guard NaN from zero-weight drawCombos
- ~~**RT-108**~~ — COMPLETE 2026-04-21. Engine-vs-authored diff CI shipped: `src/utils/postflopDrillContent/__tests__/engineAuthoredDrift.test.js` + baseline snapshot covers 30+ decision nodes × 8 lines. Drift detection verified bidirectionally.
- **RT-111** (REVIEW): `drillModeEngine` wrapper with bailout + sampleSize + caveats — single entry point for any drill consumer of `evaluateGameTree`; forbid direct imports from drillContent after it lands.
- **RT-115** (REVIEW): Minimum-combo guard + sampleSize flag on bucket aggregators — prevents false-precision teaching on 1-2 combo buckets.

## Milestone Gates

| Gate | Status | Criteria |
|------|--------|---------|
| NaN firewall | PASSED | safeDiv + input/output validation at all EV boundaries |
| Softmax stability | PASSED | stableSoftmax (log-sum-exp) replaces all inline softmax |
| Combo-level equity | PASSED | Per-combo equity in depth-1 (not bucket-anchor approximation) |
| Mobile performance | OPEN | Game tree < 150ms on Helio G80 (RT-7) |
| Main thread unblocked | OPEN | Game tree in Web Worker (RT-10) |

## Auto-Backlog Triggers

| Condition | Backlog Template | Priority |
|-----------|-----------------|----------|
| `Math.exp` without stableSoftmax pattern | "Unstable Math.exp in [file] — use stableSoftmax" | P1 |
| Division without NaN guard in exploitEngine | "Missing NaN guard in [file]:[function]" | P0 |
| Position/bucket label used as decision input | "INV-07/NEV-03 violation: label-as-input in [file]" | P0 |
| Style adjustment stacked on defining stats | "NEV-05 violation: double-counting in [file]" | P0 |
| Authored EV claim in drill content with no snapshot-diff coverage | "Drift risk: [file] authored EV not in RT-108 snapshot suite" | P1 |
| Direct import of `gameTreeEvaluator` from `drillContent/` post-RT-111 | "INV-08.a violation: direct engine consumption from drill content in [file]" | P1 |

## History

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-06 | GREEN | Initial assessment. NaN firewall, softmax stability, combo equity all resolved. Mobile profiling and Web Worker pending. |
| 2026-04-07 | GREEN | R4 roundtable. Worker migration (RT-10) complete but dual-instantiation found (RT-27). Preflop path bypasses Worker (RT-31). Circular import tracked (RT-33). All runtime metrics remain GREEN. |
| 2026-04-07 | GREEN | R5 roundtable. adjustedRealization double-discount in multiway (RT-38), NaN from zero-weight drawCombos (RT-41). Worker restart counter never resets (RT-40). handAnalysis→exploitEngine coupling violates INV-08 (RT-35). All runtime metrics GREEN. |
| 2026-04-20 | GREEN | Drills Consolidation Roundtable — audit scoped to design doc, not engine code. No engine-accuracy findings. `drillContent/` module (cross-street scheduler, shape classifier) imported by both pre- and postflop modes today; consolidation exposes this coupling as load-bearing (RT-100, RT-101) but does not alter engine correctness. Prototype pollution concern in `aggregateFrameworkAccuracy` (RT-96) is persistence-layer, not engine. Runtime metrics unchanged. |
| 2026-04-21 | YELLOW | Line Study Bucket-Teaching Roundtable — engine runtime metrics remain GREEN, but roundtable surfaced that NO engine-vs-authored diff test exists. Items 25-27 pattern (~30 accuracy constant revisions) silently invalidates any authored EV claim in Line Study content (`lines.js` 2090 LOC) with zero CI signal. Also formalized a pre-existing INV-08 violation: `postflopDrillContent/handTypeBreakdown.js:32` and `rangeVsBoard.js:17` import from `exploitEngine/` — permitted as INV-08.a exception (RT-109), but future drill consumption of `gameTreeEvaluator` must route via `drillModeEngine` wrapper (RT-111) to carry `sampleSize` + `bailedOut` + `caveats[]`. Engine itself is correct; gap is in how drill-layer consumers validate against it and surface incomplete results. Downgrade to GREEN once RT-108 (CI gate) ships. |
| 2026-04-21 | GREEN | RT-108 CI gate shipped same day. `engineAuthoredDrift.test.js` + `__snapshots__/engine-authored-drift.json` now snapshots deterministic engine outputs (narrowed ranges, bucket segmentation, fold-curve probes, sentinel constants) per decision node across all 8 authored lines. Drift detection verified bidirectionally (perturb POP_CALLING_RATES.marginal 0.55→0.60 failed with exact line-pointer diff; revert restored green). Engine-accuracy program returns to GREEN — silent drift is now a blocking CI failure. |
