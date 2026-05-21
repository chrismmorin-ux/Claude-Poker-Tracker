# Surface — Hand Replay View

**ID:** `hand-replay-view`
**Code paths:**
- `src/components/views/HandReplayView/HandReplayView.jsx` (345 lines — replay felt + stepper)
- `./ReviewPanel.jsx` (218 lines — per-step analysis details)
- `./HeroCoachingCard.jsx` (112 lines — hero-facing coaching copy)
- `./VillainAnalysisSection.jsx` (386 lines — villain-by-villain decision breakdown)
- `src/hooks/useHandReview.js`, `./useHandReplayAnalysis.js`, `./useReplayState.js`
- `src/utils/handAnalysis/handTimeline.js` — `buildTimeline`, `buildSeatNameMap`
- `src/utils/persistence/index.js` — `loadHandById`
- Shared from TableView: `SEAT_POSITIONS`, `CardSlot`, `LAYOUT`

**Route / entry points:**
- `SCREEN.HAND_REPLAY` (routed via `uiReducer`; UI state carries `replayHandId` or full `replayHand`).
- Opens from: `analysis-view` → Hand Review → "Open Immersive Replay"; `sessions-view` → SessionCard → per-hand drill-in; `hand-replay-view` itself can navigate to another via linked hands.
- Closes to: `SCREEN.HISTORY` (the list view context the user came from) via Back or Escape.

**Product line:** Main app
**Tier placement:** Plus+ (replay with analysis). Decision-tree visualization (F-W5 orphaned) would belong adjacent but is not currently routed.
**Last reviewed:** 2026-05-19 (PSD Gate 4 wire — per-step overflow menu added; see §"PSD review-mode entry-point wire" + Change log)

---

## Purpose

Immersive, step-through replay of a single recorded hand on a visually-distinct blue-slate felt. Action-by-action navigation with keyboard (arrows / Home / End / Escape), full per-decision analysis overlays, hero coaching copy, and villain-by-villain decision breakdowns. The "read the hand back" surface — slower-paced than live, with context the engine didn't have room to show at the table.

## JTBD served

Primary:
- `JTBD-SR-23` highlight worst-EV spots — via step-through with EV annotations
- `JTBD-SR-25` replay at own pace with range overlay
- `JTBD-SR-26` (partial) flag disagreement — would land here if wired (not yet)
- `JTBD-SE-02` review drill predictions against session outcomes — partial coverage via the per-step overflow `Queue for tomorrow's PSD` (PSD Gate 4 wire, 2026-05-19). The producer half of the prep ↔ session ↔ review loop: HandReplay is where the user flags a spot worth drilling tomorrow; the consumer half is `postflop-drills` Pre-Session mode.
- `JTBD-SR-28` deep-review hand against theoretical ground-truth — via HeroStateSection canonical narrative (added 2026-05-03 by HSP HandReplay wire) AND via HRP ledger-link chip → hand-review-modal (2026-05-17 by HRP Gate 4 wire)
- `JTBD-SR-29` know if theoretical analog exists — HeroStateSection renders or degrades-with-message when no analog (e.g., MULTIWAY archetypes throw upstream); HRP ledger-link chip surfaces strong/partial/no-analog match-confidence per decision
- `JTBD-SR-30` see the counterfactual EV tree for a past decision — HRP Gate 4 wire surfaces `gameTreeEvaluator.js` depth-2/3 output in the Counterfactual Tree modal tab (2026-05-17)
- `JTBD-SR-31` (partial) flag-queue surfacing — HRP Gate 4 wire opens hand-review-modal at the first flagged decision when a flagged hand opens (2026-05-17)
- `JTBD-CO-54` see own leak without being graded — HeroStateSection canonical-vs-actual side-by-side panels with neutral alignment labels (red line #5)
- `JTBD-CO-55` learn next concept — HeroStateSection narrative body explains canonical reasoning frame
- `JTBD-CO-56` validate prior coaching translates to play improvement — comparing canonical vs actual across replay sessions surfaces improvement trajectories
- (Apprentice) learn from a specific hand with coaching copy

Secondary:
- `JTBD-SR-24` filter context — not directly; entry-side (HandBrowser) handles filtering
- `JTBD-CO-49` annotate streets — proposed; would fit here

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Post-session Chris](../personas/situational/post-session-chris.md) — primary
- [Pre-Session preparer](../personas/situational/presession-preparer.md) — primary for the per-step `Queue for tomorrow's PSD` overflow-menu affordance (PSD Gate 4 wire, 2026-05-19). Sibling of `post-session-chris` per Gate 3 A-R1: HandReplay supports both — post-session general review (`post-session-chris`) AND the drill-flag loop closure (`presession-preparer` review-mode-feeder).
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — heavy review users
- [Apprentice](../personas/core/apprentice-student.md), [Study block](../personas/situational/study-block.md) — primary target of HeroCoachingCard
- [Coach](../personas/core/coach.md), [Coach review session](../personas/situational/coach-review-session.md) — step-through with student
- [Online MTT Shark](../personas/core/online-mtt-shark.md), [Multi-Tabler](../personas/core/multi-tabler.md) — post-session hand review

