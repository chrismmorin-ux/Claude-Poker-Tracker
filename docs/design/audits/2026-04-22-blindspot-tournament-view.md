# Blind-Spot Roundtable + Audit — 2026-04-22 — TournamentView

**Type:** Combined Gate-2 pre-audit blind-spot check + Gate-4 heuristic audit (DCOMP-W4-A2)
**Trigger:** Roadmap-mandated Gate 2 for tournament-view before audit (ICM / bounty / satellite distinct discovery clusters per surface artifact).
**Participants:** Claude synthesis across product-ux + systems-architect perspectives, grounded in the existing persona + JTBD library.
**Artifacts read:** `surfaces/tournament-view.md`, `TournamentView.jsx` + `BlindTimerBar.jsx` + `ChipStackPanel.jsx` + `PredictionsPanel.jsx`, `TournamentContext.jsx`, core personas (circuit-grinder, online-mtt-shark, hybrid-semi-pro, chris, ringmaster), situational personas (push-fold-short-stack, bubble-decision, final-table-play), `jtbd/domains/` (TS, MH, SM, SR).
**Method:** Code inspection + persona/JTBD cross-reference + destructive-action + touch-target lens (Playwright live-walk skipped — requires active tournament session, not seeded in dev data; high-confidence findings from code suffice).
**Status:** Draft.

---

## Executive summary

**Verdict: RED.** Five P0 destructive-action anti-patterns — every mutating interaction on TournamentView lacks undo. `End Tournament` is explicitly documented as "irreversible without undo" in the surface artifact; `recordElimination`, `advanceLevel`, `updateStack`, and `setPlayersRemaining` are all silent commits. This is the same class that Wave 1 eliminated on TV/SDV/SV and Wave 4-A1 flagged on PlayersView. Plus two Gate-2 scope blind spots the heuristic audit would likely miss: (a) the tournament-context-feeds-TableView coupling creates implicit cross-surface invariants that no contract document names, and (b) the three deferred feature clusters (bounty, satellite, multi-day) aren't just "not served" — they're being served *wrong* today because TableView's advice doesn't know they exist. 5 P0, 5 P1, 4 P2, 3 P3/deferred. Unblocks DCOMP-W5 only after core P0s ship.

---

## Gate 2 — Blind-spot roundtable

### Stage A — Persona sufficiency

**Output: ⚠️ EXPANSION NEEDED + 1 framework patch**

#### A1 — Circuit Grinder sub-persona for "between hands, tournament in progress" missing
Core `circuit-grinder.md` covers goals; no situational persona exists for the Circuit Grinder who is (a) sitting at a live tournament table, (b) the hand is folded-to-hero preflop, (c) they have ~20 seconds to scan the blind timer, eyeball opponent stacks, check the rail for eliminations, and decide. This is a distinct cognitive load profile from `between-hands-chris` (cash-game surface assumptions). Gap: **new situational persona** `circuit-grinder-between-hands.md` OR expand `between-hands-chris.md` with a tournament-branch note.

#### A2 — Online MTT Shark's relationship to this view is ambiguous
`online-mtt-shark.md` is listed as "primary for online MTT (usually via the sidebar; this view is post-session context)." But there's no documented contract for what "post-session context" means on TournamentView. If an online shark uses the sidebar for live play, do they even *open* TournamentView? If yes, when? If no, why is it listed as a served persona? The surface artifact hand-waves this. Gap: **clarify the Online MTT Shark use-case on TournamentView**, or drop the persona from the served-list.

#### A3 — Ringmaster home-tournament workflow under-specified
`ringmaster-home-host.md` with tournament-in-progress is currently a "limited breadth today" parenthetical in the surface artifact. Live home tournaments (10 friends, $20 buy-in) have specific structural demands: cash payouts (no integer split), on-the-fly restructure mid-event ("let's make it freezeout after level 5"), dealer button that rotates with a physical button not the seat grid. Gap: **Ringmaster-in-tournament situational persona deserves a dedicated artifact** if home tournaments are a Free-tier goal; otherwise close the scope by declaring home tournaments out-of-scope.

