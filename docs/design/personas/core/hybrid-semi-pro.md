# Persona — The Hybrid

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Plays live on weekends and online on weekdays; identifies as "I play poker" as a profession or semi-profession. Needs one set of tools that work across both venues and doesn't force them to maintain two separate player databases.

## Context

- **Venue:** Both live and online.
- **Format:** Cash + MTT mix.
- **Skill:** Advanced.
- **Volume:** 100+ hours/month combined.
- **Device:** Phone at live tables; desktop for online and review.
- **Intent:** Unified cross-venue tracking + live play-aid + online HUD.
- **Role:** Semi-pro or pro.

## Goals

- Unified player database across venues (can I link live reg "JohnD" to online "player8342"?).
- Session-type-level leak identification (am I worse online?).
- Single bankroll and ROI view.
- Consistent review workflow regardless of venue.

## Frustrations

- Two worlds, two toolsets, no bridge.
- Live reg "JohnD" vs. online "player8342" — no linkage mechanism.
- Bankroll split across multiple ledgers.

## Non-goals

- Drills (already advanced).
- Coaching.

---

## Constraints

- **Time pressure:** Full at both venues.
- **Error tolerance:** Low.
- **Visibility tolerance:** High for information.
- **Complexity tolerance:** High.

---

## Related situational sub-personas

- [Same-reg-across-venue moment](../situational/cross-venue-linking.md) (placeholder)
- [Monthly bankroll reconciliation](../situational/post-session-chris.md) — generalizable.

## Related JTBD

- All main-app + sidebar JTBDs
- `JTBD-PM-*` player management (cross-venue linking missing)
- `JTBD-MT-*` multi-device sync

## Product line

- **Both main app and sidebar.**

## Tier fit

- **Pro (Grinder) ~$49–79/mo**. The unified cross-venue identity is their primary value.

---

## Missing-feature needs

- [DISC] Cross-venue player linker (fuzzy + manual).
- [DISC] Unified bankroll across live + online.

## Proto caveats

- **[H1]** $60–100 WTP. Basis: combined spend on two tools. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