---

## Anatomy

```
┌────────────────────────────────────────────────────┐
│ [← Back]  Hand Replay                     (Esc key)│
├────────────────────────────────────────────────────┤
│             ┌─── blue-slate felt ───┐              │
│             │  seats w/ avatars     │              │
│             │  community cards      │              │
│             │  hero hole cards      │              │
│             │  pot + street label   │              │
│             │  current action arrow │              │
│             └───────────────────────┘              │
│                                                    │
│  [◀ Home]  [◀ step]  [▶ step]  [End ▶]             │
│                                                    │
│  ReviewPanel — current decision analysis        ⋮  │ ← per-step overflow
│   ┌────────────────────────────┐                   │
│   │ HeroCoachingCard (if hero) │                   │
│   │ HeroStateSection (if hero) │                   │
│   │   side-by-side panels:     │                   │
│   │   canonical narrative │    │                   │
│   │   hero's actual action     │                   │
│   │   (collapsible; new 5/3)   │                   │
│   │ HRP ledger-link chip       │                   │
│   │   📖 spot · match badge[L] │                   │
│   │   → hand-review-modal      │                   │
│   │   (HRP Gate 4, SPR-085)    │                   │
│   │ VillainAnalysisSection     │                   │
│   │   per villain: decision +  │                   │
│   │   EV + equity + bluff/value│                   │
│   │ Section G — Anchor         │                   │
│   │   Observations (EAL Phase 5)                   │
│   │   (see hand-replay-        │                   │
│   │    observation-capture.md) │                   │
│   └────────────────────────────┘                   │
│                                                    │
│   Per-step overflow menu (⋮) — PSD Gate 4 wire     │
│   ┌────────────────────────────┐                   │
│   │ Open in HandReview…        │                   │
│   │ Open in HRP modal     [L]  │                   │
│   │ Queue for tomorrow's PSD   │ ← NEW (2026-05-19)│
│   └────────────────────────────┘                   │
└────────────────────────────────────────────────────┘
```

## State

- **UI (`useUI`):** `replayHandId`, `replayHand` (the hand can be passed in-memory to avoid an IDB roundtrip), `setCurrentScreen`.
- **Player (`usePlayer`):** `allPlayers` — name lookup per seat at replay time.
- **Tendency (`useTendency`):** `tendencyMap` — fed to analysis so each action gets player-specific context.
- **Local:**
  - `hand` — loaded from `loadHandById(replayHandId)` if not passed directly.
  - `loading` — initial-load flag.
  - `timeline` — `buildTimeline(hand)` memoized.
  - `actionAnalysis` — `useHandReplayAnalysis(hand, timeline, tendencyMap)` output.
  - `replay` — `useReplayState(timeline, hand, actionAnalysis)` — step cursor + derived state per step.
- Writes: none — replay is read-only. (Flagging / annotations would add writes; not yet wired.)

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Step forward / back** — arrow keys or on-screen buttons → `replay.stepForward / stepBack` advances the cursor, re-renders felt + ReviewPanel.
2. **Jump to start / end** — `Home` / `End` keys → `replay.jumpToStart / jumpToEnd`.
3. **Escape** — back to caller (usually `SCREEN.HISTORY`).
4. **Click an action in timeline** (if surfaced) → jump to that step.
5. **HeroCoachingCard interactions** — expand for reasoning; links to concept references when tagged.

