# Persona — The Weekend Warrior

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Plays $1/$2 or $2/$5 at the local card room 2–4 times a month for fun and a bit of edge. Isn't trying to turn pro, isn't reading solver output — but is curious, vaguely serious, and would love to know if the hobby is actually profitable.

## Context

- **Venue:** Live brick-and-mortar card room (local casino, card room, or small private casino)
- **Format:** Cash, low stakes
- **Skill:** Low-to-mid. Knows basics, reads a hand history, watches some poker YouTube.
- **Volume:** 4–8 sessions/month, 3–6 hours each.
- **Device:** Phone, landscape, one-handed at the table.
- **Intent:** Play-aid during session; occasional light review afterward.
- **Role:** Solo player.

## Goals

- Confirm they're actually winning long-term (or at least not bleeding).
- Remember faces and tendencies across month-gap sessions.
- Feel smarter than the random tourist at the table.
- Justify the hobby to a spouse or self with a plain-English report ("I'm up $420 this year").

## Frustrations

- Existing trackers are either spreadsheets (too much work) or overkill for their volume.
- Forgets who's who between month-gap sessions.
- Entering hands mid-action without looking rude or slow is hard.

## Non-goals

- GTO mastery. Doesn't care.
- High volume. 4–8 sessions is the ceiling.
- Community/social features. Mostly solo.

---

## Constraints

- **Time pressure:** At the table, varies by situation — same as Chris. Off-table, no pressure.
- **Error tolerance:** Moderate. Occasional misclicks acceptable as long as easy to fix.
- **Visibility tolerance:** Primary actions must be obvious; advanced features can hide.
- **Complexity tolerance:** Low. Feature bloat scares them off.

---

## Related situational sub-personas

- [Mid-hand Chris](../situational/mid-hand-chris.md) — same situation applies (subset).
- [Between-hands Chris](../situational/between-hands-chris.md) — same situation applies.
- [Post-session Chris](../situational/post-session-chris.md) — lighter, shorter review than the Rounder.

## Related JTBD (most load-bearing)

- `JTBD-HE-*` hand entry (fast, discreet)
- `JTBD-SM-01` start session
- `JTBD-SM-05` cash-out with tip
- `JTBD-PM-*` player management (low-volume version)
- `JTBD-SR-02` aggregate session stats (bankroll view)
- `JTBD-MH-01` recommended action (plain-English version)

## Product line

- **Main app.** No sidebar.

## Tier fit

- **Free (Tourist)** — hand entry, basic P&L, capped player database, short history window. Enough to keep them engaged.
- Upgrade trigger: they want unlimited player history or sidebar tools after trying online — then they become a different persona entirely.

---

## How this persona differs from Chris

- Lower stakes, lower volume, less technical engagement.
- Tolerates less feature depth.
- Would be annoyed by a mid-hand recommendation that uses jargon ("SPR," "MDF").
- Spouse / non-poker accountability matters more than pure play improvement.

## Proto caveats

- **[W1]** Willingness-to-pay $0–15/mo is a guess. Basis: general recreational hobbyist spend. Verify with landing-page test.
- **[W2]** Recreational users skew phone-over-desktop. Basis: industry pattern. Verify with form-factor data.

---

## Change log

- 2026-04-21 — Created Session 1b.
