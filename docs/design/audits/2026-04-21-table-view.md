# Audit — 2026-04-21 — TableView (Heuristic)

**Scope:** Surface (`table-view`) + sub-components
**Auditor:** Claude (main) + product-ux-engineer agent (heuristic walk)
**Method:** Gate-4 heuristic walkthrough (Nielsen 10 + Poker-Live-Table + Mobile-Landscape) × 4 primary situational personas; carry-forward findings from Gate-2 blind-spot roundtable ([2026-04-21-blindspot-table-view.md](./2026-04-21-blindspot-table-view.md)) consolidated; code-level evidence for every claim.
**Status:** Draft — owner approved 2026-04-21; Gate 5 P1 implementation shipped same-session (see §"Gate 5 resolution" below).

---

## Executive summary

Audited TableView and its 9 sub-components (598 + ~1800 LOC) against the framework's three heuristic sets, through the eyes of the four acute-situational personas (mid-hand-chris, between-hands-chris, ringmaster-in-hand, newcomer-first-hand — the latter two authored same-session). **Twelve findings: four at severity 3, five at severity 2, three at severity 1.** The dominant theme is **destructive-action safety**: four of the four severity-3 findings are cases where a single tap under time pressure can corrupt hand state, save wrong calibration, or silently fold multiple seats. Three carry forward from the Gate-2 blind-spot audit (`window.confirm`, orbit scroll, etc.); six are novel to this walkthrough. The most acute is F1 (`window.confirm` on Reset Hand) — explicitly forbidden by the mid-hand-chris surface contract and already has the correct pattern (toast+undo) shipped elsewhere in the same file. No severity-4 findings.

---

## Scope details

- **Surfaces audited:** `table-view` (primary). Sub-components: `TableView.jsx`, `CommandStrip.jsx`, `ControlZone.jsx`, `SeatComponent.jsx`, `SeatContextMenu.jsx`, `LiveAdviceBar.jsx`, `SizingPresetsPanel.jsx`, `TableHeader.jsx`, `CardSelectorPanel.jsx`, `src/components/ui/PotDisplay.jsx`, `src/components/ui/RangeDetailPanel.jsx`.
- **Journeys considered:** live-hand-entry (every hand); briefing-review entry-point (referenced, not walked — see `journeys/briefing-review.md`).
- **Personas walked:** [mid-hand-chris](../personas/situational/mid-hand-chris.md), [between-hands-chris](../personas/situational/between-hands-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md). Also considered: [push-fold-short-stack](../personas/situational/push-fold-short-stack.md) (routed to DISC).
- **Heuristic sets applied:** Nielsen 10 (H-N01..10), Poker-Live-Table (H-PLT01..08), Mobile-Landscape (H-ML01..07).
- **Out of scope:** visual verification at 1600×720 or smaller viewports (Playwright MCP still unavailable — findings that depend on visual layout are flagged as "Open questions"). TournamentView overlay integration. Sidebar parity (tracked in DISC).

## Artifacts referenced

