# Handoff — LSW-P2 (Schema additions for `comboPlans`)

**Status:** COMPLETE 2026-04-27
**Session owner:** Claude (main)
**Project:** Line Study Slice Widening (LSW), Stream P (Hand Plan Layer)
**Sub-charter:** `docs/projects/line-study-slice-widening/stream-p-hand-plan.md`
**BACKLOG:** LSW-P2 → COMPLETE; **LSW-P4 + LSW-P5 unblocked → NEXT (parallel)**

---

## What shipped

### `lineSchema.js` extension

- **`SCHEMA_VERSION` 3 → 4** with version-history note (additive change; legacy content remains valid).
- **New constant `PLAN_TEXT_MAX_CHARS = 320`** (exported, ~1–3 sentence cap; H-PLT01 sub-second readability).
- **Pure import** of `isKnownRuleChip` from `planRules.js` (planRules is itself pure, so the import doesn't pollute schema's no-UI/state/persistence guarantee).
- **New validators**:
  - `validateComboPlanEntry(entry, ctx, { allowOverrides })` — shape + planText + ruleChips checks; rejects `overrides` field when called from inside an override (flat one-level structure).
  - `validateComboPlans(comboPlans, ctx, { allowedBuckets, allowedCombos })` — bucket-key orphan check, override-combo format + duplicate-card + heroView.combos membership check.
- **Wired into `validateNode`** after `decisionStrategy`. `comboPlans` is rejected when `heroView` is absent or `bucketCandidates` is empty (no anchor for bucket keys).

### Validator rules

| Rule | Enforcement |
|------|-------------|
| `comboPlans` must be a non-empty object | Reject empty / non-object |
| Bucket key must be in `heroView.bucketCandidates` | Schema-level orphan check |
| `planText` non-empty trimmed, ≤ 320 chars | Trim + length |
| `ruleChips` non-empty array, every ID resolves | `isKnownRuleChip` |
| Override combo key matches COMBO_REGEX | Format check |
| Override key has no duplicate cards | `J♥J♥` rejected |
| Override key in `heroView.combos` (when present) | Schema-level membership |
| No nested overrides | Flat one-level |
| Cross-layer combo-set membership | **Deferred to engine** per `villainRangeContext.baseRangeId` precedent |

### Tests

- **NEW: `lineSchema.comboPlans.test.js` — 25 cases**
  - Version + constants (2)
  - Happy path (4): well-formed plan; per-combo override; `comboPlans` absent (additive); multi-bucket
  - Bucket-key validation (5): orphan key; empty object; absent bucketCandidates; absent heroView; non-object comboPlans
  - Rule-chip validation (4): unknown ID; non-string; empty array; missing field
  - planText validation (4): empty; whitespace-only; > max; exactly max boundary
  - Override key validation (7): orphan combo; bad format; duplicate cards; nested rejection; non-object overrides; propagated entry validation
- **MODIFIED: `lineSchema.test.js`** — `SCHEMA_VERSION` assertion 3 → 4 (history comment extended).
- **MODIFIED: `lineSchema.v3.test.js`** — `SCHEMA_VERSION` assertion 3 → 4 with note "v3 fields remain valid".

---

## Verification

```
npx vitest run src/utils/postflopDrillContent/__tests__/lineSchema*
→ 109/109 green across 3 files (57 v2/legacy + 27 v3 + 25 new comboPlans)

npx vitest run src/utils/postflopDrillContent
→ 20 files, 415/415 green (+25 from P1 baseline 390; +42 from pre-Stream-P 373)

npx vitest run src/utils/postflopDrillContent/__tests__/lines.test.js
                  src/utils/postflopDrillContent/__tests__/engineAuthoredDrift.test.js
→ 47/47 green — all 8 production-authored lines validate clean against v4
```

**Full-project run** (smart-test-runner): 8683/8721 passing. 38 failures break down as:
- 22 worker-spawn flakes (Windows `errno -4094`, infrastructure)
- 14 in unrelated EAL persistence v21 migration tests + pre-existing `precisionAudit` shape-lane equity flake + 1 doc-drift `schema-validation.test.js` test about React context coverage.

