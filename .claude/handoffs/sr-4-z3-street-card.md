# Session Handoff: sr-4-z3-street-card

**Status:** COMPLETE — owner-approved 2026-04-13. Spec at `docs/sidebar-specs/z3-street-card.md`. | **Written:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2. Cite rule numbers in every spec.
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — §Z3 (rows 3.1–3.12) + §Rule V section.
5. `docs/sidebar-specs/README.md` — spec template (8 fields) + drill-down vocabulary.
6. `docs/sidebar-specs/z0-chrome.md`, `z1-table-read.md`, `z2-decision.md` — reference for style/depth/batch-invariants. Z3 must mirror their structure.

## Scope

Write `docs/sidebar-specs/z3-street-card.md` — per-element specs for every Z3 row with a non-`delete` verdict.

Rows to spec (from inventory §Z3):
- **3.1** ACTION HISTORY header
- **3.2** Action history chips ("Pre 2", "FLOP S3B$9")
- **3.3** Action-rationale line
- **3.4** Fold-% callout (keep — primary villain read)
- **3.5** Hand plan block (forward branch plan)
- **3.6** Range slot — grid (fixed-size, hero preflop OR villain postflop)
- **3.7** Range slot — headline row
- **3.8** Range grid legend
- **3.11** Range slot — multiway seat selector (NEW)
- **3.12** Range slot — empty/no-aggressor placeholder (NEW)
- **3.9** "Waiting for next hand…" placeholder

Deleted rows: 3.10 (duplicate "Waiting for next deal…" — 3.9 wins).

## Order of operations

1. Read files listed above, plus relevant render modules:
   - `ignition-poker-tracker/side-panel/render-street-card.js` (street-adaptive Z3 logic)
   - `ignition-poker-tracker/side-panel/render-orchestrator.js` (hand plan, fold%, range slot wiring)
2. Draft `docs/sidebar-specs/z3-street-card.md`:
   - One section per row in inventory order (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.11, 3.12, 3.9).
   - Use the 8-field template verbatim.
   - End with a **Batch invariants** section covering: Z3 fixed-slot layout (range slot is single fixed-height container — 3.6/3.7/3.8/3.11/3.12 all share it with declared priority); Rule V cross-zone contract (Z1 pill-click → Z3 range-slot seat override); 3.9 vs Zx boundary (which between-hands renderer owns the placeholder); 3.10 rejected-alternatives note.
3. Address Rule V in full: this batch owns the **Z3 half** of the Rule V contract (the Z1 half was specified as batch invariant 6 of `z1-table-read.md`). Spec must declare how the range slot selects which seat's range to show, in priority order, and how a user pill-click overrides the default.
4. Address the **3.6/3.7/3.8/3.11/3.12 single-slot carve-out**: all five rows render inside one fixed-height container. Declare the priority rule (which renders when) and R-1.3 compliance (no reflow — slot height is constant even across multiway ↔ HU ↔ no-aggressor states).
5. Flag any row where a spec field cannot be authored without re-opening an inventory verdict. Escalate per R-11.
6. Owner review gate — wait for approval before writing Z4 batch.
7. On approval, update `.claude/BACKLOG.md` (SR-4 progress → 4/6), `.claude/STATUS.md`, and open `sr-4-z4-deep-analysis.md` handoff.

## Known gotchas for Z3

- **Single-slot carve-out.** Rows 3.6, 3.7, 3.8, 3.11, 3.12 all live inside one fixed-height container ("the range slot"). Spec must declare:
  - Which row is the outer frame owner (likely 3.6 or 3.7).
  - Priority rule for which content renders when (hero preflop vs villain postflop vs no-aggressor vs multiway seat-selected).
  - R-1.3 guarantee: slot height is invariant across states. Placeholder 3.12 fills it when no data; multiway selector 3.11 shares top strip with 3.7 headline.
- **Rule V contract (Z3 half).** Z1 batch invariant 6 commits Z1 to emitting a pill-click with seat index. Z3 spec must declare:
  - Default seat selection priority (PFA → HU opponent → multiway-first-bettor → no-aggressor placeholder).
  - Override behavior when user clicks a pill in 1.9 or a chip in 3.11.
  - `hand:new` reset of any override (user override should not persist across hands — R-2.4).
