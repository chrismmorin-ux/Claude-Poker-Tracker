# Session Handoff: sr-6-rebuild-batch-5

**Status:** CLOSED — SR-6.8 shipped 2026-04-14. Zone shell scaffolded behind `settings.sidebarRebuild`. No visible UX change yet (containers empty); unblocks all zone PRs except those still gated on SR-6.5. | **Written:** 2026-04-14 | **Closed:** 2026-04-14

## What shipped

1. **`side-panel.html`**
   - New inline CSS block (inside existing `<style>`): `.zone`, `.zone-z0` (72px min-height), `.zone-z1` (204px), `.zone-z2` (150px), `.zone-z3` (300px), `.zone-z4` (24px collapsed), `.zone-zx` (0).
   - New `#hud-content-v2` shell sibling to `#hud-content` inside `#main-content`. Contains 6 empty zone containers (`#zone-z0` … `#zone-zx`) with classes `zone zone-z{N}`. Hidden by default.

2. **`side-panel.js` (`renderAll`)**
   - Inside the SR-6.1 gate sentinel: read `snap.settings?.sidebarRebuild` into `rebuildOn`.
   - No-table path hides both shells.
   - Has-table path: flag-on shows `#hud-content-v2` and hides `#hud-content`; flag-off preserves legacy behavior exactly. Legacy path unchanged when flag false (default).

3. **`side-panel/__tests__/zone-shell.test.js`** (new, 14 cases)
   - HTML presence: shell + each of the 6 zone IDs/classes.
   - CSS contract: each `.zone-z*` declares `min-height`.
   - R-1.3 slot-reservation lint: regex sweep of the inline CSS asserts no rule whose selector contains `.zone-*` sets `display:none`. Empty zones MUST reserve their slot via min-height.

## Why per-zone heights chosen (not from a single source spec)

Each spec file documents inner slot heights piecemeal (Z2 bands, Z3 range slot ~152px, Z4 chevron 24px). Outer zone heights are not a single declared number. Chose conservative bounds from the visible Z-batch invariants:
- Z0 = 28 status strip + 20 health + 24 footer ≈ 72
- Z1 = seat arc (~180) + villain pill row (~24) = 204
- Z2 = headline 44 + SPR 32 + board/pot/street 74 ≈ 150
- Z3 = 152 range slot + 148 rows above it = 300
- Z4 = single collapsed chevron row (24), grows on expand
- Zx = 0 (overlay-only; non-zero only when active)

These are **min-heights**, not fixed. Later zone PRs may refine, but the slot-reservation invariant is what R-1.3 requires and is enforced at the lint layer regardless of exact values.

## What is NOT in this PR

- Zone containers are **empty**. SR-6.10–6.15 fill them per-zone.
- No harness screenshots — nothing visible to diff until containers have content.
- No render-coordinator changes (shell visibility reads existing `settings` slot; no new renderKey fields needed).

## Acceptance — BACKLOG row

> Zone DOM containers present; CSS lint rule forbids `display:none` inside R-1.3 slots

Both gates satisfied. Suite 1541 → 1555. Build clean (6 entry points).

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. Pick one of:
   - **SR-6.5 (L, FSM authoring)** — still highest-leverage unblock. Covers recovery banner, seat popover, deep expander, between-hands (X.1), street-card. Gates R-2/R-3 + SR-6.7/6.11/6.13/6.15.
   - **SR-6.6 (M, freshness records)** — wraps rendered values in `{value, timestamp, source, confidence}` at coordinator boundary. Fixes S1 partial-push regression. Gates SR-6.7.
   - **SR-6.9 (S, motion budget)** — newly unblocked. `prefers-reduced-motion` support + 2 duration tweaks. Small and self-contained; a good palate-cleanser before SR-6.5.

## Files modified this session

- `ignition-poker-tracker/side-panel/side-panel.html` (+CSS block + #hud-content-v2 shell)
- `ignition-poker-tracker/side-panel/side-panel.js` (renderAll toggle in gate sentinel + no-table branch)
- `ignition-poker-tracker/side-panel/__tests__/zone-shell.test.js` (new, 14 cases)
- `.claude/STATUS.md`, `.claude/BACKLOG.md`

## Closeout checklist

- [x] Zone containers present in HTML
- [x] Per-zone min-heights in CSS
- [x] CSS lint test green (14 new cases)
- [x] Full extension suite passes (1555)
- [x] `node build.mjs` clean
- [x] STATUS + BACKLOG updated
- [x] SR-6.9 unblocked; SR-6.10/6.12/6.14 dep on 6.8 removed
- [x] This handoff closed
