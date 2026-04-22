# Product — Main App

**ID:** `main-app`
**Code root:** `src/`
**Build:** Vite + React + Tailwind
**Primary device:** Phone landscape (reference: Samsung Galaxy A22 at 1600×720) + tablet + desktop secondary
**Last reviewed:** 2026-04-21

---

## What it is

The React web app that serves as the full-feature workspace for live poker play-aid, review, drills, tournament tracking, and player management. Mobile-optimized for use at a live table; equally usable on desktop for review.

Architecture reference: [SYSTEM_MODEL.md](../../../.claude/context/SYSTEM_MODEL.md) (v1.7.0+). See [architecture decision records](../../adr/) for major design decisions.

## Who it's for

Every persona except Multi-Tabler and Online MTT Shark at entry (they may skip to sidebar only). Specifically:

- [Chris](../personas/core/chris-live-player.md), [Weekend Warrior](../personas/core/weekend-warrior.md), [Rounder](../personas/core/rounder.md), [Circuit Grinder](../personas/core/circuit-grinder.md), [Hybrid](../personas/core/hybrid-semi-pro.md), [Ringmaster](../personas/core/ringmaster-home-host.md), [Coach](../personas/core/coach.md), [Apprentice](../personas/core/apprentice-student.md), [Scholar](../personas/core/scholar-drills-only.md), [Banker](../personas/core/banker-staker.md), [Newcomer](../personas/core/newcomer.md), [Analyst](../personas/core/analyst-api-user.md), [Traveler](../personas/core/traveler.md).
- Multi-Tabler and Online MTT Shark only if they upgrade from Sidebar Lite to Pro.

## Form factor

- **Reference device:** Samsung Galaxy A22 landscape, 1600×720 CSS px.
- **Minimum supported:** 640×360 landscape (small Android phones).
- **Also supported:** tablets, desktop (especially for Coach, Banker, Analyst use).
- **Orientation:** primarily landscape; portrait acceptable for off-table review.
- **Ergonomic constraint:** one-handed thumb reachability in landscape is binding for mid-hand surfaces.

## Scope boundaries

**In scope:**
- All views under `src/components/views/`.
- All data in IndexedDB (currently v14, `hands` / `sessions` / `players` / `playerDrafts` / etc.).
- All engines (`exploitEngine`, `rangeEngine`, `pokerCore`, `handAnalysis`, `drillContent`).

**Out of scope:**
- The sidebar extension (see [sidebar-extension.md](./sidebar-extension.md)).

## Tier placement per feature

See [features/INVENTORY.md](../features/INVENTORY.md) for the per-feature tier map.

## Product-specific doctrine

- Mobile-landscape first; density bounded.
- State updates via reducer dispatch only.
- Design tokens centralize color; persona-driven surfaces use inline styles for action colors (see `CLAUDE.md` rules).
- Invariants catalog at `.claude/context/INVARIANTS.md`.

## Known product-scope issues

- [EVID-2026-04-21-LANDSCAPE-SCROLL](../evidence/LEDGER.md#evid-2026-04-21-landscape-scroll) — Player Editor cut off on small-phone landscape. Session 2 audit will formalize.
- Firebase cloud sync PAUSED in backlog.

---

## Change log

- 2026-04-21 — Created Session 1b.
