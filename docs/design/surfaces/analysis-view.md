# Surface — Analysis View

**ID:** `analysis-view`
**Code paths:**
- `src/components/views/AnalysisView/index.jsx` (51 lines — tab orchestrator)
- `./PlayerAnalysisPanel.jsx` (516 lines — per-player deep dive; weaknesses + villain profile + range profile)
- `./HandReviewPanel.jsx` (155 lines — hand browser + review orchestrator)
- `./HandBrowser.jsx` (242 lines — list of recorded hands with filters)
- `./HandWalkthrough.jsx` (166 lines — action-by-action step-through with analysis overlays)
- `./ReviewObservations.jsx` (225 lines — per-action observation cards: SegmentationBar, EquityBar, EVBadge, ActionClassBadge)
- `src/hooks/useHandReplayAnalysis.js`, `src/utils/handAnalysis/*` — analysis pipeline

**Route / entry points:**
- `SCREEN.ANALYSIS`.
- Opens from: bottom-nav / menu; deep-links from SessionCard, Stats, Players (with an `initialTab`).
- Closes to: `TableView` via "Back to Table". Routes to `hand-replay-view` for immersive replay.

**Product line:** Main app
**Tier placement:** Plus+ (player analysis + hand review). Villain-profile depth is Pro+. Coach / Apprentice workflows touch this surface.
**Last reviewed:** 2026-04-21

---

## Purpose

The post-hand / between-sessions investigation surface. Two tabs:
1. **Player Analysis** — single-player deep dive: Bayesian tendency summary, detected weaknesses grouped by severity, villain profile headline, range profile visualization.
2. **Hand Review** — browse recorded hands, step through actions, read per-decision observations (equity, EV, action-class, segmentation), and pivot into full immersive replay.

Both tabs share the same analysis pipeline as the live engine; this view surfaces the learnings that don't fit on the live table.

## JTBD served

Primary:
- `JTBD-SR-23` highlight worst-EV spots
- `JTBD-SR-24` filter hands by street / position / opponent-style (HandBrowser filters)
- `JTBD-SR-25` replay at own pace with range overlay (entry to `hand-replay-view`)
- `JTBD-SR-88` (partial) similar-spot search across history — currently per-player, not cross-player
- (Coach) understand a specific villain's patterns across many hands
- (Student) see correctness labels on past decisions with reasoning

Secondary:
- `JTBD-MH-03` bluff-catch frequency (read context, not decide)
- `JTBD-SR-26` flag disagreement — not yet wired
- `JTBD-SR-27` shareable replay link — not yet wired

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Post-session Chris](../personas/situational/post-session-chris.md) — primary
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — heavy users; primary consumers of villain profiles
- [Apprentice](../personas/core/apprentice-student.md) — hand-review tab for guided learning
- [Coach](../personas/core/coach.md), [Coach review session](../personas/situational/coach-review-session.md) — both tabs; depth here partially serves CO-48..53 (though dedicated coach dashboard F-P07 is Studio tier)
- [Multi-Tabler](../personas/core/multi-tabler.md), [Online MTT Shark](../personas/core/online-mtt-shark.md) — player-analysis tab for villain tagging post-session

