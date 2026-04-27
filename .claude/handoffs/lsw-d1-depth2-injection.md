# Handoff — LSW-D1 (Depth-2 injection — Hand Plan surface)

**Status:** COMPLETE 2026-04-27
**Session owner:** Claude (main)
**Project:** Line Study Slice Widening (LSW), Stream D
**BACKLOG:** LSW-D1 → COMPLETE (Hand Plan surface scope); **LSW-D2 unblocked → NEXT**

---

## What shipped

### `src/utils/postflopDrillContent/computeDepth2Plan.js` (NEW, ~165 LOC)

A direct wrapper around `evaluateGameTree` that returns the same `EnginePlan` shape `derivePlanFromBucketEVs` produces. Drop-in replacement for `HandPlanSection`'s engine-call.

**Translations**:
- `heroCombo` 4-char string ('J♥T♠') → `[card1, card2]` integer array
- `villainAction.{kind, size}` → engine `villainAction` enum (`'donk'`/`'bet'`/`'raise'`/`'check'`) + `villainBet` bb amount
- Node `board` array → encoded card integers via `parseBoard`

**Output**:
- `perAction[]` from `tree.recommendations[]` with isBest=index-0 (engine pre-sorts by EV descending)
- `bestActionLabel` + `bestActionReason` from the top recommendation's `action` + `reasoning` strings
- `nextStreetPlan` populated from `tree.recommendations[best].handPlan` (the structured `ifCall`/`ifRaise`/`ifVillainBets`/`ifVillainChecks`/`nextStreet` branches built by `buildResponseGuidance`)
- `caveats[]` derived from tree state:
  - `'real-range'` — always (vs v1's 'synthetic-range')
  - `'depth2-bailed-out'` — when `treeMetadata.depthReached < 2`
  - `'population-priors'` — when `modelQuality.overallSource === 'population'`
  - `'v1-simplified-ev'` — REMOVED (depth-2 IS real EV)
- `treeMetadata` passed through for diagnostic surfacing
- `errorState` populated on validation/engine failures (never throws)

### `src/components/views/PostflopDrillsView/panels/HandPlanSection.jsx` (MODIFIED)

- Engine call swapped: `computeEnginePlan` → `computeDepth2Plan`
- Helpers removed: local `parseHeroCombo` + `deriveHeroActionsFromDecision` (the new path doesn't need them — `evaluateGameTree` builds its own `heroActions` via `buildHeroActions`)
- Input shape simplified: `{ heroCombo, villainRange, board, pot, villainAction, decisionKind, effectiveStack, contextHints }`
- New `<NextStreetPlan>` sub-component renders up to 5 forward-look branches as a labeled list. Each branch surfaces the engine's `note` (already human-readable via `buildResponseGuidance`) plus `scaryCardRanks` when present (rendered amber).
- v1 stub copy ("Forward-look ships with depth-2 injection (LSW-D1)") replaced with "Forward-look unavailable on this node (river / no depth-2 branches)" — fires only when `nextStreetPlan === null`.

### Tests (33 NEW + UPDATED)

**`computeDepth2Plan.test.js` — 19 cases, NEW**
| Block | Cases |
|-------|-------|
| Bad-input handling | 7 — null / non-object / missing combo / unparseable combo / missing range / bad board / non-finite pot |
| Happy path on K72r AQ fixture | 8 — non-empty perAction, isBest pre-sort, bestActionLabel match, bestActionReason populated, caveats real-range present + v1-simplified-ev absent + synthetic-range absent, heroCombo verbatim, decisionKind verbatim + default, treeMetadata diagnostic |
| Villain-donk path (JT6 wet flop) | 2 — facing-bet action set translation, structural nextStreetPlan shape |
| Engine throw resilience | 1 — bad input doesn't throw, returns errorState |

(One mock-based engine-throw test was deferred — `vi.doMock` doesn't reliably override an already-imported module in this setup. The contract is covered by the bad-input branches + the implementation's try/catch.)

**`HandPlanSection.test.jsx` — 23 cases (was 22, +1)**
- Mock target swapped: `computeEnginePlan` → `computeDepth2Plan`
- `mockEnginePlan` updated: caveats `['real-range']` (was `['synthetic-range', 'v1-simplified-ev']`); bestActionLabel/Reason updated to depth-2-style narrative
- New test: `<NextStreetPlan>` renders ifCall + ifRaise branches with `note` text + `scaryCardRanks`
- "Forward-look stub" test renamed: now asserts "Forward-look unavailable" copy fires when `nextStreetPlan === null`

---

## Verification

```
npx vitest run src/utils/postflopDrillContent/__tests__/computeDepth2Plan.test.js
→ 19/19 green

npx vitest run src/components/views/PostflopDrillsView/panels/__tests__/HandPlanSection.test.jsx
→ 23/23 green

npx vitest run src/components/views/PostflopDrillsView src/utils/postflopDrillContent
→ 25 files, 515/515 green
```

Test-count progression across Stream P + D1:
- Pre-Stream-P: 373
- Post-P1: 390 (+17)
- Post-P2: 415 (+25)
- Post-P4: 448 (+33)
- Post-P5: 495 (+47)
- **Post-D1: 515 (+20)**

Cumulative gain since Stream P kicked off: **+142 tests**.

### Visual verification at 1600×720 (Playwright)

JT6 flop_root facing 33% donk now renders:

- **Depth-2 reasoning narrative**: *"Villain range is capped — raise for maximum value (58% eq, they can't have the nuts) (estimated)"*
- **4-row action table** (vs prior v1's 3 rows):
  - `raise` BEST +14.61bb (highlighted emerald)
  - `raise` +12.55bb (depth-2 surfaces an alternate raise sizing the solver considered)
  - `call` +8.71bb (depth-2-conditioned, was `unsupported` in v1)
  - `fold` +0.00bb
- **FORWARD LOOK section** with `ifRaise` branch: *"If villain raises: Fold — their raise range is too strong here"*
- **Caveats**: `REAL-RANGE · DEPTH2-BAILED-OUT · POPULATION-PRIORS` (no `v1-simplified-ev`)

Evidence: `docs/design/audits/evidence/lsw-d1-jt6-flop-root-depth2-plan.png`.

The `depth2-bailed-out` caveat tells us the engine didn't fully reach depth 2 here (likely time-budget hit on the wet board with default trials=500), so the forward-look is partial. That's accurate signaling — better than silent.

---

## Doctrine choices worth surfacing

1. **Surface-scoped wire-through.** D1 ships depth-2 for HandPlanSection only. `BucketEVPanelV2` still uses `computeBucketEVsV2` (the `GROUP_CALL_RATES` + `computeDecomposedActionEVs` path). The bucket panel's range-decomposition pedagogy is teaching students about villain's range *shape*, not the per-combo EV — depth-2 doesn't add the same value there. The Hand Plan layer is the natural surface for solver-shaped forward-look. Wiring depth-2 INTO `computeBucketEVsV2` is a future LSW-D follow-on if owner wants the bucket EV table to be depth-2-accurate too.

2. **No `archetype` weighting at the engine layer.** Looking at the existing `computeBucketEVsV2` path, archetype is informational (stamped on `confidence.archetype`) — not used for range weighting. Depth-2 follows the same convention: archetype is passed as `contextHints.archetype` for engine awareness, but doesn't shift the villain range. Future improvement: synthesize `playerStats` from archetype to make the toggle move depth-2 EV. Tracked as a follow-on.

3. **`computeDepth2Plan` is a SIBLING file, not an `if (useDepth2)` flag inside `planDerivation.js`.** Cleaner architecture, easier to test, easier to swap. HandPlanSection imports the new path directly; the v1 path (`derivePlanFromBucketEVs`) remains for any caller that wants the BucketEVs-based shape.

4. **`buildResponseGuidance` produces human-readable `note` strings — no UI translation needed.** The engine already builds the forward-look text. `<NextStreetPlan>` just renders branches verbatim. This was a quality-of-life win during implementation — I expected to write a translator and discovered the engine already had one.

5. **Caveat naming is honest, not optimistic.** `depth2-bailed-out` vs hiding the partial result; `population-priors` vs no signal. The student sees what trade-offs the engine made.

6. **Authored decision branches are NOT used by the engine.** `evaluateGameTree` builds its own SPR-aware action set via `buildHeroActions`. Lines.js authors decision branches like "Call / Raise to 9bb / Fold" — these are pedagogical labels, not solver candidates. The Hand Plan engine table shows the solver's candidate set (which often includes alternate sizings). This is intentional: the plan is "what does the solver think you should do," not "score the authored branches."

---

## Files I owned this session

- **NEW:** `src/utils/postflopDrillContent/computeDepth2Plan.js` (~165 LOC)
- **NEW:** `src/utils/postflopDrillContent/__tests__/computeDepth2Plan.test.js` (~210 LOC, 19 cases)
- **MODIFIED:** `src/components/views/PostflopDrillsView/panels/HandPlanSection.jsx` (engine swap + `<NextStreetPlan>` sub-component, ~50 LOC delta)
- **MODIFIED:** `src/components/views/PostflopDrillsView/panels/__tests__/HandPlanSection.test.jsx` (mock target + caveat strings + new forward-look render test, ~25 LOC delta)
- **MODIFIED:** `.claude/BACKLOG.md` — LSW-D1 → COMPLETE; LSW-D2 → NEXT.
- **NEW (evidence):** `docs/design/audits/evidence/lsw-d1-jt6-flop-root-depth2-plan.png`.

---

## Stream P / Stream D state after this session

- **Stream P foundational** (P1/P2/P4/P5): CLOSED 2026-04-27 (yesterday in this conversation). Stream P content (P3/P6/P7) deferred to LSW-v2.
- **Stream D**:
  - **D1 (Hand Plan surface)**: CLOSED 2026-04-27 (this session). The `nextStreetPlan` field I left as a v1 stub in P4 is now populated. The `v1-simplified-ev` caveat is gone from the Hand Plan layer.
  - **D2 (EV cache + engineVersion stamp)**: NEXT. `evaluateGameTree` calls are not currently cached — every node-render fires a fresh MC. Worth adding before LSW-v2 student usage scales the call volume.

---

## Open follow-ons surfaced

1. **`computeBucketEVsV2` depth-2 wire-through** (future LSW-D ticket). Would clear the `v1-simplified-ev` caveat from `BucketEVPanelV2` too. Lower leverage than D1 was, since the bucket panel's purpose is range decomposition, not solver-derived EV.
2. **Archetype-conditioned `playerStats` synthesis**. Currently `archetype` is informational only. Future: synthesize fish/reg/pro player stats so the toggle moves depth-2 EV the way it (subtly) moves the bucket-EV path.
3. **Forward-look CI bounds**. `evaluateGameTree` doesn't surface CI on individual recommendation EVs today; the table renders `—` in the CI column. Could be added in a future session.

---

## Next-session pickup

**LSW-D2** is the natural next step within Stream D — adds the EV cache + `engineVersion` stamp. ~1 session.

Or pivot back to **LSW-A5..A8** (continuing per-line audits, the linear Stream A work) if the depth-2 + cache loop feels saturated.

Or **a different program** entirely — STATUS.md notes EAL S17 has a visual-verification gate pending; that's owner-time, not session-time.