- **3.9 vs Zx boundary.** Inventory tags 3.9 as `handState === 'COMPLETE'` — a between-hands state. Zx overrides also fire between hands. Spec must declare whether 3.9 is the Z3 in-zone placeholder (active hand, awaiting next context) or a Zx override (full-zone takeover). If the boundary is ambiguous, escalate. Current corpus (S4/02) shows 3.9 inside the street card frame, suggesting it's Z3-local — spec should match.
- **3.10 deletion note.** Inventory deletes 3.10 as a duplicate of 3.9 (poker-correct noun "hand" beats "deal"). Spec omits 3.10 with a one-line note at the top of the file (matching the Z1 batch's omission notes).
- **Range slot data contract (3.6).** The slot switches content by street: preflop → hero's range matrix; postflop → villain's narrowed range. This is NOT a simple `if (street === preflop)` branch — it also depends on seat selection (Rule V). Spec must declare the full decision tree for "what does 3.6 render right now?" in one place.
- **3.2 "PRE 2" vs 3.5 "handPlan" overlap.** Action history chips summarize past actions; hand plan describes future branches. Spec must make clear these are temporally disjoint — there is no ambiguity about which renders when — but both can render simultaneously (past + future in the same street card).
- **3.4 fold% sample-size guard.** Inventory column notes "Insufficient sample" as invalid state. Spec must declare the threshold (likely from `bayesianConfidence.js`) and the R-4.2 placeholder rendering for low-sample villains.

## Deliverables checklist

- [ ] `docs/sidebar-specs/z3-street-card.md` drafted (11 spec sections + batch invariants; 3.10 omission note).
- [ ] Every spec has complete §3 glance pathway (all 4 sub-fields).
- [ ] Every spec cites ≥1 doctrine rule in §2.
- [ ] Every spec cites ≥1 S-frame in §7 (or flags corpus gap — Known Gaps section of inventory flags 3.6 villain postflop + 3.11 + 3.12 as corpus gaps).
- [ ] Every spec declares §6 `hand:new` behavior (R-2.4).
- [ ] Rule V Z3-half contract declared in batch invariants.
- [ ] Single-slot carve-out (3.6/3.7/3.8/3.11/3.12) priority rule declared.
- [ ] 3.9 vs Zx boundary declared (or escalated).
- [ ] No spec re-opens an inventory verdict without R-11 escalation.
- [ ] Owner review requested.

## Files this session will modify

- `docs/sidebar-specs/z3-street-card.md` (new)
- `.claude/BACKLOG.md` (SR-4 progress → 4/6, on approval)
- `.claude/STATUS.md` (active session + recently completed, on approval)
- `.claude/handoffs/sr-4-z3-street-card.md` (this file → COMPLETE on approval)
- `.claude/handoffs/sr-4-z4-deep-analysis.md` (new, on approval)

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed at v2.
- `docs/sidebar-specs/README.md` — template sealed.
- `docs/sidebar-specs/z0-chrome.md`, `z1-table-read.md`, `z2-decision.md` — owner-approved; do not amend.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — sealed; any change requires R-11 escalation, not a silent patch.
- Any code under `ignition-poker-tracker/` — SR-4 is spec-only. Reading render modules for context is allowed.

## Owner decisions carried forward

- **E-2 from Z1 (Rule V seat-arc ring):** still pending owner decision — row 1.11 new vs fold into 1.1. If decided before Z3 kickoff, surface the decision in Z3 batch invariants (the Z3-selected-villain visual is the upstream trigger for the Z1 ring). If still pending, re-flag.
- **E-3 from Z2 (S4/02-a + S4/02-b):** SR-6 follow-up item. Z3 batch unaffected; mention only if 3.9's spec-correct behavior also depends on the between-hands Zx override root cause.
- **Debug flag key:** `settings.debugDiagnostics`. No Z3 elements gated by it.
- **Footer placement:** deferred to SR-5; does not affect Z3.
- **R-11 escalation process** remains active — flag any rule conflict rather than silently amending.
