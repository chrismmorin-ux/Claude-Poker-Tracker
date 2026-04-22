# Persona — The Multi-Tabler

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Grinds 4–12 tables simultaneously online (Ignition, ACR, GG) at $0.50/$1 through $2/$5 NLHE, clocking 30–50 hours a week. Lives in the HUD. Wants actionable reads at a glance, not paragraphs. The sidebar Chrome extension is their primary surface.

## Context

- **Venue:** Online (Ignition primary for this app's sidebar; ACR/GG as secondary markets).
- **Format:** Cash, NLHE.
- **Skill:** Advanced.
- **Volume:** 150+ hours/month.
- **Device:** Desktop. Phone usage is rare and incidental.
- **Intent:** Real-time play-aid via sidebar + off-session review.
- **Role:** Solo, pro or pro-aspiring.

## Goals

- Actionable HUD reads at a glance during decisions on any of 8+ tables.
- Per-villain exploits without reading paragraphs.
- Color-code regulars by style fast (one-click style assignment).
- Session-end leak-finder and bankroll graph.
- Low-friction import from PT4/HM3 hand histories (won't start from zero).

## Frustrations

- Most HUDs are stats-only, no prescriptive reads.
- Sidebar real estate matters — no room for fluff.
- Ignition's anonymization breaks cross-session tracking (the extension has to re-identify by seat behavior).
- Moving between tables loses context unless the HUD updates fast.

## Non-goals

- Live poker tools.
- Drills. They're already advanced.
- Coaching.

---

## Constraints

- **Time pressure:** Compressed — 3–8 seconds per decision across 6+ tables.
- **Error tolerance:** Near-zero.
- **Visibility tolerance:** Information density is mandatory, not optional.
- **Complexity tolerance:** High for information; low for friction.

---

## Related situational sub-personas

- [HUD glance during action](../situational/hud-glance.md) (placeholder)
- [Coloring a new reg](../situational/coloring-a-reg.md) (placeholder)
- [End-of-session leak scan](../situational/post-session-chris.md) — generalizable.

## Related JTBD

- `JTBD-MH-*` mid-hand (compressed-time version)
- `JTBD-PM-*` player management (style-tagging heavy)
- `JTBD-SR-*` session review (worst-EV, leak-finder)
- `JTBD-DE-*` data-export/integration (PT4/HM3 import mandatory)

## Product line

- **Sidebar-primary.** Main app for review and setup.

## Tier fit

- **Pro (Grinder) ~$49/mo** — advanced sidebar features, multi-device sync, unlimited history, advanced filters.
- **Sidebar-Lite ~$15/mo** track could land them as entry if they don't want the main app.

---

## Missing-feature needs

- [DISC] PT4/HM3 hand-history importer.
- [DISC] Similar-spot search across history.
- [DISC] Tilt detector.
- [DISC] Sidebar-only subscription track.

## Proto caveats

- **[MT1]** $30–80/mo WTP. Basis: competitive HUD pricing. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
