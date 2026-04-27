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
**Last reviewed:** 2026-04-21

---

## Purpose

Immersive, step-through replay of a single recorded hand on a visually-distinct blue-slate felt. Action-by-action navigation with keyboard (arrows / Home / End / Escape), full per-decision analysis overlays, hero coaching copy, and villain-by-villain decision breakdowns. The "read the hand back" surface — slower-paced than live, with context the engine didn't have room to show at the table.

## JTBD served

Primary:
- `JTBD-SR-23` highlight worst-EV spots — via step-through with EV annotations
- `JTBD-SR-25` replay at own pace with range overlay
- `JTBD-SR-26` (partial) flag disagreement — would land here if wired (not yet)
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

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — DCOMP-W2-A1 combined Gate-2 + Gate-4 audit appended. Verdict YELLOW. 12 findings.
- 2026-04-24 — Anatomy diagram updated + Related surfaces list gained `hand-replay-observation-capture` (EAL Gate 4 S3). Section G is a new inline widget inside `ReviewPanel.jsx` below `VillainAnalysisSection`; implementation in Phase 5 of exploit-anchor-library.
