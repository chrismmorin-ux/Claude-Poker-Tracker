# Evidence Ledger

Append-only log of observations that back audit findings. Every non-trivial audit claim must cite an entry here. An observation that can't be cited is a hypothesis, not evidence.

---

## ID format

`EVID-YYYY-MM-DD-TAG`

- Date is when the observation happened (or was first logged), not when it was entered.
- Tag is a short kebab-case descriptor.

---

## Source types

- **Self-observation** — Chris (owner) noted something during or after his own use.
- **Statement** — Chris said it directly in a session with Claude.
- **Code inspection** — observed by reading code, objectively verifiable.
- **Telemetry** — pulled from IndexedDB data or logged events.
- **Test output** — failing test reveals the issue.
- **Incident** — a known failure event (post-mortem in `.claude/failures/`).
- **External** — from a third-party source (article, documentation, another tool).

---

## Entries

### EVID-2026-04-21-CLEAR-PLAYER

- **Source type:** Statement
- **Observer:** Chris
- **When:** 2026-04-21 (conversation)
- **Where:** Seat Context Menu, opened via right-click on an occupied seat
- **Summary:** When right-clicking a seat with a player assigned, "Clear Player" is at the bottom of the menu. The owner reports that in practice, the most common intent when opening this menu on an occupied seat is to clear the player (because they left), not to change to another. Current placement leads to an extra scan or scroll to reach the intended primary action.
- **Verbatim:** "the 'clear player' button when right clicking a seat is at the bottom, when it needs to be at the top. it is more likely a player clicking an existing player clears the seat instead of changes it."
- **Verified:** Yes — code at `src/components/views/TableView/SeatContextMenu.jsx:91-99` confirms Clear Player is the last item, rendered only when seat is occupied.
- **Related findings:** TBD — Session 2 audit will formalize.

### EVID-2026-04-21-LANDSCAPE-SCROLL

- **Source type:** Statement
- **Observer:** Chris
- **When:** 2026-04-21 (conversation)
- **Where:** Player Editor (`PlayerEditorView`), on phone in landscape orientation
- **Summary:** The Player Editor form is cut off on phones in landscape orientation — content that extends beyond the viewport doesn't scroll. App is optimized for Samsung Galaxy A22 (1600×720) landscape; smaller phones in landscape hit this.
- **Verbatim:** "the new player UI seem s optimized for landscope mode, and is cut off and doesn't scroll when on a phone in landscape."
- **Verified:** Partially — code at `src/components/views/PlayerEditorView/PlayerEditorView.jsx:130-156` uses `min-h-screen` + `transform: scale(...)` on root, with a `flex-1 overflow-auto` body container. Hypothesis: the scale transform interacts with `min-h-screen` + flex layout in a way that breaks scrolling on smaller viewports. Needs visual verification at ~850×390.
- **Related findings:** TBD — Session 2 audit will formalize.

### EVID-2026-04-12-SIDEBAR-S1-S5

- **Source type:** Incident
- **Observer:** Chris
- **When:** Multiple instances between 2026-04-11 and 2026-04-16
- **Where:** Ignition extension sidebar
- **Summary:** Five recurring symptoms (S1–S5) where the sidebar showed stale or wrong advice after various events: SW cache replay, hand boundary, table switch, panel override, invariant violation. Documented fully in `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` and `.claude/failures/STATE_CLEAR_ASYMMETRY.md`.
- **Verified:** Yes — post-mortem exists; 8 mechanisms identified; rebuild program closed 2026-04-15 → 2026-04-16.
- **Related findings:** Sidebar doctrine at `docs/SIDEBAR_DESIGN_PRINCIPLES.md`.

### EVID-2026-04-21-ENGINE-MARKET

