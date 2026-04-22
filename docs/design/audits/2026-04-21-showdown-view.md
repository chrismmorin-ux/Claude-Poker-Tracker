# Audit -- 2026-04-21 -- ShowdownView (Heuristic)

**Scope:** Surface (`showdown-view`) + sub-components
**Auditor:** Claude (product-ux-thinker agent) -- DCOMP-W1
**Method:** Gate-4 heuristic walkthrough (Nielsen 10 + Poker-Live-Table + Mobile-Landscape) x primary situational personas; code-level evidence for every finding.
**Status:** Draft; owner-approved per continue-directive 2026-04-21. P0 (F1) shipped same-session. See §"Gate 5 resolution" below.

---

## Executive summary

Audited ShowdownView and its 4 sub-components (350 + ~450 LOC) against the framework three heuristic sets, through the eyes of between-hands-chris (primary -- ShowdownView IS the between-hands surface for every live hand), plus mid-hand-chris, ringmaster-in-hand, and newcomer-first-hand. **Seven findings: one at severity 4, one at severity 3, three at severity 2, two at severity 1.** The severity-4 finding is Next Hand in ShowdownHeader: a single tap commits the hand, advances the game clock, and closes the surface with no undo, no toast, no snapshot -- while an identical pattern in CommandStrip.jsx already ships the correct toast+undo remedy. The dominant theme is **destructive-action density and irreversibility under between-hands time pressure**: four of the seven findings involve actions that silently commit or destroy state without an undo path. The surface earns its own audit because between-hands-chris passes through it after every live hand -- it is not optional, rare, or secondary.

---

## Scope details

- **Surfaces audited:** `showdown-view` (primary). Sub-components: `ShowdownView.jsx`, `ShowdownHeader.jsx`, `ShowdownSeatRow.jsx`, `CardGrid.jsx`, `ActionHistoryGrid.jsx`.
- **Hooks walked:** `useShowdownHandlers.js`, `useShowdownCardSelection.js`, `useShowdownEquity.js`.
- **Journeys considered:** Quick-mode winner tap (primary live path); Full-mode card assignment + summary (post-hand analysis path).
- **Personas walked:** [between-hands-chris](../personas/situational/between-hands-chris.md) (primary -- every hand), [mid-hand-chris](../personas/situational/mid-hand-chris.md), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md), [post-session-chris](../personas/situational/post-session-chris.md) (summary-mode pass).
- **Heuristic sets applied:** Nielsen 10 (H-N01..10), Poker-Live-Table (H-PLT01..08), Mobile-Landscape (H-ML01..07).
- **Out of scope:** Visual verification at 1600x720 or smaller viewports (Playwright MCP unavailable). TournamentView integration. Sidebar parity. Hand persistence IDB write path (assumed correct by prior SessionsView audit).

## Artifacts referenced

- `docs/design/surfaces/showdown-view.md` -- canonical surface artifact
- `docs/design/personas/situational/between-hands-chris.md`
- `docs/design/personas/situational/mid-hand-chris.md`
- `docs/design/personas/situational/ringmaster-in-hand.md`
- `docs/design/personas/situational/newcomer-first-hand.md`
- `docs/design/personas/situational/post-session-chris.md`
- `docs/design/audits/2026-04-21-table-view.md` -- reference quality bar (toast+undo pattern)
- `src/components/views/TableView/CommandStrip.jsx:205-253` -- existing Next Hand undo reference impl

---

## Findings

Ordered by severity descending, then by effort ascending.

---

### F1 -- Next Hand in ShowdownHeader commits silently with no undo

