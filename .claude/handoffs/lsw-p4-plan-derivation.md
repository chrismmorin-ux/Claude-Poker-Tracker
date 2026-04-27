# Handoff — LSW-P4 (Engine-derived plan derivation)

**Status:** COMPLETE 2026-04-27
**Session owner:** Claude (main)
**Project:** Line Study Slice Widening (LSW), Stream P (Hand Plan Layer)
**Sub-charter:** `docs/projects/line-study-slice-widening/stream-p-hand-plan.md`
**BACKLOG:** LSW-P4 → COMPLETE; **LSW-P5 unblocked → NEXT (only foundational sub-stream remaining)**

---

## What shipped

### `src/utils/postflopDrillContent/planDerivation.js` (NEW, ~140 LOC)

Two exports:

**`derivePlanFromBucketEVs(bucketEVs, { heroCombo, decisionKind })`** — pure synchronous transformer. Returns:
- `null` when input is null/undefined/non-object/missing-or-empty `actionEVs`
- An `EnginePlan` with populated `errorState` when input has `errorState`
- A fully-formed `EnginePlan` otherwise

**`computeEnginePlan(input, heroComboString)`** — async convenience wrapper. Runs `computeBucketEVsV2` + transforms in one call. Never throws (graceful degradation per I-HP-2).

### EnginePlan shape

```
{
  heroCombo: 'J♥T♠' | null,
  perAction: [
    {
      actionLabel: 'bet 75%',
      actionKind: 'bet' | 'check' | 'raise' | 'jam' | 'call' | 'fold' | null,
      betFraction: 0.75 | null,
      ev: 18.32,
      evLow: 17.82 | null,
      evHigh: 18.82 | null,
      isBest: true,
      unsupported: false,
    }
  ],
  bestActionLabel: 'bet 75%' | null,
  bestActionReason: 'Correct: bet 75% at +18.32bb...' | null,
  decisionKind: 'standard' | 'bluff-catch' | 'thin-value',
  caveats: ['synthetic-range', 'v1-simplified-ev', ...],
  nextStreetPlan: null,    // v1 stub — D1 populates
  errorState: null,         // or { kind, userMessage, diagnostic, recovery? }
}
```

### Tests — `planDerivation.test.js` (NEW, 33 cases)

| Block | Cases |
|-------|-------|
| Bad-input handling | 5 — null / undefined / non-object / missing actionEVs / empty actionEVs |
| ErrorState propagation | 2 — populated errorState + heroCombo/decisionKind preservation on error |
| Happy path | 12 — perAction count, best mark, bestActionLabel/Reason, caveat propagation, independent caveats array, nextStreetPlan null, heroCombo passthrough, defaults, decisionKind forwarding, unsupported flag, EV CI, errorState=null |
| Defensive defaults | 6 — missing actionLabel/kind, NaN EV, missing totalEVCI, missing recommendation, empty templatedReason, missing confidence |
| End-to-end integration | 8 — real K72r Q♣Q♦ fixture mirroring `drillModeEngineV2.test.js`, MW errorState (LSW-G6), heroCombo passthrough, v1-simplified-ev inheritance, decisionKind forwarding, null input graceful degradation, nextStreetPlan null in v1 |

---

## Verification

```
npx vitest run src/utils/postflopDrillContent/__tests__/planDerivation.test.js
→ 33/33 green

npx vitest run src/utils/postflopDrillContent
→ 21 files, 448/448 green (+33 from P2 baseline 415; +75 from pre-Stream-P 373)
```

No regressions outside my files.

---

## Doctrine choices worth surfacing

1. **`nextStreetPlan` is a v1 stub.** I discovered `evaluateGameTree.recommendations[].handPlan` already exists upstream (built by `buildResponseGuidance` in `gameTreeEvaluator.js` with `ifCall`/`ifRaise`/`ifVillainBets`/`nextStreet` branches), but `drillModeEngine.computeBucketEVsV2` does NOT call `evaluateGameTree` today — it uses `GROUP_CALL_RATES` (frozen lookup) + `computeDecomposedActionEVs` (single-step EV). Wiring the full game tree is exactly LSW-D1's scope. P4's job ends at exposing the contract — `nextStreetPlan: null` in v1, populated automatically once D1 lands.

