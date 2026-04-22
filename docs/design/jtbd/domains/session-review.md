# JTBD Domain — Session Review

Jobs performed *after* a session (or between sessions) to review, filter, replay, and annotate what happened.

**Primary personas:** [Rounder](../../personas/core/rounder.md), [Coach](../../personas/core/coach.md), [Apprentice](../../personas/core/apprentice-student.md), [Hybrid](../../personas/core/hybrid-semi-pro.md), [Analyst](../../personas/core/analyst-api-user.md), [Post-session Chris](../../personas/situational/post-session-chris.md).

**Surfaces:** `HandReplayView`, `AnalysisView`, `StatsView`, `SessionsView`.

---

## SR-23 — Highlight worst-EV spots

> When reviewing, I want the worst-EV spots automatically highlighted, so I fix leaks without scanning every hand.

## SR-24 — Filter by street / position / opponent-style

> When reviewing, I want to filter hands by street, position, or opponent style, so I find patterns.

## SR-25 — Replay at own pace with range overlay

> When replaying, I want to step through hands at my own pace and see the range overlay at each decision, so I rebuild my thinking.

## SR-26 — Flag disagreement + add reasoning

> When I disagree with the app's analysis, I want to flag it and add my own reasoning, so the model learns (and I document my thinking).

- State: **Proposed**.

## SR-27 — Shareable replay link for coach

> When a coach reviews my hands, I want to share a replay link instead of screen-recording, so the handoff is clean.

- State: **Proposed** (DISC-07).

## SR-88 — Similar-spot search across history

> When analyzing a specific decision, I want to find all similar spots in my history (e.g., "turn check-raise on paired board, 40bb deep"), so my reads are informed by real data.

- State: **Proposed** (DISC-11).

---

## Domain-wide constraints

- Review surfaces should show what the app knew *at decision time* vs. what's knowable in hindsight.
- Shareable links require auth + permissions (currently not present).

## Change log

- 2026-04-21 — Created Session 1b.