- **Severity:** 4 (blocks JTBD-HE-12 in the primary situation; irrecoverable destructive action on a surface every persona passes through after every hand)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (primary), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md) (primary), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md) (exploratory tapper)
- **JTBD impact:** `JTBD-HE-12` (undo / repair a miskey before committing the hand) -- a tap on Next Hand calls `nextHand()` + `closeShowdownView()` with no snapshot, no toast, no undo. The action sequence, street state, and card assignments from the completed hand are irrecoverably reset. `JTBD-HE-11` (finish hand record) -- if the user taps Next Hand before correctly marking the winner in Full Mode, the hand is closed incomplete.
- **Heuristics violated:** H-N03 (no emergency exit for a destructive action), H-N05 (destructive action adjacent to other buttons with no guard), H-PLT06 (zero-cost misclick absorption: no undo), H-PLT08 (hand state not preserved across an accidental tap)
- **Evidence:**
  - `src/hooks/useShowdownHandlers.js:84-87` -- `handleNextHandFromShowdown` calls `nextHand()` then `closeShowdownView()` with no snapshot, no toast, no undo.
  - `src/components/views/ShowdownView/ShowdownHeader.jsx:37-43` -- Next Hand button always enabled, always visible, no disabled state, no guard condition.
  - The correct pattern is already implemented: `src/components/views/TableView/CommandStrip.jsx:205-253` -- `handleNextHand` snapshots `actionSequence`, `dealerButtonSeat`, `communityCards`, `holeCards`, `currentStreet`, `absentSeats`; calls `nextHand()`; then shows toast with undo that dispatches `GAME_ACTIONS.HYDRATE_STATE` + `CARD_ACTIONS.HYDRATE_STATE`. Same HYDRATE_STATE actions would apply here.
- **Observation:** The surface artifact (known flags section) names Next Hand irreversibility as a pre-existing known issue. This audit formalizes it as severity 4. Between-hands-chris operates in a 30-90s window under real-world interruptions. A tap on Next Hand while distracted wipes the showdown record for the current hand with no recovery path. The pattern fix sits in CommandStrip.jsx -- the engineering cost is low; the omission is a copy-oversight, not an architectural blocker.
- **Recommended fix:** Mirror the CommandStrip Next Hand undo pattern in `useShowdownHandlers.handleNextHandFromShowdown`: (1) Snapshot full hand state before calling `nextHand()`. (2) Show a "Hand recorded -- Undo" toast for 12000ms (matching `UNDO_TOAST_DURATION_MS`). (3) Undo dispatches `GAME_ACTIONS.HYDRATE_STATE` + `CARD_ACTIONS.HYDRATE_STATE` and calls `openShowdownView()`. (4) The winner confirmation overlay Next Hand button (ShowdownView.jsx:203-209) also calls `handleNextHandFromShowdown` -- it gets the fix for free.
- **Effort:** S (one hook file, ~20 lines; pattern is proven in CommandStrip.jsx).
- **Risk:** Low. Same HYDRATE_STATE actions as TableView undo. No schema change. Snapshot must include card state to fully restore ShowdownView context.
- **Proposed backlog item:** `[P0] [AUDIT-2026-04-21-SDV F1] ShowdownView Next Hand: toast+undo pattern -- useShowdownHandlers.js:84-87 (mirror CommandStrip.jsx:205-253)`

---

### F2 -- Next Hand and Done buttons visually indistinct despite opposite consequences

- **Severity:** 3 (destructive action in primary situation -- visual parity increases mis-tap rate; compounds F1 until undo ships)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (primary), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md)
- **JTBD impact:** `JTBD-HE-11` (finish hand record) -- a user intending Done may instead tap Next Hand and commit the advance (no undo until F1 ships). `JTBD-HE-12` (undo / repair) -- with no visual distinction, the user may not know which button they pressed until it is too late.
- **Heuristics violated:** H-N04 (consistency: destructive and non-destructive primaries should be visually differentiated), H-N05 (error prevention: similar appearance for dissimilar consequences), H-PLT06 (misclick absorption)
- **Evidence:**
  - `ShowdownHeader.jsx:37-43` -- Next Hand: `bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg text-xl font-bold`. Size, padding, and font weight identical to Done.
  - `ShowdownHeader.jsx:59-64` -- Done: `bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold`. Visually indistinct from Next Hand at a glance; only color differs (yellow vs. gray).
  - The gap between them is `gap-4` (16px) in the header flex row at line 21. Clear Cards (`bg-blue-600`) also sits between them.
  - The header instruction text at line 19 says "Who won?" -- the user is reading game state, not scanning button semantics.