---

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ Analysis   [Player Analysis] [Hand Review]  [Back]   │
├──────────────────────────────────────────────────────┤
│ TAB: Player Analysis                                 │
│   PlayerAnalysisPanel                                │
│   ┌────────────────────────────┐ ┌────────────────┐  │
│   │ Player picker / seat tabs  │ │ Villain profile│  │
│   │ Tendency summary (VPIP/PFR)│ │ headline card  │  │
│   │ Weaknesses (grouped, sev)  │ ├────────────────┤  │
│   │ Range profile + grid       │ │ Recommendations│  │
│   │ Hand examples per weakness │ │ (collapsible)  │  │
│   └────────────────────────────┘ └────────────────┘  │
│                                                      │
│ TAB: Hand Review                                     │
│   HandBrowser (filters + list)                       │
│     ↓ select hand                                    │
│   HandWalkthrough (action-by-action)                 │
│     ├── ReviewObservations (per-action cards)        │
│     └── [Open Immersive Replay] → hand-replay-view   │
└──────────────────────────────────────────────────────┘
```

## State

- **UI (`useUI`):** `setCurrentScreen`, `SCREEN`.
- **Player (`usePlayer`):** `allPlayers`, `seatPlayers`.
- **Tendency (`useTendency`):** `tendencyMap` — Bayesian stats + weaknesses + range profile per player.
- **Session (`useSession`):** `currentSession`, `allSessions` (for HandBrowser scope).
- **Analysis hooks:** `useHandReplayAnalysis(hand, timeline, tendencyMap)` → per-decision analysis.
- **Local (tab-level):** `activeTab`, and within each panel: selected player, selected hand, filter state, expanded observation.
- Writes: none — read-only view. (Weaknesses + tendencies are written by the analysis pipeline on hand-commit in ShowdownView.)

## Props / context contract

- `scale: number` — viewport scale.
- `initialTab: 'player' | 'review'` (default `'player'`) — deep-link support.

## Key interactions

1. **Switch tab** → tab state flips; previous panel state preserved per mount.
2. **Player Analysis → select player** → panel reloads tendency/weaknesses/range for that player.
3. **Click a weakness** → expands with hand-example list + severity evidence.
4. **Hand Review → filter** → HandBrowser narrows the list (filters by street presence, position, opponent-style).
5. **Hand Review → select hand** → HandWalkthrough renders with stepper.
6. **Click an action** in HandWalkthrough → ReviewObservations panel updates with that decision point's analysis (EV, equity, range, action class).
7. **Open Immersive Replay** → navigates to `hand-replay-view` with the selected hand.

---

## Known behavior notes

- **PlayerAnalysisPanel = 516 lines** — dense surface with significant internal state. Decomposition candidate if Wave 2 audit surfaces density findings.
- **Villain profile is the primary annotation** — recommendations are collapsed by default (paradigm shift 2026-03-26). "Profile first, advice second" — read-to-recognize, not read-to-act.
- **Weaknesses are deduped via `WEAKNESS_SUPERSEDES`** — see `generateExploits.js`.
- **Hand examples per weakness** load lazily per-click; avoid up-front cost.
- **HandBrowser filters are in-memory** over the current session's hands by default; "all sessions" mode exists but is expensive on large archives.
- **`useHandReplayAnalysis` is async** — `isComputing` guard avoids rendering partial state.

## Known issues

- **DCOMP-W2-A2 audit shipped 2026-04-22 (verdict RED).** 12 findings: **1 P0** (HandReviewPanel.jsx:43 native `confirm('Delete this hand? This cannot be undone.')` destructive-action anti-pattern — same class as Wave 1 + W4), 4 P1 (touch targets <44 systematic, text-size floor, HandBrowser filter discoverability + segregation, all-sessions filter cost+progress), 4 P2 (PlayerAnalysisPanel decomposition + hand-significance badge + single-hand export + SR-88 discovery), 3 P3 (SR-26/SR-27 merged w/ W2-A1-F3, profile-first contract doc, tab persistence). Full audit: `../audits/2026-04-22-analysis-view.md`.
- Wave 2 audit COMPLETE for analysis-view. Stats audit queued.

## Potentially missing

- **Similar-spot search across history** (SR-88) — not served cross-player.
- **Flag disagreement** (SR-26) and **shareable link** (SR-27) — proposed, not wired.
- **Coach dashboard** (F-P07) — would live adjacent to this surface if Studio tier ships.
- **Hand Significance / Importance** (F-W4) — exists in `handAnalysis` but not surfaced here.
- **Export specific hand/review** — no direct affordance from this surface.

---

## Test coverage

- Panel-level component tests under `AnalysisView/__tests__/`.
- Analysis pipeline coverage lives in `utils/handAnalysis/__tests__/` and `hooks/__tests__/useHandReplayAnalysis*`.

## Related surfaces

- `stats-view` — overlaps on range-profile inspection; narrower scope.
- `hand-replay-view` — primary pivot from Hand Review tab.
- `players-view` — alternate entry to player-level analysis via RangeDetailPanel.
- `table-view` — exit.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — DCOMP-W2-A2 Gate-4 audit appended. Verdict RED. 12 findings; 1 P0 destructive-action persists in HandReviewPanel.jsx:43.
