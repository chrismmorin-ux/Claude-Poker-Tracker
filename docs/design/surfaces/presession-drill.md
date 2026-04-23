# Surface — Presession Drill

**ID:** `presession-drill`
**Code paths (future — Phase 7 of exploit-deviation project):**
- `src/components/views/PresessionDrillView/index.jsx` (view orchestrator)
- `./DrillEntry.jsx` (time-budget selector + villain selector)
- `./DrillFlashcards.jsx` (card carousel)
- `./DrillReveal.jsx` (reveal + citation + dial)
- `./DrillRetryQueue.jsx` (missed-card replay)
- `./DrillExit.jsx` (hand-off to session or home)
- `./DrillReview.jsx` (post-session prediction-vs-outcome grid — may mount in SessionsView tab instead)
- `src/components/ui/AssumptionCitation/CitationExpanded.jsx` (three-line drill form)
- `src/components/ui/DialAffordance/index.jsx` (drill-only dial interaction)
- `src/hooks/usePresessionDrill.js` (drill state orchestrator)
- `src/hooks/useAssumptions.js` (assumption data source)
- `src/utils/assumptionEngine/` (`produceAssumptions`, `gateAssumption`)
- `src/utils/citedDecision/` (`produceCitedDecision`)

**Route / entry points:**
- `SCREEN.PRESESSION_DRILL` (routed via `uiReducer`; Phase 7 adds constant to `uiConstants.js`)
- Opens from:
  - TableView session-start flow (new "Prepare for this session" entry)
  - Standalone from main nav (new "Prepare next session" action)
- Closes to:
  - TableView (when session starts from drill exit)
  - Previous screen (when hero backs out)

**Product line:** Main app (no sidebar)
**Tier placement:** Plus (Regular) — per tier charter, this is a paid-tier feature; research-tier (below-threshold assumptions) may be Studio-only
**Feature flag:** `ENABLE_PRESESSION_DRILL` (OFF by default through Phase 7; ON after Phase 8 Tier-2 calibration accrues per charter)
**Last reviewed:** 2026-04-23

---

## Purpose

Pre-session rehearsal surface. Hero declares a session is imminent (5, 15, or 30 minutes out), selects the villains they expect to face tonight, and walks through a flash-card drill of the 3–15 most-exploitable patterns keyed to those specific villains — ranked by recognizability × expected dividend × confidence. Each card reveals a `VillainAssumption`'s compressed citation, expected dividend, and contestability dial. Hero answers, sees the reveal, adjusts commitment via the dial if they disagree, and queues missed cards for end-of-session replay.

After the session, the same surface (in review mode — mounted in SessionsView) closes the loop: for each flagged pattern, did it fire at the table? did hero catch it? what was the realized vs predicted EV gap? Review is **mood-aware** — stuck hero sees what worked highlighted; heater hero sees improvement opportunities.

The surface is the **teaching complement** to the live exploit citation — it primes recognition-primed decisions for the session, while the live sidebar cites the same underlying assumptions during play.

---

## JTBD served

Primary:
- `JTBD-SE-01` — Prepare tonight's watchlist of exploitable patterns keyed to expected villains *(preparation mode)*
- `JTBD-SE-02` — Review drill predictions against session outcomes *(review mode)*
- `JTBD-SE-03` — Scale commitment to a specific deviation via drill-side dial *(preparation mode)*

Secondary:
- `JTBD-DS-44` — Correct-answer reasoning (not just score) — reveal shows why each deviation is +EV
- `JTBD-DS-50` — Walk a decision branch-by-branch with consequences shown — expanded citation provides the reasoning chain (tangential)

Not served (explicit non-goals):
- `JTBD-MH-*` — any live mid-hand decision job. Drill exits when session starts; no in-hand behavior.
- `JTBD-DS-43` — generic concept drill. Pre-session drill is *applied*, keyed to tonight's villains, not generic.
- `JTBD-DS-46` — spaced repetition. Drill is session-specific, not long-running SRS.

---

## Personas served

- [Pre-Session Preparer](../personas/situational/presession-preparer.md) — **primary**; this surface exists for this persona specifically.
- [Chris (live player)](../personas/core/chris-live-player.md) — primary core persona (the Pre-Session Preparer maps to Chris most directly).
- [Rounder](../personas/core/rounder.md) — primary secondary (regular session player with known opponents).
- [Circuit Grinder](../personas/core/circuit-grinder.md) — secondary (pre-day-1 tournament prep — though v1 is cash-focused; tournament drill deferred).
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — secondary.
- [Weekend Warrior](../personas/core/weekend-warrior.md) — occasional (casual use).