2. **`computeEnginePlan` never throws.** `computeBucketEVsV2` already returns `{ ..., errorState }` on every failure path (validation, MC failures, MW); P4 propagates that into the plan layer. The UI (P5) reads `plan.errorState` and renders graceful empty state instead of an exception boundary. Matches I-HP-2 (graceful degradation).

3. **Caveats array is sliced.** `bucketEVs.confidence.caveats.slice()` ensures the plan layer can mutate its own array (e.g. P5 might augment with UI-side caveats like "preview mode") without polluting cached engine output.

4. **Empty `templatedReason` normalizes to null.** Engine returns `''` for unsupported actions; the plan surfaces null so P5 can render "no reason available" instead of an empty `<p></p>`.

5. **Defensive defaults everywhere.** NaN EV → 0; missing actionLabel → ''; missing CI → null; missing recommendation block → null labels. Partial engine output never crashes the UI.

6. **Multiway routing.** When `villains.length > 1`, `computeBucketEVsV2` returns `errorState.diagnostic = 'MW engine is LSW-G6'`. The plan layer surfaces this verbatim — P5 renders an "MW plans deferred to LSW-G6" empty state. No special MW handling needed at P4.

---

## Files I owned this session

- **NEW:** `src/utils/postflopDrillContent/planDerivation.js` (~140 LOC)
- **NEW:** `src/utils/postflopDrillContent/__tests__/planDerivation.test.js` (~280 LOC, 33 cases)
- **MODIFIED:** `.claude/BACKLOG.md` — LSW-P4 → COMPLETE.

---

## Next-session pickup (LSW-P5 — UI integration)

P5 is the last foundational sub-stream and the only owner-visible piece. Scope:

1. New shared `<RuleChipModal>` component — reads chip body via `getRuleChip(chipId)` from `planRules.js`. Renders `label` + `shortBody` + `fullBody` + `citations`. ~80–120 LOC.
2. New `<RuleChip>` component (or inline button) wired to open the modal.
3. New `<HandPlanSection>` component or section in `LineNodeRenderer.jsx` rendering:
   - Authored plan (when `node.comboPlans[bucketId]` present after P2)
   - Engine-derived plan (when `computeEnginePlan` returns non-null)
   - Conditional default visibility per Q2=C: authored present → hide engine; absent → show engine
   - "Show solver plan" toggle persisted via `sessionStorage['handPlanShowSolver']`
   - Clickable rule chips opening modal per Q3=B
4. **Visual verification at 1600×720** using Playwright MCP — JT6 flop_root + 1 unauthored node. Confirm: chip-tap opens modal, toggle reveals engine plan when authored present, conditional default shows engine when authored absent.
5. Empty-state copy for: MW nodes (errorState `MW engine is LSW-G6`), null engine output, no-authored + no-engine.

Recommended sequence:
- (a) Build `<RuleChipModal>` first — reusable, testable in isolation, no engine dep.
- (b) Build `<HandPlanSection>` reading both sources, threading the toggle.
- (c) Wire into `LineNodeRenderer.jsx` under each branch.
- (d) Visual verification on JT6.

P5 has no test count target in BACKLOG — but expect ~15–25 component test cases covering the conditional render matrix + chip modal + toggle persistence.

---

## Open questions still deferred (no change from prior handoffs)

1. Per-archetype plan splits — defer to LSW-v2 P3 authoring.
2. MW empty-state copy line — needs concrete copy in P5 ("Multiway plans coming with the MW bucket-EV engine [LSW-G6]").
3. Modal stacking precedence (chip-tap from inside compute calculator modal) — recommend stack at z+1 in P5.
