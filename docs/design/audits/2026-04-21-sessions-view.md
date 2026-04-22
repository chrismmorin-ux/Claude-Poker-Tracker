# Audit - 2026-04-21 - SessionsView (Heuristic)

**Scope:** Surface (sessions-view)
**Auditor:** Claude - product-ux-thinker agent (DCOMP-W1)
**Method:** Gate-4 heuristic walkthrough (Nielsen 10 + Poker-Live-Table + Mobile-Landscape) x 4 primary situational personas; code-level evidence for every finding.
**Status:** Draft; owner-approved per continue-directive 2026-04-21. P0 (F1) shipped same-session. F3 **WITHDRAWN** after code verification (`importAllData` in `exportUtils.js:192` calls `clearAllData()` first — the warning copy is accurate). See §"Gate 5 resolution" below.

---

## Executive summary

Audited SessionsView and its 6 sub-components (419 + ~550 LOC) against the framework three heuristic sets through the eyes of post-session-chris (cash-out flow), between-hands-chris (rebuy + resume path), ringmaster-in-hand (mid-hand rebuy), and the Traveler (multi-venue tracking). **Seven findings: one at severity 4, two at severity 3, two at severity 2, two at severity 1.** The severity-4 finding is window.confirm on Delete Session - it fires on the primary destructive path with a native browser dialog explicitly forbidden by ringmaster-in-hand and between-hands-chris surface contracts, and unlike TableView there is no existing toast+undo pattern here to mirror. The two severity-3 findings are: (1) the Cash Out flow commits without a tip field despite tip being a named concern in JTBD-SM-21, silently miscalculating net P&L for every tipped session; and (2) the Import action warning copy says replace ALL existing data when importAllData appears to merge rather than replace, creating false fear that causes users to abort valid restores. All seven findings are grounded in code-observable behavior that degrades a specific JTBD for a specific persona.

---

## Scope details

- **Surfaces audited:** sessions-view (primary). Sub-components: SessionsView.jsx, ActiveSessionCard.jsx, BankrollDisplay.jsx, CashOutModal.jsx, ImportConfirmModal.jsx, src/components/ui/SessionForm.jsx, src/components/ui/SessionCard.jsx.
- **Journeys considered:** Session-start flow; cash-out flow; rebuy-mid-session; import/export; past-session delete.
- **Personas walked:** post-session-chris, between-hands-chris, ringmaster-in-hand, Traveler, Banker/Staker (read-only pass).
- **Heuristic sets applied:** Nielsen 10 (H-N01..10), Poker-Live-Table (H-PLT01..08), Mobile-Landscape (H-ML01..07).
- **Out of scope:** Visual verification at 1600x720 or smaller viewports (Playwright MCP unavailable). TournamentView overlay integration. StatsView downstream aggregation.

## Artifacts referenced

- docs/design/surfaces/sessions-view.md
- docs/design/personas/situational/post-session-chris.md
- docs/design/personas/situational/between-hands-chris.md
- docs/design/personas/situational/ringmaster-in-hand.md
- docs/design/personas/core/traveler.md
- docs/design/personas/core/banker-staker.md
- Evidence: EVID-2026-04-21-ENGINE-FEATURE-INVENTORY (docs/design/evidence/LEDGER.md)

---

## Findings

Ordered by severity descending, then effort ascending.

---

### F1 - window.confirm on Delete Session: native dialog on an irrecoverable destructive action