---

## Known behavior notes

- **Dual-source loading:** `replayHand` in UI state → in-memory, skip IDB; otherwise `loadHandById(replayHandId)`. Handles browser refresh + deep-link cases.
- **Visual differentiation from TableView** — blue-slate felt tones; identical seat geometry (reuses `SEAT_POSITIONS`). Prevents "did I forget I was replaying?" confusion.
- **Keyboard hooks use refs** to avoid effect churn per step (documented in source comment).
- **VillainAnalysisSection at 386 LOC** — densest sub-panel; decomposition candidate if Wave 2 audit flags it.
- **Analysis is async** — `isComputing` on `useHandReplayAnalysis`; UI should guard for partial state.
- **`SCREEN.HISTORY` is the back target** — implies a hand-history list surface; today that is the analysis Hand Review tab or the session hand-list; ambiguity is a candidate audit finding.

---

## HeroStateSection (HSP HandReplay wire, 2026-05-03)

**Added by:** WS-143 / SPR-029. See `audits/2026-05-03-entry-hero-state-narrative.md` for the Gate 1 GREEN verdict + scope analysis.

**What this adds.** A new `HeroStateSection` renders in the ReviewPanel between `HeroCoachingCard` (line 191) and `VillainAnalysisSection` (line 194). Active only when the current step is a hero action (`currentActionEntry.seat === heroSeat`). When active, it renders the canonical reasoning frame produced by `src/utils/heroState/buildHeroState.js` (shipped WS-142, SPR-027) side-by-side with hero's actual action.

**Visual treatment.**

```
+------------------+ +------------------+
| Reasoning Frame  | | Your action      |
| BET 2.5bb        | | BET 2.5bb        |
| Standard open;   | | (aligned)        |
| range advantage; | |                  |
| dominate BTN     | | sizing rationale |
| flatting range   | | matches canon    |
| …narrative…      | |                  |
+------------------+ +------------------+
```

The HeroStateSection wraps both panels in a single `bg-indigo-900/30` border-rounded container with a `Reasoning Frame` header (collapsible chevron). Default expanded for hero actions.

**Distinct from hero-leak inline annotation (§"Hero-leak inline annotation").** Hero-leak annotation fires only when a leak rule matches (n≥30 + severity threshold) and renders inside `HeroCoachingCard`. HSP narrative renders for every hero decision point as the always-present canonical baseline. SCF Gate 5 leak-rule wiring (WS-013) will use the rendered HeroState as its canonical baseline — they coexist; HSP narrative does NOT replace hero-leak annotation.

**State.**
- HSP rederives via `buildHeroState()` per decision-point view (no IDB cache for v1 per HSP-DESIGN.md §10.2 caching deferral).
- Async with loading state; renders "Computing…" while pending.
- Soft-degrades when villain data unavailable: panel renders with available fields + "No reasoning frame available" message if everything degrades. Caller (ReviewPanel) does not need to gate on villain data.

**Anti-pattern + autonomy compliance:**
- Red line #5 (no shame / engagement-pressure): alignment labels are neutral editor's-note tone ("aligned", "deviation"). No "wrong" / "missed" / score / streak / engagement-pressure copy ships in default rendered output. Lint-style test enforces.
- Red line #8 (no cross-surface contamination): HSP narrative renders ONLY inside `src/components/views/HandReplayView/`. Live-table surfaces (`OnlineView`, `TableView`, sidebar HUD, `TournamentView`, `ShowdownView`) are out of scope for WS-143.

**Key interactions:**
- Section is collapsible; toggle persists for current replay session (not across sessions).
- Re-renders when `currentActionEntry` changes (different decision point).
- Renders nothing on villain-action steps.

---

## HRP review-modal integration (HRP Gate 4 wire, 2026-05-17, SPR-085 / WS-067)

**Added by:** WS-067 / SPR-085 (HRP Phase 3 Gate 4 surface specs). See `docs/design/surfaces/hand-review-modal.md` for the full new-surface spec.

