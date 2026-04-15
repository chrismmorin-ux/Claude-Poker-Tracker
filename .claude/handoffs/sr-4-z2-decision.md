# Session Handoff: sr-4-z2-decision

**Status:** COMPLETE — owner-approved 2026-04-13. Z3 handoff opened at `.claude/handoffs/sr-4-z3-street-card.md`. | **Written:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2. Cite rule numbers in every spec.
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — Z2 section (rows 2.1–2.9). Note: row 1.8 is carried forward from Z1 per E-1 escalation and should be spec'd here (re-numbered to 2.10).
5. `docs/sidebar-specs/README.md` — spec template (8 fields) + drill-down vocabulary.
6. `docs/sidebar-specs/z0-chrome.md` and `docs/sidebar-specs/z1-table-read.md` — reference for style, depth, and batch-invariants format. Z2 should mirror their structure.

## Scope

Write `docs/sidebar-specs/z2-decision.md` — per-element specs for every Z2 row with a non-`delete` verdict, plus the absorbed stale-advice row (1.8 → 2.10).

Rows to spec (from inventory §Z2):
- **2.1** Action headline ("BET"/"CALL"/"FOLD" large colored text)
- **2.2** Edge callout ("+3.1 edge")
- **2.3** Equity % inline (headline) — verdict: keep; 2.4 loses equity
- **2.4** Equity/SPR row — verdict: keep **SPR only**; equity moved to 2.3
- **2.5** Board card chips
- **2.6** Hero hole-card chips
- **2.7** Pot size chip
- **2.8** Street progress strip
- **2.9** "Analyzing…" placeholder
- **2.10** (new, carried from Z1) Stale-advice border tint on action bar + "Stale Ns" badge (RT-48). Plan-panel tint belongs in Z4 batch; this spec covers the Z2 (action bar) half only and cross-references the Z4 half.

Deleted rows: none in Z2.

## Order of operations

1. Read all files listed above, plus `side-panel/side-panel.js:945–981` and `:1594–1615` for the RT-48 implementation details needed for row 2.10.
2. Draft `docs/sidebar-specs/z2-decision.md`:
   - One section per row in inventory-row order, with 2.10 appended at the end.
   - Use the 8-field template verbatim.
   - End with a **Batch invariants** section covering: Z2 fixed-column layout (action bar strip above the board/pot strip), decision-critical tier hygiene (Z2 dominates `decision-critical` — no other zone should preempt), single-owner slot priority for equity (declared in 2.3 vs 2.4 carve-out), `hand:new` reset semantics for the full zone.
3. Address **E-1 from Z1 batch**: this batch makes 1.8 → 2.10 official in the spec layer. Also patch `SIDEBAR_PANEL_INVENTORY.md` to move row 1.8 into the Z2 table as row 2.10. This is a minimal inventory edit executing an already-approved R-11 escalation — NOT a verdict re-opening. Note the edit explicitly in the batch header.
4. Address **E-2 from Z1 batch**: not a Z2 concern per se, but if the owner has decided the Rule V selection ring's home (row 1.11 new vs fold into 1.1), carry that decision forward. If still undecided, re-flag at end of this batch.
5. Flag any row where a spec field cannot be authored without re-opening an inventory verdict. Escalate per R-11.
6. Owner review gate — wait for approval before writing Z3 batch.
7. On approval, update `.claude/BACKLOG.md` (SR-4 progress → 3/6), `.claude/STATUS.md`, and open `sr-4-z3-street-card.md` handoff.

## Known gotchas for Z2