- `surfaces/table-view.md` — canonical surface artifact
- `audits/2026-04-21-blindspot-table-view.md` — Gate-2 blind-spot roundtable + Gate-3 resolution
- `contracts/persisted-hand-schema.md` — writer contract
- `journeys/briefing-review.md` — cross-surface loop
- Evidence: [EVID-2026-04-21-TABLE-WINDOW-CONFIRM](../evidence/LEDGER.md#evid-2026-04-21-table-window-confirm), [EVID-2026-04-21-TABLE-TOUCH-TARGET-40PX](../evidence/LEDGER.md#evid-2026-04-21-table-touch-target-40px)

---

## Findings

### F1 — `window.confirm()` on Reset Hand in live play

- **Severity:** 3 (destructive action in primary situation; modal interrupt explicitly forbidden)
- **Situations affected:** [mid-hand-chris](../personas/situational/mid-hand-chris.md) (primary), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md) (primary — "non-modal-everything")
- **JTBD impact:** `JTBD-HE-11` (one-tap action entry) — Reset Hand's `window.confirm` blocks all other UI interactions including action buttons until dismissed. For ringmaster-in-hand, this stalls the deal.
- **Heuristics violated:** H-N05 (error prevention done wrong), H-PLT06 (zero-cost misclick absorption), H-PLT08 (no-interruption input)
- **Evidence:** [EVID-2026-04-21-TABLE-WINDOW-CONFIRM](../evidence/LEDGER.md) — `src/components/views/TableView/CommandStrip.jsx:254`. The correct pattern (toast + undo) already exists in the same file for Next Hand (lines 201–249) and Clear Player (355–369).
- **Observation:** A native browser confirm dialog pulls focus, blocks render, and requires two-tap dismissal. Mid-hand-chris's surface contract lists "pop modals that block the table view" as a forbidden pattern. Ringmaster-in-hand lists this as the canonical lethal interaction.
- **Recommended fix:** Replace `window.confirm` with the existing toast-with-undo pattern. Snapshot the hand state before reset, show "Hand reset — Undo" toast for 6 seconds, restore on undo tap.
- **Effort:** S (one file, ~20 lines; mirror the Next Hand undo pattern).
- **Risk:** Low. Same invariants as Next Hand undo, already tested.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21-TV F1] Replace window.confirm on Reset Hand with toast+undo pattern`

---

### F2 — Orbit tap-ahead silently auto-folds multiple seats without scope preview

- **Severity:** 3 (destructive bulk action in primary situation; no pre-action feedback)
- **Situations affected:** [mid-hand-chris](../personas/situational/mid-hand-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md)
- **JTBD impact:** `JTBD-HE-11` — hand action entry can record 3+ folds from a single mis-tap with no pre-commit visibility.
- **Heuristics violated:** H-N01 (visibility of system status — scope of action is invisible), H-N05 (error prevention), H-PLT06
- **Evidence:** `src/components/views/TableView/CommandStrip.jsx:133-172`. `handleOrbitTap` computes `foldCount` AFTER folding, then shows an informational toast ("Folded 3 seats"). No pre-action display of how many seats a tap would fold.
- **Observation:** Tapping "CO" when action is on "UTG" silently folds UTG, UTG+1, HJ, MP, LJ (5 seats) and shows a post-hoc toast. At the table under time pressure, an accidental orbit tap creates an immediate need to Undo before the next action — and the undo toast auto-dismisses in 5 seconds (see F5).
- **Recommended fix:** Dynamic badge on each orbit strip button showing `+N folds` when the button is the hypothetical tap target. No confirmation dialog (breaks flow); just preview-before-commit via a live count badge. Alternative: require a brief (~200ms) hold for multi-fold taps (tap for 0-1 auto-folds, hold for 2+).
- **Effort:** M (state tracking for hovered/focused orbit target + badge rendering).
- **Risk:** Low. Additive UI; undo flow unchanged.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21-TV F2] Orbit strip preview-count badge for auto-fold scope`

---

### F3 — Sizing preset long-press opens editor with no indication of which preset is being edited

