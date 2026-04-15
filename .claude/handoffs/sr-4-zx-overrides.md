# Session Handoff: sr-4-zx-overrides

**Status:** COMPLETE — Zx batch owner-approved 2026-04-13. SR-4 closed (6/6). SR-5 kickoff handoff opened at `.claude/handoffs/sr-5-architecture-audit.md`. | **Written:** 2026-04-13 | **Closed:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2. Cite rule numbers in every spec.
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — §Zx (rows X.1 through X.7, including X.2/X.4a-c/X.5b-h subs).
5. `docs/sidebar-specs/README.md` — spec template (8 fields) + drill-down vocabulary.
6. All five prior batch files — `z0-chrome.md`, `z1-table-read.md`, `z2-decision.md`, `z3-street-card.md`, `z4-deep-analysis.md`. Zx references them for cross-zone contracts (especially Z2's stale contract + Z0's debug-flag contract) and must mirror their structure.

## Scope

Write `docs/sidebar-specs/zx-overrides.md` — per-element specs for every Zx row with a non-`delete` verdict.

Rows to spec (from inventory §Zx):

**App-sync + pipeline state:**
- **X.1** "Launch Poker Tracker →" CTA link (absorbs X.2 per merge verdict — single-line form)
- **X.3** "No active table detected" + subtitle (5s grace)
- **X.4a / X.4b / X.4c** Recovery banner (triangle + container, message text, Reload button) — one composite spec or three linked specs; authoring decision belongs to this batch

**Tournament overlay (conditional-render):**
- **X.5** Tournament top bar (M + zone pill + level + countdown)
- **X.5b** M-Ratio gauge + zone label
- **X.5c** Blinds row (current + next)
- **X.5d** Stack row (BB count + avg comparison) — `decision-critical` tier
- **X.5e** Blind-Out row (levels + minutes) — `decision-critical` tier
- **X.5f** ICM row — `decision-critical` tier
- **X.5g** Milestones row

**Observer mode (conditional-render):**
- **X.6** Observer scouting panel
- **X.7** OBSERVING badge on board

Rows omitted (inventory verdicts):
- **X.2** — merged into X.1 (note the absorption in X.1 §1).
- **X.5h** — deleted per owner 2026-04-12 Group 5G (redundant with top-bar counts).

## Order of operations

1. Read files listed above, plus relevant render modules for context (do not modify):
   - `ignition-poker-tracker/side-panel/render-orchestrator.js` (tournament bar, observer panel, recovery banner, app-bridge CTA)
   - `ignition-poker-tracker/side-panel/side-panel.js` (X.4 recovery message flow, 5s no-table grace timer, tournament state plumbing)
2. Draft `docs/sidebar-specs/zx-overrides.md`:
   - One section per row in inventory order.
   - Use the 8-field template verbatim.
   - Group within the file: **§A App-sync + pipeline overrides** (X.1, X.3, X.4*), **§B Tournament overlay** (X.5*), **§C Observer mode** (X.6, X.7).
   - End with a **Batch invariants** section covering the topics listed below.
3. Flag any row where a spec field cannot be authored without re-opening an inventory verdict or conflicting with a prior batch's invariants. Escalate per R-11.
4. Owner review gate — wait for approval before closing SR-4.
5. On approval: update `.claude/BACKLOG.md` (SR-4 → COMPLETE 6/6), `.claude/STATUS.md` (SR-4 done, SR-5 unblocked), close this handoff, open `sr-5-architecture-audit.md` kickoff handoff.

## Required batch invariants for Zx

Zx is the "override / edge state" zone, which means the central question is **who owns which slot when the overrides are active**. Prior batches declared `decision-critical` for Z2 rows and `informational` for Z4; Zx has rows of every tier (ambient, informational, decision-critical) and must declare the preemption rules explicitly. Required invariants:

1. **Zone-takeover contract (R-3.2 / R-3.3 / R-3.4).** Which Zx states preempt the active-hand Z1–Z4 layout, and which coexist? Candidates:
   - **Tournament bar X.5** — likely *always-visible* top row in tournament mode, coexisting with Z0–Z4 (does not preempt). Spec must declare placement (above Z0? overlaying Z0?) and whether it counts as a new zone or an extension of Z0.
   - **Observer mode X.6/X.7** — *replaces* Z2 decision content (hero has no action to plan, so `decision-critical` tier is released). Spec must declare that Z2 blanks cleanly (no ghost headlines) when X.6 is active and `decision-critical` is not violated because there is no active decision to preempt.
   - **App-not-open X.1** — *between-hands informational* (R-3.4). Must declare it does NOT render during active hands even if app-bridge is disconnected mid-hand.
   - **No-table X.3** — *replaces the entire live-context pipeline* (Z1–Z4 have nothing to render). Spec must declare whether Z0 chrome persists through X.3.
   - **Recovery banner X.4** — *overlay*, not a replacement. Must declare which zones it overlays and whether it blocks interaction.
2. **Between-hands vs active-hand FSM (R-2.4).** X.1 is explicitly between-hands. Spec must declare the FSM: which trigger causes X.1 to mount (`hand:complete` + app-bridge disconnected) and which unmounts it (`hand:new` or app-bridge reconnected). No render-coordinator short-circuiting — the FSM owns the lifecycle.
3. **Tournament overlay cohesion.** X.5 top bar and X.5b–g detail panel share a data source (`lastGoodTournament`) and a collapsed/expanded state. Declare the toggle ownership (coordinator key), the `hand:new` behavior (tournament data is cross-hand — likely persists), and whether the detail panel coexists with active-hand Z2/Z3/Z4 or preempts them. Likely answer: detail panel is user-opened, expands in place inside the tournament zone, does not touch Z1–Z4.
4. **Observer mode tier release.** X.6 is explicitly "relevant precisely because hero has no action to plan" — in Observer mode, the `decision-critical` tier (R-3.2) does not apply because there is no active hero decision. Spec must declare this explicitly: Observer mode is a legitimate `informational` takeover of the Z2 slot, not a R-3.2 / R-3.3 violation.
5. **Recovery banner stacking.** X.4a/b/c compose a single visual unit (warning triangle + message + button). Spec must declare whether they are authored as one composite spec or three linked specs; either is acceptable if the DOM ownership and lifecycle are clear. Recommended: **one composite spec** keyed on X.4 with sub-fields noting the three DOM elements, since they never render independently.
6. **X.1 absorption of X.2.** Per owner 2026-04-12 merge verdict, X.1 is now the single-line form "Launch Poker Tracker for exploit tips & live advice →". X.1 §1 must explicitly list the absorbed row (X.2) and §8 may note the rejected two-line form.
7. **Cross-zone contracts already declared in prior batches.** Zx inherits, it does not redeclare. Specifically:
   - Stale-advice tint cross-zone contract lives in `z2-decision.md` batch invariant 8; Zx elements that render advice-derived content (unlikely but possible, e.g. X.6 observer notes) inherit that contract by reference.
   - Debug-flag contract lives in `z0-chrome.md` (0.7) and `z4-deep-analysis.md` (4.3, batch invariant 6); no Zx row is debug-flag gated per current inventory.