#### A4 — `bubble-decision.md` references phantom JTBD IDs (TS-01, TS-03 — already flagged)
Already flagged in the 2026-04-21 TableView roundtable's Stage B (`B4 — Phantom JTBD IDs`). As of 2026-04-22, this defect **has not been resolved in a Stream F batch** (checked by grep). Re-raising here because TournamentView is the surface where that persona most directly operates. Fix should land in Stream F or as a DCOMP-H1 entry.

---

### Stage B — JTBD coverage

**Output: ⚠️ 3 CLUSTER GAPS + 1 phantom-served**

#### B1 — "Am I committed to playing out this level?" JTBD is absent
A real Circuit Grinder or Hybrid Semi-Pro at 3bb with 8 minutes left in the level asks: "If I fold every hand this level, do I blind out before the break?" TournamentView has `blindOutInfo` in context — the *data* exists — but no JTBD names this outcome. The surface renders a number; the user's actual question is a decision. Gap: **new JTBD** in TS domain, working name TS-43 ("blind-out risk threshold reached").

#### B2 — "Should I rebuy?" JTBD is absent at the decision boundary
Rebuy tournaments have a specific cognitive moment: late rebuy period, hero at ~8bb, rebuy closes in 6 minutes. The user question: "Is the ROI on a rebuy positive given my stack, the field's typical rebuy rate, and the prize structure?" TS-39 tracks rebuy *cost* for ROI post-hoc; no JTBD covers the *in-session* rebuy decision. Gap: **new JTBD** TS-44 ("rebuy decision at late-reg boundary").

#### B3 — Satellite-mode goal shift is a different game, not a setting
The surface artifact flags TS-41 ("satellite / seat-bubble strategy switch") as deferred/not-served. But this isn't "a setting" — it's a *different decision calculus*: at the satellite bubble, any chip above the seat threshold is worth $0, so the optimal play is radically tighter than ICM play in a normal MTT. A user who opens TournamentView during a satellite today gets advice calibrated for a non-satellite tournament. This is **actively misleading**, not "just missing." Gap: **satellite is a P2-minimum finding**, not a deferred feature. At minimum: banner "Satellite mode not detected — advice may be incorrect" when `tournamentFormat === 'satellite'`.

#### B4 — `JTBD-MH-07` listed "not served here directly; consumed by table-view advice via context" — but is it?
The surface artifact says MH-07 (short-stack push/fold with ICM) is served via the TableView advice-bar consuming `icmPressure`. **Verify** in TableView code: does LiveAdviceBar read `icmPressure` and modify its threshold? If yes, document explicitly. If no, this is the **same defect the prior TableView audit surfaced as C3** (equity-derived LiveAdviceBar mismatches push/fold persona need). Gap: **verify + document or escalate**.

---

### Stage C — Situational stress test

**Output: ❌ 5 P0 destructive-action anti-patterns**

#### C1 — `End Tournament` is irreversible — explicitly documented, not fixed
`TournamentView.jsx:49-61` `handleConfirmEnd`: writes finish/payout/entrants/format to session, calls `resetTournament()`, navigates to SESSIONS. **No undo path.** The surface artifact's Known-behavior-notes line 108 literally reads: *"End Tournament is irreversible without undo — session record is written on confirm."* The form does require confirmation (modal with Cancel/Confirm) but that's the same anti-pattern SV-F1 replaced in Wave 1. The finish-position + payout are entered once; a typo permanently corrupts the session record's tournament summary with no recovery. **P0 finding.** Fix: toast+undo with deferred reset (reuse SV-F1 deferred-delete pattern).