- **Severity:** 3 (saves wrong calibration data silently — analog of destructive)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (primary calibration moment), [mid-hand-chris](../personas/situational/mid-hand-chris.md) (if adjusted mid-session)
- **JTBD impact:** `JTBD-MH-04` (sizing tied to villain's calling range) — mis-edit corrupts the preset the user *thought* they were calibrating.
- **Heuristics violated:** H-N01 (system status: which slot is being edited?), H-N06 (recognition over recall)
- **Evidence:** `src/components/views/TableView/SizingPresetsPanel.jsx:58-66` — all four `sizingOptions.map(...)` buttons share the same `onSizingLongPressStart`/`onSizingLongPressEnd` handlers with no `slotIndex` argument. `CommandStrip.jsx:352-381` — editor opens with `setSizingEditorOpen(true)` but does not record which slot was pressed; the editor renders all four fields as editable.
- **Observation:** Long-press on the "2/3 pot" button opens the same editor as long-press on "pot". No visual cue says "you long-pressed slot 3." User saves the wrong slot silently; realization comes when the wrong sizing fires mid-hand.
- **Recommended fix:** Thread `slotIndex` through the long-press handler; highlight the pressed slot in the editor popup ("Editing **2/3 pot**"); optionally focus only that slot's input on editor open.
- **Effort:** S (handler signature change + a conditional label in the editor).
- **Risk:** None significant.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21-TV F3] Sizing preset editor: surface which slot is being edited`

---

### F4 — Advice staleness has ambiguous middle state (fading 20s→60s) with no explicit label

- **Severity:** 3 (primary persona, ambiguous signal, high decision cost)
- **Situations affected:** [mid-hand-chris](../personas/situational/mid-hand-chris.md), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md) (who can't yet interpret opacity)
- **JTBD impact:** `JTBD-MH-02` (know whether the recommendation is fresh) — user glances at dimmed advice, can't tell if "safe to act."
- **Heuristics violated:** H-N01 (system status), H-PLT01 (sub-second glanceability), H-PLT05 (phone-sleep-safe freshness re-eval)
- **Evidence:** `src/components/views/TableView/LiveAdviceBar.jsx:171-172,198` — `isStale` at 60000ms; `isFading` at 20000ms with `opacity: 0.75`; age counter rendered at `fontSize: 9` gray-on-dark at lines 259–261.
- **Observation:** Binary staleness → tri-state is a refinement, but the middle state ("AGING") has no label. Mid-hand-chris gets half a second to decide; the current implementation asks him to distinguish opacity 0.75 from 1.0 at a glance and read a 9-pixel timer — both below glance threshold. Newcomer-first-hand can't interpret opacity at all.
- **Recommended fix:** Replace opacity-only fade with an explicit amber "AGING" badge at the 20s threshold, matching the red "STALE" style. Keep the age counter for power users but promote it to ≥14px. Alternative: collapse tri-state back to binary (treat 20s as stale if recompute is cheap).
- **Effort:** S (label addition + style).
- **Risk:** Low. No state machine change; UI-only.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21-TV F4] LiveAdviceBar: explicit AGING label replacing opacity-only fade`

---

### F5 — Undo window inconsistency: Next Hand 5000ms, Clear Player 6000ms

- **Severity:** 2 (secondary situation blocker — between-hands-chris cannot recover once window closes)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (time budget is 30–90s, not 5–6s)
- **JTBD impact:** `JTBD-HE-12` (undo a miskey) — recovery window expires before the persona is ready to act on it.
- **Heuristics violated:** H-N03 (user control / easy reverse), H-PLT06
- **Evidence:** `src/components/views/TableView/CommandStrip.jsx:223` (Next Hand, `duration: 5000`); line 364 (Clear Player, `duration: 6000`). Known from Gate-2 blind-spot E2.
- **Observation:** Two nearly-identical destructive-action undo patterns use different durations for no semantic reason. Neither is calibrated to the 30–90s between-hands attention window. A user who sees "hand completed" toast, looks back at the dealer for 6 seconds, and tries to undo finds the toast gone.
- **Recommended fix:** Align both to a single `UNDO_TOAST_DURATION_MS` constant. Recommend 12000ms (12s) — long enough for a glance-away, short enough to not linger. Also audit other toast durations for consistency.
- **Effort:** S (extract constant, use in both call sites).
- **Risk:** Negligible.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-TV F5] Unify destructive-action undo-toast duration constant`

---

### F6 — SeatContextMenu recent-players list scrolls invisibly with no count/overflow cue

- **Severity:** 2 (secondary situation, discoverable via scroll)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md) (recent-list is the primary way to find tonight's regulars)
- **JTBD impact:** `JTBD-PM-02` (assign a known player to a seat) — user scans recents, doesn't see target, may create a duplicate.
- **Heuristics violated:** H-N01 (system status: is there more?), H-ML02 (scroll affordance), H-PLT08
- **Evidence:** `src/components/views/TableView/SeatContextMenu.jsx:131` — `max-h-96` (384px) with `overflow-y-auto` on up to 20 items. No count badge, no scrollbar visual affordance, no "show more" cue. Known from Gate-2 blind-spot C2.
- **Observation:** 384px is roughly 8 rows at 44px each. If 12+ recent players exist, 4+ are invisible without scroll. One-handed landscape scrolling in a floating menu is error-prone.
- **Recommended fix:** Add a count badge ("showing 8 of 20") at the list header; add a subtle bottom-fade gradient to indicate scrollability; consider converting to a fixed-height window with a "view all" link to PlayersView.
- **Effort:** S.
- **Risk:** Low.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-TV F6] Recent-players list: count badge + scroll affordance`