**What this adds.** A ledger-link icon renders next to each hero-decision-point card in `ReviewPanel.jsx` when the HRP spot-resolver (Stream E `spotResolver/` module, Phase 4) returns a strong-or-partial match against the theoretical corpus (upper-surface artifacts + LSW line nodes). Tapping the icon (or pressing `L` while the cursor is on that decision) opens the `HandReviewModal` overlay with the linked artifact's claims ledger + counterfactual EV tree + drill card + full artifact rendered in five tabs.

The modal is HRP's depth surface — `hand-replay-view` is the entry point but does not itself render the ledger inline (per HRP Gate 2 Stage-C rule 1: "Ledger render = modal overlay, NOT inline. ReviewPanel is already dense at 386 LOC; adding 60-row ledgers breaks the surface").

**Visual treatment.**

```
ReviewPanel — current decision analysis
┌──────────────────────────────────────────────────┐
│ HeroCoachingCard (if hero)                       │
│   ⚑ leak: IP cbet defense overfold pattern       │
│ HeroStateSection (if hero)                       │
│   side-by-side canonical-vs-actual panels        │
│ [📖 BTN vs BB 3BP IP wet — strong match] [L key] │  ← NEW (HRP ledger-link)
│ VillainAnalysisSection                           │
│   per villain: decision + EV + equity            │
│ Section G — Anchor Observations (EAL Phase 5)    │
└──────────────────────────────────────────────────┘
```

