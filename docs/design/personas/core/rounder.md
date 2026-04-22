# Persona — The Rounder

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Plays $2/$5 and $5/$10 live cash 20+ hours per week, treats poker like a second income, and studies between sessions. Has 200+ players tracked and a real interest in per-villain exploit work. Would be the app's ideal customer if the tool earns the trust.

## Context

- **Venue:** Live brick-and-mortar mid-stakes.
- **Format:** Cash, primarily NLHE.
- **Skill:** Advanced. GTO-literate, uses solver concepts.
- **Volume:** 80–120 hrs/month. Regular home card room + occasional travel.
- **Device:** Phone landscape at the table; desktop for review.
- **Intent:** Play-aid during session, deep off-table study and leak-finding.
- **Role:** Solo player; may swap notes with a small circle of similarly-serious players.

## Goals

- Build reliable reads on home-casino regulars.
- Identify personal leaks (positions, sizings, specific opponent types).
- Maximize hourly by picking best tables and seats.
- Review hands away from the table systematically.
- Trust the app enough to let exploit advice shade real-money decisions.

## Frustrations

- 200+ players tracked, search and filter is painful at scale.
- Exploit advice feels generic until a villain has 30+ recorded hands.
- No way to tag "this reg changed gears after a bad beat at 2am" so the model adapts mid-session.
- Mobile tools are thin; desktop tools (PT4/HM3) don't work at a live table.

## Non-goals

- Coaching others. Might pay a coach, doesn't want to be one.
- Drills. Prefers hand-history study over abstract drills.

---

## Constraints

- **Time pressure:** Full mid-hand pressure; deep off-table time.
- **Error tolerance:** Low during hands, moderate otherwise.
- **Visibility tolerance:** High — will accept density in exchange for depth.
- **Complexity tolerance:** High. Wants nuance.

---

## Related situational sub-personas

- [Mid-hand vs known reg](../situational/mid-hand-vs-known-reg.md) — the defining moment.
- [Pre-session table select](../situational/pre-session-scouting.md) — table-picking is itself edge.
- [Post-session drive home](../situational/post-session-chris.md) — applicable (often distracted review).

## Related JTBD

- `JTBD-MH-*` mid-hand (full depth version)
- `JTBD-SR-*` session review (worst-EV, filter-heavy)
- `JTBD-PM-*` player management (scale-heavy version)
- `JTBD-HE-*` hand entry (fast, precise)

## Product line

- **Main app primary.** Sidebar if they also play online occasionally.

## Tier fit

- **Pro (Grinder) ~$49/mo** — full Bayesian villain modeling, multi-device sync, advanced filters, custom drills from own hands, game-tree EV depth-3.
- Upgrade trigger: recognized value from first month's reads + leak identification.

---

## How this persona differs from Chris

- Similar profile; Chris may *be* a Rounder. The archetype is articulated for design — when the app scales to more regs than Chris has, the Rounder is who we're protecting.
- Archetype cares about multi-reg scale operations (bulk tag, merge, archive) more than Chris currently does.

## Proto caveats

- **[R1]** $30–60/mo WTP. Basis: competitive pricing for PT4 + GTO Wizard equivalent. Verify.
- **[R2]** Mid-stakes volume assumption. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