- **Severity:** 4 (blocks JTBD completion in primary situation AND causes irrecoverable data loss - no undo path exists)
- **Situations affected:** post-session-chris (primary), between-hands-chris, ringmaster-in-hand (lethal - native modal freezes all other UI)
- **JTBD impact:** JTBD-SM-22 (backfill/delete past sessions) - Delete fires immediately on confirm with zero undo. A session with 80+ recorded hands is permanently gone in one tap.
- **Heuristics violated:** H-N03 (no emergency exit), H-N05 (window.confirm blocks UI, offers no undo), H-PLT08 (native modal suspends JS event loop), H-N09 (no error recovery)
- **Evidence:** src/components/views/SessionsView/SessionsView.jsx:122-134 - handleDeleteSession calls window.confirm(...), then immediately calls deleteSessionById(sessionId) with no snapshot, no undo window, no toast. This is the same anti-pattern fixed in TableView (AUDIT-2026-04-21-TV F1), which ships the correct toast+undo model in CommandStrip.jsx. The fix pattern is proven and available in the same codebase.
- **Observation:** The surface artifact explicitly lists Delete Session as irrecoverable and relying on dialogs rather than undoable toasts. That is accurate - but irrecoverable + native dialog is a severity-4 combination. Ringmaster-in-hand surface contract lists window.confirm as lethal. The pattern fix has simply not been ported here from CommandStrip.
- **Recommended fix:** Replace window.confirm with toast+undo: snapshot session data before delete, show "Session deleted (N hands) - Undo" toast for 12 seconds, restore on undo tap. Commit permanently when toast auto-dismisses or user navigates away.
- **Effort:** S (one file, ~20 lines; mirror the CommandStrip Next Hand undo pattern).
- **Risk:** Requires holding a session snapshot in local state for the undo window. No IDB schema change needed.
- **Proposed backlog item:** [P0] [AUDIT-2026-04-21-SV F1] Replace window.confirm+immediate delete on SessionCard with toast+undo - SessionsView.jsx:122-134

---

### F2 - Cash Out modal has no tip field: silently miscalculates net P&L for every tipped session

- **Severity:** 3 (silent financial data corruption for primary persona in primary situation; JTBD fails silently)
- **Situations affected:** post-session-chris (primary), between-hands-chris
- **JTBD impact:** JTBD-SM-21 (clean cash-out with tip logging) - tip logging is a named JTBD. CashOutModal captures only cash-out amount. Net P&L = cashOut - buyIn - rebuys has no tip deduction. A player tipping 0/session across 50 sessions reports ,500 higher lifetime bankroll than actual.
- **Heuristics violated:** H-N02 (tipping is a live-casino norm and a named JTBD; the system does not match the real world), H-N01 (BankrollDisplay figure is misleading without tip accounting)
- **Evidence:** src/components/views/SessionsView/CashOutModal.jsx:23-38 - single input for Cash Out Amount; no tip field. Handler at SessionsView.jsx:104-118 passes only cashOutAmount to endCurrentSession. BankrollDisplay.jsx:10-21 displays totalBankroll from SessionsView.jsx:201-213: cashOut - buyIn - rebuys with no tip term. Surface artifact section 103 names calculateTotalRebuy explicitly; no equivalent calculateTotalTip exists anywhere in the codebase. JTBD-SM-21 in the surface artifact names tip logging as a primary cash-out job.
- **Observation:** The Traveler persona is especially exposed - cross-border tipping norms are high (Vegas -20 per big pot), and for a high-volume player the missing tip accounting introduces meaningful financial inaccuracy that undermines the bankroll-tracking use case.
- **Recommended fix:** Add optional Tip field to CashOutModal below Cash Out Amount. Thread value through endCurrentSession into session record as tipAmount. Update calculateTotalBankroll to subtract session.tipAmount or 0. Field should be optional with placeholder 0.
- **Effort:** M (schema addition, handler update, three display sites).
- **Risk:** Existing sessions have no tipAmount - treat null/undefined as 0. Backward compatible.
- **Proposed backlog item:** [P1] [AUDIT-2026-04-21-SV F2] Add optional tip field to CashOutModal and wire through P&L accounting - CashOutModal.jsx, SessionsView.jsx:104-213, BankrollDisplay.jsx

---

### F3 - ImportConfirmModal warning says replace ALL existing data but importAllData merges

