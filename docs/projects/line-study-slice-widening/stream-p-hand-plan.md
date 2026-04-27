---
id: lsw-stream-p-hand-plan
parent: line-study-slice-widening
name: LSW Stream P — Hand Plan Layer
status: active
priority: P1
created: 2026-04-27
approved: 2026-04-27
backlog-id: LSW-P
---

# LSW Stream P — Hand Plan Layer

**Parent charter:** `docs/projects/line-study-slice-widening.project.md`
**Status:** ACTIVE — owner-approved 2026-04-27. Foundational sub-streams (P1/P2/P4/P5) inserted between LSW phases 4 and 5; content sub-streams (P3/P6/P7) deferred to LSW-v2.

---

## Why this exists (the gap)

Line study currently teaches **range-vs-range** (range/nut advantage, board morphology, frameworks) and exposes **per-combo bucket EV** at one canary node. Stream B widens the latter so every flop root + bucket-shift turn answers *"is this branch correct for hero with combo X?"* across archetypes.

What none of A/B/C/D/F/G/H produce: a **forward-looking hand plan** — the GTOwizard-style *"with JTs on T96ss facing a 33% donk, your plan is call-call-fold to a 75% turn barrel; you stay in the call range (not raise) because you cap villain's range and want to keep their bluffs in; you plan to lead bricks that improve your equity-realization"*. The meta-rules behind the plan (MDF defense, range protection, why a high-equity hand stays in checking range, blocker-driven raises, call-with-a-plan thresholds) sit implicitly in `why`/`adjust` prose on a few nodes — not as structured authoring the student can navigate.

Without this, line study answers *"what is the right action?"* but never *"what should the user's plan be, and what rules govern it?"* — which is the layer that turns memorization into transfer.

---

## Scope

A new authoring + rendering dimension on line study, parallel to (not folded into) Stream B/C. Adds:

1. **Plan rule chip taxonomy** — a small reusable catalog (~10–15 chips) covering: MDF defense, range protection, checking-range construction, call-with-a-plan, call-fold-to-turn-barrel, raise-fold, thin-value-with-foldout, blocker-driven raise, capped-vs-uncapped exploitation, polarized-vs-linear response, equity-realization defense, board-improvement plan.
2. **Authored `comboPlans` field** — keyed by bucket (or specific combo) on decision nodes, each plan = `{ planText, ruleChipIds, byArchetype? }`. Authored on the 8 canonical lines, gated per-line behind audit close (same rule as Stream B).
3. **Engine-derived plan panel** — uses depth-2/3 game tree output already computed in `evaluateGameTree` to surface *"if you call and villain barrels turn for 75%, your best action is X with EV Y"* as a forward-look the user can scroll through. No authoring required; inherits Stream D's depth-2 accuracy.
4. **UI surface** — a "Hand Plan" section in `LineNodeRenderer.jsx` rendered under each branch. Authored plan (when present) + engine-derived plan (always, when depth-2 available). Visually distinct so the student sees what's taught vs what's solver-shaped.
5. **Audit hook** — adds a new audit dimension (call it dimension 8: "plan accuracy") to the per-line audit template. Disagreements between authored and engine-derived plans become Stream G tickets (engine wrong) or Stream F batches (content wrong) per the existing category-A/B/C/D rule.

---

## Out of scope

- Engine model changes (those flow through Stream D / G via the audit feedback loop, not here).
- River-level combo-by-combo plans for non-canonical lines — the long tail leans on engine-derived only.
- Live-play guidance (TableView LiveAdviceBar) — different surface, governed by the Hand Plan feature project, not line study.

---

## Sub-streams

