# Products

Two product lines share this repository:

1. **[Main App](./main-app.md)** — the React + Vite web app at `src/`. Mobile-optimized landscape. Primary user surface for live play, review, drills, tournament tracking, and player management.
2. **[Sidebar Extension](./sidebar-extension.md)** — the Chrome MV3 extension at `ignition-poker-tracker/`. Captures Ignition online-poker WebSocket traffic and renders a live HUD + exploit sidebar.

---

## Why they're separate

They serve different personas, different contexts, and potentially different tiers. Conflating them leads to:
- Audits that assume phone-landscape constraints where desktop is the actual device.
- Tier placement confusion (sidebar-primary users shouldn't pay for main-app features they don't use).
- Feature inventory bloat (listing sidebar features and main-app features in one flat table).

Separating them lets us:
- Run audits scoped to one product at a time.
- Place the sidebar in its own tier track ([Sidebar Lite](../tiers/tier-sidebar-lite.md)).
- Honor each product's distinct doctrine — the sidebar has its own documented principles at `docs/SIDEBAR_DESIGN_PRINCIPLES.md` and its own failure history in `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`.

## How the products relate

- They share account + auth layer (when auth is active).
- They share the player database (players captured by the sidebar appear in the main app).
- They share exploit engine modules (sidebar renders advice produced by the same engine as the main app).
- They do NOT share UI components, view routing, or layout systems. The sidebar is a distinct visual product.

## Cross-product JTBD

Some JTBD are cross-product:

- `JTBD-MT-01` "my data flows across devices" — sync layer serves both.
- `JTBD-PM-*` player-management — user expects players they create in the main app to show up in sidebar's HUD.
- `JTBD-DE-*` data-export — exports should cover both products' data.

## Platform-wide constraints

- Offline-first where possible.
- Security and auth.
- Accessibility.
- Data ownership — user can always export their own data.

These apply to both products and are not subject to tier gating.

---

## Change log

- 2026-04-21 — Created Session 1b.