---

### F7 — Orbit strip horizontal scroll has no affordance

- **Severity:** 2 (secondary situation, silent failure of tap-ahead)
- **Situations affected:** [mid-hand-chris](../personas/situational/mid-hand-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md)
- **JTBD impact:** `JTBD-HE-11` — tap-ahead shortcut may target a seat that's scrolled off, folding the wrong range.
- **Heuristics violated:** H-PLT07 (state-aware primary action), H-ML05 (no horizontal scroll on primary paths), H-N01
- **Evidence:** `src/components/views/TableView/CommandStrip.jsx:554` — `overflow-x-auto` on the preflop orbit strip. No scroll indicator; no visual cue that content extends off-right. Known from Gate-2 blind-spot C4/E4.
- **Observation:** 9-handed game; right-column panel width is narrow. Seats beyond visible fit are reachable only by horizontal scroll. H-ML05 says primary paths should not require horizontal scroll at all.
- **Recommended fix:** (a) Preferred: relayout as a wrapping grid rather than a scroll strip at narrow widths. (b) Fallback: add a visible scroll indicator (arrow chevrons at edges when content is off-screen).
- **Effort:** M for (a); S for (b).
- **Risk:** (a) touches layout; re-test thoroughly.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-TV F7] Orbit strip: wrap-layout or scroll affordance`

---

### F8 — RecentPlayersSection row touch target below 44px floor

- **Severity:** 2 (inconsistent with primary menu in same file; H-ML06 violation)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md)
- **JTBD impact:** `JTBD-PM-02` — miss-taps on the small rows lead to wrong-player assignment.
- **Heuristics violated:** H-ML06 (touch target ≥44px)
- **Evidence:** [EVID-2026-04-21-TABLE-TOUCH-TARGET-40PX](../evidence/LEDGER.md) — `SeatContextMenu.jsx:83` uses `min-h-[40px]`; primary MENU_ROW_CLASS at line 15 correctly uses `min-h-[44px]`. Known from Gate-2 blind-spot E3.
- **Observation:** Two patterns coexist in the same file. A future contributor copying the weaker pattern perpetuates the defect. At scale <1.0, 40 DOM-px becomes <40 visual; at scale 0.5, ~20px — below reliability.
- **Recommended fix:** Change RecentPlayersSection button class to use `MENU_ROW_CLASS` (or at minimum `min-h-[44px]`). Consider extracting a single row-height constant to prevent future drift.
- **Effort:** S.
- **Risk:** None.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-TV F8] Recent-players rows: bump to 44px + unify row-height pattern`

---

### F9 — PotDisplay opens an inline number input on the felt, shifting viewport

