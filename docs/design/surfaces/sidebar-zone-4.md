# Surface — Sidebar Zone 4 (Deep Analysis)

**ID:** `sidebar-zone-4`
**Zone role:** Post-decision drill-down tier. Model Audit (flag-gated), per-seat villain detail on expand, freshness ledger. Drill-down interruption tier — lower than Z3 decision, higher than Z0 chrome.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (R-1.5 drill-down pathway), §7 (invariant surfacing)
- `docs/design/surfaces/sidebar-zones-overview.md`
- `.claude/projects/sidebar-rebuild/04-z4-deep-analysis.md` (SR-4 handoff)
- Extension code: `side-panel.js:1325-1329` (Model Audit DOM insert/remove, flag-gated)

**Product line:** Sidebar
**Tier placement:** Pro + flag-gated "debug diagnostics" features
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z4 is the drill-down zone. When a Multi-Tabler or Online MTT Shark wants more detail than Z3's summary — why did the advice say fold, what's villain's weighted range, what's the blocker math — Z4 is where that expansion lives. Per R-1.5, drill-down affordances in Z3 route here.

## JTBD served

- `JTBD-MH-08` blockers in fold-equity math (expanded detail)
- `JTBD-SR-*` per-seat villain detail (shared with OnlineView SeatDetailPanel)
- Debug-oriented: Model Audit (flag-gated via `settings.debugDiagnostics`)

## Personas served

- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — detail-seeker
- [Coach](../personas/core/coach.md) — when reviewing in a coaching session (though Coach canonical surface is main-app)
- Debug users with `settings.debugDiagnostics` enabled

## Elements (per SR pre-cutover audit)

- 4.3 Model Audit (flag-off absence pinned by test; flag-on visual gap — low-priority)
- Villain range expansion
- Freshness ledger (per-element last-update timestamps for diagnostic review)

## FSM / lifecycle

Z4 content is lazy-rendered on drill-down trigger from Z3. Per R-1.5, the expansion location defaults to "in place" (Z4 is the in-place expansion zone for Z3 elements) — not modal, not navigation.

Model Audit is DOM-inserted/removed by `side-panel.js:1325-1329` based on `settings.debugDiagnostics`. Orthogonal to `sidebarRebuild` flag.

## Interruption discipline

Z4 is `drill-down` tier. Lower than Z3 `decision`. Higher than Z0 `informational`. Between-hand events never preempt Z4 while a drill-down is open.

## Known issues carried forward

- **4.3 Model Audit flag-on** — visual gap (flag-off absence pinned by test, flag-on corpus frame missing)
- Cross-surface: the in-sidebar drill-down and OnlineView SeatDetailPanel diverged during the sidebar rebuild; parity not explicitly contracted (partial W4-A3-F10 coverage)

## Heuristic alignment

- H-N6 recognition rather than recall — Z4 is the recall-to-detail expansion zone
- H-N7 flexibility + efficiency — power-user drill-down
- H-N10 help + documentation — Model Audit is debug-internal, not user-docs

## Change log

- 2026-04-22 — Created (DCOMP-W5).
