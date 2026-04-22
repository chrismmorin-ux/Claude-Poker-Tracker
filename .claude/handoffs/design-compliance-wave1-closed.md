# Handoff — Design Compliance Wave 1 CLOSED (code-complete)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Plan:** `C:\Users\chris\.claude\plans\twinkling-seeking-valiant.md`
**Status:** CODE-COMPLETE. All 17 findings across 3 surfaces shipped. Pending owner visual verification on device. BACKLOG row moves to formal COMPLETE after owner signs off on the checklist below.

---

## Wave 1 by the numbers

- **9 sessions** (S1 → S9). One day elapsed.
- **17 findings shipped** across TableView (12), ShowdownView (7), SessionsView (7 total, 1 WITHDRAWN after verification).
- **3 audits produced** (one per surface), all with Gate-5 resolution sections appended.
- **1 Gate-2 blind-spot roundtable** (TableView).
- **Gate 3 framework-level work bundled into S2:** 2 new situational personas (ringmaster-in-hand, newcomer-first-hand), 4 new JTBDs (HE-17, MH-10, MH-11, TS-43, TS-44), 1 phantom-JTBD defect resolved (bubble-decision.md), new `contracts/` framework primitive with persisted-hand-schema.md, 1 intentionally-incomplete journey (briefing-review.md), 4 scored discoveries.
- **3 distinct destructive-action undo patterns** shipped + documented: HYDRATE_STATE undo (TableView, ShowdownView), deferred-delete (SessionsView), optimistic-then-revert (SessionsView rebuy). Each matched to its underlying state model.
- **Test suite: 6213/6214 passing** (1 pre-existing `precisionAudit.test.js` stochastic Monte Carlo failure unrelated). **+88 tests** vs S4 baseline (6125 → 6213).
- **Zero behavioral regressions detected.** Every surface's dedicated test suite stays green across every session.

## What's now true about Wave-1 surfaces

- **Every destructive action on TableView, ShowdownView, SessionsView is wrapped in a 12s toast+undo.** `window.confirm` eliminated everywhere. Three architectural variants, one user experience.
- **Every touch target on primary paths is ≥44px** (H-ML06). `MENU_ROW_CLASS` / `RECENT_ROW_CLASS` single-source-of-truth constants prevent future drift.
- **`inputMode="decimal"` is the established pattern** for numeric inputs (PotDisplay, CashOutModal, rebuy input). Compact Android keypad.
- **Freshness signal on advice is binary-labeled** — AGING amber between 20-60s, STALE red at 60s+. No opacity-only signals.
- **Scope-preview before commit:** orbit strip shows "+N folds" badge; Quick-Mode Won shows "mucks N others" sub-label. Destructive-action bulk side-effects are visible.
- **Tip accounting on cash-out is no longer silent** — new optional field persists to Session record; BankrollDisplay subtracts.
- **Layout is collision-free at any scale** on SessionsView bottom bar and ShowdownView button row.
- **Orbit strip wraps instead of horizontally scrolling** — no silent off-screen seats at narrow viewports.
- **`useAnalysisContext` is canonical**, deprecated alias preserved. Developer-clarity improvement for a name that misled for months.
- **Live/Online filter** on past sessions list; localStorage-persisted.

## Owner visual verification checklist (S10 completion gate)

Reference device: Samsung Galaxy A22 landscape (1600×720). Also verify on sub-reference landscape (~900×400) where noted.

### TableView

- [ ] **F1 Reset Hand**: with actions recorded, tap Reset Hand → NO native dialog; warning toast "Hand reset" with Undo (12s); Undo restores exact state.
- [ ] **F2 Orbit strip**: mid-preflop with action on UTG → orbit buttons between UTG and a downstream position show "+N" red badges; tapping auto-folds that many; post-toast count matches pre-tap badge.
- [ ] **F3 Sizing preset editor**: long-press the "2/3 pot" sizing button → editor opens with "editing **2/3 pot**" gold subtitle + that slot's input has gold border + autofocus.
- [ ] **F4 AGING badge**: wait 20s+ without street change → amber "AGING · Ns" badge appears (font 11, not opacity fade). 60s+ → red STALE badge.
- [ ] **F5 Undo duration**: Next Hand + Reset Hand undo both last 12s.
- [ ] **F6 Recent players list**: open seat context menu → Recent section header shows "N players" count. With >8 recents, bottom-fade gradient appears.
- [ ] **F7 Orbit strip narrow**: at ~900×400 landscape, orbit wraps to 2 rows (no horizontal scroll). +N badges correctly positioned.
- [ ] **F8 Recent rows**: visibly ≥44px tall (consistent with primary menu rows).
- [ ] **F9 PotDisplay**: single tap → "Long-press to correct" tooltip flashes; no keyboard. 400ms+ hold → edit mode with compact numeric keypad.
- [ ] **F10 Reset Hand proximity**: Reset Hand visibly smaller + dimmer than neighbors; physical gap above gold Next Hand CTA.
- [ ] **F11 Rename**: no user-visible change. Build still succeeds.
- [ ] **F12 Reopen-last range**: open range panel for a seat → close → "↻ Reopen range (S{N})" button bottom-left; tap to restore.

### ShowdownView

