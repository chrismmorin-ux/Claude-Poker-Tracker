# Product — Sidebar Extension

**ID:** `sidebar-extension`
**Code root:** `ignition-poker-tracker/`
**Build:** Chrome MV3 extension
**Primary device:** Desktop Chrome (online play context)
**Last reviewed:** 2026-04-21

---

## What it is

Chrome extension that captures Ignition Poker WebSocket traffic and renders a side panel HUD + exploit sidebar while the user plays online. Separate product line from the main app — different context, different form factor, different personas.

Has its own dedicated doctrine and failure history:
- Doctrine: [docs/SIDEBAR_DESIGN_PRINCIPLES.md](../../SIDEBAR_DESIGN_PRINCIPLES.md)
- Rebuild program post-mortem: `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`
- State-clear asymmetry post-mortem: `.claude/failures/STATE_CLEAR_ASYMMETRY.md`
- SW reanimation replay: `.claude/failures/SW_REANIMATION_REPLAY.md`

## Who it's for

- Primary: [Multi-Tabler](../personas/core/multi-tabler.md), [Online MTT Shark](../personas/core/online-mtt-shark.md), [Hybrid](../personas/core/hybrid-semi-pro.md) (for their online play).
- Secondary: other personas if they occasionally play online (Rounder, Analyst, etc.).

## Form factor

- **Reference device:** Desktop Chrome browser, 1920×1080 typical.
- **Minimum supported:** Chrome side panel at standard resolution (≥1280 wide).
- **Orientation:** N/A.
- **Ergonomic constraint:** live-table latency — HUD updates must be sub-second.

## Scope boundaries

**In scope:**
- Everything under `ignition-poker-tracker/`.
- WebSocket capture, service worker, side panel, render orchestrator, state / FSM / observability.
- Product tests: ~1,974 extension tests (as of 2026-04-16).

**Out of scope:**
- Main app views (see [main-app.md](./main-app.md)).

## Relationship to main app

- **Shared:** account (when auth), player database (via IDB when synced), exploit engine (via npm-internal shared modules).
- **Not shared:** UI components, layout system, view routing.

## Sidebar's own zone architecture

Per doctrine, the sidebar is organized into 6 zones:
- **Z0 Chrome** — connection status, controls.
- **Z1 Table Read** — seat grid, player briefs.
- **Z2 Decision** — primary advice surface.
- **Z3 Street Card** — street-adaptive details.
- **Z4 Deep Analysis** — optional drill-down panels.
- **Zx Overrides** — freshness / staleness / invariant violations.

## Tier placement

- **Not available:** Free, Plus.
- **Available:** Sidebar Lite (~$15 — sidebar only, no main app), Pro (full), Studio (full).

## Product-specific doctrine

Seven automated doctrine rules under lint gates:
- R-2.3 DOM (no duplicate owners)
- RT-60 timer registration
- R-5.6 FSM output exclusivity
- R-7.2 cross-panel refs
- R-7.3 observability honesty
- R-7.4 observability completeness
- R-8.1 state-clear symmetry
- R-10.1 payload-level invariants

See `docs/SIDEBAR_DESIGN_PRINCIPLES.md` for the full 33 rules.

## Known product-scope issues

- 0 active issues as of 2026-04-16 (post Sidebar Trust Program phase 2 close).
- Any new sidebar UX finding flows through this framework but references the existing doctrine.

---

## Change log

- 2026-04-21 — Created Session 1b.