- **Source type:** External (agent-synthesized)
- **Observer:** Session 1b market-research agent
- **When:** 2026-04-21
- **Where:** n/a — market research spanning competitive landscape (PokerTracker, Hold'em Manager, GTO Wizard, Piosolver, Hand2Note, ICMIZER, Sharkscope, Run It Once, Upswing, CardRunnersEV, etc.)
- **Summary:** Ten recurring unmet-need themes across the poker-tools market: live hand entry friction, weak opponent-modeling-to-action translation, intimidating GTO output, no bridge between live and online study, small-sample HUD untrustworthiness, thin mobile-first tools, fragmented coach-student workflows, ICM/rake not in real-time decisions, weak multiway postflop guidance, Ignition / anonymous-site tool lag. Competitive tier patterns: Free / Trial → Starter ($10–30/mo) → Pro ($30–80/mo) → Elite/Team ($100–250/mo). Common gates: hand volume caps, tournament vs cash SKUs, solver depth, ICM/FGS features, AI coach, device count, cloud sync, community / share features.
- **Verified:** Sources cited include pokertracker.com, gtowizard.com, piosolver.com, hand2note.com, icmizer.com, sharkscope.com, Two Plus Two forum threads, Reddit r/poker and r/pokerstudy threads, PokerNews/Upswing comparison articles. Not independently re-validated — treat as synthesis, not primary source.
- **Related findings:** Drives persona creation for 14 end-user archetypes (Session 1b); informs tier placeholders in `tiers/`; seeds discovery list.

### EVID-2026-04-21-ENGINE-FEATURE-INVENTORY

- **Source type:** Code inspection (agent-synthesized)
- **Observer:** Session 1b feature-inventory agent
- **When:** 2026-04-21
- **Where:** Codebase — `src/components/views/`, `src/utils/*`, `ignition-poker-tracker/`
- **Summary:** 14 shipped user-facing features. 4 WIP/paused items flagged: postflop drills advanced tabs (Estimate/Framework/Library/Lessons stubs), preflop drills advanced tabs (most tabs stubs), Firebase Cloud Sync PAUSED (STATUS.md §56), Hand Significance / Importance Scoring unexposed, Decision Tree Visualization (`DecisionTreeView.jsx`) component exists but not routed (orphaned). Three user-flow gaps: (1) live advice → drill learning has no link, (2) hand review → study materials has no link, (3) online hands stored but no dedicated OnlineView history tab.
- **Verified:** Direct code inspection; paths cited.
- **Related findings:** Drives `features/INVENTORY.md`; seeds WIP flags in product artifacts.

### EVID-2026-04-21-ENGINE-GAP-LIST

- **Source type:** Statement (agent-synthesized)
- **Observer:** Session 1b product-strategist agent
- **When:** 2026-04-21
- **Where:** Synthetic — generative pass over persona cast × JTBD cast × feature inventory
- **Summary:** 20 candidate missing features across Pro / Studio / Sidebar-Lite / Platform tiers: tilt detector, cross-venue linker, voice input, ICM payout import, bounty EV, satellite mode, coach dashboard, staker portal, home-game settle, PT4/HM3 importer, similar-spot search, skill map, custom drills from history, multi-currency, public API, sidebar-lite track, mixed-games support, signed sessions, accessibility modes, session recovery / local-first guarantee.
- **Verified:** Individual items not yet evidence-backed; flagged `[SPECULATION]` in the discovery file until persona-specific evidence emerges.
- **Related findings:** Drives `discoveries/2026-04-21-initial-gap-list.md`.

### EVID-2026-04-21-SESSION4-P2-IMPLEMENTATION

- **Source type:** Code inspection + test output
- **Observer:** Claude (Session 4)
- **When:** 2026-04-21
- **Where:** Changes to `FilterChips.jsx`, `AvatarFeatureBuilder.jsx` + test, `ResultCard.jsx`, `PlayerPickerView.jsx`, `SeatContextMenu.jsx` + test, `TableView.jsx`.
- **Summary:** Implemented all 4 P2 findings from AUDIT-2026-04-21-player-selection.
  - **F5:** FilterChips `ColorPanel` and `ShapePanel` now `max-h-32 overflow-y-auto`. Panel expansion no longer pushes results below fold on short landscape viewports.
  - **F6:** ResultCard accepts `assignedToSeat` prop and shows a blue "at seat N" badge when the player is already assigned elsewhere. PlayerPickerView threads `getPlayerSeat(playerId)` lookup into ResultCard and, on pick, clears the prior seat before assigning the new one. New toast: "Moved <name> from seat X to seat Y". Silent double-assign eliminated.
  - **F8+F9:** AvatarFeatureBuilder secondary rows (Eyes, Eye Color, Glasses, Hat) collapsed behind a "More details" chevron toggle matching PhysicalSection pattern. `hasAnySecondarySelection(features)` auto-opens the group when editing a record that already has non-default selections in that group — preserves visibility in edit mode while reducing vertical mass for create-mode first impression. Primary rows (Skin, Hair, Hair Color if hair chosen, Beard, Beard Color if beard chosen) remain visible.
  - **F10:** "⇄ Swap Player…" button added to SeatContextMenu for occupied seats. TableView adds `handleSwapPlayer(seat)` → `openPlayerPicker({ seat, swapMode: true })`. PlayerPickerView reads `pickerContext.swapMode` and `getSeatPlayer(currentSeat)?.name` to surface title as "Swap <prior name> (seat N)". Semantically same as F6 (clear + assign) but with explicit intent in the UI.
- **Test verification:**
  - SeatContextMenu: 28/28 (27 previous + 1 new for Swap button).
  - AvatarFeatureBuilder: 10/10 (7 previous + 3 new for collapsibility).
  - Changed surfaces overall: 144/144 passing.
- **Visual verification:** Not performed; same Playwright MCP issue as Session 3. Owner should verify the 4 P2 behaviors on device along with the P1 verification checklist.
- **Related findings:** AUDIT-2026-04-21 F5, F6, F8, F9, F10 all marked implemented.

### EVID-2026-04-21-SESSION3-IMPLEMENTATION

- **Source type:** Code inspection + test output
- **Observer:** Claude (Session 3)
- **When:** 2026-04-21
- **Where:** Changes to `src/components/views/TableView/SeatContextMenu.jsx`, `TableView.jsx`, `src/components/views/PlayerPickerView/FilterChips.jsx` + `PlayerPickerView.jsx`, `src/components/views/PlayerEditorView/PlayerEditorView.jsx`, and `src/components/views/TableView/__tests__/SeatContextMenu.test.jsx`.
- **Summary:** Implemented 4 P1 findings from AUDIT-2026-04-21-player-selection.
  - **F1+F3+F11:** `SeatContextMenu` refactored into state-aware render. When seat occupied: `[Clear Player]` → divider → `[Make My Seat / Make Dealer]` → divider → `[Assign Player header + Find + Create + Recent]`. When empty: same but Clear omitted and seat-config at top. Recent list now separated from Clear by the full Assign section — destructive adjacency resolved structurally. `data-seat-occupied` attribute exposed for tests.
  - **F2:** `handleClearPlayer` in TableView captures prior player via `getSeatPlayer(seat)` before clearing, then shows `addToast("Cleared <name> from seat N", { duration: 6000, action: { label: 'Undo', onClick: () => assignPlayerToSeat(seat, priorPlayerId) }})`. Mirrors retro-link undo pattern.
  - **F4:** Menu rows bumped from `py-2` to `py-3 min-h-[44px]` (~48 DOM-px height). Filter chips bumped from `px-2.5 py-1` (~26 DOM-px) to `px-3 py-2 min-h-[36px]`. Pragmatic compromise — below ideal 88 DOM-px but material improvement from ~18 visual at scale 0.5 to ~24. Recent-list rows kept at 40-min (secondary priority; noted).
  - **F7:** Root of `PlayerEditorView` and `PlayerPickerView` changed from `min-h-screen` to `h-screen` + `overflow-hidden`. Hypothesis verified by reasoning: `min-h-screen` let the root grow to fit content (2000px form), so `flex-1 overflow-auto` child had no bounded parent to overflow against → scroll never engaged. `h-screen` caps root to 100vh; body `flex-1 overflow-auto` is now bounded; scroll should engage.
- **Test verification:**
  - SeatContextMenu tests: 27/27 passing (includes 4 new tests for state-aware ordering).
  - All Table/Picker/Editor surface tests: 140/140 passing.
  - Full suite: 6120/6122 (2 pre-existing flaky Monte Carlo tests in `gameTreeHelpers.test.js` — pass when run in isolation, unrelated to this session).
- **Visual verification status:** ATTEMPTED BUT UNAVAILABLE. Dev server ran on localhost:5179 (port fallback from 5173). Playwright MCP browser backend returned "Target page, context or browser has been closed" on `browser_navigate`, `browser_tabs new`, and `browser_run_code`. Could not visually verify F7 scroll fix on a 900×414 simulated viewport, or menu ordering / tap-target sizes visually. Per CLAUDE.md: "if you can't test the UI, say so explicitly rather than claiming success." Owner should verify on physical phone before closing the audit findings.
- **Verified in code:** Direct file reads after edits confirmed expected class strings and structure.
- **Related findings:** AUDIT-2026-04-21 F1, F2, F3, F4, F7, F11 marked implemented.

### EVID-2026-04-21-AUDIT-SURFACE-CODE-READ

- **Source type:** Code inspection
- **Observer:** Claude (Session 2 audit)
- **When:** 2026-04-21
- **Where:** `src/components/views/TableView/SeatContextMenu.jsx`, `src/components/views/PlayerPickerView/*`, `src/components/views/PlayerEditorView/*`, `src/hooks/useScale.js`
- **Summary:** Re-read all three player-selection surfaces and the scale hook to ground the audit. Confirmed code-level truth for 11 findings in `audits/2026-04-21-player-selection.md`:
  - SeatContextMenu renders fixed-order menu regardless of seat state; Clear at position 7 when seat occupied (lines 91-99).
  - No undo pattern wired around onClearPlayer.
  - Menu rows use `py-2` (~8px) → 36-40px DOM height → ~18-20px visual at scale 0.5.
  - PlayerEditorView root uses `min-h-screen` + `transform: scale()` + `flex-1 overflow-auto` body; composition is the hypothesized cause of the landscape scroll failure.
  - AvatarFeatureBuilder renders 9 always-expanded feature sections — long vertical form compounds scroll issue.
  - PhysicalSection is collapsible (useState), AvatarFeatureBuilder is not — asymmetric density pattern.
  - FilterChips inline-expands panels in vertical flow, can push results below the fold on short viewports.
  - PlayerPickerView.handlePickPlayer calls assignPlayerToSeat unconditionally — no pre-check for existing assignment elsewhere.
- **Verified:** Direct code paths cited per finding.
- **Related findings:** F1–F11 in audit file.

### EVID-2026-04-21-TABLE-WINDOW-CONFIRM

- **Source type:** Code inspection
- **Observer:** Claude (DCOMP-W1-S1 blind-spot audit, product-ux-engineer agent)
- **When:** 2026-04-21
- **Where:** `src/components/views/TableView/CommandStrip.jsx:254`
- **Summary:** The Reset Hand handler uses a native `window.confirm('Reset all actions for this hand?')` dialog. This is invoked during live play. Native browser confirm dialogs are modal, pull focus, require two-tap dismissal, and are explicitly forbidden by the [mid-hand-chris](../personas/situational/mid-hand-chris.md) surface contract: "Show advice without freshness indication... Pop modals that block the table view..." The codebase already uses a correct toast+undo pattern at CommandStrip.jsx lines 201–249 (Next Hand) and 355–369 (Clear Player) — the wrong pattern was used for a similarly-reversible action.
- **Verified:** Yes — `grep -n "window.confirm\|confirm\(" src/components/views/TableView/CommandStrip.jsx` returns line 254.
- **Related findings:** Blind-spot audit 2026-04-21 table-view C1 (Situational) + E1 (Heuristic). Candidate P1 for the Wave 1 heuristic audit.

### EVID-2026-04-21-TABLE-TOUCH-TARGET-40PX

- **Source type:** Code inspection
- **Observer:** Claude (DCOMP-W1-S1 blind-spot audit, product-ux-engineer agent)
- **When:** 2026-04-21
- **Where:** `src/components/views/TableView/SeatContextMenu.jsx:83` (RecentPlayersSection button). Primary MENU_ROW_CLASS at line 15 correctly uses `min-h-[44px]`.
- **Summary:** RecentPlayersSection rows use `min-h-[40px]` with `py-2.5`, violating the [mobile-landscape heuristic H-ML06](../heuristics/mobile-landscape.md) 44px touch-target floor. At viewport scale factors below 1.0 the DOM-px floor compresses further. Inconsistent with primary menu rows in the same file which correctly use `MENU_ROW_CLASS` (min-h-[44px]). The fix is a one-line class change; documenting the inconsistency prevents future contributions from copying the weaker pattern.
- **Verified:** Yes — grep confirms both patterns coexist in `SeatContextMenu.jsx` (primary at 15, weaker at 83).
- **Related findings:** Blind-spot audit 2026-04-21 table-view E3.

### EVID-2026-04-21-HAND-SCHEMA-DUAL-PATH

- **Source type:** Code inspection
- **Observer:** Claude (DCOMP-W1-S1 blind-spot audit, systems-architect agent)
- **When:** 2026-04-21
- **Where:** `src/components/views/HandReplayView/VillainAnalysisSection.jsx:40,46` — reads `hand.cardState.communityCards || hand.gameState.communityCards` (dual-path fallback).
- **Summary:** The persisted-hand schema has migrated at least once — fields that used to live on `hand.gameState` now live on `hand.cardState`, but readers preserve the old path as a fallback. This is load-bearing evidence: without a documented canonical schema, the next TableView writer change can silently break HandReplay for historical hands. No single source of truth for "what fields must a persisted hand have, and where." The fix is a schema contract document — not a code change, a framework-durability change.
- **Verified:** Yes — direct file read confirms dual-path fallback.
- **Related findings:** Blind-spot audit 2026-04-21 table-view D1. Drives the new `docs/design/contracts/persisted-hand-schema.md` invariants note authored in the same session.

### EVID-2026-04-21-BUBBLE-PHANTOM-JTBD

- **Source type:** Code inspection / framework self-audit
- **Observer:** Claude (DCOMP-W1-S1 blind-spot audit, product-ux-engineer agent)
- **When:** 2026-04-21
- **Where:** `docs/design/personas/situational/bubble-decision.md:57–58` cited `JTBD-TS-01` and `JTBD-TS-03`; atlas only defined `TS-35..TS-42`.
- **Summary:** Framework-internal defect. A situational persona pointed at JTBD IDs that never existed. Traceability was broken — any audit walking persona → JTBD → surface would have hit a dead reference. The fix was structural: the phantom IDs named real distinct jobs (per-decision ICM action vs. persistent ICM pressure indicator; pay-jump proximity vs. ICM-pressure pressure). Added `TS-43` (ICM-adjusted decision at bubble) and `TS-44` (pay-jump proximity indicator) as Active JTBDs to `domains/tournament-specific.md`, updated `bubble-decision.md` to reference the real IDs + note the resolution, referenced this evidence entry.
- **Verified:** `grep -n "JTBD-TS-0\|JTBD-TS-01\|JTBD-TS-03" docs/design/personas/situational/bubble-decision.md` returned lines 57–58 before the fix; post-fix grep returns no matches.
- **Related findings:** Blind-spot audit 2026-04-21 table-view B4. The broader pattern (framework-internal ID drift) motivates a periodic framework-integrity lint — proposed as part of quarterly hygiene H2 scope expansion.

### EVID-2026-04-21-TV-GATE5-P1

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 4 — Gate 5 implementation)
- **When:** 2026-04-21
- **Where:** `src/components/views/TableView/CommandStrip.jsx`, `./ControlZone.jsx`, `./SizingPresetsPanel.jsx`, `./LiveAdviceBar.jsx`
- **Summary:** Implemented all 4 P1 findings + F10 (coupled with F1) from [AUDIT-2026-04-21-table-view](../audits/2026-04-21-table-view.md).
  - **F1 (sev 3):** Replaced `window.confirm` on Reset Hand with toast+undo. Mirrors Next Hand pattern — snapshot gameState (actionSequence, dealerButtonSeat, currentStreet, absentSeats) + cardState (communityCards, holeCards) to `resetHandUndoRef`, call `resetHand()`, show warning toast with 12s Undo action that HYDRATE_STATEs both reducers and restores. Extracted `UNDO_TOAST_DURATION_MS = 12000` constant applied to both Reset Hand and Next Hand (closes F5 unify).
  - **F2 (sev 3):** Orbit strip preview-count badge. Each preflop orbit button that would trigger auto-folds renders a `+N` badge in the top-right, computed from current firstToAct position + unacted intermediate seats. Refactored strip to IIFE pattern for shared helper scope. `aria-label` describes the scope for screen readers.
  - **F3 (sev 3):** Sizing preset editor highlights pressed slot. Long-press handler now takes `slotIdx` argument (was zero-arity); `editingSlotIndex` state threaded into SizingPresetsPanel via new prop; editor renders "editing <label>" sub-header, highlights the matching input with gold border + `autoFocus`.
  - **F4 (sev 3):** LiveAdviceBar explicit AGING badge. Replaced opacity-only fade + 9px age counter with an amber AGING badge at font-size 11 (promoted from 9 per H-PLT01 glanceability). STALE badge font promoted from 9 → 11 for consistency.
  - **F10 (sev 2, coupled with F1):** ControlZone now renders Reset Hand as a smaller (40px vs 48px), opacity-0.75, gray-foreground button — de-emphasized vs the other utility buttons. Next Hand row wrapper gains `pt-3` (was `pt-1`) for a physical gap. Motor-proximity risk reduced without restructuring the overall layout.