- **Severity:** 2 (secondary situation — user-initiated, but miss-tap exposes)
- **Situations affected:** [mid-hand-chris](../personas/situational/mid-hand-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md)
- **JTBD impact:** `JTBD-MH-11` (validate pot before acting — just authored) — the correction flow is available but in a form that interrupts the flow it's supposed to support.
- **Heuristics violated:** H-ML03 (virtual keyboard obscures primary inputs), H-N05, H-PLT02 (one-handed reachability)
- **Evidence:** `src/components/ui/PotDisplay.jsx:29-51` — `setIsEditing(true)` renders `<input type="number" autoFocus>` on the felt. On Android, `type="number"` triggers the full keyboard and may shift viewport. No `inputMode="decimal"` to hint a compact keyboard.
- **Observation:** Pot correction is a between-hands job (ringmaster-in-hand reconstructing rebuys; Chris noticing a discrepancy). Today a single tap on the pot badge begins an inline edit — acceptable for intent, hostile for miss-tap. Adding a long-press gate (same pattern as sizing presets) would absorb miss-taps.
- **Recommended fix:** Gate edit mode behind a long-press (≥400ms). Single-tap shows a tooltip "Long-press to correct." Add `inputMode="decimal"` for compact keyboards. Ensure input scrollIntoView on focus.
- **Effort:** S.
- **Risk:** Changes interaction model for an existing affordance; test that intentional corrections still feel responsive.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-TV F9] PotDisplay: long-press to edit + inputMode="decimal"`

---

### F10 — Reset Hand button visually adjacent to Next Hand CTA with minimal separation

- **Severity:** 2 (motor-proximity risk; compounds with F1 once `window.confirm` is removed)
- **Situations affected:** [mid-hand-chris](../personas/situational/mid-hand-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md)
- **JTBD impact:** `JTBD-HE-11` — risk of hitting Reset Hand when intending Next Hand.
- **Heuristics violated:** H-N05, H-PLT06, H-ML06 (adjacent-target spacing)
- **Evidence:** `src/components/views/TableView/ControlZone.jsx:54-74` — Reset Hand (`height: '48px'`, background `#1f2937`) and Next Hand (`height: '68px'`, gold gradient) separated by only `pt-1 pb-2` (≈4-8px gap).
- **Observation:** Today, `window.confirm` (F1) catches accidental Reset Hand taps. Once F1 is fixed to toast+undo, Reset Hand becomes single-tap destructive with only a 12s (F5) undo window. Proximity then matters more. The gold Next Hand button draws the eye — thumb travels toward it — Reset Hand sits directly above.
- **Recommended fix:** Increase vertical gap between Reset Hand and Next Hand to ≥16px. Consider moving Reset Hand into a collapsed "⋯ more" disclosure; it's called rarely relative to Next Hand.
- **Effort:** S.
- **Risk:** Low (layout-only).
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-TV F10] ControlZone: separate Reset Hand from Next Hand`

---

### F11 — `useOnlineAnalysisContext` used in live TableView — name suggests the wrong scope

- **Severity:** 1 (developer clarity, not user-facing today; risk of future regressions)
- **Situations affected:** indirect — affects every future change to the advice pipeline
- **JTBD impact:** `JTBD-MH-02` — if the wrong data flows through the name, staleness indication breaks silently.
- **Heuristics violated:** H-N01 (indirect: system-status clarity for the developer)
- **Evidence:** `src/components/views/TableView/CommandStrip.jsx:78, 487` — `useOnlineAnalysisContext` consumed by live (not online-only) TableView. Known from Gate-2 blind-spot E5.
- **Observation:** The context name carries a product-line implication ("online") that is false at this call site. Future contributor sees the name, assumes it's online-only, and may break live advice when refactoring. Not a user-facing bug today; a maintenance hazard.
- **Recommended fix:** Rename to `useAnalysisContext` (or `useLiveAdviceContext`) and update import sites. If the name is load-bearing on public API surface, add a doc comment at the hook declaration explaining that it serves both live and online consumers.
- **Effort:** S (rename + imports).
- **Risk:** Low (type-safe rename).
- **Proposed backlog item:** `[P3] [AUDIT-2026-04-21-TV F11] Rename useOnlineAnalysisContext to reflect dual-product use`

---

### F12 — RangeDetailPanel closes permanently; no reopen affordance

- **Severity:** 1 (minor friction; workaround exists)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md)
- **JTBD impact:** `JTBD-MH-03`/`JTBD-MH-08` — reading villain range is achievable but extra-cost to re-invoke after accidental close.
- **Heuristics violated:** H-N03 (user control / reverse)
- **Evidence:** `src/components/views/TableView/TableView.jsx:537,589` — `onOpenRangeDetail={setRangeDetailSeat}` / `onClose={() => setRangeDetailSeat(null)}`. Ephemeral local state at line 209. No history or reopen affordance.
- **Observation:** Accidental close costs ~5s of re-navigation. Low severity because the workaround (re-tap seat) works; but first-hand Newcomers who are exploring may close unintentionally and not know how to get back in.
- **Recommended fix:** Retain last-viewed seat in a `useRef`; add a small "reopen last" button near the seat-selector row when `rangeDetailSeat` has been non-null in the session.
- **Effort:** S.
- **Risk:** None significant.
- **Proposed backlog item:** `[P3] [AUDIT-2026-04-21-TV F12] RangeDetailPanel: reopen-last affordance`

---

## Observations without fixes

Worth noting; not severity-scored; may become findings with more evidence.

- **CardSelectorPanel — Clear Board / Clear Hole have no undo.** Both are visible red buttons at `CardSelectorPanel.jsx:91-109`. Re-entering cards is cheap but repetitive if bumped accidentally. Worth a future audit pass specifically on CardSelectorPanel interaction model.
- **Street tabs allow backward navigation mid-hand without warning.** `CommandStrip.jsx:443-464` — clicking "Pre" while on Turn resets `currentStreet`; action sequence for later streets still persists in state but will not replay correctly. Open question: does the state machine guarantee integrity under this transition? If yes, document it; if no, guard.
- **FoldCurveTooltip clipping risk.** `LiveAdviceBar.jsx:113-116` — tooltip uses `bottom: '100%'` absolute in a flex row inside the sidebar panel. Needs visual verification at narrow viewport: if the tooltip clips, mid-hand-chris loses the reasoning. Blocked on Playwright availability.
- **TableView at 598 LOC.** [ARCH-003](../../../.claude/BACKLOG.md). Structural decomposition is an open item; not surfaced by heuristic audit, but touchpoint for future refactor decisions.
- **SeatContextMenu on-hover tendency opacity** (orbit-aware dimming of folded seats) works well for veterans but may confuse newcomer-first-hand. Worth observation during first-session telemetry.

## Open questions

Hypotheses that require observation or further investigation:

1. **Does the 20s fade threshold (F4) accurately reflect when a recompute would change the verdict?** If villain hasn't acted, advice doesn't need to update. The threshold may be too aggressive or too lax depending on what changes between streets.
2. **Is Reset Hand used at all?** Rare-use destructive actions have different design requirements than frequent ones. Telemetry on Reset Hand presses would clarify F1/F10 tradeoff.
3. **Does the SeatContextMenu recent list actually overflow in practice, or does the recents cap at a safe number?** If `getRecentPlayers(20, true)` rarely returns >8 in Chris's usage, F6 is theoretical. If it does overflow regularly, F6 is more severe.
4. **Does ringmaster-in-hand exist as a real use case?** The persona is PROTO; no Chris observation backs it. All findings citing ringmaster-in-hand are currently inferential.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — Replace `window.confirm` on Reset Hand with toast+undo | 3 | S | **P1** |
| 2 | F3 — Sizing preset editor shows which slot is being edited | 3 | S | **P1** |
| 3 | F4 — Advice: explicit AGING label (replace opacity-only fade) | 3 | S | **P1** |
| 4 | F2 — Orbit strip: preview-count badge for auto-fold scope | 3 | M | **P1** |
| 5 | F5 — Unify undo-toast duration constant | 2 | S | **P2** |
| 6 | F8 — Recent-players rows: bump to 44px + unify row-height | 2 | S | **P2** |
| 7 | F9 — PotDisplay: long-press gate + `inputMode="decimal"` | 2 | S | **P2** |
| 8 | F10 — ControlZone: separate Reset Hand from Next Hand | 2 | S | **P2** |
| 9 | F6 — Recent-players: count badge + scroll affordance | 2 | S | **P2** |
| 10 | F7 — Orbit strip: wrap-layout or scroll affordance | 2 | M | **P2** |
| 11 | F12 — RangeDetailPanel: reopen-last affordance | 1 | S | **P3** |
| 12 | F11 — Rename `useOnlineAnalysisContext` | 1 | S | **P3** |

**Sequencing note:** F1 and F10 are linked — fixing F1 (removing `window.confirm`) increases the severity of F10 (proximity). Ship F1 and F10 together, or at minimum F10 before F1 ships alone.

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [ ] [P1] [AUDIT-2026-04-21-TV F1] Replace window.confirm on Reset Hand with toast+undo — src/components/views/TableView/CommandStrip.jsx:254 (evidence: EVID-2026-04-21-TABLE-WINDOW-CONFIRM)
- [ ] [P1] [AUDIT-2026-04-21-TV F3] Sizing preset editor: surface which slot is being edited — SizingPresetsPanel.jsx:58-66 + CommandStrip.jsx:352-381
- [ ] [P1] [AUDIT-2026-04-21-TV F4] LiveAdviceBar: explicit AGING label replacing opacity-only fade — LiveAdviceBar.jsx:171-199
- [ ] [P1] [AUDIT-2026-04-21-TV F2] Orbit strip preview-count badge for auto-fold scope — CommandStrip.jsx:133-172
- [ ] [P2] [AUDIT-2026-04-21-TV F5] Unify destructive-action undo-toast duration constant — CommandStrip.jsx:223,364
- [ ] [P2] [AUDIT-2026-04-21-TV F8] Recent-players rows: bump to 44px + unify row-height — SeatContextMenu.jsx:83 (evidence: EVID-2026-04-21-TABLE-TOUCH-TARGET-40PX)
- [ ] [P2] [AUDIT-2026-04-21-TV F9] PotDisplay: long-press to edit + inputMode="decimal" — src/components/ui/PotDisplay.jsx:11-51
- [ ] [P2] [AUDIT-2026-04-21-TV F10] ControlZone: separate Reset Hand from Next Hand (sequence with F1) — ControlZone.jsx:54-74
- [ ] [P2] [AUDIT-2026-04-21-TV F6] SeatContextMenu recent-players: count badge + scroll affordance — SeatContextMenu.jsx:131
- [ ] [P2] [AUDIT-2026-04-21-TV F7] Orbit strip: wrap-layout or scroll affordance — CommandStrip.jsx:554
- [ ] [P3] [AUDIT-2026-04-21-TV F12] RangeDetailPanel: reopen-last affordance — TableView.jsx:209,537,589
- [ ] [P3] [AUDIT-2026-04-21-TV F11] Rename useOnlineAnalysisContext to reflect dual-product use — CommandStrip.jsx:78,487
```