The ledger-link icon renders as a single-row chip between `HeroStateSection` and `VillainAnalysisSection`. Chip content:
- Theory-link icon (📖)
- Short spot description (extracted from the matched artifact's title or spot-key shorthand)
- Match-confidence badge: `strong` (green), `partial` (yellow with one-line reason), `no analog` (gray, disabled — see below)
- `[L]` keyboard-shortcut hint

**Match-confidence states:**
- **Strong match** — chip is clickable; tap or `L` key opens modal at Summary tab.
- **Partial match — <reason>** — chip is clickable; reason is one phrase ("stack depth differs", "pot type differs", etc.). Modal opens at Summary tab with the reason elevated in the match-confidence header.
- **No analog** — chip renders disabled (gray, non-clickable) with tooltip "No theoretical analog for this spot." Per HRP Gate 2 Stage-C rule 4: empty-state clicks are misleading, so the disabled state is the right empty-state UX. The chip does NOT disappear (its presence communicates "we looked; nothing found") but it does not afford the click.

**Keyboard shortcut.** `L` opens the modal for the current cursor's decision when the spot-resolver returns a strong or partial match. `L` is a no-op when no analog exists (with a brief visual cue that no modal will open — e.g., chip flashes). Per HRP project doc Gate 4 acceptance criteria.

**State integration.**
- Reads from a new `useSpotResolver(hand, decisionIndex)` hook (planned at Stream E Phase 4 — `src/hooks/useSpotResolver.js`). Returns `SpotMatch | null` where `SpotMatch = { confidence: 'strong' | 'partial' | 'no-analog', artifactId, reason?, ... }`.
- Memoized per decision-index — the chip re-resolves only when `currentActionEntry` changes.
- No write path on chip render. Opening the modal triggers a `hand.reviewState` update (see `hand-review-modal.md` §Schema additions).

**Anti-pattern compliance:**
- Red line #5 (no shame / engagement-pressure): chip text is neutral — spot description + match confidence are factual labels. No "this is a missed lesson" or "you should have learned this" copy.
- Red line #8 (no cross-surface contamination): ledger-link chip renders ONLY inside `HandReplayView/ReviewPanel.jsx`. Live-table surfaces (TableView, OnlineView, sidebar) are out of scope for HRP per the project's narrow-scope decision.
- Red line #9 (mastery never displayed as a score): match confidence is per-spot, not per-user. The chip does not aggregate match accuracy across hero's review history.

**Cross-reference:** Full modal spec at `docs/design/surfaces/hand-review-modal.md` (Surface ID: `hand-review-modal`). Includes the AssumptionCard component contract authored at this gate (HRP wins first-author per the cross-project rule; exploit-deviation Phase 7+ consumes via `variant='compact'`).

**Key interactions:**
- Click chip OR press `L` (only when match is strong/partial) → opens modal at Summary tab.
- Chip is per-decision; modal navigation (`[` / `]`) inside the modal updates the chip when the user closes the modal.

---

## Hero-leak inline annotation (SCF Gate 4 extension, 2026-05-02)

**Added by:** SCF Gate 4 (WS-012 / SPR-020). See `audits/2026-05-02-gate4-design-self-coach-foundation.md` §SCF-G4-S2 for the full spec.

**What this adds.** When the current step's hero action matches a fired hero-leak detector rule (n≥30 sample size on the situation key + severity threshold met), `HeroCoachingCard` renders an additional ⚑ badge under the action label. Tap toggles inline expansion to a full CD-5 claim card with `Drill this` / `Dismiss` / `Snooze` affordances.

This is NOT a new ReviewPanel section. Annotations weave inline into the action timeline within the existing `HeroCoachingCard` (per Decision 2: "Inline badge under action label, tap expands inline" — chosen for lowest visual weight + mirroring the existing action-tag pattern).

**Visual treatment.**

```
Street: Flop  Pot: $42  K72r

  Hero (BTN): cbet 60% pot
     ⚑ leak: IP cbet defense overfold pattern   ▶ tap

  ▼ EXPANDED:
  ┌──────────────────────────────────────────┐
  │ Hero IP cbet defense — fold-to-cbet rate │
  │ 52% [38%, 66%] over 30 hands              │
  │ Solver baseline: 38%                      │
  │ Sample threshold: 30 hands                │
  │ Related drill: cbet-defense               │
  │ [ Drill this ]   [ Dismiss ]   [ Snooze ] │
  └──────────────────────────────────────────┘

  Villain (CO): call
```

**Per-action gating logic.** Badge fires when ALL of: (a) hero action at this timeline step matches a hero-leak detector rule's situation key; (b) sample size ≥ 30 (per AP-SCF-04 floor); (c) severity exceeds rule-defined threshold (Gate 5 implementation detail; default proposal: severity > 0.3 + CI-lower deviation > 5pp from solver baseline).

Multiple leak rules may fire on the same action — render each as a separate badge under the action label.

**Affordance behaviors:**
- `Drill this` — navigates to SelfCoachView Curriculum section, scrolls to + highlights the lesson card matching the leak's `relatedConceptId`.
- `Dismiss` — collapses badge for current HRV session only; does NOT suppress future hand-replay reviews on the same situation key.
- `Snooze` — suppresses leak annotations for the situation key for 7 days from `snoozedAt`. Persisted in `heroLeaks[situationKey].snoozedUntil`. Owner can clear in SelfCoachView Hero leaks section.

**Source-util-policy whitelist.** HRV review-mode reads `heroLeaks` IDB store. CI-grep enforcement at Gate 5 (SCF-G4-SUP). Live `OnlineView`, sidebar HUD, `TableView`, `TournamentView`, `ShowdownView` blacklisted (per AP-SCF-02).

**Anti-pattern + copy-discipline + 9 red lines compliance:** see Gate 4 audit doc §SCF-G4-S2 walkthroughs. All cells: compliant.

---

## Known issues

- **DCOMP-W2-A1 audit shipped 2026-04-22 (verdict YELLOW).** 12 findings: 0 P0, 3 P1 (F1 Back context-aware routing + ≥44×44, F2 significance badge, F3 flag+annotate SR-26/CO-49), 5 P2 + 4 P3. Back-target routing resolved: always `SCREEN.HISTORY` → `<AnalysisView initialTab="review" />`, but hardcoded regardless of entry (Sessions-entry users disoriented). `DecisionTreeView.jsx` orphan status rediscovered (points to existing `2026-04-21-decision-tree-fate` discovery). VillainAnalysisSection 386 LOC density flagged for decomposition. Full audit: `../audits/2026-04-22-blindspot-hand-replay-view.md`.
- Wave 2 audit COMPLETE for hand-replay-view. Analysis + stats audits queued.

## Potentially missing

- **Hand Significance / Importance** (F-W4) — module exists in `handAnalysis` but no UI. Natural home is this surface's header.
- **Decision Tree Visualization** (F-W5) — `DecisionTreeView.jsx` is orphaned; could be folded into ReviewPanel or as a tab here.
- **Annotate streets** (CO-49) — voice/text annotation; proposed.
- **Shareable replay link** (SR-27) — proposed.
- **Flag disagreement with reasoning** (SR-26) — proposed; this surface is the natural capture point.

---

## Test coverage

- `useReplayState`, `useHandReplayAnalysis`, `handTimeline` are unit-tested.
- Component-level tests exist for ReviewPanel / HeroCoachingCard / VillainAnalysisSection.
- No dedicated end-to-end test for the keyboard stepper.

## Related surfaces

- `analysis-view` — primary entry (Hand Review tab).
- `sessions-view` — secondary entry via SessionCard.
- `table-view` — source of the recorded hand (via ShowdownView commit).
- `showdown-view` — the record-committing surface whose output this replays.
- `hand-replay-observation-capture` — Section G inline capture widget (EAL Phase 5). Adds Tier 0 observation-tagging affordance to `ReviewPanel.jsx` below `VillainAnalysisSection`.
- `leak-distillation` — pipeline UI (SCF Phase 5). HRV inline hero-leak annotation is one of the two surface presentations of the leak-distillation pipeline (the other is SelfCoachView Hero leaks section).
- `self-coach-view` — `Drill this` affordance on expanded leak claim card deep-links to SelfCoachView Curriculum section.
- `hand-review-modal` — HRP Gate 4 deep-surface (2026-05-17). HRV ledger-link chip is the entry; the modal renders claims ledger + counterfactual tree + drill card + full artifact in a 5-tab overlay.
- `postflop-drills` (Pre-Session mode) — added 2026-05-19. The per-step `Queue for tomorrow's PSD` overflow-menu option flags the current decision's anchor-node for inclusion in the next `presession-preparer` prep session. HandReplay is the producer surface; Pre-Session mode is the consumer surface that drills the flagged spot.

---

## PSD review-mode entry-point wire (PSD Gate 4 wire, 2026-05-19, SPR-092 / WS-199)

**Added by:** WS-199 / SPR-092. See `docs/design/surfaces/postflop-drills.md` § Pre-Session mode for the full destination spec.

**What this adds.** A per-step overflow menu (`⋮`) on `ReviewPanel.jsx`, rendered in the panel header near the decision title. The menu surfaces three options today:

1. `Open in HandReview…` — existing affordance reorganized into the menu (previously a separate button on the analysis-view side; HandReplay surfaces it here as a shortcut).
2. `Open in HRP modal` `[L]` — existing HRP ledger-link entry, mirrored into the overflow for discoverability. Tapping has identical behavior to the inline chip.
3. **`Queue for tomorrow's PSD`** — NEW. Flags the current decision's anchor-node-ID into the user's "queued spots" set for the next prep-mode Pre-Session session. Does NOT navigate. Confirmation: toast "Queued for next Pre-Session Drill" with Undo.

The overflow-menu pattern is new to HandReplay; precedent surfaces (e.g., `seat-context-menu`) use kebab/dot-dot-dot menus for low-frequency per-row actions. PSD Gate 4 reuses that pattern at the per-step granularity.

### Why an overflow menu, not an inline button

The decision was elicited at WS-199 plan-mode (2026-05-19): inline button would compete with the ReviewPanel's already-dense chrome (HeroCoachingCard, HeroStateSection, HRP ledger-link chip, VillainAnalysisSection, Section G — Anchor Observations). The overflow menu defers visibility cost — the affordance is *available* on every step but doesn't add chrome until tapped. This trades discoverability for chrome budget; the entry-discoverability cost is offset because:

- The primary discovery surface for PSD is the inline `Pre-Session Drill` button on `sessions-view` (visible every session start). Users learn PSD exists via that button.
- The HandReplay queue-affordance is for users who already know PSD and want to *flag a spot they're reviewing*. They're motivated to find the affordance; one menu-tap latency is acceptable.

### Visual treatment

```
ReviewPanel header (per step)
┌──────────────────────────────────────────────────┐
│ Decision: BET 2.5bb on K♣7♦2♥ flop         ⋮     │
│   ─ EV: +0.4bb · Match: STRONG ─                 │
└──────────────────────────────────────────────────┘
                                            │
                                            ▼ on tap
                        ┌──────────────────────────────────┐
                        │ Open in HandReview…              │
                        │ Open in HRP modal           [L]  │
                        │ ──────────────────────────────── │
                        │ 📌 Queue for tomorrow's PSD       │
                        └──────────────────────────────────┘
```

Menu dismiss: tap outside / `Escape`. Selection: tap an item.

### Behavior — `Queue for tomorrow's PSD`

1. Resolve the current step's anchor-node-ID via the HRP spot-resolver (Stream E `spotResolver/`). If the step has a strong-or-partial artifact match, the queue write captures the resolved node-ID. If the spot-resolver returns no-analog, the menu item renders **disabled** with explanatory tooltip ("This spot has no theoretical analog yet — nothing to drill on for PSD").
2. Append the resolved node-ID to `userSettings.psdQueuedSpots[]` (additive IDB write; survives the replay session). De-dupe: if the same node-ID is already queued, increment a `queuedAtCount` rather than appending a second row.
3. Show toast: `Queued for next Pre-Session Drill` with `Undo` action (5 s dismiss). Undo reverses the IDB write.
4. Menu closes.

### How PSD consumes the queue

Per `postflop-drills.md` § Pre-Session mode selection algorithm: when a prep-mode session opens, the selection layer prepends any `psdQueuedSpots[]` entries to the candidate set (within time-budget capacity), then fills remaining capacity with recency × frequency × mood scoring against the full corpus. Queued spots are consumed (removed from the queue) when they appear on a drilled card in either prep or review mode. Spots that never get drawn (e.g., user queued 20 spots, runs only 5-card 5-min variant tomorrow) stay in the queue across sessions until consumed.

### State

`ReviewPanel.jsx` gains:
- `menuOpen` — local state for the overflow menu visibility.
- `spotResolverResult` — already computed for the HRP ledger-link chip; re-used here to determine menu-item enabled/disabled state.
- New handler `onQueueForPSD()` — invokes `psdQueueWriter.appendSpot(nodeId)` (new util) + dispatches toast.

No new HandReplayView-level state; the queue write goes straight to IDB.

### Anti-pattern + autonomy compliance

- **Red line #5 (no shame / engagement-pressure):** menu item label is neutral factual verb ("Queue") — not motivational, not framed as a study-prescription. Toast copy stays factual ("Queued for next Pre-Session Drill"), no emotional inflation.
- **Red line #8 (no cross-surface contamination):** the queue writer affects only `userSettings.psdQueuedSpots[]` (PSD scope); no writes to leak-detection / HSP / SCF stores. The queued-spots field is read only by the Pre-Session selection layer.
- **No streak / badge / "you've queued N spots!" surface:** the queue is a passive data structure — no UI surfaces queue-depth as a score or motivational metric. Per A-AP1 binding inherited from `postflop-drills.md` Pre-Session mode spec.

### Key interactions (PSD wire)

1. **Open overflow** — tap `⋮` in ReviewPanel header → menu appears.
2. **Queue for PSD** — tap menu item → IDB write + toast + menu closes.
3. **Undo queue** — tap `Undo` in toast within 5s → IDB write reverted; toast updates to "Removed from queue".
4. **Disabled state** — when current step has no-analog match, menu item is disabled with tooltip; tap does nothing.

### Test-coverage expectations (Gate 5 scope)

- Menu open/close (tap-outside dismiss, Escape dismiss).
- Queue-write IDB integration test: append, de-dupe by node-ID, increment `queuedAtCount` on duplicate.
- Undo: appendSpot followed by removeSpot within 5s window leaves IDB in original state.
- Disabled state: render menu with no-analog spot-resolver result → assert menu item disabled.
- Cross-surface: PSD prep-mode selection consumes `psdQueuedSpots[]` → assert spot removed from queue post-draw + assert undrawn spots persist across sessions.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — DCOMP-W2-A1 combined Gate-2 + Gate-4 audit appended. Verdict YELLOW. 12 findings.
- 2026-04-24 — Anatomy diagram updated + Related surfaces list gained `hand-replay-observation-capture` (EAL Gate 4 S3). Section G is a new inline widget inside `ReviewPanel.jsx` below `VillainAnalysisSection`; implementation in Phase 5 of exploit-anchor-library.
- 2026-05-02 — SCF Gate 4 extension appended. Hero-leak inline annotation in `HeroCoachingCard`: per-action ⚑ badge with inline expansion to full CD-5 claim card + `Drill this` / `Dismiss` / `Snooze` affordances. NOT a new ReviewPanel section — woven into existing HeroCoachingCard. Source-util-policy whitelist enforced. Implementation deferred to SCF Gate 5 multi-PR.
- 2026-05-03 — HSP HandReplay wire (WS-143 / SPR-029). New `HeroStateSection` between `HeroCoachingCard` and `VillainAnalysisSection`. Renders side-by-side canonical-vs-actual panels per hero decision point; collapsible; HSP rederives per view (no IDB cache v1). Gate 1 GREEN verdict (`audits/2026-05-03-entry-hero-state-narrative.md`); Gate 2 not required. JTBDs served list grew: added CO-54, CO-55, CO-56, SR-28, SR-29. Closes the HSP build (SPR-024..SPR-027) and unblocks WS-013 (SCF G5 leak-rule wiring) which uses HSP narrative as canonical baseline.
- 2026-05-03 — SCF G5 Drill-this end-to-end (WS-147 / SPR-032). `ReviewPanel.onDrillLeak` upgraded from `console.log` stub to `openLessonDetail(leak.relatedConceptId)` via UIContext, navigating to new `LessonDetailView` (`SCREEN.LESSON_DETAIL`). Closes the HeroCoachingCard hero-leak badge wiring shipped in SPR-031: tap on ⚑ badge → expand CD-5 claim card → tap Drill this → lesson opens with Exposition + Worked Example + Success Criteria. v1 ships 2 reference lessons (`001-cbet-defense.md` for `hero-ip-cbet-overfold`; `002-bb-defense.md` for `hero-bb-defense-width`); future leak rules add lessons under `docs/projects/self-coach-foundation/lessons/`. Lesson framework details in `lesson-authoring-template.md` (SPR-020); lesson registry at `src/utils/skillAssessment/lessonRegistry.js`.
- 2026-05-17 — HRP Gate 4 wire (WS-067 / SPR-085). New "HRP review-modal integration" section appended. Adds ReviewPanel ledger-link chip between `HeroStateSection` and `VillainAnalysisSection` — per-decision chip surfaces spot-resolver match-confidence (strong / partial / no-analog) with `L` keyboard shortcut to open the new `hand-review-modal` overlay. Anatomy diagram updated. JTBDs served list grew: SR-30 (counterfactual EV tree), SR-31 (partial — flag queue surfacing). Spec-only: no code (HRP Phase 3 is documentation-only). Stream E + Stream U code unblocked by this gate. AssumptionCard component contract authored in `hand-review-modal.md` per the cross-project first-author rule (exploit-deviation Phase 7+ will consume via `variant='compact'`).
- 2026-05-19 — **PSD Gate 4 wire** (WS-199 / SPR-092). New "PSD review-mode entry-point wire" section appended. Adds per-step overflow menu (`⋮`) on `ReviewPanel.jsx` with three options: `Open in HandReview…` (reorganized existing affordance), `Open in HRP modal` `[L]` (mirrored from inline chip), and **`Queue for tomorrow's PSD`** (NEW — flags decision's anchor-node-ID into `userSettings.psdQueuedSpots[]` for next prep-mode session). Disabled state for no-analog spots. Toast with Undo. Anatomy diagram updated. JTBDs served list extended: SE-02 partial (review drill predictions vs session outcomes — HandReplay is the producer half of the prep ↔ session ↔ review loop). Personas list extended with `presession-preparer` (sibling of `post-session-chris` per Gate 3 A-R1). Related surfaces gains `postflop-drills (Pre-Session mode)`. Spec-only — Gate 5 implementation deferred. Companion to `postflop-drills.md` § Pre-Session mode + `sessions-view.md` inline `Pre-Session Drill` button.
