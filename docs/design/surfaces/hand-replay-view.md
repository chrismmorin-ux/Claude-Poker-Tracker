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
**Last reviewed:** 2026-05-03 (HSP HandReplay wire — see §"HeroStateSection" + Change log)

---

## Purpose

Immersive, step-through replay of a single recorded hand on a visually-distinct blue-slate felt. Action-by-action navigation with keyboard (arrows / Home / End / Escape), full per-decision analysis overlays, hero coaching copy, and villain-by-villain decision breakdowns. The "read the hand back" surface — slower-paced than live, with context the engine didn't have room to show at the table.

## JTBD served

Primary:
- `JTBD-SR-23` highlight worst-EV spots — via step-through with EV annotations
- `JTBD-SR-25` replay at own pace with range overlay
- `JTBD-SR-26` (partial) flag disagreement — would land here if wired (not yet)
- `JTBD-SR-28` deep-review hand against theoretical ground-truth — via HeroStateSection canonical narrative (added 2026-05-03 by HSP HandReplay wire)
- `JTBD-SR-29` know if theoretical analog exists — HeroStateSection renders or degrades-with-message when no analog (e.g., MULTIWAY archetypes throw upstream)
- `JTBD-CO-54` see own leak without being graded — HeroStateSection canonical-vs-actual side-by-side panels with neutral alignment labels (red line #5)
- `JTBD-CO-55` learn next concept — HeroStateSection narrative body explains canonical reasoning frame
- `JTBD-CO-56` validate prior coaching translates to play improvement — comparing canonical vs actual across replay sessions surfaces improvement trajectories
- (Apprentice) learn from a specific hand with coaching copy

Secondary:
- `JTBD-SR-24` filter context — not directly; entry-side (HandBrowser) handles filtering
- `JTBD-CO-49` annotate streets — proposed; would fit here

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Post-session Chris](../personas/situational/post-session-chris.md) — primary
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
│  ReviewPanel — current decision analysis           │
│   ┌────────────────────────────┐                   │
│   │ HeroCoachingCard (if hero) │                   │
│   │ HeroStateSection (if hero) │                   │
│   │   side-by-side panels:     │                   │
│   │   canonical narrative │    │                   │
│   │   hero's actual action     │                   │
│   │   (collapsible; new 5/3)   │                   │
│   │ VillainAnalysisSection     │                   │
│   │   per villain: decision +  │                   │
│   │   EV + equity + bluff/value│                   │
│   │ Section G — Anchor         │                   │
│   │   Observations (EAL Phase 5)                   │
│   │   (see hand-replay-        │                   │
│   │    observation-capture.md) │                   │
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

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — DCOMP-W2-A1 combined Gate-2 + Gate-4 audit appended. Verdict YELLOW. 12 findings.
- 2026-04-24 — Anatomy diagram updated + Related surfaces list gained `hand-replay-observation-capture` (EAL Gate 4 S3). Section G is a new inline widget inside `ReviewPanel.jsx` below `VillainAnalysisSection`; implementation in Phase 5 of exploit-anchor-library.
- 2026-05-02 — SCF Gate 4 extension appended. Hero-leak inline annotation in `HeroCoachingCard`: per-action ⚑ badge with inline expansion to full CD-5 claim card + `Drill this` / `Dismiss` / `Snooze` affordances. NOT a new ReviewPanel section — woven into existing HeroCoachingCard. Source-util-policy whitelist enforced. Implementation deferred to SCF Gate 5 multi-PR.
- 2026-05-03 — HSP HandReplay wire (WS-143 / SPR-029). New `HeroStateSection` between `HeroCoachingCard` and `VillainAnalysisSection`. Renders side-by-side canonical-vs-actual panels per hero decision point; collapsible; HSP rederives per view (no IDB cache v1). Gate 1 GREEN verdict (`audits/2026-05-03-entry-hero-state-narrative.md`); Gate 2 not required. JTBDs served list grew: added CO-54, CO-55, CO-56, SR-28, SR-29. Closes the HSP build (SPR-024..SPR-027) and unblocks WS-013 (SCF G5 leak-rule wiring) which uses HSP narrative as canonical baseline.
- 2026-05-03 — SCF G5 Drill-this end-to-end (WS-147 / SPR-032). `ReviewPanel.onDrillLeak` upgraded from `console.log` stub to `openLessonDetail(leak.relatedConceptId)` via UIContext, navigating to new `LessonDetailView` (`SCREEN.LESSON_DETAIL`). Closes the HeroCoachingCard hero-leak badge wiring shipped in SPR-031: tap on ⚑ badge → expand CD-5 claim card → tap Drill this → lesson opens with Exposition + Worked Example + Success Criteria. v1 ships 2 reference lessons (`001-cbet-defense.md` for `hero-ip-cbet-overfold`; `002-bb-defense.md` for `hero-bb-defense-width`); future leak rules add lessons under `docs/projects/self-coach-foundation/lessons/`. Lesson framework details in `lesson-authoring-template.md` (SPR-020); lesson registry at `src/utils/skillAssessment/lessonRegistry.js`.