- **Observation:** Between-hands-chris has 5-30 seconds of focused attention. Yellow (Next Hand) and gray (Done) are distinguishable with careful foveal focus, but a thumb under time pressure will hit whichever button is in its arc. Next Hand (destructive, irrecoverable until F1 ships) sits adjacent to Clear Cards and Done with no spatial separation, no size differentiation, and no explicit danger visual. The TableView ControlZone pattern de-emphasizes Reset Hand and separates it from Next Hand (F10 from table-view audit). The same principle applies here.
- **Recommended fix:** (1) Move Done to the left side of the header (non-destructive anchor) or give it a back-arrow icon. (2) Increase the physical gap between Next Hand and Done to at least 32px. (3) After F1 ships (undo toast), severity drops to 2.
- **Effort:** S (layout + icon change, no logic).
- **Risk:** Low; visual-only change. Needs device verification.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21-SDV F2] ShowdownHeader: spatial and visual separation between Next Hand and Done -- ShowdownHeader.jsx:21-64 (sequence with F1)`

---

### F3 -- Clear Cards in header has no undo and sits adjacent to Next Hand

- **Severity:** 2 (destructive action in the primary surface; no undo exists)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (Full Mode card entry path), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md) (exploratory tapper)
- **JTBD impact:** `JTBD-HE-12` (undo / repair) -- Clear Cards dispatches `CARD_ACTIONS.RESET_CARDS` + `GAME_ACTIONS.CLEAR_STREET_ACTIONS`, wiping all hole card and community card assignments. Re-entering 18 hole card slots manually is a 2-3 minute cost in a 30-second budget. `JTBD-SR-23` (seed reviewable hand) -- a hand with partially assigned cards that was cleared cannot be reviewed correctly.
- **Heuristics violated:** H-N03 (no undo for destructive action), H-N05 (blue button adjacent to yellow Next Hand -- error-prone placement), H-PLT06 (misclick absorption)
- **Evidence:**
  - `useShowdownHandlers.js:26-34` -- `handleClearShowdownCards` dispatches `CARD_ACTIONS.RESET_CARDS` + `GAME_ACTIONS.CLEAR_STREET_ACTIONS` with no snapshot and no undo. Log line confirms: "cards cleared, first active seat selected."
  - `ShowdownHeader.jsx:44-49` -- Clear Cards: `bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold`. Sits `gap-4` from Next Hand -- approximately 16px separation between two large buttons in the same flex row.
- **Observation:** Clear Cards is a Full Mode utility but is visible even in Quick Mode where it has no effect on the summary. Blue conventionally means informational in this codebase -- it does not signal destructive intent. The SessionsView audit fixed the analogous delete pattern (SV F1) with a deferred toast; the same approach applies here.
- **Recommended fix:** (1) Add snapshot + toast+undo to `handleClearShowdownCards`. (2) Hide Clear Cards in Quick Mode where it is a no-op. (3) Consider moving Clear Cards to a secondary position.
- **Effort:** S (handler + toast; pure React state restoration).
- **Risk:** Low. Card state is local; undo is pure React state restoration.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-SDV F3] ShowdownHeader Clear Cards: add undo toast + hide in Quick Mode -- useShowdownHandlers.js:26-34, ShowdownHeader.jsx:44-49`

---

### F4 -- Quick Mode Won tap auto-mucks all opponents with no preview and no undo

