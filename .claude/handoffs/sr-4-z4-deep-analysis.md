# Session Handoff: sr-4-z4-deep-analysis

**Status:** COMPLETE — Z4 batch owner-approved 2026-04-13. Spec at `docs/sidebar-specs/z4-deep-analysis.md`. BACKLOG + STATUS updated; Zx kickoff opened at `sr-4-zx-overrides.md`. | **Written:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2. Cite rule numbers in every spec.
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — §Z4 (rows 4.1–4.3).
5. `docs/sidebar-specs/README.md` — spec template (8 fields) + drill-down vocabulary.
6. `docs/sidebar-specs/z0-chrome.md`, `z1-table-read.md`, `z2-decision.md`, `z3-street-card.md` — reference for style/depth/batch-invariants. Z4 must mirror their structure.

## Scope

Write `docs/sidebar-specs/z4-deep-analysis.md` — per-element specs for every Z4 row with a non-`delete` verdict.

Rows to spec (from inventory §Z4):
- **4.1** "PLAN" collapsible chevron (hand plan tree)
- **4.2** "More Analysis" collapsible (alt sizings / alt lines)
- **4.3** "Model Audit" collapsible (debug-flag gated — shares `settings.debugDiagnostics` with 0.7)

## Order of operations

1. Read files listed above, plus relevant render modules for context (do not modify):
   - `ignition-poker-tracker/side-panel/render-orchestrator.js` (plan panel, alternatives, audit wiring)
   - `ignition-poker-tracker/side-panel/side-panel.js` (collapsible state, scheduleRender, RT-61 plan auto-expand)
2. Draft `docs/sidebar-specs/z4-deep-analysis.md`:
   - One section per row in inventory order (4.1, 4.2, 4.3).
   - Use the 8-field template verbatim.
   - End with a **Batch invariants** section covering: (a) collapsible state ownership (who owns open/closed — per-hand reset vs persistent?); (b) auto-expand contract (RT-61 routes planPanel auto-expand through scheduleRender — spec must declare which conditions trigger auto-expand and R-2.4 `hand:new` reset behavior); (c) debug-flag contract for 4.3 (shared with 0.7; neither visible when flag off); (d) Z4 below-the-fold placement + R-3.1 tier (all three are `informational`, not decision-critical — spec must forbid any element from being promoted to decision-critical to keep Z2/Z3 primary).
3. Flag any row where a spec field cannot be authored without re-opening an inventory verdict or conflicting with a prior batch's invariants. Escalate per R-11.
4. Owner review gate — wait for approval before writing Zx batch.
5. On approval, update `.claude/BACKLOG.md` (SR-4 progress → 5/6), `.claude/STATUS.md`, and open `sr-4-zx-overrides.md` handoff.

## Known gotchas for Z4

- **Collapsible state ownership.** 4.1/4.2/4.3 are user-toggled. Spec must declare: does the open/closed state persist across `hand:new`? Across street changes? Does RT-61's auto-expand-on-fresh-advice override a user collapse? Likely answer: user collapse wins within the hand; `hand:new` resets to default (collapsed, except 4.1 if RT-61 trigger fires).
- **4.1 / 3.5 relationship.** Inventory row 3.5 is the hand plan block *inside* the street card. 4.1 is the collapsible chevron *above/beside* it. Spec must declare the ownership boundary: 4.1 owns the toggle + chevron UI; 3.5 owns the content rendered when open. No duplication of plan data between the two specs.
- **4.2 "More Analysis" content scope.** Inventory says "alt sizes, alt lines" — spec must enumerate exactly what renders (sizing presets? depth-2 branch EVs? alternative actions?). Check `render-orchestrator.js` for current content. If multiple content types live under one collapsible, declare the internal layout.
- **4.3 debug-flag contract.** Z0 batch declared `settings.debugDiagnostics` as the shared key for 0.7 and 4.3. Spec must cite this and declare that 4.3 is completely absent (not just hidden) from the DOM when the flag is off — matches the "don't tease unavailable features" principle.
- **R-3.1 tier discipline.** All three rows are `informational`. Spec must explicitly forbid any visual treatment (pulsing, color pops, auto-scroll, toast) that would elevate them to `decision-critical` and compete with Z2/Z3 for attention. R-1.2 targeted-glance: the 5-primary cap lives in Z1/Z2/Z3; Z4 is deliberately secondary.
- **Corpus coverage.** Inventory cites S3/01 and S5/01 for Z4 rows. Spec §7 must cite these frames. If 4.2's content varies across frames (e.g., alt-lines present vs absent), pick the clearest frame for each state and flag any corpus gap for SR-6.

## Deliverables checklist

- [ ] `docs/sidebar-specs/z4-deep-analysis.md` drafted (3 spec sections + batch invariants).
- [ ] Every spec has complete §3 glance pathway (all 4 sub-fields).
- [ ] Every spec cites ≥1 doctrine rule in §2.
- [ ] Every spec cites ≥1 S-frame in §7 (or flags corpus gap).
- [ ] Every spec declares §6 `hand:new` behavior (R-2.4) — including collapsible reset semantics.
- [ ] Collapsible state ownership rule declared in batch invariants.
- [ ] RT-61 auto-expand contract declared (4.1).
- [ ] Debug-flag absence-from-DOM rule declared (4.3).
- [ ] R-3.1 "informational-only, never promoted" rule declared for all Z4 rows.
- [ ] No spec re-opens an inventory verdict without R-11 escalation.
- [ ] Owner review requested.

## Files this session will modify

- `docs/sidebar-specs/z4-deep-analysis.md` (new)
- `.claude/BACKLOG.md` (SR-4 progress → 5/6, on approval)
- `.claude/STATUS.md` (active session + recently completed, on approval)
- `.claude/handoffs/sr-4-z4-deep-analysis.md` (this file → COMPLETE on approval)
- `.claude/handoffs/sr-4-zx-overrides.md` (new, on approval)

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed at v2.
- `docs/sidebar-specs/README.md` — template sealed.
- `docs/sidebar-specs/z0-chrome.md`, `z1-table-read.md`, `z2-decision.md`, `z3-street-card.md` — owner-approved; do not amend.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — sealed; any change requires R-11 escalation, not a silent patch.
- Any code under `ignition-poker-tracker/` — SR-4 is spec-only. Reading render modules for context is allowed.

## Owner decisions carried forward

- **E-2 from Z1 (Rule V seat-arc ring):** Z3 batch re-flagged but raised no new escalation. Still pending owner decision on whether to add as inventory row 1.11 or fold into 1.1. Does not block Z4.
- **E-3 from Z2 (S4/02-a + S4/02-b):** SR-6 follow-up. Z4 batch unaffected.
- **Z3 corpus gaps** (3.6-villain-postflop, 3.11-multiway-selector, 3.12-no-aggressor): SR-6 harness additions. Do not affect Z4.
- **Debug flag key:** `settings.debugDiagnostics`. Gates 4.3 (and 0.7).
- **Footer placement:** deferred to SR-5. Does not affect Z4.
- **R-11 escalation process** remains active — flag any rule conflict rather than silently amending.