- **2.3 vs 2.4 equity ownership.** Inventory verdict: equity is in 2.3 (headline inline), 2.4 reduces to "SPR: X". Spec must declare 2.3 as single owner of the equity channel (R-5.1) and explicitly state 2.4 no longer renders equity. Do not describe 2.4 as "was equity/SPR" — describe it as "SPR row" and treat the historical form as a rejected alternative.
- **2.7 pot-size staleness (S4/02 bug candidate).** Inventory flags the pot chip as still visible between-hands (possible bug). Z2 spec for 2.7 must declare the correct behavior: blank between hands, re-appear on the next hand's first bet. If the spec-correct behavior differs from current code, flag as a regression for SR-6 (do not fix in SR-4).
- **2.8 street progress staleness (same S4/02).** Same concern as 2.7 — street progress still shows filled dots between hands. Spec the correct behavior (reset at `hand:new`) and flag the regression.
- **2.9 "Analyzing…" vs 2.10 stale indicator.** These are mutually exclusive states. 2.9 = no advice yet; 2.10 = advice exists but is stale. Spec must declare the priority and which wins when both would trigger. Per RT-48 logic, advice presence disambiguates — the spec should mirror that.
- **2.10 cross-zone cross-reference to Z4.** The stale-tint also renders on the plan panel (Z4). Z2 spec covers only the action-bar half. Note explicitly that the plan-panel half will be spec'd in `z4-deep-analysis.md`, and the two halves must share a single data source and single renderKey field (R-5.1 — single-owner upstream, even though rendered in two zones).
- **2.5 board vs 2.6 hero hole cards.** Both are chip rows. Must not collide geometrically with the pot chip (2.7). Spec declares the three-column layout inside the Z2 board strip.
- **2.1 action color channel.** The headline color encodes action (BET green, CALL blue, FOLD red — or existing palette). This color is a separate channel from the Z0 pipeline dot (also green/amber/red) and the stale-advice yellow-orange tint (2.10). Spec must confirm no channel conflict and cite the palette source.

## Deliverables checklist

- [ ] `docs/sidebar-specs/z2-decision.md` drafted (9 spec sections + batch invariants; 2.10 included).
- [ ] `docs/SIDEBAR_PANEL_INVENTORY.md` patched to move 1.8 → 2.10 (E-1 executed).
- [ ] Every spec has complete §3 glance pathway (all 4 sub-fields).
- [ ] Every spec cites ≥1 doctrine rule in §2.
- [ ] Every spec cites ≥1 S-frame in §7.
- [ ] Every spec declares §6 `hand:new` behavior (R-2.4).
- [ ] 2.7 and 2.8 between-hands behavior explicitly declared; S4/02 regression flagged if code diverges.
- [ ] 2.10 declares cross-zone contract with Z4 half.
- [ ] No spec re-opens an inventory verdict without R-11 escalation.
- [ ] Owner review requested.

## Files this session will modify

- `docs/sidebar-specs/z2-decision.md` (new)
- `docs/SIDEBAR_PANEL_INVENTORY.md` (move row 1.8 → 2.10; executing approved E-1)
- `.claude/BACKLOG.md` (SR-4 progress → 3/6, on approval)
- `.claude/STATUS.md` (active session + recently completed, on approval)
- `.claude/handoffs/sr-4-z2-decision.md` (this file → COMPLETE on approval)
- `.claude/handoffs/sr-4-z3-street-card.md` (new, on approval)

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed at v2.
- `docs/sidebar-specs/README.md` — template sealed.
- `docs/sidebar-specs/z0-chrome.md`, `docs/sidebar-specs/z1-table-read.md` — owner-approved; do not amend.
- Any code under `ignition-poker-tracker/` — SR-4 is spec-only. (Reading `side-panel.js` for RT-48 details is allowed.)

## Owner decisions carried forward

- **E-1 from Z1:** approved. Execute the 1.8 → 2.10 inventory move and spec the row in this batch.
- **E-2 from Z1 (Rule V seat-arc ring):** still pending owner decision at time of Z1 approval. If undecided at Z2 kickoff, re-flag at end of Z2; if decided, it belongs in Z1 amend (separate R-11 patch, not this batch).
- **Debug flag key:** `settings.debugDiagnostics`. No Z2 elements gated by it.
- **Footer placement:** deferred to SR-5; does not affect Z2.
- **R-11 escalation process** remains active — flag any rule conflict rather than silently amending.