- [ ] **F1 Next Hand**: at showdown, tap Next Hand → NO native dialog; success toast "Hand recorded" with Undo; Undo re-opens Showdown with full state restored (action sequence, community cards, hole cards, allPlayerCards, dealer button, street, hand count). Same for winner-confirmation overlay Next Hand.
- [ ] **F2 Header layout**: Done button is LEFT-anchored with `←` icon; Next Hand is RIGHT-anchored with gold glow; BOARD + mode toggle sit between them.
- [ ] **F3 Clear Cards**: in Full Mode, tap Clear Cards → warning toast with Undo restores every card slot + action sequence. In Quick Mode, Clear Cards button is ABSENT.
- [ ] **F4 Quick Mode Won**: 5-way showdown → each Won button shows "mucks 4 others" sub-label; heads-up (1 other) shows no sub-label. Tap Won → success toast with Undo reverts WON+MUCKED batch.
- [ ] **F5 CardGrid overflow**: at narrow viewport, CardGrid scrolls horizontally to reveal low-rank columns that were previously clipped. At reference 1600×720, no visible change.
- [ ] **F6 Seat headers**: Full-Mode summary shows "Seat 1".."Seat 9" column headers (no blue Labels buttons).
- [ ] **F7 Empty equity banner**: in Full Mode with partial board (<5 community cards), amber info banner "Hand rankings require all 5 board cards" visible.

### SessionsView

- [ ] **F1 Delete Session**: tap Delete on a past SessionCard → NO native dialog; warning toast with Undo; card reappears on undo; card permanently removed after timeout (verify via reload).
- [ ] **F2 Tip field**: end active session → CashOutModal shows Cash Out Amount + Tip field with helper text "Included in P&L". Both use compact numeric keypad. Enter $200 + $20 tip → P&L = $200 - buyIn - rebuys - $20.
- [ ] **F3 Import warning**: verify warning copy "replace ALL existing data" accurately reflects the behavior (import does clear-then-restore). **Withdrawn — visual check is confirmation that the finding is indeed invalid.**
- [ ] **F4 Rebuy entry**: tap + Add Rebuy → "Use $X" preset button above input commits immediately with Undo toast. Typed input uses compact keypad. Confirm/Cancel visibly ≥44px.
- [ ] **F5 Bottom bar**: at reference 1600×720, BankrollDisplay left + drill buttons right-justified; no overlap. At sub-reference scale, same (no collision).
- [ ] **F6 SessionForm**: Start New Session → type custom venue → tap outside the form (backdrop) → dialog STAYS OPEN (dirty guard). Tap × to close → dialog dismisses.
- [ ] **F7 Filter pills**: with past online sessions present, All/Live/Online pills render in past-sessions header. Select Live → online sessions hidden. Reload page → filter choice persists.

### Regression spot-checks

- [ ] A normal live hand from dealer-click → 9 preflop actions → flop → turn → river → Showdown → Next Hand → fresh hand loads correctly.
- [ ] An online session from Ignition import still displays correctly under All and Online filters.
- [ ] PlayerPicker / PlayerEditor flows unaffected.
- [ ] Tournament overlay on TableView still renders with M-ratio + ICM pressure.

## Outstanding non-Wave-1 items still queued from Wave 1 audits

These surfaced during W1 but were routed to their own tracks:

- **4 discoveries** logged in `docs/design/discoveries/`:
  - `2026-04-21-push-fold-widget` (WSJF ~21, Pro tier) — dedicated ≤15bb push/fold widget, replacing equity-derived advice below threshold.
  - `2026-04-21-briefing-badge-nav` (WSJF ~80, Free+) — cross-surface nav edge from TableView seat-badge → PlayersView review queue.
  - `2026-04-21-decision-tree-fate` — owner A/B/C decision on DecisionTreeView (revive / fold-in / retire).
  - `2026-04-21-sidebar-tournament-parity` (may expand Wave 5) — Hybrid/Online MTT Shark cross-product tournament-overlay gap.
- **Journey doc** at `journeys/briefing-review.md` — intentionally-incomplete journey documenting the broken notification loop.
- **Contract doc** at `contracts/persisted-hand-schema.md` — seeded the new framework primitive.
- **Framework patches** to atlas + bubble-decision persona + 2 new situational personas — all load-bearing on audit severity calibration.

## What closes this wave formally

When the owner visual-verification checklist is walked and any regressions are resolved:

1. Mark `DCOMP-W1` status from `CODE_COMPLETE` → `COMPLETE` in `.claude/BACKLOG.md`.
2. Update `docs/design/surfaces/{table,showdown,sessions}-view.md` Known-issues sections to reflect verified closure (remove "pending owner verification").
3. Append final CLOSED entry to each audit file.
4. Update STATUS.md: move DCOMP-W1 entries to "Recently Completed".
5. Unblock **DCOMP-W2** (Review surfaces — hand-replay / analysis / stats) as the next wave.

## What I will NOT do without owner input

- Mark DCOMP-W1 COMPLETE in BACKLOG (visual verification is the gate).
- Start Wave 2 (owner priority call — W2 vs W4 vs W3 sequencing flexibility is in the roadmap).
- Act on the 4 discoveries (each needs owner decision on scope + tier).

## Closed

51 tasks across Wave 1. Plan `twinkling-seeking-valiant.md` executed front-to-back with no mid-stream re-plan. Framework-level investment (S2) demonstrably paid off in audit severity calibration and implementation decisions downstream.