Not served (explicit):
- [Scholar (drills-only)](../personas/core/scholar-drills-only.md) — wrong persona. Scholar doesn't play; drill is applied to tonight's specific villains.
- [Multi-Tabler](../personas/core/multi-tabler.md), [Online MTT Shark](../personas/core/online-mtt-shark.md) — v1 is live-cash-focused.
- [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) — drill exits when session starts.

---

## Anatomy

Three modes: **Entry**, **Flashcards** (with reveal sub-state), **Review** (post-session).

### Mode 1 — Entry

```
┌──────────────────────────────────────────────────────────────────┐
│ Prepare for tonight's session              [Back] [Skip drill]   │
│                                                                  │
│ Session starting in:    [ 5 min ]  [ 15 min ]  [ 30 min ]        │
│                           (3 cards)  (5-7 cards) (10-15 cards)   │
│                                                                  │
│ Tonight's opponents:                                             │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ + Add villain   (from Players / session template)    │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│   ☑  Dan     (Fish, n=54)       → 3 patterns ready               │
│   ☑  Mike    (Nit, n=71)        → 2 patterns ready               │
│   ☑  Sara    (LAG, n=28)        → 1 pattern (low confidence)     │
│   ☐  Jerome  (unknown)          → 0 patterns                     │
│                                                                  │
│                                   [ Start drill → 6 cards ]      │
└──────────────────────────────────────────────────────────────────┘
```

### Mode 2 — Flashcards (card-revealed sub-state)