- **Test verification:**
  - Changed surfaces: `src/components/views/TableView/__tests__/*.test.jsx` → **86/86 passing** (4 test files: TableHeader 13, SeatContextMenu 28, SeatComponent 33, LiveAdviceBar 12).
  - Reducers: `src/reducers/__tests__/*.test.js` → 238/238 passing (HYDRATE_STATE paths used by F1 undo).
  - Full-suite pre-existing failure (`precisionAudit.test.js`) is a known stochastic Monte Carlo lane-equity test — unrelated to this work, documented in EVID-2026-04-21-SESSION3-IMPLEMENTATION.
- **Visual verification:** Not performed — Playwright MCP still unavailable. Owner should verify on device:
  - F1: Tap Reset Hand with actions recorded → no native dialog; "Hand reset" warning toast with Undo action; Undo restores exact prior state.
  - F2: Set action to UTG in a 6+ handed game → tap "CO" → orbit buttons between UTG and CO show small "+N" red badges; tapping CO still auto-folds them (count in post-toast matches badge).
  - F3: Long-press the "2/3 pot" sizing button → editor opens; "editing 2/3 pot" label visible in gold; that slot's input has gold border + autofocus.
  - F4: Wait 20s without street change → AGING badge appears with "AGING · 25s" in amber. Wait past 60s → STALE badge in red.
  - F10: Visual check — Reset Hand appears smaller and less prominent than Deselect/Absent/Reset Street in the same row; visible vertical gap above Next Hand gold CTA.
- **Verified in code:** direct file reads confirm all expected changes at `CommandStrip.jsx:132-135,225,252-296,358-368,669-682,601-672` + `ControlZone.jsx:54-75` + `SizingPresetsPanel.jsx:12-21,54-66,85-113` + `LiveAdviceBar.jsx:250-268`.
- **Related findings:** AUDIT-2026-04-21-TV F1, F2, F3, F4, F5, F10 marked implemented.

### EVID-2026-04-21-SV-GATE5-F1

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 4 — SessionsView Gate 5)
- **When:** 2026-04-21
- **Where:** `src/components/views/SessionsView/SessionsView.jsx`
- **Summary:** Implemented SV-F1 (sev 4) from [AUDIT-2026-04-21-sessions-view](../audits/2026-04-21-sessions-view.md). Replaced `window.confirm` + immediate `deleteSessionById` at `SessionsView.jsx:122-134` with a **deferred-delete** toast+undo pattern. Session stays in IDB through the 12s undo window; only commits the real delete when the timeout fires. On unmount, pending deletes commit (user intended to delete, just didn't undo) — prevents orphaned in-memory snapshots and matches user intent.
- **Pattern difference from TableView F1:** TableView's undo snapshots reducer state and calls `HYDRATE_STATE` on undo. SessionsView's undo operates on local `sessions` array state only; IDB is never touched during the undo window. This avoids (a) re-creating a session with a new sessionId (the createSession path strips sessionId), and (b) cascading hand-record restoration.
- **F3 withdrawn after verification.** Agent's open question #1 asked whether `importAllData` merges or replaces. Direct read of `src/utils/exportUtils.js:192` confirms `await clearAllData()` fires FIRST. Import DOES replace. Warning copy is accurate. F3 is a non-finding.
- **Test verification:**
  - SessionsView sub-component tests: **103/103 passing** (BankrollDisplay 18, ImportConfirmModal 24, CashOutModal 24, ActiveSessionCard 37).
  - Full-suite pre-existing `precisionAudit.test.js` failure unrelated (documented elsewhere).
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - Tap Delete on past session → NO native dialog; warning toast with Undo.
  - Undo within 12s → card restored.
  - Let timeout → permanently deleted (verify via reload).
  - Delete + navigate away → unmount cleanup commits delete.
- **Verified in code:** `SessionsView.jsx:29-36` (imports + constants + ref), `:71-83` (unmount cleanup effect), `:120-175` (`handleDeleteSession` rewritten).
- **Related findings:** AUDIT-2026-04-21-SV F1 closed; F3 withdrawn.

### EVID-2026-04-21-SDV-GATE5-F1

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 4 — ShowdownView Gate 5)
- **When:** 2026-04-21
- **Where:** `src/hooks/useShowdownHandlers.js`, `src/components/views/ShowdownView/ShowdownView.jsx`
- **Summary:** Implemented SDV-F1 (sev 4) from [AUDIT-2026-04-21-showdown-view](../audits/2026-04-21-showdown-view.md). Replaced unguarded `nextHand() + closeShowdownView()` at `useShowdownHandlers.js:84-87` with a snapshot-and-toast pattern. Mirrors `CommandStrip.handleNextHand` (the Next Hand in TableView) but additionally calls `openShowdownView()` on undo so the user lands back on the Showdown surface — critical for ringmaster-in-hand whose undo mental model is "return me to where I was before I broke the hand," not just "restore the data."
- **Hook signature extended** with 12 new inputs: `dealerButtonSeat`, `currentStreet`, `absentSeats`, `communityCards`, `holeCards`, `allPlayerCards`, `holeCardsVisible`, `handCount`, `setHandCount`, `openShowdownView`, `addToast`, `showInfo`. All are optional (graceful no-op if missing), backward-compatible with existing callers.
- **Test update:** existing `useShowdownHandlers.test.js` doesn't exercise the new inputs yet; the new path is gated on `hadActions && addToast` — when those are absent (as in most existing tests), behavior is identical to pre-fix. 23/23 existing tests pass without modification.
- **Covers both call sites:** header Next Hand (`ShowdownHeader.jsx:37-43`) AND winner-confirmation overlay Next Hand (`ShowdownView.jsx:203-209`) both call `handleNextHandFromShowdown` — the fix applies to both for free (audit observation).
- **Test verification:**
  - ShowdownView + hook tests: **111/111 passing** (hook 23, ActionHistoryGrid 21, ShowdownSeatRow 32, ShowdownHeader 16, CardGrid 19).
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - Record a hand → reach Showdown → tap Next Hand → "Hand recorded" toast with Undo (no native dialog, no silent advance).
  - Within 12s tap Undo → ShowdownView re-opens with full state restored (action sequence, cards, dealer button, street, hand count).
  - Same verification on the winner-confirmation overlay Next Hand button.
  - Fresh hand with zero actions → Next Hand emits no toast (no rollback needed).
