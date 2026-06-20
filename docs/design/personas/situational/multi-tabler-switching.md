# Situational Persona — Multi-Tabler Switching

**Type:** Situational (derived from [The Multi-Tabler](../core/multi-tabler.md))
**Evidence status:** Proto
**Last reviewed:** 2026-06-13
**Owner review:** Pending

---

## Snapshot

Four to eight tables are live at once and at least one is always waiting on a decision. The user is not "at a table" — they are cycling between tables, giving each one a 3–8 second slice of attention before the next table's timer pulls them away. The core Multi-Tabler persona models the grinder's overall workflow; this situational persona isolates the *active-switching* moment, where the binding constraint is not skill or information density but **focus hand-off cost**: every glance lands cold, with no memory of what this specific table was doing eight seconds ago.

---

## Situation trigger

- Two or more tables are simultaneously demanding action (timer running on table A while table B just dealt).
- Exits when: table count drops to one active decision at a time, or the session ends.

## Context (deltas from core persona)

- **Time pressure:** 3–8 seconds per decision, but *interleaved* — the user re-enters each table cold and must reconstruct context instantly. The "between" moment that single-tablers get does not exist; the gap between this table's decisions is filled by other tables.
- **Attention:** Near-fully saturated. No spare capacity for reading prose, opening a modal, or processing a layout that changed. The sidebar must answer "what do I do on THIS table, right now" in one glance.
- **Hand availability:** Desktop, both hands on keyboard/mouse. Phone is not in play.
- **Cognitive load:** Maximum. The user is paging context in and out continuously; anything that forces a re-orientation (focus steal, layout shift, stale read) costs a decision on another table.

## Goals

- **Glance-read the table demanding action now** — exploit + sizing for the current villain without scanning or scrolling.
- **Switch tables without losing context** — when focus returns to a table, its sidebar state reflects *that* table, not the last one looked at.
- **Queue a style tag in-flow** — one-click color/style assignment that does not block the other tables.
- **Trust the read is current** — the HUD has updated for this table's latest action before the user looks, not after.

## Frustrations

- Sidebar state that lags the table switch — reading table A's advice while looking at table B.
- Anything requiring more than one tap, or a modal that steals focus from a table with a running timer.
- Layout shifts or prose that force re-orientation on a cold glance.
- Losing a queued style tag because the table demanded action before it committed.

## Non-goals

- Deep analysis or leak-finding. Saved for off-session (core persona's review workflow).
- Drills, coaching. Already advanced.
- Anything that asks for sustained attention on a single table.

---

## Constraints

- **Time budget per interaction:** 1–3 seconds for a read; ≤1 tap for a style tag. No interaction may exceed a single table's decision window.
- **Error tolerance:** Near-zero — a misclick costs a decision (and chips) on the table whose timer was running.
- **Visibility tolerance:** Maximum density. Every pixel earns its place; no progressive disclosure that adds a step.
- **Recovery expectation:** Any action must be non-blocking — it can never freeze or focus-trap the user away from another live table.

---

## Related JTBD

- `JTBD-MH-*` mid-hand decision (compressed-time, per-table variant)
- `JTBD-SR-89` review the basis/history of live sidebar advice (post-hoc; placeholder — Proposed)
- `JTBD-PM-04` swap the player on a seat (style-tagging, in-flow)

---

## What a surface must offer

1. **Per-table state isolation.** The sidebar shows the table the user is currently focused on, switching its full context the instant focus changes — no carry-over from the prior table.
2. **One-glance answer.** Exploit + sizing for the current decision readable without scrolling, scanning, or reading prose.
3. **One-tap style tagging** that commits without a modal and survives an immediate table switch.
4. **Read freshness guarantee.** The advice reflects this table's most recent action before the user looks at it.

## What a surface must NOT do

- Steal focus or open a modal while any other table has a running timer.
- Shift layout or change information position between glances at the same table.
- Render prose where a glyph or number would do.
- Carry one table's state into another table's view after a switch.

---

## Change log

- 2026-06-13 — Created. Closes Stage-A finding A1 of the 2026-04-22 OnlineView blind-spot audit (WS-081 / DCOMP-W4-A3-F12).