```
┌──────────────────────────────────────────────────────────────────┐
│ Card 3 of 6 · ~2 min                          [Exit early ×]    │
│                                                                  │
│ Villain:  Dan    (Fish, 17% fold-to-river @ 3/4 pot, n=52)      │
│                                                                  │
│ Spot:   River, OOP. You double-barreled turn with Ks Js         │
│         on Jh 9h 2c 5c. River 3s. He called each street.        │
│                                                                  │
│ Your holding:  8s 7s (missed draw, no showdown)                  │
│                                                                  │
│           ┌───────────────────────────────────────┐              │
│           │  What's your move?                    │              │
│           │                                       │              │
│           │    [ Fold/Check ]    [ Bet 3/4 pot ]  │              │
│           │                                       │              │
│           │    [ I'm not sure → reveal ]          │              │
│           └───────────────────────────────────────┘              │
│                                                                  │
│ ────────  REVEAL (after tap) ────────                            │
│                                                                  │
│ Normally:   bet 75% for balance (EV +0.09 bb)                    │
│ Tonight:    check  (EV +0.27 bb — dividend +0.18 bb)             │
│                                                                  │
│ Why:  Dan folds to river bets only 17% of the time (n=52)       │
│       → your bluff combos here are −EV. Check and give up.      │
│                                                    [ ⓘ more ]    │
│                                                                  │
│ Confidence dial:  ○───────●──────────  0.82                      │
│                   Balanced              Full commit              │
│                                                                  │
│ ┌──────────────────────────────────────────────┐                 │
│ │  Got it    |    Retry later    |    Skip     │                 │
│ └──────────────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

### Mode 2 (continued) — Citation expanded (tap "ⓘ more")

```
┌──────────────────────────────────────────────────────────────────┐
│ Why this is a check, not a bet:                                  │
│                                                                  │
│  [1] Dan folds rivers only 17% of the time to 3/4-pot bets      │
│      (n=52, 95% CI [11%, 24%]).  His style (Fish) confirms.     │
│      → bluff loses value. Contribution: +0.18 bb                │
│                                                                  │
│  [2] Your 8s 7s has no showdown value — pure bluff candidate.   │
│      Against Dan's calling range, you can't win at showdown.    │
│      Checking saves the bet. Contribution: 0                     │
│                                                                  │
│  Confidence dial:  0.82 (high)                                   │
│  Overall commitment:  0.78                                       │
│                                                                  │
│  Emotional state:  fear 0.22 (low), greed 0.41 (mild)            │
│  Dan isn't scared of a bluff here; his range contains enough     │
│  showdown value that he'll find a call.                          │
│                                                                  │
│  Try: drag dial below 0.40 — the bet re-emerges as mixed at     │
│        that point (balanced strategy returns).                   │
│                                                                  │
│                                         [ close ]                │
└──────────────────────────────────────────────────────────────────┘
```

### Mode 3 — Retry queue (end of initial pass)

```
┌──────────────────────────────────────────────────────────────────┐
│ Nice work — you answered 4 of 6 cards correctly.                 │
│                                                                  │
│ Want to try the 2 you missed again?                              │
│                                                                  │
│   ● Card 3:  Dan's river fold rate (you said bet; answer: check)│
│   ● Card 5:  Sara's turn check-raise (you said call; answer: fold)│
│                                                                  │
│                                  [ Retry ]    [ I'm ready ]      │
└──────────────────────────────────────────────────────────────────┘
```

### Mode 4 — Exit hand-off

```
┌──────────────────────────────────────────────────────────────────┐
│ You're ready.  Tonight's watchlist:                              │
│                                                                  │
│   ● Dan folds rivers too often → pure bluffs lose                │
│   ● Mike overfolds to cbet on dry → range-bet small              │
│   ● Sara loves check-raising on paired turns → bet bigger/fewer  │
│                                                                  │
│        [ Start session now ]    [ Leave drill — back later ]     │
└──────────────────────────────────────────────────────────────────┘
```

### Mode 5 — Review (post-session, mounted in SessionsView tab)

```
┌──────────────────────────────────────────────────────────────────┐
│ Drill Review — Tonight's session    [Hands tab] [Drill tab ●]    │
│                                                                  │
│ 🎯 You caught 2 of 3 flagged patterns that fired:                │
│                                                                  │
│  ● Pattern 1 — Dan's river fold (flagged ✓ fired 3× caught 3×)   │
│    Realized EV: +0.21 bb/100 (predicted +0.18).                  │
│                                                                  │
│  ● Pattern 2 — Mike's cbet fold (flagged ✓ fired 2× caught 1×)   │
│    Hand #23: you should've range-bet; you checked back.          │
│    [ Replay hand #23 → ]                                         │
│                                                                  │
│  ● Pattern 3 — Sara's check-raise (flagged ✓ fired 0× — passed)  │
│                                                                  │
│ 2 patterns you weren't primed for, in hindsight:                 │
│                                                                  │
│  ○ Jerome turned out to be a 3-bet bluffer — call lighter next.  │
│    (Not in database yet — add him to watchlist for next session.)│
│                                                                  │
│ Calibration update:  Dan fold-to-river now 18% (was 17%, n=55).  │
│                      Mike cbet-fold stable at 78%.               │
└──────────────────────────────────────────────────────────────────┘
```

*(When hero is stuck 3+ buy-ins, the review opener switches from "🎯 You caught 2 of 3" to "🎯 Tonight's catches: 2 of 3 flagged patterns." Same data, less triumphalist framing. Mood-aware per Gate 2 Stage C resolution.)*

---

## State

- **From reducers/contexts:**
  - `AssumptionContext` — `assumptions`, `activeByVillain`, `categorizations`, `emotionalStateCache`, `citedDecisionCache` (per architecture §7.1)
  - `PlayerContext` — villain list for selector (existing)
  - `SessionContext` — active session for auto-link (existing)
  - `UIContext` — `SCREEN.PRESESSION_DRILL` routing + `drillContext` (new field, mirrors `editorContext` pattern for carrying entry state)

- **From hooks:**
  - `usePresessionDrill()` — orchestrates card queue, reveal state, retry queue, dial overrides. Dispatches `DRILL_SESSION_STARTED` / `DRILL_CARD_REVEALED` / `DRILL_CARD_ANSWERED` / `DRILL_SESSION_COMPLETED`.
  - `useAssumptions(villainIds, timeBudget)` — returns actionable-in-drill assumptions for selected villains, ranked by `recognizability × asymmetricPayoff × posteriorConfidence`, capped by time budget.

- **Mutates:**
  - IDB `drillSessions` store — card progression + hero overrides (batch-write at session end per architecture §8.3).
  - IDB `assumptionValidation` updates — hero's hit/miss per assumption feeds Tier 2 calibration metric aggregation.
  - `assumptionReducer` state — dial overrides persist with the card.

- **Assumes about environment:**
  - Pre-Session Preparer has ≥ 1 villain with actionable-in-drill assumptions (otherwise entry surface renders empty-state guidance — see Edge Cases §Empty villain).
  - Game tree depth-3 baseline is computable for at least one node per selected villain (otherwise cards are dropped with the "compute timed out" label per architecture Finding 2.1).

---

## Props / context contract

- `scale: number` — viewport scale (existing responsive pattern).
- No direct props from parent; all state flows through contexts + hooks.

---

## Entry flow

1. **From TableView session-start flow:** a new "Prepare for tonight" CTA appears after hero initiates a session but before the first hand is dealt. Tapping routes to `SCREEN.PRESESSION_DRILL` with `drillContext = { mode: "preparation", sessionId: activeSession.id }`. On drill exit, hero is returned to TableView to play.
2. **Standalone:** a new "Prepare next session" nav action (Settings or a top-level button — Gate 4 iteration) routes to the drill with `drillContext = { mode: "preparation", sessionId: null }`. Drill operates without a linked session; hero declares villains explicitly.
3. **Resume:** if hero backs out mid-drill (exit button), drill state persists per-session in IDB; re-entry offers "Resume where you left off" prompt.

---

## Key interactions

1. **Select time budget** — hero taps 5/15/30. Card count computed (`3 / 5-7 / 10-15`). Disabled villains (no ready patterns) grey out but remain listed so hero understands data coverage.

2. **Add villain** — opens existing PlayerPicker surface in "presession-drill" context. Hero selects from the player list. Session-template recall (if hero has prior sessions with the same roster) offers one-tap prefill.

3. **Start drill** — computes per-villain assumption ranking, selects top-N cards fitting the time budget, presents Card 1.

4. **Reveal card** — click-to-reveal is final per Gate 2 Stage E. The pre-answer controls ("Fold/Check" vs "Bet 3/4 pot" vs "I'm not sure → reveal") each record hero's answer before the reveal fires. Accidental peeks are mitigated by click-not-hover semantics.

5. **Expand citation** — tap "ⓘ more" expands to three-line citation with dial affordance and emotional state readout. Tap "close" collapses. Tap-to-expand is cheap (no re-render of the card).

6. **Drag dial** — hero pulls dial to left/right; recommendation re-converges live (≤ 300ms per architecture §6). At dial = 0 the balanced-baseline recommendation replaces the deviation recommendation. Honesty check is visible in real time.

7. **Answer card** — tap "Got it" (correct), "Retry later" (missed or uncertain), or "Skip" (abandon this card — rare, e.g. unfamiliar spot). Card fades out; next card loads.

8. **End of initial pass** — retry queue offers missed + retry-later cards once more. Hero can skip to "I'm ready" if time-pressured.

9. **Exit hand-off** — final summary shows tonight's watchlist (3–5 patterns hero committed to). Tap "Start session now" links the drill to the active session for later review. Tap "Leave drill" releases without link; review is still available if hero opens the session on their own.

10. **Post-session review (SessionsView "Drill" tab)** — prediction-vs-outcome grid renders. Each pattern shows fire count, hero-caught count, realized EV, and deep-link to specific missed-pattern hands for replay context.

---

## Design rules (applied from Gate 2 Blind-Spot Roundtable 2026-04-23)

### From Stage C (situational stress)

- **Time-budget-aware card count.** 5 min → 3 cards; 15 min → 5–7 cards; 30 min → 10–15 cards. Selector is primary, not an advanced setting.
- **Supportive tone.** Framing emphasizes "recognize and respond correctly." Never "you face opponents tonight" / "dominate" / aggression-priming copy.
- **Compressed citation on reveal.** Single-line summary always-visible; tap-to-expand for three-line + dial + emotional state.
- **Retry-later queue.** Missed cards revisit before exit; no card-mastery gatekeeping (hero can exit any time).
- **Mood-aware review copy.** Stuck hero (≥ 3 buy-ins down from prior sessions) sees wins-first framing. Heater hero sees improvement-first framing. Neutral hero sees balanced framing.

### From Stage E (heuristic pre-check)

- **Click-to-reveal final.** No hover-to-peek. Accidental misclicks mitigated via retry-later queue.
- **Touch targets ≥ 44 DOM-px at 1600×720 scale.** Specifically verified for dial affordance, reveal button, answer buttons, retry/skip/close.
- **Dead-zones** around dial and reveal to prevent accidental drag/tap interaction.
- **Inline glossary on predicate names.** Tapping "fold-to-river-bet" (inline in citation) opens a reference tooltip explaining the predicate.
- **State-aware primary action.** In preparation mode, primary = "Next card" / "Reveal" / "Continue". In review mode, primary = "Next prediction". The primary action is always the prominent button in the bottom-right quadrant.

### From architecture § (CC findings)

- **Dial affordance visible in drill.** Per CC-5, dial is drill-only — live sidebar hides it. Drill must expose it because contestability is a JTBD (SE-03).
- **Hero-side meta-assumptions** may appear in drill (per architecture §5 I-AE-2 exception for drill). Opening drill card may be hero-side: "Your fear baseline tonight is elevated. Patterns that require sustained aggression are higher risk. Flagged: 2 of 5 tonight's patterns require you to override a fear response." Rendered as **pre-drill intro**, not a flashcard.

---

## Responsive layout at 1600×720

- **Samsung Galaxy A22 landscape (1600×720 @ ~92% scale).**
- Entry surface: single-column, time-budget buttons 110 DOM-px wide × 80 tall, villain list scrollable if > 8 villains (no pagination).
- Flashcard surface: two-column at 1600×720 (spot description left 60%, answer controls right 40%); single-column reflow below 900×720 (not a v1 target; documented for forward compatibility).
- Reveal expanded view: modal-style overlay with clear close affordance; never a full-screen lock (hero can still exit drill).
- Review surface (SessionsView tab): inherits SessionsView responsive framework; no new constraints.

All touch targets ≥ 44 DOM-px before scale is applied; scale preserves the ratio per `useScale` pattern.

---

## Edge cases

| Case | Behavior |
|---|---|
| **Empty villain data** (no villains have ready patterns) | Entry surface renders empty-state: "No actionable patterns yet — play a few hands with these opponents to build the data. Or try a concept drill instead → [deep-link to PreflopDrillsView]." |
| **Partial villain coverage** (some villains have patterns, some don't) | Disabled villains grey-out with "0 patterns ready — n=8 hands, need more." Tooltip explains the gate. |
| **All cards time-out on baseline computation** | Drill shows "Tonight's prep is having trouble computing recommendations — try again in a moment, or skip to session." Diagnostic path logs the timeout for investigation. |
| **Hero taps "Exit early"** mid-drill | Drill state persists; re-entry offers "Resume where you left off" with unrevealed cards intact. |
| **Hero closes browser / session-expires** | IDB state is the source of truth; drill re-hydrates on next open. No ephemeral state. |
| **Hero answers then tap reveal** vs **tap reveal then think** | Answer is recorded whenever hero taps an answer button, regardless of whether reveal has fired. Reveal records separately. "Got it" / "Retry later" / "Skip" determine the final classification. |
| **Multiple drills in a day** (hero preps, plays, preps again) | Each drill is a separate `drillSessions` record. Review tab shows most-recent-first; retention 90 days per architecture §8.4. |
| **Review with no prior drill** (hero opens review tab for a session they didn't drill for) | Review tab shows empty state: "You didn't prepare for this session. Drill review starts here — prep your next one." Deep-link to standalone drill entry. |
| **Predicate retirement during drill** | If a predicate's calibration gap exceeds 0.35 mid-session, it moves to `expiring` status. Drill filters out expiring predicates from the next drill's card pool. No in-drill surface change. |

---

## Performance targets

Per architecture §6:

| Operation | Desktop | Samsung A22 |
|---|---|---|
| Drill view cold-start | ≤ 500ms (skeleton < 200ms) | ≤ 800ms |
| Card render | ≤ 32ms | ≤ 48ms |
| Reveal-to-rendered-citation | ≤ 100ms | ≤ 200ms |
| Dial drag → recommendation re-convergence | ≤ 300ms | ≤ 400ms |
| Expand/collapse citation | ≤ 150ms | ≤ 200ms |
| Retry queue → first retry card render | ≤ 300ms | ≤ 500ms |

CI enforces via Tier-1 performance tests (per `calibration.md` §4.1).

---

## Telemetry

Per architecture §7 + CC-5:

- **`DRILL_SESSION_STARTED`** — time budget, villain count, generated card count, linked session (if any), hero mood estimate (derived from prior sessions' P/L).
- **`DRILL_CARD_REVEALED`** — card assumption ID, time-to-reveal (how long hero thought), answer given before reveal.
- **`DRILL_CARD_ANSWERED`** — answer classification (correct / retry-later / skip), dial override value (if changed from default).
- **`DRILL_SESSION_COMPLETED`** — cards hit, cards missed, cards retried, total time, exit action (start-session / leave).
- **Joint `(fearIndex, greedIndex)`** preserved per-card per architecture schema §5 for quadrant-distribution analysis (Phase 8 deliverable `joint-distribution-analysis.md`).

Privacy: all telemetry local-first; only hashed villain IDs leave the device (per architecture §16 cloud-sync forward concerns).

---

## Known behavior notes

- **Feature-flagged OFF** through Phase 7 of the exploit-deviation project. Toggle-on in Phase 8 after Tier-2 calibration accrues meaningful sample per `calibration.md`.
- **Review mode is a SessionsView tab, not a separate routed view.** Keeps surface count manageable and aligns with existing hand-review pattern.
- **Standalone entry point** is tentative (top-level button vs Settings action). Final placement TBD — Gate 4 iteration or a Wave-5 Settings audit.
- **Tournament context deferred.** v1 cash-focused per Gate 2 Stage D. Tournament drill requires ICM-aware predicates which aren't in schema v1.1.
- **Coach-assigning-drill-to-students** is a deferred use-case. Existing Coach persona uses this surface as-is; no coach-specific adaptations in v1.

---

## Known issues

None yet — surface is pre-implementation.

Future audit findings will accumulate here after Phase 7 ships and Gate 4/5 compliance audit runs.

---

## Potentially missing (future enhancement — not v1)

- **Spaced repetition** across sessions — drill doesn't currently re-surface patterns that hero missed in prior sessions. Possible integration with DS-46 long-term.
- **Cross-persona coach view** — coach walking student through drill as a review session. Coach-persona-primary use case.
- **Multi-villain composition** — what happens when hero faces villain A AND villain B in the same hand? Current drill assumes single-villain spots. Multiway drill is `research-agenda` item 3 in `schema.md` §9.2.
- **Hero fear/greed self-declaration** — currently derived from P/L. Hero may want to explicitly declare "I'm tilted tonight, emphasize careful play" or similar override.
- **Drill card sharing / social** — hero shares a specific drill card with a friend/coach. Out of v1 scope.

---

## Test coverage (planned — Phase 7)

### Component tests (`PresessionDrillView/__tests__/`)

- Entry surface renders time-budget buttons and villain list.
- Time-budget selection updates card count.
- Villain selection enables / disables Start-drill button.
- Empty-villain-data state renders correctly.
- Flashcard renders without leaking reveal content pre-tap.
- Reveal tap fires `CARD_REVEALED` with correct timing.
- Expand citation opens / closes correctly.
- Dial drag updates recommendation within 300ms.
- Honesty check: dial=0 shows balanced baseline recommendation (also unit-tested in citedDecision/).
- Retry-later queue replays missed cards before exit.
- Exit hand-off links drill to session when sessionId present.
- Responsive layout at 1600×720, 900×720 (forward-compat).

### Integration tests

- Full drill flow: entry → flashcards → retry → exit → review.
- Review renders with correct prediction-vs-outcome data after a simulated session.
- Mood-aware review framing switches correctly with stuck / heater / neutral input.

### Performance tests (CI)

- Drill view cold-start ≤ 500ms desktop / ≤ 800ms mobile.
- Dial drag → re-convergence ≤ 300ms desktop / ≤ 400ms mobile.
- Card render ≤ 32ms / ≤ 48ms.

### Visual verification (manual)

- Samsung A22 landscape 1600×720 via Playwright when available.
- Touch-target ≥ 44 DOM-px verified with dev tools.

---

## Related surfaces

- **TableView** — entry point (session-start flow adds "Prepare for tonight" CTA).
- **SessionsView** — hosts the drill review tab (post-session mode).
- **PlayerPicker** — villain selection delegates to existing picker.
- **Live Exploit Citation (sidebar)** — consumes same `VillainAssumption` substrate; parallel surface. Spec pending (Phase 5 Session 2).
- **PreflopDrillsView / PostflopDrillsView** — sibling drill surfaces (generic fluency). Empty-state CTA deep-links to these when no actionable assumptions exist.

---

## Change log

- 2026-04-23 — Created in Phase 5 of exploit-deviation project. Gate 4 drill surface spec. Incorporates Gate 2 Blind-Spot Roundtable resolutions (Stage C + E) + architecture spec v1.0 constraints. Live citation spec deferred to next session (LSW coordination required).