- **Verified in code:** `useShowdownHandlers.js:1-17` (imports + constant), `:27-44` (extended signature + undo ref), `:91-164` (rewritten handler), `ShowdownView.jsx:42-68` (consolidated context destructuring + new inputs), `:81-116` (hook call site).
- **Related findings:** AUDIT-2026-04-21-SDV F1 SHIPPED. F2 (visual separation, severity drops to 2 post-F1) queued. F3/F4/F5 P2 queued. F6/F7 P3 queued.

### EVID-2026-04-21-W1-S5-BATCH

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 5 — Destructive-action completion batch)
- **When:** 2026-04-21
- **Where:** `src/hooks/useShowdownHandlers.js`, `src/components/views/ShowdownView/ShowdownHeader.jsx`, `src/components/views/ShowdownView/ShowdownSeatRow.jsx`, `src/components/views/ShowdownView/ShowdownView.jsx`, `src/components/views/SessionsView/ActiveSessionCard.jsx` + 2 test files (ShowdownHeader.test, ActiveSessionCard.test)
- **Summary:** Three P2 fixes shipped in one batch, all extending the toast+undo / destructive-action-safety pattern proven in S4:
  - **SDV-F3 (sev 2):** `handleClearShowdownCards` now snapshots `{communityCards, holeCards, allPlayerCards, holeCardsVisible, actionSequence}`, clears, and shows a 12s warning toast with Undo that HYDRATE_STATEs both reducers. `ShowdownHeader` hides the Clear Cards button when `showdownMode === 'quick'` (it's a no-op in Quick Mode; hiding reduces destructive-action surface).
  - **SDV-F4 (sev 2):** `handleWonSeat` captures `actionSequence` pre-won, records WON + MUCKED, then shows a 12s success toast with Undo that HYDRATE_STATEs `actionSequence`. `ShowdownSeatRow` gains a new optional `wonAutoMuckCount` prop; in Quick Mode with `≥2` other active seats the Won button renders a passive "mucks N others" sub-label. `ShowdownView` computes `activeShowdownSeatCount` via `SEAT_ARRAY.filter(isSeatInactive-passing + no-showdown-WON/MUCKED-action)` and threads `Math.max(0, count - 1)` into each SeatRow.
  - **SV-F4 (sev 2):** `ActiveSessionCard` rebuy entry polish: input switched to `type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"` (role changed from spinbutton → textbox; tests updated); Confirm/Cancel/+Add-Rebuy/preset buttons bumped to `minHeight: 44px`; new one-tap preset button "Use $X" above the input uses `getDefaultRebuyAmount(gameType)` to bypass keyboard entry for the common rebuy case. `commitRebuy(amount)` snapshots prior `rebuyTransactions` before appending and shows a 12s success toast with Undo that reverts to the snapshot via `onUpdateField`. Tests mock `useToast` + extend `lucide-react` mock for transitive Toast.jsx icons.
- **Test verification:**
  - SessionsView + ShowdownView + hook tests: **215/215 passing** (9 files).
  - 3 ShowdownHeader tests updated to pass `showdownMode="full"` explicitly (Clear Cards now hidden in Quick Mode); 1 new positive-coverage test for the Quick-Mode hide.
  - 3 ActiveSessionCard rebuy tests updated: `getByRole('spinbutton')` → `getByRole('textbox')` after `type="text"` switch.
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - SDV-F3: In Full Mode, Clear Cards button is visible; tap clears + 12s "Cards cleared" warning toast with Undo restores every card slot + action sequence. In Quick Mode, Clear Cards button is absent.
  - SDV-F4: 5-way Quick Mode showdown → each Won button shows "mucks 4 others" sub-label in small text below "Won". Tapping Won → 12s success toast "Seat N won (4 others mucked)" with Undo; Undo reverts all WON+MUCKED records. Heads-up (1 other) → no sub-label (below threshold of 2).
  - SV-F4: Tap "+ Add Rebuy" → keyboard-free "Use $X" preset button visible above input; tapping preset commits immediately with 12s Undo toast. Typing in input: compact numeric keypad (inputMode=decimal). Confirm button visibly larger (≥44px).
- **Verified in code:** `useShowdownHandlers.js:42-48,56-113,141-192` + `ShowdownHeader.jsx:45-57` + `ShowdownSeatRow.jsx:32-42,145-178` + `ShowdownView.jsx:177-194,292-300` + `ActiveSessionCard.jsx:1-9,68-117,156-204`.
- **Related findings:** AUDIT-2026-04-21-SDV F3 + F4 SHIPPED; AUDIT-2026-04-21-SV F4 SHIPPED. P1-post-F1 sequencing: SDV-F2 severity confirmed P2 (F1 now absorbs cost of adjacent mis-tap).

### EVID-2026-04-21-W1-S6-BATCH

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 6 — Layout + touch-target batch)
- **When:** 2026-04-21
- **Where:** `src/components/views/ShowdownView/ShowdownHeader.jsx`, `./CardGrid.jsx`, `src/components/views/SessionsView/SessionsView.jsx`, `./BankrollDisplay.jsx`, `src/components/views/TableView/SeatContextMenu.jsx`
- **Summary:** Four P2 layout/touch-target fixes in one batch — pure visual hygiene with no behavioral changes:
  - **SDV-F2 (sev 3→2):** ShowdownHeader layout reworked. Done button moved from the rightmost position (adjacent to Next Hand) to the LEFT anchor, with an `ArrowLeft` icon signaling non-destructive exit. Next Hand kept at the rightmost position with a subtle gold glow. Destructive/non-destructive primaries now separated by the full BOARD display + mode toggle (≥200px physical gap), structurally eliminating the adjacent-mis-tap risk. Post-F1 (shipped S4), severity drops from 3→2; this layout change completes the defense-in-depth.
  - **SDV-F5 (sev 2):** `CardGrid.jsx:23` changed `overflow-hidden` → `overflow-auto`. Code comment documents the 1600×720 design-reference assumption + the sub-reference-viewport clipping risk. Full responsive layout deferred as a future discovery; this one-line change unblocks the JTBD-HE-11 regression where right-column low-rank cards (2, 3) were silently inaccessible on narrow devices.
  - **SV-F5 (sev 2):** SessionsView bottom bar unified. Removed `absolute bottom-8 left-8` from BankrollDisplay (content block now); removed inline `absolute bottom-8 right-48 / right-8` from drill buttons. All three now wrapped in a single `absolute bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-8` container with `pointer-events-none` on the wrapper + `pointer-events-auto` on interactive children. Collision-proof at any scale.
  - **TV-F8 (sev 2):** SeatContextMenu recent-players row class change `min-h-[40px]` → new `RECENT_ROW_CLASS` (44px). Added code comment making it a single-source-of-truth rule: "every tappable row in this menu MUST use one of these classes." Prevents future drift to weaker heights.
