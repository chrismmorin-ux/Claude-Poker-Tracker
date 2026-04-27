# Handoff — LSW-P1 (Plan Rule Chip Taxonomy + Spec Doc)

**Status:** COMPLETE 2026-04-27
**Session owner:** Claude (main)
**Project:** Line Study Slice Widening (LSW), Stream P (Hand Plan Layer)
**Sub-charter:** `docs/projects/line-study-slice-widening/stream-p-hand-plan.md`
**BACKLOG:** LSW-P1 → COMPLETE; **LSW-P2 unblocked → NEXT**

---

## What shipped

Three deliverables:

1. **`src/utils/postflopDrillContent/planRules.js`** — chip taxonomy module
   - 12 owner-approved chips: `mdf-defense`, `range-protection`, `checking-range-construction`, `call-with-a-plan`, `call-fold-to-turn-barrel`, `raise-fold`, `thin-value-with-foldout`, `blocker-driven-raise`, `capped-uncapped-exploitation`, `polarized-linear-response`, `equity-realization-defense`, `board-improvement-plan`.
   - Shape: `{ id, label, shortBody, fullBody, citations }` per chip.
   - Citation shape: `{ source: 'POKER_THEORY.md' | 'external', anchor, note? }`.
   - Citations anchored to POKER_THEORY.md §§1.4 / 1.5 / 3.3 / 3.5 / 3.6 / 3.7 / 4.1 / 4.2 / 5.6 / 5.7 / 5.8 / 6.1 / 6.2 / 6.4 / 6.6 / 7.1.
   - Exports: 12 named chips (SCREAMING_SNAKE_CASE) + `PLAN_RULE_CHIPS` (id-keyed map) + `PLAN_RULE_CHIP_ORDER` (pedagogically ordered) + helpers (`isKnownRuleChip`, `listKnownRuleChips`, `getRuleChip`).
   - All chips + citations frozen via `freezeChip` helper (mutation prevention).

2. **`docs/design/surfaces/hand-plan-layer.md`** — spec doc
   - Lives under existing `surfaces/` convention (not new `specs/` dir — minor correction from BACKLOG entry).
   - Doctrine: I-HP-1 (plans cite chips, chips own bodies), I-HP-2 (authored takes precedence; engine is long-tail default), I-HP-3 (chips clickable → shared `<RuleChipModal>`).
   - Schema contract for LSW-P2: `comboPlans?: Record<bucketId, { planText, ruleChips, overrides? }>`.
   - Default visibility rule for LSW-P5: `selectActivePlanSource(node, activeBucket, toggleState)` returns `'authored-only' | 'engine-only' | 'both' | 'none'`. Toggle persisted via `sessionStorage['handPlanShowSolver']`.
   - Two-source plan-model table — authored vs engine-derived coverage / authority / cost / drift.
   - Three deferred open questions (per-archetype splits, MW empty-state copy, modal stacking).

3. **`src/utils/postflopDrillContent/__tests__/planRules.test.js`** — invariants test
   - 17 tests across 4 describe blocks: taxonomy invariants, ordering, lookup helpers, named-export consistency.
   - Validates: ≥10 chips, shape per chip, kebab-case ID format, POKER_THEORY.md `§N.M` anchor format, freeze invariants, owner-approved chip-name presence, named-export ↔ index consistency.

---

## Verification

```
npx vitest run src/utils/postflopDrillContent/__tests__/planRules.test.js
→ 17/17 green

npx vitest run src/utils/postflopDrillContent
→ 19 files, 390/390 green (+17 from baseline 373)
```

No regressions. No code changes outside the new files.

---

## Files I owned this session

- **NEW:** `src/utils/postflopDrillContent/planRules.js`
- **NEW:** `docs/design/surfaces/hand-plan-layer.md`
- **NEW:** `src/utils/postflopDrillContent/__tests__/planRules.test.js`

Updated (small bookkeeping):
- `.claude/BACKLOG.md` — LSW-P1 → COMPLETE; LSW-P2 unblocked → NEXT.

---

## Next-session pickup (LSW-P2)

LSW-P2 is unblocked. Scope per BACKLOG entry + spec doc §"Schema additions":

1. Extend `src/utils/postflopDrillContent/lineSchema.js` with `comboPlans` validator on decision nodes.
2. Validator rules (numbered in spec doc §"Schema additions"):
   - Additive — legacy nodes without `comboPlans` remain valid.
   - Bucket keys must appear in node's `bucketCandidates` (or v3 `heroView` resolved bucket set).
   - Chip IDs must satisfy `isKnownRuleChip(id)` from `planRules.js` (import).
   - Override combo strings must appear in the bucket's combo set on this node.
   - `planText` non-empty trimmed string ≤ 320 chars.
   - `ruleChips` non-empty array.
3. Add ~6 new test cases to `lineSchema.v3.test.js` (or new file): well-formed plan accepted, orphaned bucket key rejected, unknown chip ID rejected, orphaned override combo rejected, empty planText rejected, additive (legacy validity preserved).

LSW-P4 + P5 unblock once P2 closes.

---

## Open questions surfaced this session (for owner)

Three carried into the spec doc as DEFERRED, not blockers:

1. **Per-archetype plan splits.** Add `byArchetype?: ...` to `ComboPlanEntry` once authoring (P3, deferred to LSW-v2) demonstrates real archetype-conditional plans. Premature today.
2. **MW empty-state copy.** Engine-derived plans require `evaluateGameTree` non-null; MW returns null. Need a copy line for "plans not yet available for multi-way pots" — author with P5.
3. **Modal stacking.** A chip tap from inside the existing `compute` calculator modal: stack vs replace vs queue? Recommend stack (z-index +1, layered backdrop) per existing precedent.

None are blockers for P2/P4/P5. Surface them at LSW-v2 kickoff.