- **Severity:** 3 (false destructive warning - post-session-chris aborts valid restores; H-N02 real-world mismatch)
- **Situations affected:** post-session-chris (restoring from backup), any user recovering from crash or device switch
- **JTBD impact:** JTBD-DE-72 (raw JSON export/import), JTBD-CC-77 (state recovery after crash) - the warning "This will replace ALL existing data!" is factually wrong if importAllData merges. Users believe they will lose current sessions by importing a partial backup, causing abandon of valid restores - or proceed, see existing sessions remain, and lose trust in the system.
- **Heuristics violated:** H-N02 (replace vs merge is a meaningful real-world distinction), H-N09 (the error model the warning creates is false), H-N05 (inaccurate warnings erode trust in confirmation dialogs)
- **Evidence:** src/components/views/SessionsView/ImportConfirmModal.jsx:18 - "Warning: This will replace ALL existing data!" rendered in red. However the handler at SessionsView.jsx:177 calls importAllData(importData) which returns result.counts of imported records in additive framing, not records deleted. The success toast at SessionsView.jsx:180 shows "Imported N hands" - consistent with merge semantics. The warning copy appears to be a copy-paste assumption from a replace pattern that does not match the actual implementation.
- **Observation:** This creates two opposite failure modes: (1) users believe the warning, abort a valid restore, and lose data; (2) users import, see the replace ALL framing, and are surprised their existing sessions remain. Neither maps to the correct mental model.
- **Recommended fix:** First verify importAllData semantics in exportUtils.js. If it merges: update warning to "This will add the backup data to your existing records. Sessions, hands, and players will be merged; duplicates may appear if the backup overlaps current data." Change button from Import and Replace to Import and Merge. If it actually replaces: keep warning but add an itemized count of records that will be deleted.
- **Effort:** S (copy change if merge confirmed) or M (implementation change if replace confirmed).
- **Risk:** If importAllData is a replace, the fix requires an implementation change, not just copy.
- **Proposed backlog item:** [P1] [AUDIT-2026-04-21-SV F3] Fix ImportConfirmModal warning - verify merge vs replace semantics and align copy - ImportConfirmModal.jsx:18, exportUtils.js

---

### F4 - Rebuy entry opens keyboard input mid-session with no undo and below-spec touch targets

- **Severity:** 2 (secondary situation blocker - ringmaster-in-hand cannot safely log a rebuy mid-hand; between-hands-chris similarly stressed)
- **Situations affected:** ringmaster-in-hand (primary rebuy scenario), between-hands-chris
- **JTBD impact:** JTBD-SM-18 (log add-ons / rebuys) - path works but a miskeyed amount commits immediately with no undo, and Android keyboard shifts viewport, potentially obscuring Confirm and Cancel buttons.
- **Heuristics violated:** H-N03 (confirm is final, no undo), H-PLT06 (single Confirm tap commits a financial change), H-PLT08 (keyboard open covering controls), H-ML03 (virtual keyboard may obscure inputs), H-ML06 (Confirm/Cancel buttons ~28-32px, below 44px floor)
- **Evidence:** src/components/views/SessionsView/ActiveSessionCard.jsx:147-170 - rebuy input uses type=number (not inputMode=decimal) which on Android triggers full numeric keyboard. Confirm and Cancel at lines 157-168 use text-xs + px-2 py-1 - approximately 28-32px tall. handleConfirmRebuy at lines 66-75 appends to rebuyTransactions immediately with no undo, no toast. The rebuyDefault per game type already exists in constants (ActiveSessionCard.jsx:41-44 calls getDefaultRebuyAmount) but is only used to pre-fill the input field, not exposed as a one-tap preset.
- **Observation:** Ringmaster-in-hand surface contract requires "Rebuy / add-on entry available without leaving TableView" - meaning the Ringmaster navigates to SessionsView mid-hand, a surface switch under a 2-second time budget. A miskeyed rebuy then silently corrupts session accounting.
- **Recommended fix:** (1) Change type=number to type=text inputMode=decimal for compact keyboard. (2) Show 6s undo toast after confirming: "Rebuy +00 added - Undo." (3) Increase Confirm/Cancel to min-h-[44px]. (4) Surface rebuyDefault as a one-tap preset button eliminating keyboard entry for the common case.
- **Effort:** M.
- **Risk:** Low. All additive to existing local state pattern.
- **Proposed backlog item:** [P2] [AUDIT-2026-04-21-SV F4] Rebuy entry: inputMode decimal + undo toast + 44px button targets + preset quick-tap - ActiveSessionCard.jsx:60-75,147-170