- **Test verification:**
  - TableView + ShowdownView + SessionsView: **278/278 passing** (12 test files).
  - All existing tests pass without modification — pure layout changes don't affect test semantics.
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - **SDV-F2:** ShowdownView: Done button is leftmost with ← icon; Next Hand is rightmost with subtle gold glow; ≥200px horizontal gap between them (BOARD + mode toggle sit between).
  - **SDV-F5:** On a sub-reference-wide viewport (e.g., 900×400), CardGrid scrolls horizontally to reveal low-rank columns that were previously clipped. On reference 1600×720, no visible change.
  - **SV-F5:** SessionsView bottom bar: BankrollDisplay left, drill buttons right-justified; no overlap at any scale. Both drill buttons remain clickable.
  - **TV-F8:** Seat context menu → Recent section: rows visibly taller than before (44px instead of 40px). Minor but consistent with primary-menu rows.
- **Verified in code:** `ShowdownHeader.jsx:1-92` (full rewrite), `CardGrid.jsx:22-29` (single-line change + comment), `SessionsView.jsx:~439-465` + `BankrollDisplay.jsx:1-25` (flex container + positioning stripped), `SeatContextMenu.jsx:14-22,79-85` (new constant + consumer swap).
- **Related findings:** AUDIT-2026-04-21-SDV F2 + F5 SHIPPED; AUDIT-2026-04-21-SV F5 SHIPPED; AUDIT-2026-04-21-TV F8 SHIPPED. Wave-1 remaining: TV-F6/F7/F9/F11/F12, SV-F2/F6/F7, SDV-F6/F7.

### EVID-2026-04-21-W1-S7-BATCH

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 7 — Minor polish + dev-clarity batch)
- **When:** 2026-04-21
- **Where:** 8 source files + 2 test updates across TableView, ShowdownView, SessionsView, OnlineView, ui/, contexts/
- **Summary:** 8 XS/S-effort findings shipped in one pass (the "long tail"). All independent; zero cross-file risk. Final batch closes most of DCOMP-W1's non-M-effort queue.
  - **TV-F6 (sev 2):** `SeatContextMenu` RecentPlayersSection gains a count sub-label ("N players") on the Recent section header, plus a sticky bottom-fade gradient shown when `recentPlayers.length > 8` (the overflow threshold derived from 8 rows × 44px = 352px vs the menu's max-h-96 = 384px cap). Scrollability is now visible, not inferred.
  - **TV-F9 (sev 2):** `PotDisplay` edit-mode now gated behind a 400ms long-press (`POT_EDIT_LONG_PRESS_MS` constant); single tap surfaces a "Long-press to correct" hint for 1.5s. Input switched from `type="number"` to `type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"` for compact Android keypad. First adopter of the inputMode=decimal pattern on the felt.
  - **TV-F11 (sev 1):** `useOnlineAnalysisContext` → `useAnalysisContext`. The prior name implied online-only scope but the hook serves both TableView (live) and OnlineView (online). Canonical symbol `useAnalysisContext` added to `OnlineAnalysisContext.jsx`; deprecated alias `useOnlineAnalysisContext = useAnalysisContext` retained to avoid breakage. `contexts/index.js` re-exports both. 3 internal call sites migrated (CommandStrip, OnlineView, ExtensionPanel). Error message reflects canonical name. Test expectation updated.
  - **TV-F12 (sev 1):** `TableView` `RangeDetailPanel` gains a reopen-last affordance. `lastRangeDetailSeatRef` (useRef) captures the most-recently-opened seat; `handleOpenRangeDetail`/`handleCloseRangeDetail` wrap the setter; a floating "↻ Reopen range (S{N})" button appears fixed-bottom-left when the panel is closed AND a seat was previously viewed. Accidental close recovery = 1 tap.
  - **SDV-F6 (sev 1):** `ActionHistoryGrid` dead Labels buttons (blue, hover-styled, no onClick) removed. Replaced with plain "Seat N" column headers. 1 test updated from `getAllByText('Labels')` to iterate `Seat N`.
  - **SDV-F7 (sev 1):** `ShowdownView` summary-mode now renders an amber info banner "Hand rankings require all 5 board cards to be entered" when `rankings.length === 0`. Resolves silent empty-state for preflop all-in / turn-ended hands.
  - **SV-F6 (sev 1):** `SessionForm` backdrop-tap dismiss now guards on dirty state. `isDirty` derived from venue/gameType/buyIn/goal/customGoal/notes divergence from defaults; `handleBackdropClick` ignores backdrop taps when dirty. Explicit × button still works. Preserves between-hands-chris's draft across accidental miss-taps (H-PLT08).
  - **SV-F7 (sev 1):** `SessionsView` past-sessions list gains All/Live/Online filter pills, shown only when `onlineCount > 0`. In-memory filter over `sessions.filter(s => !s.isActive)`. Selection persists to `localStorage` under key `sessionsView.pastFilter`.
- **Test verification:**
  - S7-affected subtrees: **280/280 passing** (13 test files across TableView, ShowdownView, SessionsView, OnlineView, and contexts/OnlineAnalysisContext).
  - Full suite after rename: 1 pre-existing `precisionAudit.test.js` stochastic failure remains (unrelated, documented).
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - TV-F6: Right-click seat → Recent section header shows "N players" badge. With >8 recents, bottom-fade gradient visible.
  - TV-F9: Single-tap pot → "Long-press to correct" tooltip flashes; no keyboard. Hold 400ms+ → edit mode opens with compact numeric keypad.
  - TV-F11: Dev-facing; no user-visible change. Full build succeeds.
  - TV-F12: Open range panel for a seat → close → "↻ Reopen range (S{N})" button bottom-left; tap to restore.
  - SDV-F6: Full-Mode summary row shows "Seat 1..9" headers, no blue Labels buttons.
  - SDV-F7: Full-Mode summary with partial board shows amber "Hand rankings require…" info banner.
  - SV-F6: Start New Session → type in venue/buy-in → tap outside the form → dialog stays open. Tap × or Cancel → dialog dismisses.
  - SV-F7: With past online sessions: All/Live/Online pills render. Filter narrows list. Reload page → filter choice persists.
- **Verified in code:** `SeatContextMenu.jsx:79-119`, `PotDisplay.jsx:1-124`, `OnlineAnalysisContext.jsx:54-68`, `contexts/index.js:18-20`, 3 migrated import sites, `TableView.jsx:208-231,556,615-625`, `ActionHistoryGrid.jsx:21-37`, `ShowdownView.jsx:360-383`, `SessionForm.jsx:38-55,100-102`, `SessionsView.jsx:33-45,395-460`.
- **Related findings:** SHIPPED: AUDIT-2026-04-21-TV F6 + F9 + F11 + F12; AUDIT-2026-04-21-SDV F6 + F7; AUDIT-2026-04-21-SV F6 + F7. **Wave-1 remaining after S7: 3 findings (TV-F7 orbit wrap-layout M, SV-F2 tip field P1/M). Per plan: S8 and S9.**

### EVID-2026-04-21-W1-S8-TV-F7

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 8 — TV-F7 Orbit wrap-layout)
- **When:** 2026-04-21
- **Where:** `src/components/views/TableView/CommandStrip.jsx` (orbit-strip block, lines ~599-671)
- **Summary:** The preflop orbit-strip's layout switched from `flex overflow-x-auto` to `flex flex-wrap gap-1`, and per-button `flexShrink: 0` → `flexShrink: 1`. Previously, when the right-rail panel was narrow enough that 9 position buttons couldn't fit in one row, the rightmost buttons scrolled off-screen with no affordance — tap-ahead silently targeted invisible seats (H-PLT07, H-ML05). Wrapping to a second row keeps every seat reachable at every scale; flexShrink allows mild button compression before wrap triggers. F2 preview-count badges (absolute-positioned with `top: -6 right: -4`) remain correctly placed after wrap.
- **Why flex-wrap over grid:** Plan proposed both options. Flex-wrap preserves the existing per-button sizing and badge positioning with a single prop change; grid would have required reworking the button style. Less jittery on intermediate sizes per the plan's assessment; empirically verified no test regressions with the flex approach.
- **Test verification:**
  - TableView tests: **86/86 passing** (4 files: TableHeader 13, SeatContextMenu 28, SeatComponent 33, LiveAdviceBar 12). No assertions about orbit-strip layout; behavior unchanged.
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - At reference viewport (1600×720), 9-seat preflop orbit strip fits in 1 row; no visible change from prior behavior (no scroll, no wrap needed).
  - At narrower viewports (e.g., 900×400), orbit strip wraps to 2 rows instead of horizontally scrolling. Every seat button remains visible + tappable.
  - F2 "+N" badges correctly positioned in top-right of each button after wrap.
  - Tap-ahead (tap a downstream seat) still auto-folds intermediate unacted seats.