8. **`decision-critical` tier audit for X.5d/e/f.** Three tournament rows carry `decision-critical` tier per inventory. R-3.2 says `decision-critical` is baseline during active hands; Zx rows are off-path from the main decision flow. Spec must declare how `decision-critical` applies to a tournament detail row (likely: when the detail panel is open, these rows take the glance priority within the tournament zone; they do NOT preempt Z2's headline). If this feels like a stretch, flag as escalation.

## Known gotchas for Zx

- **Tournament bar placement.** Inventory calls X.5 the "always-visible top row". Spec must declare whether this is *above Z0* (new zone) or *inside Z0* (extending the chrome zone). Prior batches treated Z0 as "chrome + pipeline status"; adding the tournament bar to Z0 would expand Z0's scope. Either answer is defensible — pick one and justify.
- **X.3 vs Z0 chrome during no-table state.** When no table is detected, Z0 pipeline dot (0.1) presumably still renders (connected-but-no-table is a valid pipeline state). Spec must disambiguate: X.3 replaces Z1–Z4, but Z0 stays. If Z0 also blanks, say so.
- **X.4 recovery banner lifecycle.** `push_recovery_needed` arms the banner; what unmounts it? Reload success? A timer? An explicit `push_recovery_cleared`? Check the render orchestrator for the unmount path before writing the FSM.
- **X.6/X.7 Observer mode detection.** How does the sidebar know it is in Observer mode (HS2)? Is there a message type? Derived state? Spec §4 must name the exact source.
- **Corpus coverage.** Zx uses S4/02 (between-hands), S8/01 (no-table), S9/01 (recovery), S10/01 (tournament), S11/02 (Observer). Every spec §7 must cite at least one frame. Tournament subs may share frames — acceptable.

## Deliverables checklist

- [ ] `docs/sidebar-specs/zx-overrides.md` drafted (all kept Zx rows + batch invariants).
- [ ] Every spec has complete §3 glance pathway (all 4 sub-fields).
- [ ] Every spec cites ≥ 1 doctrine rule in §2.
- [ ] Every spec cites ≥ 1 S-frame in §7 (or flags corpus gap for SR-6).
- [ ] Every spec declares §6 `hand:new` behavior (R-2.4) — including "does not apply / cross-hand persistence" where appropriate (tournament data).
- [ ] Zone-takeover contract declared for each Zx state (R-3.2/R-3.3/R-3.4).
- [ ] Between-hands FSM declared for X.1.
- [ ] Tournament overlay cohesion rule declared (X.5 + X.5b–g).
- [ ] Observer mode tier-release rule declared (X.6/X.7).
- [ ] Recovery banner composite-spec decision documented.
- [ ] X.1 absorption of X.2 declared in X.1 §1 and §8.
- [ ] `decision-critical` tier audit for X.5d/e/f documented (with R-11 escalation if the tier assignment is unworkable).
- [ ] No spec re-opens an inventory verdict without R-11 escalation.
- [ ] Owner review requested.

## Files this session will modify

- `docs/sidebar-specs/zx-overrides.md` (new)
- `.claude/BACKLOG.md` (SR-4 → COMPLETE 6/6, SR-5 unblocked, on approval)
- `.claude/STATUS.md` (SR-4 complete, SR-5 active, on approval)
- `.claude/handoffs/sr-4-zx-overrides.md` (this file → COMPLETE on approval)
- `.claude/handoffs/sr-5-architecture-audit.md` (new, on approval)

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed at v2.
- `docs/sidebar-specs/README.md` — template sealed.
- `docs/sidebar-specs/z0-chrome.md`, `z1-table-read.md`, `z2-decision.md`, `z3-street-card.md`, `z4-deep-analysis.md` — owner-approved; do not amend.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — sealed; any change requires R-11 escalation.
- Any code under `ignition-poker-tracker/` — SR-4 is spec-only. Reading render modules for context is allowed.

## Owner decisions carried forward

- **E-2 from Z1 (Rule V seat-arc ring):** still pending owner decision on whether to add as inventory row 1.11 or fold into 1.1. Zx does not block on this; fair to defer to SR-5.
- **E-3 from Z2 (S4/02-a pot chip + S4/02-b street strip):** SR-6 follow-up. Zx unaffected.
- **Z3 corpus gaps** (3.6-villain-postflop, 3.11-multiway-selector, 3.12-no-aggressor): SR-6 harness additions.
- **Z4 corpus gaps** (RT-61 auto-expand, no-plan path, 4.2 one-block, flag-off absence, flag-on no-audit): SR-6 harness additions.
- **Debug flag key:** `settings.debugDiagnostics`. Gates 0.7 and 4.3 only — no Zx row uses it per current inventory.
- **Footer placement:** deferred to SR-5.
- **R-11 escalation process** remains active.

## SR-4 closeout prep

This is the final SR-4 batch. On owner approval of Zx:
- SR-4 moves to COMPLETE in BACKLOG.
- SR-5 (architecture audit) unblocks — its kickoff handoff should enumerate the ordered rebuild backlog and consume every SR-4 batch's escalations (E-2, E-3, corpus TODOs across Z0/Z3/Z4/Zx) as inputs to the Stage 5 `05-architecture-delta.md` document.
- The six `docs/sidebar-specs/*.md` files become the **authoritative spec surface** for SR-6 implementation PRs.
