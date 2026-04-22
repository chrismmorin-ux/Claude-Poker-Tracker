# Surface — Sidebar Zone 2 (Decision)

**ID:** `sidebar-zone-2`
**Zone role:** Active-hand decision surface (advice + sizing presets + recommendation reasoning). Top of the decision-tier stack per R-3.3 interruption discipline — only other decision-tier events may preempt Z2 when a hand is active.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1, §3 (R-3.3 interruption discipline), §5 (render contract — single-owner-per-slot)
- `docs/design/surfaces/sidebar-zones-overview.md`
- `.claude/handoffs/sr-4-z2-decision.md` (SR-4 handoff)
- Extension code: `ignition-poker-tracker/render-orchestrator.js` (routes advice content into Z2)

**Product line:** Sidebar (primary) + cross-surface JTBD mirrors on main-app TableView (LiveAdviceBar)
**Tier placement:** Pro
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z2 is what the sidebar is *for*. The primary decision-support surface during active play. Multi-Tabler's glance-every-8s lands here; Online MTT Shark's live decision feed lives here. Z1 (Table Read) exists to support Z2; Z3 (Street Card) renders the spatial hand-state companion below Z2.

## JTBD served

- `JTBD-MH-01` see the recommended action for the current street ← **primary JTBD for sidebar**
- `JTBD-MH-03` check bluff-catch frequency on current villain
- `JTBD-MH-04` sizing suggestion tied to villain's calling range
- `JTBD-MH-07` short-stack push/fold with ICM (tournament context — currently partial, cross-surface parity item)

## Personas served

- [Multi-Tabler](../personas/core/multi-tabler.md) — primary; glance-every-8s
- [Online MTT Shark](../personas/core/online-mtt-shark.md) — primary decision feed
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — cross-format

## Elements

- Advice text (primary recommendation with confidence + reasoning)
- Sizing presets (bet-size suggestions with EV annotations)
- Recommendation reasoning (expandable on drill-down affordance per R-1.5 → routes to Z4)
- Pot chip (between-hands blank state verified by test — low-priority harness-screenshot gap per SR-7)

## FSM / lifecycle

Per R-2.* doctrine: every Z2 element has an explicit statechart. No `classList.toggle` or ad-hoc visibility flips outside declared transitions. `render-orchestrator.js` owns the reduce-state-to-DOM step. Stage 4 spec at `sr-4-z2-decision.md` defines transitions.

## Interruption discipline (critical)

Per R-3.3: Z2 holds the `decision` tier. Only another `decision`-tier event may overwrite Z2's content. Between-hands (Z1), diagnostics (Z0), informational deep-dive (Z4) all have strictly lower tier and must route to a non-conflicting zone or drop — never overwrite Z2.

## Freshness contract

Z2's advice content IS the `stale-advice` subject. `computeAdviceStaleness` watches Z2's render payload; stale signal surfaces in Z1 (freshness indicator) not Z2 itself — Z2 stays stable per R-1.2 glance test. If advice is stale, Z1 surfaces the signal, Z2 keeps rendering the last-good advice with visual staleness decoration (not removal).

## Known issues carried forward

- **2.7 pot chip between-hands** — low-priority corpus gap (test-verified, harness-screenshot-missing)
- Cross-surface coupling with main-app TableView LiveAdviceBar — no contract doc today; mirrors W4-A2-F10 tournament-to-table contract pattern

## Heuristic alignment

- H-N1 visibility of system status — advice + sizing presets, stale-signal via Z1
- H-N4 consistency + standards — advice format stable across streets
- H-N6 recognition rather than recall — spatial memory of Z2 position is a core design premise
- H-PLT-01 glance-readable — R-1.2 glance test is Z2's primary compliance gate
- H-PLT-05 primary content prominence — Z2 holds this by R-3.3 interruption tier

## Related surfaces

- `table-view.md` — TableView's LiveAdviceBar mirrors Z2 advice content
- `online-view.md` — OnlineView's SeatDetailPanel is the post-hand review mirror
- `sidebar-zone-3.md` — Street Card renders below Z2 with hand spatial state

## Change log

- 2026-04-22 — Created (DCOMP-W5).