---

### F5 - BankrollDisplay and drill-entry buttons share the bottom-8 row and may collide at sub-reference scale

- **Severity:** 2 (layout collision on small landscape viewports; primary interaction paths blocked)
- **Situations affected:** between-hands-chris (drill access between hands), post-session-chris (post-session drill access)
- **JTBD impact:** Drill-access path - on viewports smaller than 1600px, three absolute-positioned bottom elements compress toward each other. Effective tap targets shrink or overlap.
- **Heuristics violated:** H-ML01 (works on the full viewport range), H-ML06 (crowded absolute elements may overlap, shrinking tap area), H-ML05 (no horizontal crowding on primary paths)
- **Evidence:** src/components/views/SessionsView/SessionsView.jsx:377-397 - three absolute-positioned elements at bottom-8: BankrollDisplay at left-8 with max-w-xs (320px DOM width); Preflop Drills button at right-48 (192px from right); Postflop Drills button at right-8 (32px from right). The outer container at line 219 sets width: 1600 as inline style. At scale ~0.55 (viewports near 880px wide) these elements visually compress toward each other. Unverified - flagged as open question pending visual verification.
- **Observation:** The fixed width: 1600 pattern is intentional per H-ML04. The issue is that three independent absolute elements share a bottom bar without a coordinating flex container - a future fourth element will certainly collide.
- **Recommended fix:** Replace three independent absolute bottom-8 elements with a single absolute bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-8 bar. BankrollDisplay sits left; drill buttons sit right. Collision-proof at any scale.
- **Effort:** S (layout refactor of bottom bar only; no state change).
- **Risk:** Needs visual verification at reference and small viewports.
- **Proposed backlog item:** [P2] [AUDIT-2026-04-21-SV F5] Unify bottom-bar absolute elements into a flex container - SessionsView.jsx:377-397

---

### F6 - SessionForm backdrop tap dismisses with no warning on in-progress forms

- **Severity:** 1 (minor friction; between-hands-chris loses typed venue/buy-in on accidental backdrop tap)
- **Situations affected:** between-hands-chris (start new session with keyboard open), newcomer-first-hand (exploratory tapper)
- **JTBD impact:** JTBD-SM-17 (open session with preset stakes / venue) - typed custom venue or buy-in clears silently on backdrop mis-tap.
- **Heuristics violated:** H-N03 (no warning before dismissing in-progress input), H-PLT05 (form does not autosave draft), H-PLT08 (partial entry lost on interruption)
- **Evidence:** src/components/ui/SessionForm.jsx:100-106 - outer backdrop div has onClick={onCancel}; inner modal has onClick={e.stopPropagation()}. Outer tap fires onCancel at SessionsView.jsx:363: () => setShowNewSessionForm(false). All form state (venue, gameType, buyIn, goal, notes) is local useState inside SessionForm and destroyed on unmount. None is lifted to SessionsView or persisted to a ref.
- **Observation:** Between-hands-chris has <=60s and may be interrupted mid-form by the dealer. H-PLT08 explicitly requires form state to survive interruptions. Severity is 1 rather than 2 because re-opening the form re-hydrates from defaultGameType/defaultVenue props, recovering the most common fields.
- **Recommended fix:** (a) Preferred: replace backdrop-tap dismiss with explicit Cancel-button-only dismiss when form has non-default values; show inline Discard changes? confirmation. (b) Simpler: lift form draft state to a useRef in SessionsView and restore on re-open.
- **Effort:** S.
- **Risk:** Low. No state schema change.
- **Proposed backlog item:** [P3] [AUDIT-2026-04-21-SV F6] SessionForm: guard backdrop-tap dismiss when form has dirty state - SessionForm.jsx:100-106