**None of the failures touch `lineSchema.js` or `planRules.js`.** Verified via grep — none of the failing test files import either module. Confirmed in isolation: re-running the failing files standalone reproduces the same failures, which means they're independent of my changes.

---

## Files I owned this session

- **MODIFIED:** `src/utils/postflopDrillContent/lineSchema.js` (+ ~95 LOC: validators + version note + constant)
- **MODIFIED:** `src/utils/postflopDrillContent/__tests__/lineSchema.test.js` (SCHEMA_VERSION 3 → 4)
- **MODIFIED:** `src/utils/postflopDrillContent/__tests__/lineSchema.v3.test.js` (SCHEMA_VERSION 3 → 4)
- **NEW:** `src/utils/postflopDrillContent/__tests__/lineSchema.comboPlans.test.js` (~280 LOC, 25 cases)
- **MODIFIED:** `.claude/BACKLOG.md` — LSW-P2 → COMPLETE; LSW-P4 + LSW-P5 → NEXT.

---

## Doctrine choices worth surfacing

1. **Pure-import of `isKnownRuleChip`.** `planRules.js` is itself pure (no UI/state/persistence imports), so threading it into `lineSchema.js` doesn't violate the schema-purity invariant. This is a cleaner architecture than the alternative (passing chip set as a parameter to `validateLine`), which would have forced every test fixture to construct + pass the chip set.

2. **Cross-layer combo-set membership deferred to engine.** Spec said "every override combo string must appear in the bucket's combo set on this node" but bucket combo sets are only resolvable via `bucketTaxonomy.js` + `archetypeRanges.js`, which would pull range-engine code into schema validation. I followed the existing `villainRangeContext.baseRangeId` precedent (cross-layer check NOT done at schema; engine catches at runtime). Schema does the format-level membership check against `heroView.combos` only — this catches authoring typos but defers the deeper bucket-membership check to the engine layer that has access.

3. **`comboPlans` requires `heroView` + non-empty `bucketCandidates`.** A node without bucketCandidates has no anchor for bucket keys, so authoring would be unvalidatable. Reject up front rather than silently accept.

4. **Empty `comboPlans` object rejected.** "Omit the field instead of leaving empty" — keeps the schema crisp + catches in-progress authoring (a stub `comboPlans: {}` left behind).

---

## Next-session pickup

**Two paths unblocked, parallel:**

### LSW-P4 — Engine-derived plan panel
Wraps existing `evaluateGameTree` depth-2/3 output into a per-combo / per-action forward-look. Pure derivation, no authoring. Soft dep on Stream D1 — may run before D1 inheriting the `v1-simplified-ev` caveat.
- Likely entry point: new `derivePlanFromGameTree` function in `drillModeEngine.js` or a sibling `planDerivation.js`.
- Tests cover non-null depth-2 paths + `bailedOut` graceful degradation.

### LSW-P5 — UI integration
Plan section rendered under each branch in `LineNodeRenderer.jsx`. Conditional default visibility per Q2=C. Clickable rule chips opening shared `<RuleChipModal>` per Q3=B. Visual verification at 1600×720 mandatory.
- New components: `<RuleChipModal>`, `<RuleChip>`, `<HandPlanSection>` (or merge with existing panel scaffold).
- `sessionStorage`-persisted toggle.
- Visual smoke needs `npm run dev` + Playwright on JT6 flop_root + 1 unauthored node.

P4 and P5 can land in either order or parallel. Recommend **P5 first** since it surfaces the chip-modal UX (which is owner-visible) and the engine-derived render can land empty-state until P4 arrives. Or P4 first if you prefer to ship the engine first and have P5 read both sources at once. Owner's call.

---

## Open questions still deferred (no change from P1 handoff)

1. Per-archetype plan splits — defer to LSW-v2 P3 authoring.
2. MW empty-state copy line — needed in P5 since `evaluateGameTree` returns null for MW.
3. Modal stacking precedence (chip-tap from inside compute calculator modal) — recommend stack at z+1.