- **Severity:** 2 (bulk side-effect action without scope visibility -- analog of orbit auto-fold finding F2 in table-view audit)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (primary Quick Mode user), [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md) (most common path during home-game management)
- **JTBD impact:** `JTBD-HE-11` (finish hand record) -- tapping "Won" on seat 4 in a 5-way pot auto-records MUCKED for seats 1, 2, 5, 8 simultaneously. If the tap was on the wrong seat (fat-finger error), four incorrect MUCKED records are committed alongside one incorrect WON record. `JTBD-HE-12` (undo / repair) -- there is no undo; the user must manually correct each seat.
- **Heuristics violated:** H-N01 (system status: scope of the auto-muck is invisible pre-tap), H-N05 (error prevention: bulk side-effect with no preview), H-PLT06 (misclick absorption), H-PLT07 (state-aware primary action: Won should preview its effect on other seats)
- **Evidence:**
  - `useShowdownHandlers.js:66-81` -- `handleWonSeat(seat)` records `ACTIONS.WON` for the tapped seat, then loops `remaining.forEach(s => recordSeatAction(s, ACTIONS.MUCKED))` for all other active seats. No preview, no confirmation, no undo.
  - `ShowdownSeatRow.jsx:138-147` -- Won button renders with `bg-green-500` at `text-base px-4 py-3` in quick mode. No indicator that tapping it will affect other seats.
  - `CommandStrip.jsx:133-172` -- the orbit auto-fold analog -- AUDIT-2026-04-21-TV F2 added a badge showing "+N folds" pre-tap. A "mucks N others" badge on each Won button would serve the same purpose here.
- **Observation:** Quick Mode exists specifically to reduce friction. Eliminating a confirmation dialog is correct. But eliminating all scope visibility is not -- orbit auto-fold learned this at Gate 4. The fix is not a dialog; it is a passive count label on each Won button ("S1 Won -- mucks 4 others") in multi-player games. In heads-up the side-effect is already obvious (only one other seat exists).
- **Recommended fix:** (1) In Quick Mode with 3+ players, add a sub-label to each Won button: "mucks N others" where N = count of active seats that would be auto-mucked. No confirmation required -- the count is passive and glanceable. (2) After committing, show a toast "Seat N won (N others mucked) -- Undo" that restores via state snapshot.
- **Effort:** S (label derivation is trivial; undo snapshot is the same pattern as F1).
- **Risk:** Low. Additive UI change; undo is pure state restoration.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-SDV F4] Quick Mode Won: passive "mucks N others" label + undo toast -- useShowdownHandlers.js:66-81, ShowdownSeatRow.jsx:138-147`

---

### F5 -- CardGrid buttons are 62px DOM-wide; at scale 0.7 effective tap width is ~43px (below H-ML06 floor)

- **Severity:** 2 (H-ML06 violation on primary Full Mode input path; fat-finger card selection is high-cost in a 30s window)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (Full Mode card assignment), [post-session-chris](../personas/situational/post-session-chris.md) (post-session card entry for reviewable hands)
- **JTBD impact:** `JTBD-HE-11` (finish hand record) -- a mis-tapped card requires detection, de-selection, and re-selection. In a 9-player game with 18 hole slots, the probability of at least one mis-tap under time pressure is non-trivial.
- **Heuristics violated:** H-ML06 (touch targets >= 44x44 scaled CSS pixels; 62px at scale 0.7 = ~43px effective -- marginal violation), H-ML05 (secondary: no horizontal scroll affordance on primary path when content clips)
- **Evidence:**
  - `CardGrid.jsx:89` -- `style={ height: "90px", width: "62px" }` applied to every card button.
  - App scale at reference viewport (1600x720) is ~1.0 per `useScale`. At smaller landscape viewports (e.g., 1100x550 = scale ~0.69), effective width drops to ~43px. At 900x420 (scale ~0.56), effective width ~35px -- well below floor.
  - `CardGrid.jsx:23` -- outer div uses `overflow-hidden` rather than `overflow-auto`. On narrow viewports, the 13-column x 4-row fixed-pixel table (13 * 62px = 806px minimum) clips rather than scrolling -- the rightmost columns (low-rank cards: 3, 2) are silently inaccessible with no scroll affordance.
- **Observation:** The CardGrid is a fixed 52-card table. On the reference device at scale 1.0, 62px is acceptable. The real risk is sub-reference viewports. The `overflow-hidden` choice means that on narrow phones the rightmost columns are silently cut off -- the user has no way to select a 2 or 3 of any suit on a 900px viewport. This is a full JTBD blocker on smaller devices.
- **Recommended fix:** (1) Change `overflow-hidden` to `overflow-auto` on the CardGrid outer div to restore horizontal scroll (H-ML05). (2) At minimum, document the 1600x720 reference assumption in a code comment. (3) At scale <0.75, consider an alternative layout: two rows of 13 with larger cards.
- **Effort:** S for the overflow fix; M for the responsive layout alternative.
- **Risk:** The overflow fix is safe. Responsive CardGrid layout would need visual verification across scales.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21-SDV F5] CardGrid: overflow-hidden -> overflow-auto + evaluate card size at sub-reference scale -- CardGrid.jsx:23,89`

