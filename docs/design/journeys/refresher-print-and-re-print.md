# Journey — Refresher Print and Re-Print

**ID:** `refresher-print-and-re-print`
**Last reviewed:** 2026-04-24 (Gate 4, Session 5 — PRF-G4-J)
**Status:** SPEC (design artifact; Phase 5 of printable-refresher project implements)

---

## Purpose

The print-and-re-print journey is the multi-step flow through which the owner commits a set of cards to physical paper (first-print) and later discovers + acts on staleness (re-print prompt). Unlike the typical "action commits state in-app" journey, this one has a **physical-world side effect**: paper exits the app's control once printed. Every step is designed around that irreversibility.

Five variations cover the full lifecycle of a laminated reference card: Variation A (first-print) and B (stamp-date capture) together establish the print-time ground truth. Variation C (engine-changes) is the background silent state transition. Variation D (in-app-diff) is how the owner **discovers** staleness. Variation E (re-print prompt) is the action loop closing back to A.

The journey spec enforces **copy-discipline** against engagement-pressure (CD-3) + imperative tone (CD-1) throughout. Paper permanence makes tone errors unusually durable — a batch confirmation printed with "You must re-print now!" imperative framing would live in owner memory even if the UI copy got fixed later. Conservative copy throughout is load-bearing.

**Principle: printing is an owner-initiated commit of current engine state to paper; staleness is a passive discovery, never a nag.**

---

## Primary JTBD

- **`JTBD-DS-60`** — Carry-the-reference-offline (the act of printing is what produces the carryable artifact).
- **`JTBD-CC-82`** — Trust-the-sheet (lineage-stamped reference — the batch-stamp + lineage footer populates the trust infrastructure).
- **`JTBD-CC-83`** — Know-my-reference-is-stale (staleness surfacing — variations C + D + E).

## Secondary JTBD along the journey

- **`JTBD-SE-04`** — Pre-session kinesthetic visualization. Pre-session review is a re-print-prompt trigger when the owner notices stale cards while preparing for tonight.

## Personas

- **`chris-live-player`** (when in `presession-preparer` / `post-session-chris` situational context) — primary.
- **`scholar-drills-only`** — primary study-block printer.
- **`rounder`** — secondary carry-reference printer.
- **`apprentice-student`** — secondary coach-curated-pack printer.
- **`stepped-away-from-hand`** — primary situational **for the printed artifact** (not for the journey itself — the journey happens in-app, at home / pre-session, never at the table).
- **`returning-after-break`** — re-print-prompt is load-bearing on first return (≥28-day gap likely means stale batch).

