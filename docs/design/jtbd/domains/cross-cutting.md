# JTBD Domain — Cross-Cutting

Jobs that span multiple surfaces and don't belong to any one domain — undo, recovery, search, accessibility, notifications.

**Primary personas:** All.

**Surfaces:** every surface, via shared primitives (Toast, navigation, state recovery).

---

## CC-01 — Undo a recent destructive action

> When I take a reversible destructive action (clear seat, delete player), I want undo within a reasonable window, so misclicks don't cost data.

- Partial: retro-link undo is gold standard; clear-player lacks undo.

## CC-02 — Recover from app crash without data loss

> When the app crashes or reloads, I want my in-flight data (hand, session, draft) intact, so I continue without reconstruction.

- Partial: drafts covered; in-flight hand state recovery partial.

## CC-03 — Navigate views without losing in-progress input

> When I navigate between views, I want in-progress input (form fields, search queries) preserved, so navigation doesn't cost data.

## CC-76 — Instant undo with no confirmation for hot paths

> When I take a hot-path action (tap an action button), I want instant undo available for a few seconds, so speed wins over safety-rail friction.

## CC-77 — State recovery to exact position after crash

> When the app crashes mid-hand, I want state recovered to exactly where I was (current street, selected seat, pending action), so I don't re-enter.

## CC-78 — Unified search across hands / players / sessions

> When I search for anything, I want one search box that finds hands, players, and sessions, so I don't pick a tab first.

- State: **Proposed**.

## CC-79 — Navigation that returns to prior position

> When I drill from summary to detail and back, I want to return to exactly where I was in the summary, so deep-dives don't cost navigation tax.

## CC-80 — Configurable alerts / notifications

> When the app needs to alert me (tilt warning, session milestone, staker push), I want configurable channels, so I'm not spammed or missed.

- State: **Proposed**.

## CC-81 — Accessibility modes (color-blind, low-light)

> When I have color-vision limits or I'm in a dim card room, I want accessibility modes (color-blind-safe palette, low-light theme), so I can actually read the UI.

- State: **Proposed** (DISC-P01).

## CC-87 — Tilt detection + break suggestion

> When my session behavior indicates tilt (variance spikes, stop-loss breaches, abnormal sizings), I want a nudge to take a break, so I save money.

- State: **Proposed** (DISC-01).

## CC-89 — Mixed-games framework (PLO / stud)

> When I play non-NLHE formats, I want the same framework support (ranges, exploits, drills), so I'm not locked to Hold'em.

- State: **Proposed** (DISC-17, deferred).

---

## Domain-wide constraints

- Undo windows vary by action risk — higher risk = longer window, more visible affordance.
- State recovery requires draft-store discipline applied consistently (see PEO-1).
- Accessibility touches every surface and can't be retrofit cheaply — bake into surface templates.

## Change log

- 2026-04-21 — Created Session 1b.