| ID | Title | Sessions | Status | Gate |
|----|-------|----------|--------|------|
| P1 | Plan rule chip taxonomy + spec doc | 1 | **COMPLETE 2026-04-27** | Shipped: 12 chips + spec doc + 17 tests |
| P2 | Schema additions (`comboPlans` on `lineSchema.js`) + validator | 1 | **COMPLETE 2026-04-27** | Shipped: SCHEMA_VERSION 3→4 + validator + 25 tests |
| P4 | Engine-derived plan panel — wraps existing depth-2/3 output | 1–2 | **COMPLETE 2026-04-27** | Shipped: `planDerivation.js` + 33 tests + nextStreetPlan stub for D1 |
| P5 | UI integration in `LineNodeRenderer.jsx` + `BucketEVPanel.jsx` + tests | 1–2 | **COMPLETE 2026-04-27** | Shipped: `RuleChipModal` + `HandPlanSection` + wired into renderer + 33 component tests + 1600×720 Playwright walk on JT6 flop_root + turn_after_call |
| P3 | Authored plans on canonical flop roots (8 lines × ~3–6 buckets) | 2–3 | DEFERRED — LSW-v2 | Reason: defer until v1 student-usage data identifies which nodes drive teaching value. Re-open after LSW v1 closeout. |
| P6 | Audit dimension 8 added to `_TEMPLATE.md`; per-line plan-accuracy walks | rolling | DEFERRED — LSW-v2 | Reason: only meaningful once authored content (P3) exists. Re-open with P3. |
| P7 | Authored plans on turn bucket-shift nodes (~8 nodes) | 1–2 | DEFERRED — LSW-v2 | Reason: depends on P3 closure + Stream B2 turn-node coverage. Re-open with P3. |

**Foundational sub-streams CLOSED 2026-04-27** — 4 sessions total (1 each for P1/P2/P4/P5), tracked in handoffs `lsw-p1-plan-rules-taxonomy.md` / `lsw-p2-comboplans-schema.md` / `lsw-p4-plan-derivation.md` / `lsw-p5-ui-integration.md`. Test gain: pre-Stream-P 373 → post-P5 495 (+122 tests). v1 ships engine-derived plans on every node where `evaluateGameTree` returns non-null depth-2 output, addressing the GTOwizard-style hole-card-specific plan gap immediately.

**Deferred total (LSW-v2):** 3–5 sessions. Sequenced post-closeout, prioritized by v1 usage telemetry.

---

## Acceptance criteria

- Plan rule chip taxonomy file exists (`src/utils/postflopDrillContent/planRules.js` or appended to `frameworks.js`) with ≥10 chips, each carrying `{ id, label, shortBody, fullBody, citations }`.
- `lineSchema.validateLine` accepts and validates `comboPlans` shape; rejects dual-authored or orphaned chip IDs.
- Every flop decision root on the 8 audited lines has `comboPlans` entries covering every authored `bucketCandidates` value — at minimum a single-row plan per bucket.
- Every turn decision flagged dimension-6-YES *and* dimension-8-YES has authored `comboPlans`.
- Engine-derived plan panel renders on every decision node where `evaluateGameTree` returns a non-null depth-2 tree.
- UI 1600×720 verified: plan section does not overflow, does not crowd archetype toolbar, contrast survives dim-light.
- Audit dimension 8 closed GREEN on all 8 lines (or YELLOW with owner waiver).
- No regression on existing 322 postflop + component tests; new tests cover schema, taxonomy, render, and engine-plan derivation.

---

## How this changes the parent LSW phase plan

Insert into `docs/projects/line-study-slice-widening.project.md` § Phases:

| Phase | Status | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 4′ | [ ] | **Stream P1+P2** — taxonomy + schema | Taxonomy file + schema accept `comboPlans` |
| 4″ | [ ] | **Stream P3 + P5** — authored plans on flop roots + UI | All 8 flop roots have plans rendered |
| 5′ | [ ] | **Stream P4** — engine-derived plan panel (post-D1) | Panel renders on every node with depth-2 output |
| 6′ | [ ] | **Stream P7** — authored plans on turn bucket-shifts | Flagged turn nodes have plans |
| 8 | [ ] | Closeout (existing) — add: Stream P backlog zero-P1, audit dim-8 GREEN | (extends existing closeout) |

