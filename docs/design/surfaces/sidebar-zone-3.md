# Surface — Sidebar Zone 3 (Street Card)

**ID:** `sidebar-zone-3`
**Zone role:** Spatial hand-state rendering — action history, per-seat summaries, multiway selector, no-aggressor placeholder, street-adaptive visualization. Companion to Z2 Decision — Z2 says *what to do*, Z3 shows *the state you're doing it in*.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1, §3, §5 (render contract — single-owner-per-slot)
- `docs/design/surfaces/sidebar-zones-overview.md`
- `.claude/handoffs/sr-4-z3-street-card.md` (SR-4 handoff)
- Extension code: `ignition-poker-tracker/render-street-card.js` (street-adaptive renderer, primary module)

**Product line:** Sidebar
**Tier placement:** Pro
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z3 is the spatial, street-adaptive hand-state renderer. Shows who's in the hand, who acted when, on what street, with what sizing, at which seats. Street-adaptive in the sense that flop / turn / river render with different density + row shapes, but the ZONE itself is fixed per R-1.1 (doesn't reorder or resize on data change).

Z3 is a `decision`-tier zone per R-3.3 alongside Z2. Together they're the active-hand surface; no informational content may preempt either.

## JTBD served

- `JTBD-MH-13` seat-activity read (who is in / folded / absent)
- `JTBD-MH-14` action-history read (current betting round reconstruction)
- `JTBD-MH-09` street + pot awareness (Z1 and Z3 share this, Z1 is chip summary / Z3 is visual action history)

## Personas served

- [Multi-Tabler](../personas/core/multi-tabler.md) — primary; visual spatial scan
- [Online MTT Shark](../personas/core/online-mtt-shark.md) — action-history read
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — cross-format

## Elements (per SR pre-cutover audit)

- Action history rows (per-seat summaries, street-adaptive)
- 3.6 Villain-postflop summary (corpus gap per SR-7)
- 3.11 Multiway selector — BET/RAISE clear state pinned; harness screenshots deferred (low-priority)
- 3.12 No-aggressor placeholder — limped/checked-around corpus frame missing (low-priority)

## FSM / lifecycle

Per R-2.* doctrine: every Z3 element has an explicit statechart. `render-street-card.js` is the primary street-adaptive renderer. The street-change transition is particularly constrained — it must NOT cause zone-level reflow per R-1.3 (in-place data update only).

## Interruption discipline

Z3 is `decision` tier alongside Z2. No lower-tier event may preempt. Multiway selector + no-aggressor placeholder are designed to render even in edge cases (limped pot, all-checked-around) so the zone never goes blank unexpectedly.

## Freshness contract

Z3's content is derived from hand-event payloads (each action is a discrete event). No stale-signal needed at Z3 level — the hand-state IS the freshness.

## Known issues carried forward

- **3.6 villain-postflop** — corpus gap (Wave-5 audit candidate if sidebar re-audit reactivates)
- **3.11 multiway selector** — BET/RAISE clear state pinned; harness screenshots deferred
- **3.12 no-aggressor placeholder** — limped/checked-around corpus frame missing

## Heuristic alignment

- H-N1 visibility of system status — action history is the authoritative state view
- H-N4 consistency + standards — street-adaptive but not street-reshaping (core R-1.3 constraint)
- H-N6 recognition rather than recall — spatial hand memory is Z3's primary value
- H-PLT-01 glance-readable — per-seat action summary fits R-1.2 glance test
- H-PLT-05 primary content prominence — Z3 shares decision-tier prominence with Z2

## Related surfaces

- `sidebar-zone-2.md` — Z2 Decision sits above Z3; together they are the active-hand pair
- `table-view.md` — TableView's seat layout is the main-app analogue of Z3 spatial render
- `showdown-view.md` — post-hand spatial review

## Change log

- 2026-04-22 — Created (DCOMP-W5).
