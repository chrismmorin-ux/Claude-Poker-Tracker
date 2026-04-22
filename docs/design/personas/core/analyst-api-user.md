# Persona — The Analyst

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Engineer or quant by day, plays poker part-time and wants to own the data. Raw exports, custom queries, API access, Jupyter notebooks. Opinionated analysis the app provides is a starting point, not a ceiling.

## Context

- **Venue:** Online mostly; some live.
- **Format:** Cash + MTT.
- **Skill:** Advanced analytically, mid on play experience.
- **Volume:** 30–60 hrs/month play + same in analysis.
- **Device:** Desktop, terminal.
- **Intent:** Build personal dashboards; test theories; hook into custom tools.
- **Role:** Player + hobbyist analyst.

## Goals

- Export everything to CSV/JSON.
- Access raw IndexedDB data or an API.
- Build personal dashboards independent of the app.
- Test hypotheses the app's exploit engine doesn't cover.

## Frustrations

- Closed systems.
- No API.
- Opinionated analysis they disagree with and can't override.

## Non-goals

- Coaching.
- Social features.

---

## Constraints

- **Time pressure:** None off-table; normal at table.
- **Error tolerance:** Low for data integrity.
- **Visibility tolerance:** High.
- **Complexity tolerance:** Maximum.

---

## Related situational sub-personas

- [Off-table data exploration](../situational/post-session-chris.md) — generalizable.

## Related JTBD

- `JTBD-DE-*` data-export/integration (primary domain)
- Standard play-aid JTBDs

## Product line

- **Main app + API.** Sidebar if they play online.

## Tier fit

- **Pro (Grinder) ~$49/mo** + **API access as addon** or **Studio** with API included.

---

## Missing-feature needs

- [DISC] Public API + webhooks.
- [DISC] Raw JSON / CSV export for all data types.
- [DISC] Webhook events (session start / end, flagged hand).
- [DISC] Local-only mode (no cloud sync) for paranoid analysts.

## Proto caveats

- **[AN1]** $30–60 + API WTP. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