#### C2 — `recordElimination` commits silently
`ChipStackPanel.jsx` (`onEliminate={handleEliminate}` → `recordElimination(seat)`). No confirmation, no toast, no undo. The surface artifact anatomy line 70 shows `[Eliminate a seat]  [Undo elimination]` — but code grep shows no `Undo` string in `ChipStackPanel.jsx` or `TournamentContext.jsx`. **The artifact describes an undo that doesn't exist in code.** Candidate interpretation: the artifact was authored speculatively. P0 finding either way — eliminate-a-player is high-consequence in a live tournament (ICM projections flip; stack counts shift; players-remaining decrements). Fix: reuse the TV-F1 toast+undo pattern with optimistic-then-revert semantics matching SV-F4 rebuy.

#### C3 — `advanceLevel` commits silently — misclick = lost level
`BlindTimerBar.jsx` `onSkipLevel={advanceLevel}`. One tap skips the current level, jumps blinds up, potentially triggers a "level locked" calculation. No confirmation. A misclick late at night on a live tournament has no recovery path. P0 finding. Fix: toast+undo.

#### C4 — `updateStack` direct commit on numeric input blur
`ChipStackPanel.jsx` `onUpdateStack={updateStack}`. Every edit commits to context immediately. A Circuit Grinder updating seat 4 from 15000 to 16500 but accidentally typing 165000 (extra zero) silently writes the corruption. ICM projections recompute on it. Fix: either (a) require an explicit "Save" per stack edit, or (b) toast+undo. Recommend (b) for consistency with the surface's other destructive actions. P1 finding (lower than C1–C3 because it's edit-mode not one-tap destructive).

#### C5 — `setPlayersRemaining` no guard, no validation
External field-count update also commits silently. Entering 0 or a negative is not guarded. Worse: if the user hears "we're down to 47" and types 47, but they miscount and actually it's 45, the ICM pressure recomputation is now off by two seats at the bubble. Fix: tap-then-confirm with computed-delta display (e.g., "Set players-remaining 47 → 45? Change: −2"). P1 finding.

---

### Stage D — Cross-product / cross-surface

**Output: ⚠️ 2 CONTRACT GAPS**

#### D1 — TournamentContext → TableView coupling is implicit
Per the surface artifact: "TableView reads `isTournament`, `currentBlinds`, `icmPressure`, `mRatioGuidance` directly from TournamentContext." That's a **contract** — TableView's rendering decisions (which advice to show, which threshold to use) depend on these fields being current and correct. If `icmPressure` is stale because a timer paused and the pause didn't propagate, TableView shows wrong advice. No contract document names which fields must be fresh, when they're allowed to be stale, or what the fallback is.

Recommend: **add a contract doc** `contracts/tournament-to-table.md` naming the four fields, their freshness requirements, and TableView's fallback on missing/stale data. Promote to a Wave-5 cross-surface invariant.

#### D2 — Online product line spans the extension + main-app; tournament sidebar gap persists
Already identified in 2026-04-21 TableView roundtable Stage D (`D4 — Hybrid Semi-Pro persona spans both product lines but tournament overlay is main-app-only`). Promoted then to "likely expands Wave 5 scope." Re-raising because TournamentView is the surface most directly affected — the online MTT shark using the sidebar has no ICM/M-ratio context, and no link from the sidebar back to TournamentView. Gap: **cross-product tournament overlay** remains a Wave-5 / discovery entry. Already logged as `2026-04-21-sidebar-tournament-parity` discovery; not duplicating.

---

### Stage E — What the Gate-4 audit might miss

**Output: 3 items to watch for**

#### E1 — The "active tournament" assumption
The heuristic audit visits the surface *when a tournament is active*. An audit-setup oversight: the surface also renders an empty state (`No active tournament` + back button). Nobody audits the empty state. Check: is the empty state's back-button touch target ≥44px? Is "No active tournament" scan-able (fast recognition) or does it read as an error state? **Audit-watch item.**