---

### F7 - Online Sessions mixed into past-sessions list with no filter or grouping

- **Severity:** 1 (minor friction; gap already flagged in surface artifact)
- **Situations affected:** post-session-chris (reviewing session history), Traveler (cross-venue history scan), Banker/Staker (live vs online win rate split matters for staking)
- **JTBD impact:** JTBD-SM-17/JTBD-SM-22 - a post-session-chris reviewing all live sessions this month must visually scan a list that may include online sessions with no filter chip or tab.
- **Heuristics violated:** H-N06 (recognition over recall - user must remember which sessions are which type), H-N08 (mixed list with inline badges is noisier than a tabbed list)
- **Evidence:** src/components/views/SessionsView/SessionsView.jsx:340-358 - sessions.filter(s => !s.isActive).map(...) with no grouping or filter. src/components/ui/SessionCard.jsx:65-69 - session.source === ignition renders a small Online badge inline in the session title only. The Online Play status card at SessionsView.jsx:309-332 is a separate widget, not a mode toggle. Surface artifact section 108 flags this as F-03 connection gap.
- **Observation:** Severity is 1 because the badge is present and the gap is already documented in the surface artifact. This finding formalizes the known issue as an audit finding with a backlog proposal attached.
- **Recommended fix:** Add pill-filter row above past-sessions list: All | Live | Online. Default to All. In-memory filter, no IDB query needed. Persist active filter to localStorage.
- **Effort:** S.
- **Risk:** Negligible.
- **Proposed backlog item:** [P3] [AUDIT-2026-04-21-SV F7] Add Live / Online filter pills to past-sessions list - SessionsView.jsx:340-358

---

## Observations without fixes

Worth noting; not severity-scored; may become findings with more evidence.

- **BankrollDisplay shows cents (,437.50) - may be noise for glance use.** BankrollDisplay.jsx:13 uses toFixed(2). A lifetime bankroll displayed to the cent creates false precision; rounding to nearest dollar may serve glanceability better for post-session-chris who reads this as a trend signal, not an accounting ledger.

- **SessionCard delete button is ~32px effective tap target.** src/components/ui/SessionCard.jsx:147-151 - p-2 + Trash2 size=16 = 32px total. Below the 44px H-ML06 floor. Not promoted to a separate finding because fixing F1 (toast+undo) reduces the cost of a mis-tap to a recoverable undo.

- **SessionForm double-scale risk.** SessionForm.jsx:104 applies transform: scale(scale) to the modal inner div, while SessionsView wraps the entire view in ScaledContainer. If both factors compound, the modal may appear smaller than intended at scale < 1.0. Needs visual verification.

- **ActiveSessionCard has no explicit Resume to Table label.** Surface artifact anatomy lists Resume as a primary action alongside Cash Out. The actual component has only End Session in the card header. Back to Table in the parent view header (SessionsView.jsx:264-270) serves as resume but is grouped with Export and Import with no visual primacy. Post-session-chris returning to an interrupted session may not identify it as the resume affordance.

---

## Open questions

1. Does importAllData merge or replace? F3 fix scope depends on the answer: copy-only (S) vs implementation + copy (M).
2. Is tip omission a confirmed frustration or inferred? JTBD-SM-21 names tip logging, but no LEDGER.md entry records Chris expressing tip frustration directly. Real user validation would elevate severity confidence.
3. Does the bottom-bar collision (F5) manifest on Chris actual device? Samsung Galaxy A22 at 1600x720 - scale ~1.0 - no collision at reference. Verify with Playwright at 900x420 viewport.
4. Is ringmaster-in-hand a real SessionsView use case? If a rebuy affordance were added directly to TableView, the Ringmaster would never navigate to SessionsView mid-hand, making F4 irrelevant for that persona specifically.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 - Replace window.confirm + immediate delete with toast+undo | 4 | S | P0 |
| 2 | F3 - Fix ImportConfirmModal warning copy (merge vs replace) | 3 | S | P1 |
| 3 | F2 - Add tip field to CashOutModal and wire through P&L | 3 | M | P1 |
| 4 | F5 - Bottom-bar: flex container to prevent overlap at sub-reference scale | 2 | S | P2 |
| 5 | F4 - Rebuy entry: inputMode decimal + undo toast + preset quick-tap | 2 | M | P2 |
| 6 | F6 - SessionForm: guard backdrop-tap dismiss on dirty state | 1 | S | P3 |
| 7 | F7 - Add Live / Online filter pills to past-sessions list | 1 | S | P3 |

