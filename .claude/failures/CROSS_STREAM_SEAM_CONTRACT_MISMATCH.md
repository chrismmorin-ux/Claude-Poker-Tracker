# CROSS_STREAM_SEAM_CONTRACT_MISMATCH

**Status:** RESOLVED 2026-06-10 (live-bridge fix following WS-023 / SPR-114 drift CI).

## Pattern

Two modules built in separate work streams share an implicit data contract,
each side is thoroughly unit-tested against **hand-authored fixtures of its own
idea of the contract**, and no test drives real data through the seam. Each
suite is green; the seam is dead. The feature fails silently in production —
no error, no log, just "the thing never happens."

Concrete instance: EAL Stream B shipped `matcher.js` (consumes `situation`
with pot-fraction sizing + anchor-vocabulary board conditions per street).
Stream C shipped `deriveLiveSituation.js` (produces `situation` from gameReducer
state). Three contract mismatches accumulated unnoticed:

1. **Units:** bridge passed raw chip `amount` as `sizing`; matcher expected
   pot-fractions. Every `sizingRange` step failed (30 chips ∉ [1.0, 1.8]).
2. **Coverage:** bridge attached board info to the current street only; matcher
   required a `board` object on any step with a `boardCondition` — even the
   `texture: 'any'` wildcard. Every multi-street anchor failed.
3. **Vocabulary:** the texture producer emitted `'wet'|'medium'|'dry'`; the
   matcher's vocabulary includes `'paired'|'monotone'|'flush-complete'|
   'straight-complete'` + `scareKind`, which **no production code computed at
   all**.

Result: 3 of 4 seed exploit anchors could never fire on the live surface. The
LiveAdviceBar anchor badge — the feature's whole point — was dead since Stream C
shipped, with 45 green matcher tests and 14 green bridge tests the entire time.

## Symptoms

- Feature "works in tests, never in production" with zero errors.
- Unit fixtures on the consumer side look subtly different from what the
  producer actually emits (here: `sizing: 0.75` in matcher fixtures vs
  `sizing: 30` from the bridge; `board` on every street in fixtures vs one
  street from the bridge).
- The producer's own tests encode the bug as expected behavior
  (`deriveLiveSituation.test.js` asserted raw-amount passthrough).

## Root cause

The contract lived in doc comments (`matcher.js` situation-shape JSDoc,
schema-delta §2.2) but nothing executable crossed the seam. Hand-authored
fixtures on both sides drifted from each other because each author copied
their own mental model, not the other module's output.

## Fix

1. Root-cause fixes at the producer + a wildcard-semantics fix at the consumer
   (pot-fraction conversion via `calculatePotProgression`, per-street
   `deriveAnchorBoardCondition` in anchor vocabulary incl. scareKind,
   `'any'`-means-no-constraint in `matchesBoardCondition`).
2. **Seam test as a permanent fixture:** `anchorMatchDrift.test.js` liveBridge
   section drives realistic chip-denominated hands through
   `deriveLiveSituation → getMatchingAnchors` and asserts the active seed
   anchors actually fire — plus snapshots the full chain output so any future
   contract drift fails CI with a diff.
3. Fail-safe asymmetry encoded: when the producer can't honor the contract
   (missing blinds, estimated pot, unentered board), it OMITS the field rather
   than emitting a wrong value — constrained anchors then don't fire instead of
   mis-firing.

## Generalisation

Whenever module A (producer) and module B (consumer) are built in different
sessions/streams against a documented-but-not-executable contract:

- At least one test must feed B with A's REAL output on realistic input —
  fixtures authored by copying the contract doc don't count.
- Detection question for review: "does any test import BOTH modules?" If no,
  the seam is untested regardless of per-module coverage.
- Producers that can't fulfill a contract field should omit it (fail-safe),
  never approximate it in different units/vocabulary (fail-wrong) — an omitted
  field is detectable; a wrong-units value looks plausible everywhere.

Same class as [[feedback_picker_editor_field_parity]] (two surfaces of one
model drifting) but at module-contract level rather than UI-field level.

## Related

- `src/utils/anchorLibrary/__tests__/anchorMatchDrift.test.js` — the seam test.
- `docs/projects/exploit-anchor-library/schema-delta.md` §2.2 — the contract.
- Fix commits: WS-023 drift CI (`92c9320`) + the live-bridge fix (this session).
- `.claude/failures/TABLEVIEW_INVARIANT_GAP.md` — sibling class: invariants
  assumed but never executed.