#### E2 — The `<input type="number">` spinner-UI coupling to Android keypad
End-tournament form uses `<input type="number">` for Finish Position + Payout. Heuristic H-ML08 (Android compact keypad via `inputMode="decimal"`) was shipped on TableView-F9 and SV-F2 in Wave 1. TournamentView doesn't use the pattern. **Audit-watch item.**

#### E3 — `heroStack` fallback `Object.values(chipStacks)[0] || 0` is non-deterministic
If `mySeat` is null, the fallback returns the first value in an object. Object key order for non-integer keys in JavaScript is insertion order, but for integer-looking keys (seat numbers) it's ascending. So this would usually return seat 1's stack — but the prompt says "hero stack" in the PredictionsPanel. If seat 1 isn't hero, the ICM projection for the hero is wrong and silently rendered. **Candidate audit finding (correctness, not heuristic).**

---

## Gate 4 — Heuristic audit findings

Each finding anchored to the Gate-2 output where applicable. All P0/P1 findings are carry-forward from Gate-2 Stage C.

### F1 — End Tournament irreversible → toast+undo with deferred write

- **Severity:** 4 (P0)
- **Heuristics violated:** H-N3 user control + freedom, H-N5 error prevention, H-PLT-04 destructive-action guard
- **JTBD impact:** TS-39 rebuy cost for ROI — garbage-in-garbage-out if finish position + payout are typo'd
- **Evidence:** `TournamentView.jsx:49-61`; Known-behavior-notes line 108.
- **Recommended fix:** Optimistic write to local state + 12s toast + Undo button. On undo, restore `tournamentState` (don't re-init — just don't call `resetTournament()` + revert session field writes). On toast expiry, call `resetTournament()` and navigate. Matches SV-F1 deferred-delete pattern.
- **Effort:** M — requires deferring the `resetTournament()` + session field writes; undo flow must restore pre-end state.
- **Proposed backlog item:** `DCOMP-W4-A2-F1 — TournamentView End Tournament → deferred-reset toast+undo` (P0)

### F2 — recordElimination silent → toast+undo

- **Severity:** 4 (P0)
- **Heuristics violated:** H-N5, H-PLT-04
- **Evidence:** `ChipStackPanel.jsx` + `TournamentContext` reducer — no undo path. Surface artifact describes an Undo button that **does not exist in code**.
- **Recommended fix:** Add an `ELIMINATION_UNDO_TOKEN` to reducer state; `recordElimination` emits a token that captures `chipStacks[seat]`, `playersRemaining` before decrement, and any ICM recomputation snapshot. Undo restores all three. 12s toast.
- **Effort:** M — reducer + token lifecycle.
- **Proposed backlog item:** `DCOMP-W4-A2-F2 — ChipStackPanel eliminate → toast+undo` (P0)

### F3 — advanceLevel silent → confirm-before + toast+undo

- **Severity:** 4 (P0)
- **Heuristics violated:** H-N5
- **Evidence:** `BlindTimerBar.jsx` `onSkipLevel={advanceLevel}`.
- **Recommended fix:** Two-phase — tap shows a preview toast ("Skip to level N+1? Blinds: X/Y") with Confirm (10s countdown) or Cancel; confirm executes + shows undo toast for 12s.
- **Effort:** S — reducer already has `advanceLevel`; UI shell needed.
- **Proposed backlog item:** `DCOMP-W4-A2-F3 — BlindTimerBar advanceLevel → two-phase guard` (P0)

### F4 — updateStack typo guard

- **Severity:** 3 (P1)
- **Heuristics violated:** H-N5, H-ML08 (inputMode)
- **Evidence:** `ChipStackPanel.jsx` numeric inputs commit on blur, no sanity threshold (e.g., "new value is 10× previous — are you sure?").
- **Recommended fix:** Sanity threshold (prompt on order-of-magnitude change) + toast+undo on commit. Add `inputMode="decimal"` while touching the inputs.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A2-F4 — updateStack typo guard + inputMode` (P1)

### F5 — setPlayersRemaining guard

- **Severity:** 3 (P1)
- **Heuristics violated:** H-N5
- **Recommended fix:** Confirm-before with delta display. Reject negative / zero.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A2-F5 — setPlayersRemaining confirm-before` (P1)