Sequencing note: F1 is standalone P0. F3 must be verified before coding (semantics question). F2 and F4 are independent. F5 pairs with any visual verification pass. F6 and F7 can be bundled.

---

## Backlog proposals

Copy-paste ready for .claude/BACKLOG.md:

- [ ] [P0] [AUDIT-2026-04-21-SV F1] Replace window.confirm+immediate delete on SessionCard with toast+undo - SessionsView.jsx:122-134
- [ ] [P1] [AUDIT-2026-04-21-SV F3] Fix ImportConfirmModal warning copy - verify merge vs replace semantics - ImportConfirmModal.jsx:18, exportUtils.js
- [ ] [P1] [AUDIT-2026-04-21-SV F2] Add optional tip field to CashOutModal and wire through P&L - CashOutModal.jsx, SessionsView.jsx:104-213, BankrollDisplay.jsx
- [ ] [P2] [AUDIT-2026-04-21-SV F5] Unify bottom-bar elements into flex container - SessionsView.jsx:377-397
- [ ] [P2] [AUDIT-2026-04-21-SV F4] Rebuy entry: inputMode decimal + undo toast + 44px buttons + preset quick-tap - ActiveSessionCard.jsx:60-75,147-170
- [ ] [P3] [AUDIT-2026-04-21-SV F6] SessionForm: guard backdrop-tap dismiss when form has dirty state - SessionForm.jsx:100-106
- [ ] [P3] [AUDIT-2026-04-21-SV F7] Add Live / Online filter pills to past-sessions list - SessionsView.jsx:340-358

---

## Discoveries referenced (separate track - not audit findings)

- Multi-currency bankroll (Traveler persona, F-P14) - BankrollDisplay shows a single dollar sign with no currency field in the session schema. Traveler primary use case is entirely unserved on this surface. Discovery candidate: docs/design/discoveries/2026-04-21-multi-currency-bankroll.md.
- Tax-friendly per-year export (DE-71) - only raw JSON ships today. Traveler and Circuit Grinder doing annual tax reconciliation need structured CSV or per-year summary. Discovery candidate.
- Resume affordance missing from ActiveSessionCard - card primary CTA is End Session (destructive). Return-to-table path is a secondary header button labeled Back to Table. No explicitly-labeled resume affordance on the card itself. Candidate for surface update.

---

## Gate 5 resolution — 2026-04-21 (same session)

Owner approved via continue-directive. Main-Claude verified the 3 high-severity claims by direct code read before acting:

- **F1 (sev 4) — VERIFIED.** `SessionsView.jsx:122` has `window.confirm(...)` + line 125 `deleteSessionById(sessionId)` with no snapshot. Proceeded to fix.
- **F2 (sev 3) — VERIFIED.** `CashOutModal.jsx` renders only Cash Out Amount input; no tip field. Deferred — requires session schema change + BankrollDisplay update + multiple call sites.
- **F3 (sev 3) — INVALID.** Open question #1 resolved AGAINST the finding. `importAllData` at `src/utils/exportUtils.js:192` calls `await clearAllData()` FIRST, then imports. The warning copy ("replace ALL existing data") is accurate; the "Import & Replace" button is accurate. F3 WITHDRAWN. The observation about trust erosion from user confusion is preserved as an observation-without-fix (users may still be surprised by the scope, but the finding as written is false).

**Implemented:**