---

### F6 -- ActionHistoryGrid Labels buttons are dead controls (no onClick, no handler, no disabled attribute)

- **Severity:** 1 (misleading affordance; JTBD does not fail but user wastes attention tapping non-functional buttons)
- **Situations affected:** [post-session-chris](../personas/situational/post-session-chris.md) (summary mode reviewer), [newcomer-first-hand](../personas/situational/newcomer-first-hand.md) (explorer who taps everything)
- **JTBD impact:** `JTBD-SR-23` (seed reviewable hand) -- the Labels buttons in the summary grid imply functionality (labeling a player for a street or hand) that does not exist. Users who tap them expecting feedback get none. For newcomer-first-hand, this contributes to "I broke it" syndrome.
- **Heuristics violated:** H-N01 (visibility of system status: a button that does nothing communicates wrong status), H-N04 (consistency: blue styled as interactive but non-functional), H-N10 (no help for what Labels does or could do)
- **Evidence:**
  - `ActionHistoryGrid.jsx:26-30` -- nine Labels buttons render with `bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold w-full mb-2`. No `onClick` prop. No `disabled` attribute. Full hover styling is applied (`hover:bg-blue-600`), making them appear interactive.
  - The hover effect fires on user interaction, reinforcing the expectation of an action -- then nothing happens.
- **Observation:** Dead controls are worse than absent controls -- they teach the user that tapping things in this app does nothing. Severity is 1 because Summary mode (ActionHistoryGrid) is only reached in Full Mode with all cards assigned, which is an advanced and deliberate path. Between-hands-chris on the primary Quick Mode path never sees this.
- **Recommended fix:** Two options: (a) If Labels has a planned implementation, add `disabled` attribute and `cursor-not-allowed` styling plus a tooltip "Player labels coming soon." (b) If Labels has no planned implementation, remove the buttons entirely and replace with a plain seat-number header.
- **Effort:** XS (attribute + style change; or delete).
- **Risk:** None.
- **Proposed backlog item:** `[P3] [AUDIT-2026-04-21-SDV F6] ActionHistoryGrid Labels buttons: add disabled + tooltip or remove -- ActionHistoryGrid.jsx:26-30`

---

### F7 -- useShowdownEquity silently returns empty rankings when board has fewer than 5 cards; no user signal

- **Severity:** 1 (silent empty state; user receives no information but no error either; JTBD degrades silently)
- **Situations affected:** [between-hands-chris](../personas/situational/between-hands-chris.md) (Full Mode with partial board), [post-session-chris](../personas/situational/post-session-chris.md) (review of a hand that ended preflop or on the turn)
- **JTBD impact:** `JTBD-HE-11` (finish hand record) -- if the user entered Full Mode on a hand that ended preflop (no board cards), the equity rankings section of ShowdownSeatRow is blank with no explanation. The user does not know if the app failed to compute, if they need to enter the board, or if rankings simply do not apply.
- **Heuristics violated:** H-N01 (visibility of system status: silent empty is not informative), H-N09 (help users recognize and recover: no guidance on what to do when rankings are blank)
- **Evidence:**
  - `useShowdownEquity.js:29-31` -- `if (board.length < 5) return []`. No UI signal. Silent empty array.
  - `ShowdownSeatRow.jsx:112-118` -- ranking badge renders only `if (!hideCards && ranking)`. When `rankings` is empty, the badge is absent. No placeholder, no "rankings require 5 board cards" label.