P6 (audit dimension 8) is rolling, threaded into Stream A re-walks where audits already closed.

---

## Tradeoffs / risks

- **Authoring debt.** ~25 decision nodes × ~5 bucket clusters × up-to-3 archetype splits ≈ 80–150 plan rows worst case. Mitigation: most plans collapse to bucket-level (no archetype split needed when the plan is the same); average ~1.5 rows per node-bucket pair. Real estimate: ~60–100 plan strings authored across the 8 lines.
- **Drift from engine changes.** Stream G tickets shift fold curves, archetype multipliers, taxonomy. Authored plans citing "call-fold to a 75% turn barrel" are sensitive to fold-curve drift. Mitigation: audit dim-8 catches divergence; plan text references *which rule* it leans on (chip ID), so drift in a chip body propagates without re-authoring every plan that cites it.
- **Schema risk.** `lineSchema.js` migration guard rejects dual-authored nodes (cf. LSW-G4-IMPL Commit 3 `heroHolding` → `heroView`). Adding `comboPlans` is additive, not a migration; risk is low but the spec must be explicit about whether `comboPlans` keys are bucket IDs, combo strings, or both.
- **Authored vs engine duplication.** Two plan sources can disagree even on canonical lines. The audit feedback loop is the resolution mechanism — disagreement *is* a finding, not a bug.
- **Display-density risk on 1600×720.** Adding a plan section under each branch + existing archetype toolbar + bucket-EV reveal panel could crowd the node renderer. Mitigation: collapsible by default, expanded on tap; H-PLT01 (sub-second glanceability) protects the existing primary action.

---

## Resolved decisions (owner approval 2026-04-27)

1. **Plan keying = bucket-keyed with per-combo override.** `comboPlans[bucketId] = { planText, ruleChips, overrides?: { [combo]: { planText, ruleChips } } }`. Validator must check that override combo strings appear in the bucket's combo set on that node. Authoring volume ~A baseline (~60–80 strings) + ~10–15 overrides total across 8 lines. *(P2 cascade: ~30 LOC of override membership validation in `lineSchema.js`.)*
2. **Engine-derived plan default visibility = conditional.** When authored plan is present → engine-derived plan hidden by default. When no authored plan → engine-derived plan shown by default. A "Show solver plan" toggle is always available, persisted via `sessionStorage` so advanced users see both everywhere after one toggle. *(P5 cascade: ~15 LOC of conditional render + toggle hook.)*
3. **Rule chips clickable → shared `<RuleChipModal>`.** A chip tap opens a shared modal rendering the chip's `fullBody` + `citations` from the P1 taxonomy spec. One reusable component (~80–120 LOC); no per-chip authoring beyond the taxonomy. The full glossary-as-study-surface ambition (cross-links + embedded calculators + entry points from HandReplay/TableView) is captured as follow-on `LSP-G` rather than rolled into Stream P.
4. **Phase placement = hybrid.** Foundational sub-streams **P1 + P2 + P4 + P5** insert between LSW phases 4 and 5 (4–5 sessions). Content sub-streams **P3 + P6 + P7** defer to LSW-v2, with v1 student-usage data informing which nodes earn authoring depth. v1 shipping behavior under this plan: schema supports `comboPlans` with overrides; UI renders plan section with conditional default; rule chip taxonomy + clickable modal live; engine-derived plans render on every decision node where `evaluateGameTree` returns depth-2 output (immediately addressing the GTOwizard gap). Authored plans wait for v2.

---

## Files this stream touches

### New
- `src/utils/postflopDrillContent/planRules.js` — chip taxonomy (or appended to `frameworks.js`)
- `docs/design/specs/hand-plan-layer.spec.md` — design spec produced in P1
- `docs/design/audits/line-audits/_TEMPLATE.md` — dimension 8 added (P6)

