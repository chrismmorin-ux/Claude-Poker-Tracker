# Persona — The Ringmaster (Home Game Host)

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Runs a weekly $0.50/$1 or $1/$2 home cash / MTT game for 6–9 regulars. Knows everyone by name. Wants light poker-aware tools — chip/debt settlement at night's end, stats that make regulars feel engaged, and their own performance vs. the group. Social motivation dominates profit motive.

## Context

- **Venue:** Home game (someone's basement or living room).
- **Format:** Cash or small MTT, low stakes.
- **Skill:** Mid.
- **Volume:** 1–2x per week.
- **Device:** Phone.
- **Intent:** Host utilities + light personal play-aid.
- **Role:** Host + player.

## Goals

- Clean settlement at night's end (who owes whom, Venmo amounts).
- Light stats for the group ("Tommy's on a heater" / "Sarah's +$420 lifetime").
- Personal performance vs. the regulars.
- Share graphs / notable hands in the group chat.

## Frustrations

- Accounting apps aren't poker-aware (they can't handle rebuys, side pots, chip-up errors).
- Existing trackers are solo — no group mode.
- Nothing helps with the host role (seating, blind timing, payout structure for small tournaments).

## Non-goals

- GTO analysis.
- Professional-level play tools.
- Drills.

---

## Constraints

- **Time pressure:** Low.
- **Error tolerance:** Settlement errors are highly costly socially — no room for bugs there.
- **Complexity tolerance:** Low to moderate.

---

## Related situational sub-personas

- [Home game settle](../situational/home-game-settle.md)
- [Sharing a bad-beat clip](../situational/post-session-chris.md) — generalizable.

## Related JTBD

- `JTBD-SG-*` social/group (settlement, group stats, sharing)
- `JTBD-PM-*` (simplified, close-knit version)
- `JTBD-SM-01` session start (fast for weekly recurrence)

## Product line

- **Main app primary.** No sidebar.

## Tier fit

- **Plus (Regular) ~$19/mo** personally or **Studio (Teams) ~$149/mo** group split across regulars — home game could subsidize the subscription as "the game tool."

---

## Missing-feature needs

- [DISC] Home-game settle & share mode (multi-player settlement, Venmo-ready amounts, group chat share cards).
- [DISC] Group-wide stats with privacy controls.
- [DISC] Blind timer + small-tournament payout calculator.

## Proto caveats

- **[RM1]** $0–15 personal or group sub. Basis: recreational social software pricing. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
