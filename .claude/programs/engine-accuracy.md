# Program: Engine Accuracy

Status: GREEN
Owner: eng-engine (failure-engineer + systems-architect personas)
Last assessed: 2026-04-07 (R5)
Last verified against code: 2026-04-07

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

## History

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-06 | GREEN | Initial assessment. NaN firewall, softmax stability, combo equity all resolved. Mobile profiling and Web Worker pending. |
| 2026-04-07 | GREEN | R4 roundtable. Worker migration (RT-10) complete but dual-instantiation found (RT-27). Preflop path bypasses Worker (RT-31). Circular import tracked (RT-33). All runtime metrics remain GREEN. |
| 2026-04-07 | GREEN | R5 roundtable. adjustedRealization double-discount in multiway (RT-38), NaN from zero-weight drawCombos (RT-41). Worker restart counter never resets (RT-40). handAnalysis→exploitEngine coupling violates INV-08 (RT-35). All runtime metrics GREEN. |
