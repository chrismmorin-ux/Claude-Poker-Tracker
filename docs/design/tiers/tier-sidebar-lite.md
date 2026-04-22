# Tier — Sidebar Lite (Alternate Track)

**ID:** `tier-sidebar-lite`
**Role:** Sidebar-only product for online-exclusive players
**Target $/mo (placeholder):** ~$15
**Last reviewed:** 2026-04-21

---

## Why this tier exists as its own track

The sidebar extension is a distinct product line (Ignition online HUD + live capture), and a meaningful slice of the addressable market plays online exclusively and has no need for the main app's live-hand-entry flow. Gating sidebar behind Pro forces them to pay for features they won't use; offering a sidebar-only track creates a natural low-friction entry point for Multi-Tabler and Online MTT Shark personas who might otherwise churn at Pro pricing.

## Who this tier is for

- Primary: entry-point [Multi-Tabler](../personas/core/multi-tabler.md), casual [Online MTT Shark](../personas/core/online-mtt-shark.md)
- Secondary: online-only [Hybrid](../personas/core/hybrid-semi-pro.md) who doesn't care about live features

## Role vs. adjacent tiers

- Upgrade from: Free (which doesn't include sidebar)
- Upgrade to: Pro (when the user wants main-app review, cross-venue player database, or advanced sidebar)
- Reason to upgrade to Pro: wants main-app hand replay, cross-venue tracking, or depth-3 game tree

---

## What's included

### Main app

- Account + auth only (no main app UI beyond settings / sign-in).
- **Or optionally:** minimal hand browser for sidebar-imported hands.

### Sidebar extension

- Full sidebar with exploit engine (Layer 1 + 2 depth-1; not depth-3)
- Live HUD for Ignition
- Villain brief + recommendations
- Basic range display

### Platform-wide

- Account recovery
- Accessibility modes
- Data export of sidebar-captured hands (CSV)

## What's NOT included (moves you to Pro)

- Main app hand entry, replay, drills, stats dashboards
- Depth-3 exploit engine
- Bayesian villain modeling at full depth
- Cross-venue player linking
- PT4 / HM3 importer
- Multi-currency

## Caps and limits

- Player database: unlimited (within sidebar scope)
- History window: unlimited (sidebar-captured)
- Device count: 1 desktop (Chrome extension)

---

## Typical customer journey

- Multi-Tabler tries sidebar → pays $15 → grinds → after 2 months wants deeper analysis → upgrades to Pro.
- Online MTT Shark pays $15 for basic sidebar → doesn't need main app.

## Retention risks

- Pro's sidebar features (depth-3, fold curves, advanced tells) make Lite feel underpowered.
- Users feel nickeled-and-dimed if Lite can't do what the old Pro sidebar could.
- Ignition or browser updates break the extension — Lite users churn faster because they have no main app fallback.

---

## Change log

- 2026-04-21 — Created Session 1b.