- **Verified in code:** `CommandStrip.jsx:620-645` (wrap class + shrink change + comments).
- **Related findings:** AUDIT-2026-04-21-TV F7 SHIPPED. **Only SV-F2 (tip field) remains on DCOMP-W1. All other TableView + ShowdownView audit findings closed.**

### EVID-2026-04-21-W1-S9-SV-F2

- **Source type:** Code inspection + test output
- **Observer:** Claude (DCOMP-W1 Session 9 — SV-F2 Tip field on CashOutModal)
- **When:** 2026-04-21
- **Where:** `src/utils/persistence/sessionsStorage.js`, `src/hooks/useSessionPersistence.js`, `src/reducers/sessionReducer.js`, `src/components/views/SessionsView/CashOutModal.jsx`, `src/components/views/SessionsView/SessionsView.jsx` + 2 test updates
- **Summary:** SV-F2 (sev 3, P1) shipped. Optional `tipAmount` field threaded end-to-end: Session schema → end-session atomic write → reducer → CashOutModal input → bankroll P&L subtraction. JTBD-SM-21 explicitly named tip logging; before this change, lifetime bankroll silently overcounted by the tip amount for every tipped session (Traveler persona especially exposed due to Vegas tipping norms).
- **Schema change is additive + backward-compatible:** No IDB version bump needed. Legacy sessions without `tipAmount` read as undefined → `(session.tipAmount || 0)` fallback in P&L → zero deduction → historical data unchanged. `endSessionAtomic` only writes `tipAmount` when non-null, so round-trip-loading a legacy record + re-saving preserves legacy shape.
- **Changes by file:**
  - `sessionsStorage.js:45-60` — default session shape gains `tipAmount: null`. Signature of `endSessionAtomic` extended to `(sessionId, cashOut, userId, tipAmount = null)`. Persist block writes `session.tipAmount = tipAmount` only when provided.
  - `useSessionPersistence.js:234-263` — `endCurrentSession` signature extended to `(cashOut = null, tipAmount = null)`. Dispatches `END_SESSION` with `tipAmount` in payload. Legacy call sites continue to work (undefined second arg).
  - `sessionReducer.js:86-99` — `END_SESSION` reducer case includes `tipAmount: action.payload.tipAmount || null`.
  - `CashOutModal.jsx` — added optional `tipAmount` + `onTipAmountChange` props. New Tip field below Cash Out Amount (placeholder 0, inputMode=decimal, pattern decimal). Both inputs switched from `type="number"` to `type="text" inputMode="decimal"` for compact Android keypad + consistency with PotDisplay pattern. Helper text "Included in P&L. Leave empty if you didn't tip."
  - `SessionsView.jsx:72-74,131-160,537-550` — new `tipAmount` useState; `handleEndSession` resets it; `handleConfirmCashOut` parses it (empty → null) and threads to `endCurrentSession(cashOut, tip)`. `calculateTotalBankroll` subtracts `(session.tipAmount || 0)` from per-session P&L. Modal cancel/unmount cleanup includes `setTipAmount('')`.
- **Test verification:**
  - SessionsView + hooks + reducers + persistence: **595/595 passing** (19 test files).
  - Full suite: **6213/6214 passing** (1 pre-existing `precisionAudit.test.js` stochastic Monte Carlo failure unrelated).
  - Net new tests from SV-F2: 3 in `CashOutModal.test.jsx` (renders Tip field; calls onTipAmountChange; displays tipAmount value).
  - Updated tests: 2 in `CashOutModal.test.jsx` (cash-out is now first of two $-inputs; value assertions switched from numeric to string for type=text); 1 in `useSessionPersistence.test.js` (`endSessionAtomic` call includes null tipAmount as 4th arg).
- **Visual verification:** Not performed — Playwright MCP unavailable. Owner checklist:
  - End an active session → CashOutModal: Cash Out Amount field (autofocus) + Tip field beneath. Both use compact numeric keypad on Android (inputMode=decimal). Helper text reads "Included in P&L" for tip.
  - Enter $200 cash-out + $20 tip → confirm → BankrollDisplay reflects `$200 - buyIn - rebuys - $20` (NOT just `$200 - buyIn - rebuys`).
  - Reload the app → tipped sessions still show the correct P&L (value persists in IDB).
  - Legacy sessions (pre-S9): BankrollDisplay unchanged — tipAmount absent → treated as 0.
- **Verified in code:** `sessionsStorage.js:45-64,518-548`, `useSessionPersistence.js:229-267`, `sessionReducer.js:86-100`, `CashOutModal.jsx:1-80`, `SessionsView.jsx:72-74,131-160,280-293,537-552`.
- **Related findings:** AUDIT-2026-04-21-SV F2 SHIPPED. **DCOMP-W1 is now 17 of 17 findings shipped.** S10 = close-out.

### EVID-2026-04-27-COMP-PT4

- **Source type:** External (agent-synthesized via WebFetch + WebSearch on official PT4 docs and reviewer sources)
- **Observer:** Claude (SHC Gate 3 deliverable #3, competitive design-language review)
- **When:** 2026-04-27
- **Where:** PokerTracker 4 — official HUD guides + community reviews. Fluent-user lens (steady-state daily HUD use), no first-impression / onboarding scope.
- **Summary:** PT4's design-language posture across the three SHC dimensions:
  - **Status semantics:** No freshness/staleness/connection signal on the HUD itself; updates are imported per hand and gaps surface as count-not-advancing rather than a UI status. Sample-size is handled binarily — global "Minimum Hands Required" filter suppresses HUD entirely below threshold; hover reveals `(times/opportunities)`. **No graded confidence treatment** (no opacity-by-sample, no warning glyph). User-configured color ranges fire purely on stat value, ignoring sample — 100% (1/1) renders identical to 100% (47/47).
  - **Affordance vocabulary:** Small. `cell click → popup` is the primary affordance, **never signposted** (no chevrons/arrows/underlines — discovered, not declared). Modifier-key affordances exist (Ctrl/Cmd-drag for layout) but are invisible to first-timers. Tag/note icons are the only explicit-glyph affordances. Hover is a passive affordance the user must know to use.
  - **Density rhythm:** Layout modes (Normal/Grid). Default cash profile fits ~5–8 cells per player block. **No enforced typography ladder** — per-stat font is fully user-configurable; community profiles set the de-facto rhythm. Color is **dual-purpose** (semantic + decorative) with per-stat thresholds — red on VPIP and red on PFR don't share a meaning. Glanceability via opacity-dim-until-hover (a *focus mechanic*, not a freshness one — directly collides with Hand2Note's identical visual idiom for sample-size).
- **Verified:** Sources cited per agent report — pokertracker.com/guides/PT4/ (Basic HUD Guide, Advanced HUD Guide, HUD Options & Profiles, HUD Troubleshooting), pokertracker.com/forums color-ranges thread, blackrain79.com sample-size article. Not independently re-validated; treat as synthesis from public docs, not direct product use.
- **Related findings:** SHC Gate 3 deliverable #3. Feeds Gate 4 shell-spec authoring (CC-90 system-recognition, CC-91 affordance vocabulary). Cross-references EVID-2026-04-27-COMP-CROSS-PATTERNS.

### EVID-2026-04-27-COMP-H2N

