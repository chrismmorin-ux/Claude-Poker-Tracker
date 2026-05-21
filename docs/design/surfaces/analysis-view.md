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
- `JTBD-SR-24` filter hands by street / position / opponent-style (HandBrowser filters; HRP Gate 4 adds flag filter)
- `JTBD-SR-25` replay at own pace with range overlay (entry to `hand-replay-view`)
- `JTBD-SR-31` flag-queue surfacing — HandBrowser flag filter chip + per-card flag indicator + last-reviewed column (HRP Gate 4 wire, 2026-05-17)
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
│     • flag filter chip ⚐ [all|flagged|unflagged]     │
│     • per-card flag indicator ⚐                       │
│     • last-reviewed column (rel. timestamp)          │
│     ↓ select hand                                    │
│   HandWalkthrough (action-by-action)                 │
│     ├── ReviewObservations (per-action cards)        │
│     └── [Open Immersive Replay] → hand-replay-view   │
│         (flagged hands → modal auto-opens at         │
│          first flagged decision per HRP Gate 4)      │
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

---

## HRP HandBrowser augmentations (HRP Gate 4 wire, 2026-05-17, SPR-085 / WS-067)

**Added by:** WS-067 / SPR-085 (HRP Phase 3 Gate 4 surface specs). See `docs/design/surfaces/hand-review-modal.md` for the full new-surface spec.

**What this adds.** The HandBrowser sub-component (in the Hand Review tab) gains three HRP affordances that make the flag queue visible and navigable, satisfying SR-31 (flag-queue surfacing). These are HandBrowser-side surfaces of the `hand.flags[]` + `hand.reviewState` schema additions specified in `hand-review-modal.md` §Schema additions.

**Three new affordances:**

1. **Flag filter chip** — a tri-state filter at the top of the HandBrowser list: `[all] [flagged] [unflagged]` (default: `all`). Reads `hand.flags.length > 0` to classify. Mirrors the visual style of existing HandBrowser filters (street / position / opponent-style).

2. **Per-card flag indicator** — a small ⚐ icon on each hand card in the list when `hand.flags.length > 0`. Tooltip on hover: "Flagged for review (N flags, most recent <date>)" where N = flag count and date is the most recent `hand.flags[i].createdAt`.

3. **Last-reviewed column** — a relative-timestamp column ("3d ago", "never", "2wk ago") fed by `hand.reviewState.lastReviewedAt`. Sortable. "Never reviewed" rows sort to the bottom by default; explicit sort flips them to the top.

**Navigation handoff to HandReplayView.** Selecting a flagged hand in HandBrowser opens HandReplayView with a small change: if the hand has flags AND the user clicked the flag indicator (vs the hand card body), HandReplayView auto-jumps to the first flagged decision and opens the `hand-review-modal` overlay automatically. Clicking the hand card body opens HandReplayView at the start without opening the modal (default behavior preserved). This satisfies SR-31's "find it again in the queue" criterion without breaking the existing review flow.

**State integration.**
- Reads from the same `useSession` / hand-loading path HandBrowser already uses; no new IDB queries.
- The flag filter is a local UI state inside HandBrowser (not persisted across sessions).
- Sorting by last-reviewed uses an in-memory sort over the loaded hands.
- No writes from HandBrowser. The `lastReviewedAt` update happens in `hand-review-modal` (the consumer side).

**Anti-pattern compliance:**
- Red line #5 (no engagement-pressure): the flag indicator is a neutral data signal, not a "you have N unreviewed hands!" notification. No badge counter, no overdue framing, no "review streak" anywhere on this surface.
- Red line #8 (no cross-surface contamination): HandBrowser augmentations land only in `AnalysisView/HandBrowser.jsx`. Live-table surfaces are unaffected.

**Cross-reference:** Schema details + modal contract at `docs/design/surfaces/hand-review-modal.md`.

---

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
- `hand-review-modal` — HRP Gate 4 deep-surface (2026-05-17). HandBrowser's flag indicator opens a flagged hand directly into the modal at the first flagged decision; the modal renders the claims ledger + counterfactual tree + drill card + full artifact in a 5-tab overlay.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
- 2026-04-22 — DCOMP-W2-A2 Gate-4 audit appended. Verdict RED. 12 findings; 1 P0 destructive-action persists in HandReviewPanel.jsx:43.
- 2026-05-17 — HRP Gate 4 wire (WS-067 / SPR-085). HandBrowser augmentations spec'd: flag filter chip (tri-state all/flagged/unflagged), per-card flag indicator (⚐ icon on flagged hands), last-reviewed column (relative-timestamp). Navigation handoff: selecting a flagged hand from the flag indicator (vs the card body) auto-opens `hand-review-modal` at the first flagged decision when HandReplayView mounts. JTBDs served list grew: SR-31 (flag-queue surfacing). Spec-only: no code (HRP Phase 3 is documentation-only). Schema additions (`hand.flags[]` + `hand.reviewState`) authored in `hand-review-modal.md`; HandBrowser is read-only consumer.
