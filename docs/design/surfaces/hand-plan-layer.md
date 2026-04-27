# Surface — Hand Plan Layer

**ID:** `hand-plan-layer`
**Status:** DRAFT — Stream P P1 design artifact.
**Scope:** A new "what's my plan" rendering layer added under each decision branch in Line Study. Composes (a) authored bucket-keyed plans with rule-chip citations and (b) engine-derived forward-look plans drawn from `evaluateGameTree` depth-2/3 output.
**Sub-charter:** `docs/projects/line-study-slice-widening/stream-p-hand-plan.md`
**Code paths (target after implementation):**
- `src/utils/postflopDrillContent/planRules.js` (DONE — chip taxonomy, this artifact's P1 deliverable)
- `src/utils/postflopDrillContent/lineSchema.js` (P2 — `comboPlans` validator with override membership checks)
- `src/utils/postflopDrillContent/drillModeEngine.js` or sibling (P4 — engine plan derivation)
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` (P5 — plan section render)
- `src/components/views/PostflopDrillsView/panels/RuleChipModal.jsx` (P5 — new shared modal)

**Route / entry points:** Sub-surface of Postflop Drills → Line. Renders inside `LineNodeRenderer` under each decision branch on every node, gated on either `node.comboPlans` (authored) being populated for the active hero bucket OR `evaluateGameTree` returning a non-null depth-2 tree (engine-derived).

**Last reviewed:** 2026-04-27 (draft author — Stream P P1).

---

## Purpose

This layer answers one question for one decision branch: **"given the action you're about to take and the bucket your hero combo falls in, what should your plan be on subsequent streets, and what rules govern that plan?"**

It is explicitly **not**: a single-action recommender (the existing branch `correct` flag does that), a range-vs-range equity viewer (BucketEVPanel does that), a live-game advice bar (sidebar `LiveAdviceBar` does that), or a solver substitute (we don't run solvers; we surface authored plans + game-tree-derived plans, both of which inherit the existing accuracy boundaries).

The layer exists because line study currently teaches range-vs-range and per-combo bucket EV but stops short of the GTOwizard-style **forward plan**: *"with JTs facing 33% donk, your plan is call-call-fold to a 75% turn barrel; you stay in the call range (not raise) because BB's range is uncapped post-3-bet and you cap their value combos by flatting; you plan to lead bricks and check scare cards."* That layer — the meta-rules behind the plan, not just the action — is what turns memorization into transfer.

---

## Doctrine

Three invariants the layer must satisfy. Every primitive / authoring rule / engine-derived render is checked against these.

**I-HP-1. Plans cite rules; rules carry their own bodies.** Authored plans never inline rule explanations — they cite chips by ID. The chip taxonomy (`planRules.js`) owns the explanation; plans only own the *application* to this specific node + bucket. This decouples drift: when a rule's framing improves, every plan citing it updates without re-authoring.

**I-HP-2. Authored plans take precedence; engine plans are the long-tail default.** When a node has an authored plan for the active hero bucket, render the authored plan and hide the engine-derived plan by default. When no authored plan exists, render the engine-derived plan. A `sessionStorage`-persisted toggle ("Show solver plan") lets advanced users reveal both. This protects pedagogy on taught nodes while keeping un-authored nodes informative.

**I-HP-3. Rule chips are clickable; tap opens a shared `<RuleChipModal>`.** Chips are not decorative labels. Tapping a chip surfaces its `fullBody` + `citations` from the taxonomy. The modal is one shared component — no per-chip authoring beyond the chip definition.

**Structural enforcement.** I-HP-1 is enforced at schema level: `comboPlans[bucketId].ruleChips` must be string IDs that resolve via `isKnownRuleChip(id)`. I-HP-2 is enforced at render level: `LineNodeRenderer` calls a single `selectActivePlanSource(node, activeBucket, toggleState)` helper returning `'authored' | 'engine' | 'both'`. I-HP-3 is enforced by component contract: `<RuleChip>` always wires `onClick` to open `<RuleChipModal>` for its chip ID.

---

## Schema additions (LSW-P2 contract)

`lineSchema.js` extension on decision nodes:

```ts
type ComboPlanEntry = {
  planText: string;            // 1-3 sentence forward plan in plain English
  ruleChips: string[];         // chip IDs, validated against planRules.PLAN_RULE_CHIPS
  overrides?: Record<string, ComboPlanOverride>; // combo string → override
};

type ComboPlanOverride = {
  planText: string;
  ruleChips: string[];
  // No nested overrides — flat one-level structure.
};

type DecisionNode = {
  // ... existing fields ...
  comboPlans?: Record<string, ComboPlanEntry>; // bucketId → plan
};
```

**Validator rules (LSW-P2):**
1. `comboPlans` is **additive** — legacy nodes without it remain valid.
2. Every key in `comboPlans` must appear in the node's `bucketCandidates` (or, for v3 schema, in the resolved bucket set for the active `heroView`). Orphaned bucket keys are rejected.
3. Every chip ID in `ruleChips` must satisfy `isKnownRuleChip(id)`. Orphaned chip IDs are rejected with the failing ID + a hint to `planRules.PLAN_RULE_CHIPS`.
4. Every key in `overrides` must be a combo string that *appears in the bucket's combo set on this node*. Orphaned combo overrides are rejected. Membership is checked against the same combo enumeration the bucket teaching pipeline uses.
5. `planText` must be a non-empty trimmed string, ≤ 320 characters (1–3 sentences). Empty or whitespace-only rejected.
6. `ruleChips` must be non-empty (a plan with no rules is a P0 authoring smell — chips are why the plan transfers).

**Migration:** none required — `comboPlans` is purely additive to existing v3 schema.

---

## Default visibility rule (LSW-P5 contract)

```js
selectActivePlanSource(node, activeBucket, toggleState) →
  | 'authored-only'   // authored present, toggle off
  | 'engine-only'     // no authored, engine present (default for un-authored nodes)
  | 'both'            // toggle on (sessionStorage), both present
  | 'none'            // no authored AND no engine output (degenerate; render empty state)
```

- Authored present + toggle off → `'authored-only'`
- Authored present + toggle on → `'both'`
- No authored + engine present → `'engine-only'` (toggle is moot but still rendered for state consistency)
- No authored + no engine → `'none'` (graceful empty state — no plan section rendered at all, not an error placeholder)

Toggle persistence: `sessionStorage['handPlanShowSolver'] = '1' | '0'`. Default off (absent → off). Persists across nodes within the same session; a fresh session starts off again.

---

## Chip-tap contract (LSW-P5 contract)

```jsx
<RuleChip
  chipId="mdf-defense"
  onClick={() => openModal(chipId)}
/>

<RuleChipModal
  chipId={openedChipId}
  onClose={() => setOpenedChipId(null)}
/>
```

`<RuleChipModal>` reads the chip via `getRuleChip(chipId)` and renders:
- Chip `label` as title
- Chip `shortBody` as the lead sentence (italicized)
- Chip `fullBody` as the body
- Chip `citations` as a footer list with `source` + `anchor` + optional `note`

Touch target: chip pill ≥ 32×32 DOM-px, rendered at scale to satisfy 1600×720 ≥ 44×44 effective. Modal dismissible via Esc, backdrop tap, or close button. No focus-trap escape via Tab — keep keyboard navigation contained while open.

---

## Two-source plan model

| Source | Authored (`comboPlans`) | Engine-derived (P4) |
|--------|-------------------------|---------------------|
| Coverage | Canonical lines, per audit dim-8 priority | Every node where `evaluateGameTree` returns non-null depth-2 |
| Content | 1–3 sentence plan + rule chips | "What the solver expects to happen" forward-look — per-combo, per-action EV at this node + the next-street decision tree branches |
| Authority | Pedagogically taught material | Inherits engine accuracy bounds (depth-2 calibration; v1-simplified-ev caveat until LSW-D1 ships) |
| Cost | ~1 plan string per bucket × node + ~10–15 overrides total across 8 lines | Pure derivation; no authoring |
| Drift | Static — re-audited per Stream A turn | Tracks engine changes (Stream G); inherits any depth-2 calibration shifts automatically |

The two sources can disagree even on canonical lines. The audit dimension 8 walk (LSW-P6, deferred to LSW-v2) reconciles disagreements via the existing Stream F (content wrong) / Stream G (engine wrong) routing, same as Stream A's category-A/B/C/D classification.

---

## v1 ship scope (Stream P foundational)

P1 (DONE 2026-04-27): chip taxonomy with 12 chips + this spec.
P2: schema extension for `comboPlans` with override-membership validator.
P4: engine-derived plan derivation wrapping `evaluateGameTree` depth-2 output.
P5: UI integration — plan section render + `<RuleChipModal>` + toggle.

**v1 ships with zero authored plans.** Per Q4=C (hybrid placement), authoring (P3) defers to LSW-v2 with v1 student-usage data driving prioritization. Every decision node where depth-2 returns non-null gets engine-derived plans on day one.

---

## Out of scope (deferred to LSW-v2 or LSP-G)

- **Authored plans on canonical lines (P3, P7).** Defer until v1 student-usage data identifies which nodes earn teaching depth.
- **Audit dimension 8 (P6).** Defer until P3 produces authored content to walk.
- **Glossary-as-study-surface (LSP-G).** Chip taps in v1 open a single modal with the chip body + citations. The richer ambition — cross-links to other plans citing this chip, embedded `compute` calculators (MDF, pot-odds, equity-realization), entry points from HandReplay + TableView education tooltips — is captured in `LSP-G` as a follow-on program.
- **Multi-villain plan coverage.** Plans on MW lines (`btn-vs-bb-sb-srp-mw-j85`, `co-vs-btn-bb-srp-mw-oop`) inherit whatever bucket-EV coverage LSW-G6 produces. No special MW handling at the plan layer in v1.

---

## Open questions (deferred)

1. **Per-archetype plan splits.** Should `ComboPlanEntry` carry `byArchetype?: Record<archetype, Pick<ComboPlanEntry, 'planText' | 'ruleChips'>>` for the cases where fish/reg/pro plans differ? Current answer: **defer to P3 authoring**. If the audit dim-8 walk surfaces real archetype-conditional plans on multiple nodes, add the field then. Premature optimization risk: most plans are archetype-invariant; add complexity only when content demands it.
2. **Plan section visibility on un-authored MW nodes.** Engine-derived plans require `evaluateGameTree` returning non-null; MW returns null today. A "plans not yet available for multi-way pots" empty-state copy line should ship with P5 to avoid silent absence.
3. **`<RuleChipModal>` modal stacking.** Line study already has the bucket-EV reveal panel and (where present) the calculator modal. Tap a chip from inside the calculator modal — does it stack, replace, or queue? Recommend stack (z-index +1, backdrop layered) per existing modal precedent in the codebase.

---

## Related artifacts

- Sub-charter: [`docs/projects/line-study-slice-widening/stream-p-hand-plan.md`](../../projects/line-study-slice-widening/stream-p-hand-plan.md)
- Parent project: [`docs/projects/line-study-slice-widening.project.md`](../../projects/line-study-slice-widening.project.md)
- Chip taxonomy: `src/utils/postflopDrillContent/planRules.js`
- Decision-modeling doctrine: `docs/design/surfaces/bucket-ev-panel-v2.md` (I-DM-1/2/3)
- Poker theory anchors: `.claude/context/POKER_THEORY.md` §1.4, §1.5, §3.5, §3.7, §4.1, §4.2, §5.6, §5.7, §6.1, §6.2, §6.4, §7.1