### F6 — Empty-state back button touch target

- **Severity:** 2 (P2, Gate-2 E1)
- **Evidence:** `TournamentView.jsx:73-77` empty-state back button — `px-4 py-2` Tailwind = ~40×~36. Under 44×44.
- **Fix:** ≥44×44 padding.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A2-F6 — Empty-state back button ≥44×44` (P2)

### F7 — End-tournament form inputs lack inputMode=decimal

- **Severity:** 2 (P2, Gate-2 E2)
- **Evidence:** Finish Position + Payout `<input type="number">` without `inputMode`. H-ML08 established in Wave-1.
- **Fix:** Add `inputMode="decimal"` (payout) and `inputMode="numeric"` (finish position, integer).
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A2-F7 — End form inputs inputMode` (P2)

### F8 — `heroStack` fallback non-deterministic

- **Severity:** 3 (P1, Gate-2 E3, correctness-not-heuristic)
- **Evidence:** `TournamentView.jsx:88` — `const heroStack = chipStacks[mySeat] || Object.values(chipStacks)[0] || 0;`
- **Risk:** When `mySeat` is null and seat 1 isn't hero, PredictionsPanel renders the wrong player's ICM projection as hero's.
- **Recommended fix:** When `mySeat` is null, either (a) render the whole PredictionsPanel with "No hero seat selected — set your seat via TableView" (graceful), or (b) gray out the hero-specific projections. Don't pick an arbitrary seat.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A2-F8 — heroStack fallback handled explicitly` (P1)

### F9 — TS-38/40/41/42 not served + satellite is actively misleading

- **Severity:** 2 (P2, Gate-2 B3)
- **Evidence:** Surface artifact "Potentially missing" section lines 117–122. Satellite is called out as the most dangerous because the advice doesn't know the game mode.
- **Recommended fix:** Minimum-viable satellite flag: when `tournamentFormat === 'satellite'`, render an amber banner: "Satellite detected — ICM pressure shown for standard MTT structure. Satellite play deviates: chips above seat threshold are worth $0." Does not need to implement the correct math; just honesty-labels the limitation.
- **Effort:** S for banner; L for correct satellite math (deferred).
- **Proposed backlog item:** `DCOMP-W4-A2-F9 — Satellite-mode honesty banner` (P2)

### F10 — Cross-surface coupling contract missing

- **Severity:** 2 (P2, Gate-2 D1)
- **Recommended fix:** `contracts/tournament-to-table.md` documenting the 4 fields, freshness expectations, TableView fallback behavior.
- **Effort:** S (documentation).
- **Proposed backlog item:** `DCOMP-W4-A2-F10 — tournament-to-table contract doc` (P2)

### F11 — MH-07 served-by-context claim verification

- **Severity:** 1 (P3, Gate-2 B4)
- **Recommended fix:** Verify TableView's LiveAdviceBar reads `icmPressure` and adjusts threshold; document explicitly. If it doesn't, escalate to an MH-07 defect (likely ties back to the 2026-04-21 TableView C3 finding about push/fold verdict).
- **Effort:** S verify-and-document.
- **Proposed backlog item:** `DCOMP-W4-A2-F11 — MH-07 coupling verify` (P3)

### F12 — Persona sufficiency patches

- **Severity:** 1 (P3, Gate-2 A1/A2/A3)
- **Recommended fix:** Resolve per Stage A — author `circuit-grinder-between-hands.md`, clarify Online MTT Shark scope, decide home-tournament scope or drop.
- **Effort:** M (three artifacts).
- **Proposed backlog item:** `DCOMP-W4-A2-F12 — Tournament persona patches` (P3)

