# Session Handoff: sr-4-z1-table-read

**Status:** COMPLETE — Z1 batch authored and owner-approved 2026-04-13. Spec at `docs/sidebar-specs/z1-table-read.md`. Two escalations (E-1 row 1.8 reassignment to Z2; E-2 Rule V selection ring as new surface) carried forward to Z2 handoff. | **Written:** 2026-04-13 | **Closed:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2. Cite rule numbers in every spec.
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — Z1 section (rows 1.1–1.10) + Rule V (villain range seat-selection).
5. `docs/sidebar-specs/README.md` — spec template (8 fields) + drill-down vocabulary.
6. `docs/sidebar-specs/z0-chrome.md` — **reference for style, depth, and batch-invariants format**. Z1 should mirror its structure.

## Scope

Write `docs/sidebar-specs/z1-table-read.md` — per-element specs for every Z1 row with a non-`delete` verdict.

Rows to spec (from inventory §Z1):
- **1.1** Seat circle (hands count ring)
- **1.3** Seat hero star
- **1.4** PFA annotation
- **1.5** Seat bet chip ("B $9" / "C $6" / "R $9")
- **1.7** Dealer button
- **1.8** Stale-advice border tint + "Stale Ns" badge
- **1.9** Villain style pill row
- **1.10** Seat check-mark indicator

Deleted (omit with one-line note):
- 1.2 seat style badge — deleted (1.9 pills are style source of truth)
- 1.6 seat action tag — deleted (duplicate of 1.5; R-5.1 single-owner)

## Order of operations

1. Read all files listed above.
2. Draft `docs/sidebar-specs/z1-table-read.md`:
   - One section per kept row in inventory-row order.
   - Use the 8-field template verbatim.
   - End with a **Batch invariants** section covering: Z1 seat-arc layout (fixed positions per seat count), single-owner per seat slot, `hand:new` reset behavior for all per-seat state, interaction between 1.9 pill row and Rule V seat selection.
3. Flag any row where a spec field cannot be authored without re-opening an inventory verdict. Escalate per R-11.
4. Owner review gate — wait for approval before writing Z2 batch.
5. On approval, update `.claude/BACKLOG.md` (SR-4 progress → 2/6), `.claude/STATUS.md`, and open `sr-4-z2-decision.md` handoff.

## Known gotchas for Z1

- **Rule V is doctrine for 1.9.** The villain pill row's click behavior feeds the Rule V override mechanism (see inventory §Rule V item 6). Spec 1.9 must describe how a click routes to the range slot (Z3 row 3.6/3.7/3.11) — but must NOT re-spec the range slot itself (that belongs in Z3). Cross-reference only.
- **1.8 is a cross-zone signal.** Stale-advice tint renders on both the action bar (Z2) and plan panel (Z4). Z1 spec covers only the Z1 side (if any seat-level stale indicator) OR clarifies that 1.8 is misfiled — verify against RT-48 implementation before writing. If 1.8 has no Z1 component, escalate to move the row out of Z1.
- **1.4 PFA annotation appears only postflop.** R-2.4 `hand:new` behavior: clear at preflop, set once preflop aggressor is known. Spec must declare this transition explicitly.
- **1.5 bet chip shares a slot with 1.10 check indicator.** Both are per-seat, per-street annotations. Only one can be active on a seat at a time (a seat that checked this street has no bet this street). Spec must declare the priority and which is the slot's declared owner (R-5.1).
- **1.1 seat circle hands-count ring — zero-hands state.** When a seat has 0 hands of data, does the ring render as empty, greyed, or absent? Spec must declare (consistent with R-4.2 unknown placeholder policy).
- **Vacant seats.** Inventory says "Vacant seats should blank" for 1.1. Spec must declare whether the slot reserves space for a vacant seat (R-1.3 no reflow) or whether the seat arc itself is a fixed geometry where vacant positions are visually absent. Check the existing seat arc rendering to confirm.

## Deliverables checklist

- [ ] `docs/sidebar-specs/z1-table-read.md` drafted (8 spec sections + batch invariants).
- [ ] Every spec has complete §3 glance pathway (all 4 sub-fields).
- [ ] Every spec cites ≥1 doctrine rule in §2.
- [ ] Every spec cites ≥1 S-frame in §7.
- [ ] Every spec declares §6 `hand:new` behavior (R-2.4).
- [ ] No spec re-opens an inventory verdict without R-11 escalation.
- [ ] Owner review requested.

## Files this session will modify

- `docs/sidebar-specs/z1-table-read.md` (new)
- `.claude/BACKLOG.md` (SR-4 progress → 2/6, on approval)
- `.claude/STATUS.md` (active session + recently completed, on approval)
- `.claude/handoffs/sr-4-z1-table-read.md` (this file → COMPLETE on approval)
- `.claude/handoffs/sr-4-z2-decision.md` (new, on approval)

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed at v2.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — verdicts sealed.
- `docs/sidebar-specs/README.md` — template sealed.
- `docs/sidebar-specs/z0-chrome.md` — owner-approved; do not amend.
- Any code under `ignition-poker-tracker/` — SR-4 is spec-only.

## Owner decisions carried forward from Z0

- **Debug flag key:** `settings.debugDiagnostics` (chrome.storage.local). Z1 has no elements gated by this, but any future reference uses this exact name.
- **Footer placement** (affects Z0 height, not Z1 layout directly): deferred to SR-5.
- **R-11 escalation process** is active — flag any rule conflict rather than silently amending.