---

## Discoveries referenced (separate track — not audit findings)

These surfaced from the same walkthrough but are missing-feature questions, not fixable defects. Already logged during Gate-3 resolution:

- [DISC-2026-04-21-push-fold-widget](../discoveries/2026-04-21-push-fold-widget.md) — ≤15bb needs a dedicated widget, not equity-derived advice.
- [DISC-2026-04-21-briefing-badge-nav](../discoveries/2026-04-21-briefing-badge-nav.md) — seat badge → review queue edge missing.
- [DISC-2026-04-21-decision-tree-fate](../discoveries/2026-04-21-decision-tree-fate.md) — orphaned F-W5 blocks MH-10 deep variant.
- [DISC-2026-04-21-sidebar-tournament-parity](../discoveries/2026-04-21-sidebar-tournament-parity.md) — Hybrid / Online MTT Shark cross-product gap.

---

## Gate 5 resolution — 2026-04-21 (same session)

Owner approved the audit verdict → 4 P1 findings + coupled F10 shipped as code in DCOMP-W1 Session 4. Per METHODOLOGY.md audits are immutable once closed; this section is appended to record the closure.

**Implemented:**

| ID | Status | Code | Evidence |
|----|--------|------|----------|
| F1 | ✅ SHIPPED | `CommandStrip.jsx:252-296` (handleResetHand rewritten) + `:132-135` (resetHandUndoRef + UNDO_TOAST_DURATION_MS) | [EVID-2026-04-21-TV-GATE5-P1](../evidence/LEDGER.md) |
| F2 | ✅ SHIPPED | `CommandStrip.jsx:601-672` (orbit IIFE + computeFoldPreview + badge render) | same |
| F3 | ✅ SHIPPED | `CommandStrip.jsx:358-368` (editingSlotIndex state + handler arg) + `SizingPresetsPanel.jsx:12-21,54-66,85-113` (prop + highlight) | same |
| F4 | ✅ SHIPPED | `LiveAdviceBar.jsx:250-268` (AGING + STALE badges promoted to font-size 11) | same |
| F5 | ✅ SHIPPED (incidentally) | `CommandStrip.jsx:135` (UNDO_TOAST_DURATION_MS = 12000) + line 225 (applied to Next Hand) | same |
| F10 | ✅ SHIPPED (coupled with F1) | `ControlZone.jsx:54-75` (Reset Hand de-emphasized + pt-3 gap above Next Hand) | same |