- **Observation:** Severity is 1 because: (1) a hand that goes to showdown almost always has 5 board cards; (2) Quick Mode does not show rankings at all; (3) Full Mode with partial board is an edge case (preflop all-in). The fix is a passive informational label, not a functional change.
- **Recommended fix:** When `rankings` is empty and the surface is in Full Mode (summary), render a passive label: "Hand rankings require all 5 board cards to be entered." This clarifies the empty state without blocking any action.
- **Effort:** XS (one conditional label in ShowdownView.jsx or ShowdownSeatRow.jsx).
- **Risk:** None.
- **Proposed backlog item:** `[P3] [AUDIT-2026-04-21-SDV F7] useShowdownEquity: surface empty-state explanation when board < 5 cards -- useShowdownEquity.js:29-31, ShowdownSeatRow.jsx:112-118`

---

## Observations without fixes

Worth noting; not severity-scored; may become findings with more evidence.

- **Winner confirmation overlay also calls `handleNextHandFromShowdown`.** ShowdownView.jsx:203-209 -- the green overlay Next Hand button is the natural tap target after tapping Won on a seat in Quick Mode. It calls the same unguarded handler as the header Next Hand button. F1 fix must cover both call sites to be complete.

- **ShowdownHeader mode toggle label describes the destination, not the current mode.** ShowdownHeader.jsx:56 -- when `showdownMode === "quick"`, the button reads "Assign Cards" (the Full Mode label). When `showdownMode === "full"`, it reads "Quick Mode." This follows the navigate-to convention rather than current-state convention. Acceptable per H-N04 if applied consistently; flagged as an H-N02 question (does "Quick Mode" tell the user what the current experience IS or where it will go?).

- **`mode` variable is derived from two independent signals (`showdownMode` + `isAllCardsAssigned`).** ShowdownView.jsx:133-135 -- `mode` is "quick" if `showdownMode === "quick"`, otherwise "summary" if `isAllCardsAssigned`, otherwise "selection". This tri-state is not visible to the user. Between-hands-chris switching from Full to Quick mode after completing card assignment stays in Quick visually but the mode derivation path changes. Not a bug; worth a code comment explaining the intent.

- **`useShowdownCardSelection` stale-closure risk: non-issue, correctly handled.** useShowdownCardSelection.js:23 captures `highlightedSeat` and `highlightedHoleSlot` in a `useCallback`. The dependency array at line 69 includes both -- the callback is recreated on every highlight change. The stale-closure risk flagged in prior analysis was false. Noting here for the record.

- **Touch-target assessment for Quick Mode Won/Muck buttons.** ShowdownSeatRow.jsx:127-148 -- quickMode buttons use `text-base px-4 py-3` with `minHeight: "48px"`. At scale 1.0 (reference device), 48px meets H-ML06. At scale 0.7, effective height ~34px -- marginal. Less critical than CardGrid (F5) because Won/Muck buttons are wider and more separated, but should be verified visually at sub-reference scale.

---

## Open questions

1. **Is Quick Mode actually the primary path in real use?** The surface artifact treats it as primary. If Full Mode is used more (for card entry review), the persona weighting of this audit shifts toward post-session-chris. Telemetry on `showdownMode` at surface entry would confirm.

2. **Does the Won auto-muck (F4) write to IDB immediately?** If `recordSeatAction` writes through to IDB synchronously, the undo implementation must also handle IDB restoration (more complex than pure state undo). If IDB write is deferred until `nextHand()`, the undo can be pure state restoration. This affects F4 implementation complexity.

3. **Is ActionHistoryGrid (summary mode) reachable in practice?** It renders only when `isAllCardsAssigned` in Full Mode. If Full Mode card assignment is rarely completed, summary mode is a post-session-chris path exclusively. The dead Labels buttons (F6) would then be a post-session finding, not a between-hands one.