**Explicitly excluded:**
- **`mid-hand-chris`** — no print actions mid-hand. The journey happens entirely in-app outside of active hands (red line #8 cross-surface segregation + H-PLT01 glance-budget prohibits app use mid-hand).
- **`between-hands-chris`** (30-90s window) — insufficient time budget for the 6-step confirmation flow; journey should not be entered here.

---

## Entry triggers

**Owner-initiated (3 entry points):**

1. **Catalog "Print selected batch →" button** — user has selected ≥1 cards in `CardCatalog`, tapped the batch-print CTA. Enters at step A1.
2. **Print-preview "Send to browser print dialog →" button** — user opened `/refresher/print-preview`, reviewed layout, tapped send. Enters at step A3 (skipping catalog selection; preview already has cards queued).
3. **Staleness banner "Review stale cards →" tap** — user tapped the amber banner on catalog entry. Enters Variation D (in-app-diff) at step D1.

**System-initiated (0 entry points):**

No system-initiated entries to this journey. Red line #15 (no proactive print-output) enforces — printing is 100% owner-initiated. Variation C (engine-changes) is a background state change that **does not trigger UI on its own**; staleness surfacing (Variation D) is passive and waits for the next in-app visit.

## Exit conditions

- **Success (A + B):** `printBatches` record written via W-URC-3; browser print dialog fired; owner presumably printed paper (app can't verify this). Journey terminates.
- **Success (D + E):** owner re-entered A + B for a stale-subset batch; new batch record supersedes old for staleness-diff purposes.
- **Abort (any variation):** owner taps Cancel at any confirm step; no `printBatches` record written; staleness state unchanged.
- **Partial (A confirmed but print dialog dismissed):** `printBatches` record is still written with the user-entered `printedAt`. Rationale: the owner committed to the date at modal-confirm time; whether they actually printed is unverifiable + unimportant. If they didn't print, the batch record reflects a committed intent that was not followed through — same effect as printing and losing the paper.

---

## Variations

### Variation A — First-print (owner-initiated; catalog → confirm → browser)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| A1 | `CardCatalog` | User selects 1+ cards (checkboxes on rows). `selectCardsForBatchPrint` filter drops any suppressed/hidden (defense-in-depth). | session-scoped `selectedIds` Set | ≤30s (browsing + selection) |
| A2 | `CardCatalog` | User taps `[ Print selected batch → ]`. Navigates to `/refresher/print-preview` with selection passed. | `useRefresherView.selectedIds` passed as render input | ≤1s |
| A3 | `PrintPreview` | User reviews WYSIWYG layout. May adjust page-size / cards-per-sheet / color-mode via `PrintControls` (W-URC-1 writes debounced 400ms). | `printPreferences` updated on IDB | ≤20s (review + adjust) |
| A4 | `PrintPreview` | User taps `[ Send to browser print dialog → ]`. `PrintConfirmationModal` opens. | modal overlay; no persistence yet | ≤1s |
| A5 | `PrintConfirmationModal` | User reviews batch summary: **"N cards (page-size, Q-up = M pages). Selected: N active + K pinned; 0 suppressed; 0 hidden."** Date-picker defaults today; user may edit. Optional label input. | no persistence | ≤5s (reading) |
| A6 | `PrintConfirmationModal` | User taps `[ Confirm and open print dialog → ]`. W-URC-3 writes `printBatches` record atomically: `{ batchId: uuid(), printedAt: userDate, label, cardIds, engineVersion, appVersion, perCardSnapshots }` + side-effect invokes W-URC-1 `writeConfigPreferences({ lastExportAt: printedAt })`. Modal dismisses. | batch committed; lastExportAt updated | instant |
| A7 | Browser print dialog | `window.print()` fires. Browser-controlled UI outside app scope. Owner picks printer + settings + Ctrl+P. App cannot observe outcome. | outside app | variable (owner-paced) |
| A8 | `CardCatalog` (returned-to) | Toast: **"Batch printed: N cards dated 2026-MM-DD."** No [Undo] (batch is append-only per I-WR-5 — no programmatic delete). Toast auto-dismisses 4s. | toast visible | ≤1s render, 4s dismiss |

**Total target time:** ~60s from first selection through print dispatch. No undo after A7 — batches are immutable per I-WR-5 append-only invariant. If the owner meant to print a different selection, they return to A1 + print again; the new batch supersedes the old for staleness-diff purposes (per `selectStaleCards` "most-recent batch per card" rule).

**Copy-discipline demonstration (A5-A6):**

- ✓ `"N cards (Letter, 12-up = 2 pages). Selected: 13 active + 2 pinned; 0 suppressed; 0 hidden."` — factual inventory per CD-1.
- ✓ `"This is the date stamped on cards + used for staleness diff."` — explains the mechanism per CD-5 (assumptions explicit).
- ✓ `"Disable browser headers + footers for best laminate result."` — utility instruction per CD-1.
- ✗ `"Don't forget to print soon!"` — urgency framing; violates CD-3 + AP-PRF-08.
- ✗ `"You must print on the date you entered."` — imperative + false-precision (date is user-committable, not enforceable); violates CD-1.
- ✗ `"Printed X batches this week!"` — engagement copy; violates CD-3 + AP-PRF-03.

### Variation B — Stamp-date capture (within Variation A, focused)

This is not a separate variation from A — it's the **focused sub-flow** at step A5/A6 where the `printedAt` commitment happens. Separating it out because the date field is where permanence is established: the entered date stamps every card in the batch + is the staleness-diff reference for every future comparison.

**Date-picker defaults to today** but is editable. Two common uses:

- **Today (default).** Owner is printing now + will laminate now. `printedAt = today`. This is the most common case.
- **Back-date (user edits to past date).** Owner printed yesterday but forgot to mark; is back-filling the batch record now. `printedAt = yesterday`. This is legitimate + supported per Q9 owner ratification.
- **Future date (user edits to +N days).** Rare; e.g., "I'll print these Monday." Writer warns in dev-mode but accepts. In production, owner sees no warning — date-picker permits any date.

**The date-picker does NOT offer:**

- ✗ `"Schedule this batch to print Monday"` — red line #15 (no proactive print-output). Future-dated batches don't fire a print-dialog at that future date.
- ✗ `"Remind me to re-print in 60 days"` — AP-PRF-08 (engagement notifications default-on). Staleness surfaces passively via banner, not via push / timer.
- ✗ `"Your usual print date is X; use that?"` — AP-PRF-09 (auto-personalization) + AP-PRF-03 (streak). Default is today; no learned-date heuristic.

The optional `label` field is a free-text ≤60 chars. Examples: `"Home game refresh"` / `"Vegas trip pack"` / `"March rake update"`. Null is permitted + common. Labels are for the owner's own reference; app never surfaces them for sorting / ranking / social-sharing.

### Variation C — Engine-changes (background state transition; no UI)

This variation has **no user-facing steps**. It is the state-change sequence that produces staleness:

| # | Actor | Event | State change |
|---|-------|-------|--------------|
| C1 | Dev / code-author | A source-util in the whitelist changes (`pokerCore/preflopCharts.js` gets an updated range, `gameTreeConstants.js` rake config updates, POKER_THEORY §9 gains a new divergence entry). | source-util `contentHash` changes at build. |
| C2 | CI (content-drift CI — PRF-G4-CI) | `contentDrift.test.js` runs on the PR. Detects `contentHash` mismatch. | If PR bumps `manifest.schemaVersion` + updates cached `manifest.contentHash`: PASS (intentional re-version). If not: CI FAILS — PR cannot merge without bump. |
| C3 | PR merge (if schemaVersion bumped) | Deploy flows to production. New app version ships with updated manifests. | `cardRegistry.js` now returns the new `contentHash` for affected cards at runtime. |
| C4 | Owner's device (any future session open) | User launches app. `selectStaleCards(inputs, printBatches)` runs on refresher catalog mount. Compares current `contentHash` to `printBatches[lastBatchForCard].perCardSnapshots[cardId].contentHash` for every card in the owner's most-recent batches. | Staleness set computed for this session. |
| C5 | `StalenessBanner` | If stale count > 0, amber banner renders: `"Your YYYY-MM-DD batch: N of M cards current, K stale."` | banner visible on catalog mount (passive) |

**Critical properties of Variation C:**
- No push notification. No badge counter. No timer. No "days-since-bump" display. The staleness banner appears only when the owner opens the refresher surface in-app.
- No auto-print. No auto-re-print. The owner decides when (or whether) to act.
- No urgency copy. Banner is informational amber — never red, never `"⚠️ URGENT"`, never `"STALE — RE-PRINT NOW"`.

**Copy-discipline demonstration (C5 banner):**
- ✓ `"Your 2026-04-24 batch: 12 of 15 cards current, 3 stale."` — factual + dated + counted per CD-1 + CD-5.
- ✓ `"Math unchanged; exception clause updated 2026-05-01."` — specific per-card diff prose per CD-1.
- ✗ `"⚠️ Your cards are out of date!"` — urgency framing + imperative tone; violates CD-1 + CD-3.
- ✗ `"3 cards expire soon — re-print before session!"` — false precision (cards don't "expire"; they drift) + imperative; violates CD-1 + AP-PRF-08.
- ✗ `"It's been 45 days since your last print."` — engagement counter / streak framing; violates CD-3 + AP-PRF-03.

### Variation D — In-app-diff (owner-initiated; staleness discovery)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| D1 | `CardCatalog` (on mount) | Staleness banner renders (from C5). User sees "12 of 15 cards current, 3 stale." | banner visible | ≤1s render |
| D2 | `StalenessBanner` | User taps `[ Review stale cards ]`. Filter applies: `useRefresherView.filters.statuses = ['stale']` (derived, not a persisted state). Catalog re-renders showing only the 3 stale cards. | derived filter applied | ≤1s |
| D3 | `CardRow` (filtered) | User taps ⓘ on a stale card row. Navigates to `/refresher/card/:cardId` (`CardDetail` sub-view). | route change | ≤1s |
| D4 | `CardDetail` | User sees per-card staleness footer: **"Stale: rake assumption changed 2026-05-15 — re-print recommended."** Tap `[ Where does this number come from? → ]` opens `LineageModal`. | modal overlay | ≤1s |
| D5 | `LineageModal` | User reviews 7-field lineage + staleness-diff prose. Decides whether the change matters for their use. Closes modal. | no persistence | ≤30s (reading) |
| D6 | (decision point) | User either: (a) returns to catalog, continues with current laminate (accepts drift); (b) enters Variation E (re-print). Dismisses banner for session via `[ Dismiss — I'll check later ]` if (a). | session-scoped dismiss (not persisted) | variable |

**Critical design choices:**
- Dismissing the banner is **session-scoped only**. Persisted dismissal would require a "days-since-dismissal" counter to know when to re-show it → AP-PRF-03 streak / #5 engagement-pressure slide. Re-appearance on next app open is the intended behavior; the owner controls cadence by acting (re-printing) not by hiding (dismissal).
- No "Don't show this again" option. That would be owner-requested suppression of a red line #10 guarantee — which the system cannot honor. Dismissal is session-scoped, full stop.
- No escalating urgency. 1 card stale renders identically to 15 cards stale (modulo the number). No "⚠️" at threshold N. No color escalation from amber-1 to amber-2 to red. Amber is the only state.

**Copy-discipline demonstration (D4 staleness footer):**
- ✓ `"Stale: rake assumption changed 2026-05-15 — re-print recommended."` — factual + dated + reason + passive recommendation per CD-1.
- ✓ `"Math unchanged; caption updated 2026-04-30."` — specific diff, non-structural per CD-1.
- ✓ `"No changes since print."` — null-case per CD-1.
- ✗ `"Your old card is WRONG!"` — imperative + grading tone; violates CD-1 + CD-2.
- ✗ `"Fix this card now!"` — urgency + imperative; violates CD-1 + AP-PRF-08.
- ✗ `"You printed this 42 days ago."` — engagement counter; violates CD-3.

### Variation E — Re-print prompt (owner-initiated; staleness → fresh laminate)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| E1 | `StalenessBanner` or `CardDetail` | User taps `[ Re-print this batch → ]` OR manually re-enters A1. | enters Variation A flow | ≤1s |
| E2 | `CardCatalog` | Cards from the originating stale batch pre-selected; user can adjust (add / remove cards before print). | `selectedIds` Set seeded | ≤30s (review) |
| E3 | (Variation A resumes) | A3 → A8 identical to first-print. New `printBatches` record written via W-URC-3 with today's `printedAt`. | new batch committed | ~60s |
| E4 | Post-commit | Old batch remains in IDB (I-WR-5 append-only); new batch supersedes for `selectStaleCards` purposes (most-recent-batch-per-card rule). | new batch is staleness-diff reference for these cards | instant |

**Critical design choices:**
- **Old batch is NOT deleted.** Per I-WR-5, `printBatches` is append-only. Old laminates the owner discarded are still represented in IDB. If the owner later prints cards B + C that only existed in the old batch (not in the new), staleness-diff against the old batch resumes for those cards. Storage cost is minimal (~1KB/batch).
- **Selection is pre-seeded from the stale subset**, not from the full previous batch. Rationale: re-print of only the stale cards is the common intent. If owner wants the full prior batch re-printed, they can re-select all (catalog remembers prior selections for session only).
- **The re-print CTA is labeled "Re-print this batch" not "Update your laminate"** — "update" implies the paper updates, which it doesn't. "Re-print" is literal.
- No "smart batch" — the app does not propose "also print these cards you haven't seen yet" or similar. User controls selection fully per red line #15.

**Copy-discipline demonstration (E1 CTA + E3 toast):**
- ✓ `[ Re-print this batch → ]` — factual action per CD-1.
- ✓ Toast on commit: `"New batch printed: 3 cards dated 2026-05-20."` — factual per CD-1 + CD-5.
- ✗ `[ Fix your laminate ]` — implies paper fix is possible (it isn't); violates factual accuracy per CD-1.
- ✗ `[ Refresh your reference ]` — metaphorically close but imprecise; "refresh" suggests in-place update.
- ✗ Post-commit toast `"Great! Your cards are current again!"` — engagement copy + gamified satisfaction; violates CD-3.

### Variation F — First-print with coach-curated pack (apprentice persona; forward-looking Phase 2+)

**Not in Phase 1 scope.** Placeholder for Phase 2+ coach-curated pack import feature (see `apprentice-student.md` §Goals — "Receive coach-curated printable packs as physical study aids"). When that ships, the journey variation will flow:

1. Apprentice receives pack from coach (PDF or in-app bundle — format TBD at Phase 2 Gate 4).
2. Imports pack — card selection is pre-populated; cannot be edited by apprentice (coach owns content).
3. `PrintConfirmationModal` shows coach-label + date + note "Coach-curated pack; cards sourced from <coach-username>."
4. Print proceeds as Variation A.

Red line #16 (cross-surface segregation — bidirectional) applies: coach packs flow **in** to apprentice's catalog as a distinct source; apprentice's per-card selections are not shared back to coach without separate opt-in flow. Full Phase 2 Gate 4 design required.

---

## Anti-patterns refused on this journey

This journey surface enforces the following PRF-specific anti-patterns (from `docs/projects/printable-refresher/anti-patterns.md`):

- **AP-PRF-02 — "Card of the day" auto-surface.** No variation has a system-initiated "here's what to print today" prompt. All entries are user-initiated taps.
- **AP-PRF-03 — Print-streak visualization.** `PrintConfirmationModal` summary does NOT include "Xth batch this week" / "consecutive days" / "longest streak." Toast does NOT show "Xth print this year." Batches are silent to the streak framing.
- **AP-PRF-05 — "Retired cards you might reconsider" nudges.** Variation E re-print pre-selects only the STALE subset; the system does NOT suggest "also include these cards you suppressed earlier." Suppressed cards remain suppressed even during re-print.
- **AP-PRF-06 — "Your refresher accuracy" graded-work framing.** Post-commit toast does NOT evaluate the owner ("Your prints are 95% on time!" / "You're a reliable printer!"). Just factual commit confirmation.
- **AP-PRF-08 — Engagement notifications default-on.** No push / email / badge when cards go stale. Variation D's banner appears only on in-app visit.
- **AP-PRF-09 — Auto-personalized print pack.** `PrintConfirmationModal` never suggests adding cards based on play data. Selection is purely owner-driven + carried from catalog state.
- **AP-PRF-10 — Watermark-based social engagement.** Printed batch does NOT carry "Printed by Chris · share with friends" watermark. Lineage footer is factual-utility only.
- **AP-PRF-11 — Card-view analytics surfaced to owner.** Post-commit toast does NOT show "You've viewed this card N times before printing."

EAL-inherited anti-patterns apply transitively where journey steps cross into anchor / calibration surfaces (none do in Phase 1 — PRF is structurally segregated per red line #16 + F6 source-util blacklist).

---

## Red-line compliance on this journey

All 17 red lines from charter §Acceptance Criteria are preserved on this journey. Per-line assertions:

- **#1 Opt-in enrollment** — N/A directly; journey does not produce skill-state writes (structurally via #11).
- **#2 Full transparency on demand** — `LineageModal` accessible ≤2 taps from any step of Variations A / D (via ⓘ icon on rows + "Where does this come from?" button).
- **#3 Durable overrides** — suppressed cards do not appear in Variation A selection even if user somehow selects them (defense-in-depth via `selectCardsForBatchPrint`); un-suppress requires owner tap on ⛔ chip, never journey-triggered.
- **#4 Reversibility** — Variation E is the reversibility loop for stale state; V E commits a new batch that supersedes the stale one. No "undo print" for completed batches (I-WR-5 append-only; paper can't be un-printed anyway).
- **#5 No streaks / engagement-pressure** — no streak tracking on prints; no motivational copy; no gamification at any step.
- **#6 Flat access** — Variations A / D render `selectAllCards` with filter state applied; suppressed cards visible in catalog via "Show suppressed" toggle even during print-selection flow.
- **#7 Editor's-note tone** — all copy per CD-1 factual-not-imperative. Per-variation demonstrations above.
- **#8 No cross-surface contamination** — journey does not render live-advice / calibration state; does not dispatch to anchor / observation stores.
- **#9 Incognito observation mode** — N/A (journey doesn't capture observations).
- **#10 Printed-advice permanence requires staleness surfacing** — Variations C + D implement this: every batch carries `perCardSnapshots`; staleness banner surfaces diff passively; lineage modal shows per-card diff.
- **#11 Reference-mode write-silence at reducer boundary** — journey dispatches stay in `currentIntent: 'Reference'`; W-URC-1/2/3 writers do not mutate skill-state (I-WR-2).
- **#12 Lineage-mandatory** — every `CardDetail` view + every printed card footer carries 7 fields per red line #12 + `LineageModal` 7-field drilldown.
- **#13 Durable suppression** — suppressed classes do not leak into Variation A selection; defense-in-depth via `selectCardsForBatchPrint`.
- **#14 No completion/mastery tracking** — journey does not increment any view-count / print-count / streak / mastery score.
- **#15 No proactive print-output** — NO system-initiated entries to this journey. All entries are user taps.
- **#16 Cross-surface segregation bidirectional** — journey reads `userRefresherConfig` + `cardRegistry` + `printBatches` only; writes only to the two PRF stores via W-URC-1/2/3. Does not read live-play data; does not write to skill-state.
- **#17 Intent-switch for drill-pairing** — no drill-pair affordance in Phase 1 journey; Phase 2+ variation would require explicit `currentIntent: 'Deliberate'` dispatch before routing to drill.

---

## Test coverage targets (Phase 5)

### Unit tests

- `PrintConfirmationModal.test.jsx` — date-picker default = today + editable + backdateable; batch summary correct; W-URC-3 invoked atomically on confirm; `window.print()` fires after IDB commit resolves.
- `StalenessBanner.test.jsx` — passive mount appearance when stale count > 0; session-scoped dismissal; "Review stale cards" filter navigation.
- `stalenessDiff.test.js` — most-recent-batch-per-card rule; null case (never printed = not stale); matching case (current hash = printed hash); diverging case (current ≠ printed → stale).

### Integration tests

- `PrintableRefresherView.e2e.test.jsx` §journey A — full Variation A flow: selection → preview → confirm modal → IDB write → window.print() call spy.
- `PrintableRefresherView.e2e.test.jsx` §journey D+E — seed a past batch + simulate source-util hash change → mount refresher → banner renders → "Review stale" filter applies → re-print flow → new batch supersedes.

### Playwright evidence (PRF-G5-PDF)

- `EVID-PHASE5-PRF-J-A1-CATALOG-SELECTION` — catalog with 3 cards selected.
- `EVID-PHASE5-PRF-J-A4-PREVIEW` — print-preview with WYSIWYG layout.
- `EVID-PHASE5-PRF-J-A5-CONFIRM` — `PrintConfirmationModal` with date + summary.
- `EVID-PHASE5-PRF-J-A8-TOAST` — post-commit toast.
- `EVID-PHASE5-PRF-J-C-STALENESS-BANNER` — amber banner with count.
- `EVID-PHASE5-PRF-J-D4-CARD-DETAIL-STALE` — card detail with amber staleness footer.
- `EVID-PHASE5-PRF-J-E-REPRINT-SELECTION` — catalog with stale cards pre-selected for re-print.

---

## Cross-surface dependencies

- **`printable-refresher` (parent surface PRF-G4-S1)** — the journey runs on this surface. All sub-views (`CardCatalog` / `CardDetail` / `LineageModal` / `PrintPreview` / `PrintConfirmationModal` / `StalenessBanner`) are inputs/outputs.
- **WRITERS.md (PRF-G4-W)** — W-URC-1 (config prefs) + W-URC-2 (card visibility — for defense-in-depth check that suppressed cards never slip into selection) + W-URC-3 (print-batch append) are the write-paths invoked.
- **selectors.md (PRF-G4-SL)** — `selectCardsForBatchPrint` + `selectStaleCards` are the read-paths that power the journey.
- **content-drift-ci.md (PRF-G4-CI)** — enforces the source-util integrity that Variations C/D/E depend on for staleness-diff correctness.
- **Card templates spec (PRF-G4-S2, pending)** — per-card-class layouts consumed in `PrintPreview` + `PrintConfirmationModal` inventory summary.
- **Browser print dialog** — external; out of app scope. `window.print()` is the handoff boundary.

---

## Amendment rule

Adding a new variation or modifying an existing variation's copy / flow requires **persona-level review**. Default answer is no. Copy changes specifically follow `copy-discipline.md` amendment rule (shared persona-level review). Flow changes that touch red-line compliance assertions require Gate-2-voice equivalent sign-off on the red-line impact.

Removing a variation is forbidden except as part of Phase 2+ Gate 4 re-design (which would trigger fresh Gate 1+2 for the affected scope).

---

## Change log

- **2026-04-24 — v1.0 shipped (Gate 4, Session 5 — PRF-G4-J).** 5 variations authored (A first-print / B stamp-date capture sub-flow / C engine-changes silent-transition / D in-app-diff staleness discovery / E re-print loop) + Variation F Phase 2+ coach-pack placeholder. Copy-discipline demonstrations ✓/✗ per variation. 8 AP-PRF refusals enumerated at journey level. All 17 red-line compliance assertions mapped. Test coverage targets enumerated for Phase 5 (unit + integration + 7 Playwright evidence placeholders). Critical-design-choice callouts documented for 3 non-obvious decisions (session-scoped dismissal / old-batch-not-deleted / amber-is-only-state).