### F13 — JTBD coverage patches

- **Severity:** 1 (P3, Gate-2 B1/B2)
- **Recommended fix:** Author TS-43 (blind-out threshold) + TS-44 (rebuy decision at late-reg boundary).
- **Effort:** S (atlas + domain file updates).
- **Proposed backlog item:** `DCOMP-W4-A2-F13 — Tournament JTBD atlas patches` (P3)

---

## Observations without fixes

- **Timer canonical in TournamentContext** is a correct post-Sidebar-Rebuild pattern — don't regress.
- **Pause/Resume** is fully reversible and safe — good reference for what destructive-safe looks like on this surface.
- **`Advance Level` also rotates button / recomputes blinds** — the reducer is doing the right thing; the UI is just missing a guard.

## Open questions for the owner

- Is home-tournament a Free-tier goal? (Ringmaster scope decision, affects A3.)
- Is satellite mode worth a dedicated math pass, or does the honesty-banner (F9) close the gap for now?
- Should TournamentView empty-state be reachable at all outside of a specific debug path? (If no, F6 is moot.)

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — End Tournament deferred-reset toast+undo | 4 | M | P0 |
| 2 | F2 — Eliminate-a-seat toast+undo | 4 | M | P0 |
| 3 | F3 — Advance Level two-phase guard | 4 | S | P0 |
| 4 | F4 — updateStack typo guard + inputMode | 3 | S | P1 |
| 5 | F5 — setPlayersRemaining confirm-before | 3 | S | P1 |
| 6 | F8 — heroStack fallback explicit | 3 | S | P1 |
| 7 | F6 — Empty-state back button ≥44×44 | 2 | S | P2 |
| 8 | F7 — End-form inputMode | 2 | S | P2 |
| 9 | F9 — Satellite-mode honesty banner | 2 | S | P2 |
| 10 | F10 — tournament-to-table contract doc | 2 | S | P2 |
| 11 | F11 — MH-07 coupling verify | 1 | S | P3 |
| 12 | F12 — Tournament persona patches | 1 | M | P3 |
| 13 | F13 — Tournament JTBD atlas patches | 1 | S | P3 |

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [P0] [DCOMP-W4-A2 F1] TournamentView End Tournament → deferred-reset toast+undo (SV-F1 pattern)
- [P0] [DCOMP-W4-A2 F2] ChipStackPanel eliminate → toast+undo
- [P0] [DCOMP-W4-A2 F3] BlindTimerBar Advance Level → two-phase guard
- [P1] [DCOMP-W4-A2 F4] updateStack typo guard + inputMode=decimal
- [P1] [DCOMP-W4-A2 F5] setPlayersRemaining confirm-before with delta
- [P1] [DCOMP-W4-A2 F8] heroStack fallback → explicit no-hero-seat state
- [P2] [DCOMP-W4-A2 F6] Empty-state back button ≥44×44
- [P2] [DCOMP-W4-A2 F7] End-form inputMode=decimal + inputMode=numeric
- [P2] [DCOMP-W4-A2 F9] Satellite-mode honesty banner
- [P2] [DCOMP-W4-A2 F10] contracts/tournament-to-table.md
- [P3] [DCOMP-W4-A2 F11] Verify + document MH-07 context-coupling claim
- [P3] [DCOMP-W4-A2 F12] Tournament persona patches (3 artifacts)
- [P3] [DCOMP-W4-A2 F13] Tournament JTBD atlas patches (TS-43, TS-44)
```

---

## Severity rubric

Standard template rubric — see `docs/design/audits/_template.md`.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

## Change log

- 2026-04-22 — Draft. Combined Gate-2 roundtable + Gate-4 audit in one artifact because all Stage-C findings mapped 1:1 to Gate-4 heuristic violations; separating would duplicate the evidence block.