**Tests:** 86/86 TableView component tests + 238/238 reducer tests pass. Pre-existing `precisionAudit.test.js` Monte Carlo failure unrelated.

**Remaining open (queued for subsequent sessions):**
- F6 (P2) — SeatContextMenu recent-players count badge + scroll affordance
- F7 (P2) — Orbit strip wrap-layout / scroll affordance (F2 partially mitigates by making scope visible; discoverability of off-screen seats remains)
- F8 (P2) — Recent-players row 44px floor
- F9 (P2) — PotDisplay long-press gate + inputMode="decimal"
- F11 (P3) — `useOnlineAnalysisContext` rename
- F12 (P3) — RangeDetailPanel reopen-last affordance

**Visual verification:** blocked on Playwright MCP; owner-facing checklist logged in EVID-2026-04-21-TV-GATE5-P1.

---

## Sign-off

- **Drafted by:** Claude (main) — 2026-04-21
- **Owner-reviewed:** 2026-04-21 (approved)
- **P1 implementation closed:** 2026-04-21 (DCOMP-W1-S4)
- **P2/P3 implementation:** Pending subsequent sessions.

Audit is immutable after close. Follow-up audits create a new file.

---

## Change log

- 2026-04-21 — Draft. DCOMP-W1 Session 3 (Gate 4). 12 findings, 4 observations, 4 open questions.
- 2026-04-21 — Gate 5 resolution appended. F1/F2/F3/F4/F5/F10 shipped. P2/P3 queued.
- 2026-04-21 — DCOMP-W1-S6: F8 SHIPPED (recent-players 44px + single-source-of-truth row-class). Evidence: `EVID-2026-04-21-W1-S6-BATCH`. F6/F7/F9/F11/F12 remain queued.
- 2026-04-21 — DCOMP-W1-S7: F6 + F9 + F11 + F12 SHIPPED (polish + dev-clarity batch). Evidence: `EVID-2026-04-21-W1-S7-BATCH`. **Only F7 (orbit wrap-layout M) remains.**
- 2026-04-21 — DCOMP-W1-S8: F7 SHIPPED (orbit strip flex-wrap, no more silent off-screen seats). Evidence: `EVID-2026-04-21-W1-S8-TV-F7`. **All TableView audit findings closed.**