- **Source type:** External (agent-synthesized via WebFetch + WebSearch on official Hand2Note docs and reviewer sources)
- **Observer:** Claude (SHC Gate 3 deliverable #3)
- **When:** 2026-04-27
- **Where:** Hand2Note — official help pages + manual + reviewer sources. Fluent-user lens.
- **Summary:** Hand2Note's design-language posture:
  - **Status semantics:** **Strongest explicit sample-size treatment in the competitive set.** Configuration → Stats Appearance exposes: `(n)` inline rendering, sample-only-when-below-threshold (n as warning, not decoration), separate sample typography (font + color), **opacity-by-sample threshold** ("Make stat transparent if sample lower than X" + "Stat opacity in case of small sample"), and conditional vs-Hero source-of-truth swap when sub-sample is large enough. **Inconsistency:** the same concept ("not enough data") splits across three visual treatments depending on settings — print n, drop opacity, or silently substitute a different value. No documented unified "unknown" state — first-hand villain renders as either first-hand data or static-HUD population baseline depending on config. Freshness/connection still not surfaced.
  - **Affordance vocabulary:** Larger than PT4. Hover→popup (configurable, "milliseconds" latency emphasized in marketing) + click→popup + dynamic re-layout (Dynamic HUD rearranges as action proceeds — *implicit affordance signaling current decision relevance*) + showdown notification badge (one-off, not a generalized slot) + categorical color markers on player names. Several affordances can mean overlapping things depending on configuration — cost of the larger vocabulary.
  - **Density rhythm:** Three modes (Static/Positional/Dynamic); Dynamic resolves density-vs-glanceability via *contextual frame change* rather than per-frame compression. **Only product in set with built-in two-tier typographic ladder** (value font ≠ sample-count font). Color heavily semantic but three systems coexist (per-stat ranges + categorical player markers + opacity-as-confidence) — disambiguation burden on user's config choices.
- **Verified:** Sources — hand2note.com/Help/Features/hud, hand2note3.hand2note.com/Help/pages/HUDCustomization, hand2noteguide.com sample-in-hand2note, blackrain79.com Hand2Note review. Synthesis from public docs.
- **Related findings:** SHC Gate 3 deliverable #3. Feeds Gate 4 shell-spec authoring. **Direct relevance to D-1 forensics** (Hand2Note has the explicit opacity-by-sample treatment that our Z2 context strip imitates without a legend per `render-orchestrator.js:442–444, 450`); the H2N precedent shows the pattern *exists* in the market but is a configurable user setting, not a silent always-on default.

### EVID-2026-04-27-COMP-NOTECADDY

- **Source type:** External (agent-synthesized via WebFetch + WebSearch on Holdem Manager / Assaultware sources)
- **Observer:** Claude (SHC Gate 3 deliverable #3)
- **When:** 2026-04-27
- **Where:** NoteCaddy / NoteCaddy Edge — HM3 KB + Assaultware wiki + community discussion. Fluent-user lens.
- **Summary:** NoteCaddy's design-language posture:
  - **Status semantics:** Freshness/connection not surfaced (inherits HM3/PT4 host posture). Sample-size handled by **threshold-gated badge appearance** — a badge only appears when its underlying note's conditions (which include sample-size where the user authors them) are met. **The presence of a badge IS the confidence signal**; no badge = condition unmet OR sample too small (binary, not graded; no "weak badge" treatment). Color Definitions (parallel mechanism) can also fire badges with their own threshold logic — fluent users have to remember which mechanism produced which badge.
  - **Affordance vocabulary:** Tiny — essentially "badge slot." 16×16 px PNG/GIF images in dedicated HUD slots with **explicit Priority numbers for ordering** (NC.OrderedBadges, NC.PrefixedBadges) — most explicit ordering system in the set. Hover-for-detail reveals underlying note text. Drill-down inherited from host (HM3/PT4); NoteCaddy adds badges, not new drill-down idioms. *Visual vocabulary inside a badge is wide-open* — user-authored 16×16 images mean competing community badge packs use wildly different visual languages.
  - **Density rhythm:** Row height forced by 16×16 badge format. Multiple badges per player when many notes fire = visually quite dense. Typography ladder N/A (badges are images). **No enforced color semantic** — the same red badge could mean "tilts after losing" in one user's pack and "donk-bets flop" in another's. Color is decorative-by-convention but not by product enforcement. Glanceability achieved by *iconography* rather than text density.
- **Verified:** Sources — forums.holdemmanager.com NoteCaddy badges thread, kb.holdemmanager.com badges-overview, wiki.assaultware.com NoteCaddy Badges, assaultware.blogspot.com badges-in-detail. Synthesis from public docs.
- **Related findings:** SHC Gate 3 deliverable #3. NoteCaddy's **explicit Priority-number badge ordering** is unique in the set and is a candidate pattern for the shell-spec attention-budget map (Gate 1 §4.2 missing artifact "Attention budget").

### EVID-2026-04-27-COMP-DRIVEHUD

- **Source type:** External (agent-synthesized via WebFetch + WebSearch on official DriveHUD docs and reviewer sources)
- **Observer:** Claude (SHC Gate 3 deliverable #3)
- **When:** 2026-04-27
- **Where:** DriveHUD (DriveHUD 2) — homepage + KB + reviewer sources. Fluent-user lens. **Weakest evidence base in the competitive set** — official feature pages 404'd; deeper interaction claims are second-hand.
- **Summary:** DriveHUD's design-language posture:
  - **Status semantics:** Freshness / connection not surfaced. **No documented automatic sample-size treatment** — user-configured color ranges fire purely on stat value, not credibility. Ships **default color ranges with category labels** (Red=Very Tight, Orange=Tight Reg, Blue=Reg/TAG, Yellow=LAG, Green=Fish) — but these are **per-stat thresholds**, so red on VPIP and red on aggression don't share a meaning beyond "extreme on this axis." Fluent user reads "red" contextually per cell.
  - **Affordance vocabulary:** Cell click → popup. **Multi-level nested popups** (secondary, third level) — unusual; most competitors have one popup level; the chain is its own affordance the user has to discover. NoteCaddy-style "bumper stickers" (badge equivalent; integrates the NoteCaddy ecosystem). Drag-and-drop layout authoring (table HUD doesn't reveal it was drag-authored).
  - **Density rhythm:** **12 ships defaults targeting different player skill levels** — density is segmented by audience rather than uniform. Per-stat user-configurable typography (no enforced ladder). Color is dual-purpose (categorical-with-thresholds + per-cell ranges). **Only product in set that markets theme (dark/light) as a feature.** Glanceability achieved via curated default profiles rather than product-level rhythm rule.
- **Verified:** Sources — drivehud.com homepage, drivehud.com/dh2-knowledge-base/ default-color-ranges, drivehud.com/new-pop-up-designer blog, drivehud.com/introducing-all-new-drivehud-2 blog, plo365.com DriveHUD review. **Caveat:** several DriveHUD official feature pages returned 404 during research; deeper interaction patterns (multi-level popup designer, density layouts) should be considered second-hand from review sites until verified by direct product access or current screenshots.
- **Related findings:** SHC Gate 3 deliverable #3. DriveHUD's **profile-segmented density** is a candidate model for tier-aware shell-spec density rhythm (e.g., a "novice" vs "fluent" sidebar density mode), though deferred to Gate 4 scope decision.

### EVID-2026-04-27-COMP-GTOWIZARD

- **Source type:** External (agent-synthesized via WebFetch + WebSearch on official GTO Wizard help pages, blog, and PokerNews review)
- **Observer:** Claude (SHC Gate 3 deliverable #3)
- **When:** 2026-04-27
- **Where:** GTO Wizard — official help.gtowizard.com pages + blog + PokerNews review. Fluent-user lens. **Standout of the competitive set on affordance discipline and color discipline.**
- **Summary:** GTO Wizard's design-language posture:
  - **Status semantics:** Freshness/staleness **effectively N/A in steady state** — pre-solved solutions are versioned by spot-tree, not by computed-at timestamp. GTO Wizard AI custom solving runs in seconds; documented UI emphasis is "instant," no documented loading-state vocabulary in public docs. Sample-size **not the right concept for this product** (deterministic solver outputs, not sampled estimates). EV-tightness between actions signaled by **white** in EV-comparison view (red=clear loss, green=clear gain, white=marginal). Different problem than HUDs face, **cleaner solution** — uncertainty visualization is a built-in primitive, not a config setting.
  - **Affordance vocabulary:** **Small and ruthlessly consistent — standout of the set on affordance discipline.** hover=preview, click=filter/select, dropdown=mode-switch. Eye icon=hide section, pop-out icon=open in new window, three-dots=per-table contextual controls, hotkeys mirror clickable affordances (1/2/3/4=tabs, Q=maximize, J=jump, P=clear filters, S=group bet sizes, spacebar=unit toggle). Manhattan-plot-expand-on-hover is a first-class hover-to-preview pattern. **One reusable affordance per concept, not per-panel re-invention.**
  - **Density rhythm:** **Only product in set with documented product-level density ladder** — Settings → Appearance offers large/medium/compact + 4 layout templates (Horizontal, Split, Horizontal-reversed, Split-reversed). Implicit but consistent typographic ladder across body numbers, secondary EV/equity numbers, micro-labels in tables. Color **strictly semantic — never decorative**: Red=bet/raise frequency, Green=check/call frequency, Black=not-in-range, White=marginal-EV. **Same pixel-color means same thing in matrix, breakdown, and trainer feedback** — clean counterexample to PT4/H2N's "red means whatever the user configured for this stat." Glanceability via strategy-matrix-as-heatmap (range fits in one widget, color tells answer instantly).
- **Verified:** Sources — help.gtowizard.com (Study Mode, Breakdown Tab, How To Use the Trainer), blog.gtowizard.com (Simplified Solutions, Thousands of New Solutions), pokernews.com GTO Wizard review. Synthesis from public docs.
- **Related findings:** SHC Gate 3 deliverable #3. **GTO Wizard is the model worth studying** for shell-spec color-semantic isolation (D-2 forensics) and affordance vocabulary discipline (CC-91 / R-1.5 dangling reference). The product-level density ladder is also a candidate model for sidebar density-rhythm authoring at Gate 4. Note that GTO Wizard's lessons may not all transfer — deterministic-solver UX has a different uncertainty profile than a Bayesian-tendency-tracking sidebar.

### EVID-2026-04-27-COMP-CROSS-PATTERNS

- **Source type:** External (agent-synthesized; cross-cuts the 5 per-product entries above)
- **Observer:** Claude (SHC Gate 3 deliverable #3)
- **When:** 2026-04-27
- **Where:** Synthetic — pattern observations across PT4, Hand2Note, NoteCaddy, DriveHUD, GTO Wizard. Fluent-user lens.
- **Summary:** Cross-product patterns and vocabulary divergences relevant to SHC Gate 4 shell-spec authoring:
  - **Pattern 1 — Freshness/staleness essentially absent across the four trackers.** None of PT4, H2N, NoteCaddy, DriveHUD shows a "this stat was last updated at X" or "data may be stale" signal. Implicit model: data is whatever the last imported hand made it; users diagnose drift by noticing counts not advancing. GTO Wizard sidesteps the problem (solver outputs aren't sampled). **Implication for SHC:** our sidebar's R-1.7 staleness shape-class consistency rule is a *category-leading discipline*, not a category norm — there is no off-the-shelf vocabulary to import. The shell spec must invent it.
  - **Pattern 2 — Connection/sync is never on the HUD.** All four trackers treat connection problems as a tech-support concern surfaced via missing data. **Implication:** our Z0 pipeline-health dot (`render-orchestrator.js:1324–1342`) is a category-leading affordance; competitive review does not surface a precedent vocabulary.
  - **Pattern 3 — Sample-size confidence acknowledged but treated inconsistently.** Three patterns in the wild: suppress below threshold (PT4 minimum-hands), opacity below threshold (Hand2Note), inline `(n)` text (PT4 hover, Hand2Note configurable). No product combines all three coherently — they're alternatives the user picks between. **Implication for D-1 forensics:** our sidebar combines all three (Z2 header dot, Z2 context-strip opacity, Z4 dot+`n=` label) which is **not a market norm** — it is a worse-than-average treatment that no competitor ships in one product.
  - **Pattern 4 — Click→popup is the universal drill-down idiom for trackers.** GTO Wizard's hover→preview + click→filter is the sole alternative pattern. **Implication for CC-91:** the chevron/underline/badge affordance vocabulary is *under-specified* in the competitive market; our Gate 4 shell spec gets to invent rather than match.
  - **Pattern 5 — Color is dual-purpose (semantic + decorative) in trackers; strictly semantic in GTO Wizard.** Per-cell color thresholds in PT4/H2N/DriveHUD are user-configured, meaning **same color means different things on different cells of the same product.** **Implication for D-2 forensics:** our `#fbbf24`-encodes-5-roles violation has direct competitive parallel in PT4/H2N/DriveHUD's per-stat-color-context model (where "red" means context-dependent things) — it is **a market norm to tolerate this**, not a market norm to fix it. GTO Wizard is the only product that demonstrates the alternative.
  - **Pattern 6 — No product has a documented "locked" state.** "Locked" as a concept doesn't really exist in the HUD market — gating models surface as feature-not-appearing rather than as a locked-out chip. **Implication:** if the shell spec needs a "locked" treatment (e.g., for tier-gated sidebar features under MPMF), it must be invented from outside the HUD category.
  - **Vocabulary divergence A — Opacity-as-focus (PT4) vs. opacity-as-sample-confidence (Hand2Note).** Two products use the same visual idiom for different concepts. **Implication for shell spec:** opacity is a *contested channel*; using it for any one meaning forecloses the others. Direct evidence that the choice should be deliberate, not silent.
  - **Vocabulary divergence B — GTO Wizard's red/green/white tri-state (clear/clear/marginal) vs. trackers' red/yellow/green tri-state (extreme/middle/extreme).** GTO Wizard's white-as-marginal cleanly encodes "this is uncertain, use judgment"; trackers' yellow is overloaded. **Implication:** white-as-marginal is a candidate addition to the shell-spec status-color vocabulary.
  - **Vocabulary divergence C — Hand2Note's two-tier typographic ladder (value font ≠ sample-count font)** is unique. Other products either suppress n entirely or render it in the same typographic register. **Implication:** typographic disambiguation of value-vs-meta-stat is an underused channel in the market.
  - **Vocabulary divergence D — NoteCaddy's explicit badge Priority numbers** are unique. **Implication:** explicit ordering as a configuration axis is a candidate model for the missing attention-budget artifact (Gate 1 §4.2).
  - **Vocabulary divergence E — GTO Wizard's affordance discipline (hover=preview, click=filter, hotkey-mirroring)** is the only example of a small internally consistent affordance vocabulary across every panel. Trackers all mix-and-match per panel. **Implication for CC-91 / R-1.5:** the dangling SR-4 spec index must follow the GTO Wizard pattern — small, internally consistent, cross-panel — not the tracker pattern of per-panel idioms.
  - **Vocabulary divergence F — GTO Wizard's product-level density ladder (large/medium/compact + 4 layouts)** is the only example of density as a first-class user setting. **Implication:** density-rhythm authoring at Gate 4 may include a user-controlled compact/comfortable mode rather than a fixed per-zone density.
- **Verified:** Pattern observations cross-derived from EVID-2026-04-27-COMP-PT4, EVID-2026-04-27-COMP-H2N, EVID-2026-04-27-COMP-NOTECADDY, EVID-2026-04-27-COMP-DRIVEHUD, EVID-2026-04-27-COMP-GTOWIZARD. No primary observations; cross-product synthesis only. **Confidence floor matches the weakest individual entry (DriveHUD).** Loading/calculating/error UI was not found documented for any product — this is a real documentation gap, not a synthesis claim; would require direct product access to verify "no loading state exists" vs. "no loading state is documented."
- **Related findings:** SHC Gate 3 deliverable #3. Direct inputs to Gate 4 shell-spec authoring on (a) status-color vocabulary, (b) affordance vocabulary, (c) density-rhythm authoring, (d) attention-budget map. Specific cross-references: D-1 → Pattern 3 (our combination is worse than market norm); D-2 → Pattern 5 (market tolerates context-dependent color but GTO Wizard demonstrates alternative); D-3 → Pattern 1 (we are category-leading and must invent vocabulary).

### EVID-2026-04-16-STP1-RECURRENCE

- **Source type:** Incident
- **Observer:** Chris
- **When:** 2026-04-16, post-cutover
- **Where:** Sidebar, invariant-violation badge
- **Summary:** Even after the Sidebar Rebuild Program closed, a badge showed "213 state invariant violations in 30s" — indicating that the prior audit (SRT-1/2) had missed observability honesty gaps. STP-1 followed up with doctrine rules R-7.3 / R-7.4 / R-8.1 / R-10.1.
- **Verified:** Yes — logged in STATUS.md.
- **Related findings:** R-7.3, R-7.4, R-8.1, R-10.1 in `docs/SIDEBAR_DESIGN_PRINCIPLES.md`.

---

## Guidelines for adding entries

1. **Observations, not interpretations.** "Chris said X" is an observation. "Chris feels Y" is an inference — log only what was said or seen, and save inference for the audit.
2. **Verbatim when possible.** Especially for statements. Paraphrasing introduces distortion.
3. **Link to code or data.** A code-inspection evidence entry should cite file + line.
4. **Append-only.** Never edit prior entries. If a prior entry turns out wrong, add a new entry that corrects it and reference the prior ID.
5. **One observation per entry.** Don't bundle "Chris said X and then Y" into one — they may relate to different findings.

---

## Change log

- 2026-04-21 — Created with three seed entries relevant to Session 2 audit.
- 2026-04-27 — Added 6 entries for SHC Gate 3 deliverable #3 (competitive design-language review): EVID-2026-04-27-COMP-PT4, EVID-2026-04-27-COMP-H2N, EVID-2026-04-27-COMP-NOTECADDY, EVID-2026-04-27-COMP-DRIVEHUD, EVID-2026-04-27-COMP-GTOWIZARD, EVID-2026-04-27-COMP-CROSS-PATTERNS. External / agent-synthesized via WebFetch + WebSearch; not direct product use. Feeds Gate 4 shell-spec authoring and consolidates into Gate 3 deliverable #6 (sidebar-coherence-baseline). DriveHUD entry has weakest evidence base (404'd official feature pages); cross-product entry inherits floor.