### Modified
- `src/utils/postflopDrillContent/lineSchema.js` — `comboPlans` validator
- `src/utils/postflopDrillContent/lines.js` — authored `comboPlans` per node (P3, P7)
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — plan section render
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` — optional plan integration

### Tests
- `src/utils/postflopDrillContent/__tests__/planRules.test.js` — taxonomy invariants
- `src/utils/postflopDrillContent/__tests__/lines.test.js` — schema validation extended
- `src/components/views/PostflopDrillsView/__tests__/LineNodeRenderer.test.jsx` — plan render

---

## Decisions log (for this sub-charter)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-27 | Stream P is a sub-charter under LSW, not a new project | Authoring + audit pipeline reuses LSW's per-line gating, audit template, and Stream G feedback loop. Splitting would duplicate ceremony. |
| 2026-04-27 | Two-source plan model (authored + engine-derived) | Authored teaches reliably but doesn't scale; engine-derived scales free but inherits calibration error. The audit loop reconciles. |
| 2026-04-27 | Plan keying = bucket-keyed with per-combo override (Q1=C) | Combo-keyed plans are 5–10× the authoring debt; per-combo override slot preserves specificity where it matters (e.g., flush-blocker raise vs non-blocker call). |
| 2026-04-27 | Engine-derived plan default visibility = conditional (Q2=C) | Authored present → hide engine; no authored → show engine. Avoids short-circuiting pedagogy on taught nodes while keeping un-authored nodes from rendering empty. `sessionStorage`-persisted toggle for advanced users. |
| 2026-04-27 | Rule chips clickable → shared `<RuleChipModal>` (Q3=B) | Chips become real learning units at low cost (~80–120 LOC reusable component). Full glossary-as-study-surface ambition deferred to follow-on `LSP-G`. |
| 2026-04-27 | Hybrid phase placement: foundational now, content deferred (Q4=C) | P1+P2+P4+P5 insert between LSW phases 4 and 5 (4–5 sessions); P3+P6+P7 defer to LSW-v2, prioritized by v1 usage telemetry. v1 closeout slips 4–5 sessions, not 7–12. |

---

## Closeout

**Promoted to ACTIVE 2026-04-27. Foundational sub-streams CLOSED 2026-04-27.** Closeout audit:

- [x] P1 spec doc shipped at `docs/design/surfaces/hand-plan-layer.md` with 12 chips defined (note: under existing `surfaces/` convention rather than new `specs/` dir per precedent).
- [x] P2 schema additions landed; `lineSchema.validateLine` accepts `comboPlans` with bucket-key + chip-ID + override-combo membership checks. SCHEMA_VERSION bumped 3 → 4.
- [x] P4 engine-derived plan derivation shipped at `src/utils/postflopDrillContent/planDerivation.js`. `nextStreetPlan` is a v1 stub awaiting LSW-D1's `evaluateGameTree.recommendations[].handPlan` wire-through.
- [x] P5 UI renders plan section with conditional default + chip modal; 1600×720 Playwright verified on JT6 flop_root (engine-only path) + turn_after_call (no-heroView path).
- [x] No regression on existing tests: 495/495 green across `PostflopDrillsView` + `postflopDrillContent` (+122 tests vs pre-Stream-P 373 baseline).
- [x] Parent charter Phases table 4′/4″ inserts updated.
- [x] BACKLOG entries `LSW-P1` / `LSW-P2` / `LSW-P4` / `LSW-P5` all marked COMPLETE.

**Owner-visible state at v1 ship:** every Line Study decision node with `heroView` renders an engine-derived solver plan (per-action EV table + best-action highlighted + templated reason + caveats). Authored plans (`comboPlans` on `lines.js` nodes) are v2-deferred (P3); the schema + UI are in place to receive them when v2 starts. Rule chip modal is wired and tested but not user-reachable in v1 (no live node has `comboPlans` populated).

Closeout for the deferred sub-streams (P3+P6+P7) lives with LSW-v2; this sub-charter remains open as the canonical reference.