| ID | Status | Code | Tests |
|----|--------|------|-------|
| F1 | ✅ SHIPPED | `SessionsView.jsx:29-36` (imports + UNDO_TOAST_DURATION_MS + `pendingDeletesRef`), `:120-175` (`handleDeleteSession` rewritten as deferred-delete), `:71-83` (unmount cleanup commits pending deletes) | 103/103 SessionsView sub-component tests pass |
| F3 | ❌ WITHDRAWN | Verification resolved finding false | — |

**Pattern choice (F1):** *deferred-delete* rather than *delete-then-restore*. The fix keeps the session in IDB through the undo window; only commits the real delete when the 12s timeout fires. On undo: local state restores; IDB is never touched. On unmount: pending deletes commit (user intended to delete, just didn't undo). Advantages over the alternative:
- No need to preserve sessionId across delete+re-insert (createSession assigns new IDs).
- No orphaned-hand edge case.
- No schema surgery.
- Clean rollback if the IDB delete itself fails.

**Remaining open (queued for subsequent sessions):**
- F2 (P1) — tip field on CashOutModal. Effort M — schema + handler + 3 display sites. Separate session.
- F4 (P2) — Rebuy entry: inputMode decimal + undo toast + 44px + preset. Effort M.
- F5 (P2) — Bottom-bar flex container. Effort S; needs visual verification.
- F6 (P3) — SessionForm dirty-state backdrop guard. Effort S.
- F7 (P3) — Live/Online filter pills. Effort S.

**Visual verification (owner checklist):**
- [ ] Tap Delete on a past SessionCard → NO native dialog; warning toast "Session deleted (N hands)" appears with Undo action.
- [ ] Within 12s, tap Undo → card reappears in its original position; success toast "Session restored" confirms.
- [ ] Let toast auto-dismiss → card stays removed; session is now permanently gone from IDB (confirm via page reload).
- [ ] Delete multiple sessions in quick succession → each gets its own toast; each can be undone independently; non-undone ones commit individually after their own 12s window.
- [ ] Delete a session then navigate to Table → return → session is gone (unmount cleanup committed the delete).

---

## Sign-off

- **Drafted by:** Claude (product-ux-thinker agent) - 2026-04-21
- **Owner-reviewed:** 2026-04-21 (continue-directive)
- **P0 implementation closed:** 2026-04-21 (DCOMP-W1-S4)
- **F3 withdrawn:** 2026-04-21 (verification resolved)
- **P1-P3 implementation:** Pending subsequent sessions.

Audit is immutable after close. Follow-up audits create a new file.

---

## Change log

- 2026-04-21 - Draft. DCOMP-W1 (Gate 4). Heuristic walkthrough on SessionsView + 6 sub-components. 7 findings (1xsev4, 2xsev3, 2xsev2, 2xsev1), 4 observations-without-fixes, 4 open questions, 3 discovery candidates.
- 2026-04-21 - Gate 5 resolution appended. F1 shipped; F3 withdrawn after verification; F2/F4-F7 queued.
- 2026-04-21 - DCOMP-W1-S5: F4 SHIPPED (rebuy polish + preset + undo). Evidence: `EVID-2026-04-21-W1-S5-BATCH`. F2 (tip field P1) + F5/F6/F7 remain queued.
- 2026-04-21 - DCOMP-W1-S6: F5 SHIPPED (bottom-bar flex container — BankrollDisplay + drill buttons unified). Evidence: `EVID-2026-04-21-W1-S6-BATCH`. F2 + F6 + F7 remain queued.
- 2026-04-21 - DCOMP-W1-S7: F6 + F7 SHIPPED (SessionForm dirty-state backdrop guard; Live/Online filter pills with localStorage persistence). Evidence: `EVID-2026-04-21-W1-S7-BATCH`. **Only F2 (tip field P1) remains.**
- 2026-04-21 - DCOMP-W1-S9: F2 SHIPPED (tip field on CashOutModal + wire through P&L, additive schema, backward-compat). Evidence: `EVID-2026-04-21-W1-S9-SV-F2`. **All SessionsView audit findings closed.**