4. **At what scale does the CardGrid clip on the actual device?** Samsung Galaxy A22 at 1600x720 renders at scale ~1.0 where 62px cards are safe. The overflow-hidden clipping only manifests on sub-reference devices. If this device is the sole target, F5 overflow priority may be lower than indicated. The overflow-hidden fix is still correct regardless.

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 -- Next Hand: toast+undo pattern | 4 | S | P0 |
| 2 | F2 -- Next Hand / Done: spatial + visual separation | 3 | S | P1 |
| 3 | F3 -- Clear Cards: undo toast + hide in Quick Mode | 2 | S | P2 |
| 4 | F4 -- Quick Mode Won: passive count label + undo toast | 2 | S | P2 |
| 5 | F5 -- CardGrid: overflow-hidden to overflow-auto | 2 | S | P2 |
| 6 | F6 -- Labels buttons: disabled + tooltip or remove | 1 | XS | P3 |
| 7 | F7 -- Empty equity ranking: surface explanation label | 1 | XS | P3 |

**Sequencing note:** F1 is standalone P0. F2 severity drops after F1 ships (undo absorbs the cost of a misclick). F3 and F4 share the snapshot+toast undo pattern with F1 -- they can be bundled in the same implementation pass for minimal marginal cost. F5 (overflow fix) is a one-line change and should be bundled with any ShowdownView touch. F6 and F7 are XS and can be bundled together.

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [ ] [P0] [AUDIT-2026-04-21-SDV F1] ShowdownView Next Hand: toast+undo pattern -- useShowdownHandlers.js:84-87 (mirror CommandStrip.jsx:205-253)
- [ ] [P1] [AUDIT-2026-04-21-SDV F2] ShowdownHeader: spatial and visual separation between Next Hand and Done -- ShowdownHeader.jsx:21-64 (sequence with F1)
- [ ] [P2] [AUDIT-2026-04-21-SDV F3] ShowdownHeader Clear Cards: add undo toast + hide in Quick Mode -- useShowdownHandlers.js:26-34, ShowdownHeader.jsx:44-49
- [ ] [P2] [AUDIT-2026-04-21-SDV F4] Quick Mode Won: passive "mucks N others" label + undo toast -- useShowdownHandlers.js:66-81, ShowdownSeatRow.jsx:138-147
- [ ] [P2] [AUDIT-2026-04-21-SDV F5] CardGrid: overflow-hidden -> overflow-auto + evaluate card size at sub-reference scale -- CardGrid.jsx:23,89
- [ ] [P3] [AUDIT-2026-04-21-SDV F6] ActionHistoryGrid Labels buttons: add disabled + tooltip or remove -- ActionHistoryGrid.jsx:26-30
- [ ] [P3] [AUDIT-2026-04-21-SDV F7] Empty equity rankings: surface explanation when board < 5 cards -- useShowdownEquity.js:29-31, ShowdownSeatRow.jsx:112-118
```

---

## Discoveries referenced (separate track -- not audit findings)

No new discoveries surfaced. All findings are fixable defects in the existing surface, not missing-feature questions.

Existing discoveries from the Gate-2 blind-spot audit adjacent to this surface:
- [DISC-2026-04-21-decision-tree-fate](../discoveries/2026-04-21-decision-tree-fate.md) -- DecisionTreeView revive / retire / fold-in decision. The summary mode ActionHistoryGrid is the closest current analog to a structured hand walkthrough. If DecisionTree is folded into ShowdownView summary mode, ActionHistoryGrid becomes a higher-priority surface.

---

## Severity rubric (for reference)

| Severity | Definition | Example |
|----------|------------|---------|
| 0 | Cosmetic. No functional impact. | Slightly off-center label. |
| 1 | Minor friction. JTBD completes with avoidable effort. | Extra tap on non-primary path. |
| 2 | Blocks a secondary situation or causes destructive action without undo on secondary path. | Clear Cards without undo in Full Mode. |
| 3 | Blocks JTBD in a secondary situation OR causes destructive action in primary path (undo exists elsewhere). | Visual indistinction between primary and secondary destructive CTAs. |
| 4 | Blocks JTBD completion in primary situation OR causes silent irrecoverable data loss. | Next Hand with no undo on a surface every persona visits after every hand. |

---

## Gate 5 resolution — 2026-04-21 (same session)

Owner approved via continue-directive. Main-Claude verified F1 by direct read of `useShowdownHandlers.js:84-87`. Confirmed anti-pattern identical to TableView F1 / SessionsView F1. Shipped same-session.

**Implemented:**

| ID | Status | Code | Tests |
|----|--------|------|-------|
| F1 | ✅ SHIPPED | `useShowdownHandlers.js:1-17` (imports + UNDO_TOAST_DURATION_MS), `:27-44` (extended hook signature + undo ref), `:91-164` (handler rewritten) + `ShowdownView.jsx:42-68` (consolidated context destructuring), `:81-116` (hook call site) | 111/111 ShowdownView + hook tests pass |

**Key implementation notes:**
- Mirrors CommandStrip Next Hand pattern but also calls `openShowdownView()` on undo so the user lands back on the Showdown surface (not TableView). Ringmaster-in-hand semantics.
- Hook signature extended with 12 optional inputs (all guard-protected). Backward-compatible: existing test harness without `addToast` continues to work; fallback is pre-fix behavior (no toast, just next-hand advance).
- Handler covers BOTH call sites for free: ShowdownHeader Next Hand button AND winner-confirmation overlay Next Hand button both call `handleNextHandFromShowdown`.

**Remaining open (queued for subsequent sessions):**
- F2 (P1 → P2 post-F1) — spatial + visual separation of Next Hand / Done. Effort S, pure CSS/layout.
- F3 (P2) — Clear Cards undo toast + hide in Quick Mode.
- F4 (P2) — Quick Mode Won auto-muck: passive "mucks N others" label + undo toast.
- F5 (P2) — CardGrid overflow-hidden → overflow-auto.
- F6 (P3) — ActionHistoryGrid Labels dead buttons: disable or remove.
- F7 (P3) — Empty equity rankings explanation label.

**Visual verification (owner checklist):**
- [ ] Record a hand → reach Showdown → tap Next Hand → "Hand recorded" toast with Undo (NO native dialog).
- [ ] Within 12s, tap Undo → ShowdownView re-opens with all state restored (action sequence, community cards, hole cards, allPlayerCards, dealer button, current street, absent seats, hand count).
- [ ] Same verification on the winner-confirmation overlay Next Hand button (Quick Mode path).
- [ ] Fresh hand with zero actions → Next Hand emits no toast (nothing to roll back).

---

## Review sign-off

- **Drafted by:** Claude (product-ux-thinker agent) -- 2026-04-21
- **Owner-reviewed:** 2026-04-21 (continue-directive)
- **P0 implementation closed:** 2026-04-21 (DCOMP-W1-S4)
- **P1–P3 implementation:** Pending subsequent sessions.

Audit is immutable after close. Follow-up audits create a new file.

---

## Change log

- 2026-04-21 -- Draft. DCOMP-W1 (Gate 4). Heuristic walkthrough on ShowdownView + 4 sub-components + 3 hooks. 7 findings (1xsev4, 1xsev3, 3xsev2, 2xsev1), 5 observations-without-fixes, 4 open questions, 0 new discoveries.
- 2026-04-21 — Gate 5 resolution appended. F1 shipped; F2–F7 queued.
- 2026-04-21 — DCOMP-W1-S5: F3 + F4 SHIPPED (destructive-action completion batch). Evidence: `EVID-2026-04-21-W1-S5-BATCH`. F2 + F5 + F6 + F7 remain queued.
- 2026-04-21 — DCOMP-W1-S6: F2 + F5 SHIPPED (layout batch — Header separation + CardGrid overflow). Evidence: `EVID-2026-04-21-W1-S6-BATCH`. F6 + F7 remain queued.
- 2026-04-21 — DCOMP-W1-S7: F6 + F7 SHIPPED (Labels buttons removed; empty equity rankings info banner). Evidence: `EVID-2026-04-21-W1-S7-BATCH`. **All ShowdownView findings closed.**
