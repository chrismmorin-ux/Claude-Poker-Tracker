# Persona — The Banker (Staker / Backer)

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Stakes 3–15 poker players ("horses"). Needs visibility into their play, ROI, and leaks. Trust but verify. Reviews disputed hands, tracks makeup, flags suspicious sessions. Non-player role; makes money by picking winners.

## Context

- **Venue:** Meta — doesn't play themselves, manages others.
- **Format:** All, across horses.
- **Skill:** Advanced+ analytically.
- **Volume:** Oversight only — reviews weekly, alerts in real-time.
- **Device:** Desktop.
- **Intent:** Horse monitoring, risk management, makeup accounting.
- **Role:** Staker / backer.

## Goals

- Per-horse P&L dashboard.
- Flag suspicious sessions (tilt, off-game time, stop-loss violations).
- Review disputed hands with horse.
- Compare horses on common criteria.
- Makeup accounting that's accurate.

## Frustrations

- Horses self-report — no ground truth.
- Can't intervene mid-session when a horse is tilting.
- Makeup accounting is currently spreadsheets.
- No standard for what "proof of play" looks like.

## Non-goals

- Playing themselves.
- Coaching horses (that's the coach's job).

---

## Constraints

- **Time pressure:** Real-time alerts must be instant; review is batched.
- **Error tolerance:** Zero for financial accuracy.
- **Visibility tolerance:** High.
- **Complexity tolerance:** High.

---

## Related situational sub-personas

- [Staker horse review](../situational/staker-horse-review.md)
- [Tilt alert](../situational/staker-horse-review.md) — same file, different trigger.

## Related JTBD

- `JTBD-SG-58` shared read-access to staked horse sessions
- `JTBD-SG-59` privacy controls (horse side)
- `JTBD-DE-*` data-export/integration (reports to external accounting)
- `JTBD-CC-*` cross-cutting (tilt alerts, notifications)

## Product line

- **Main app, staker role.** Potentially API access.

## Tier fit

- **Studio (Teams) ~$149+/mo** with per-horse seat. Business expense; cost-vs-risk calculation justifies.

---

## Missing-feature needs

- [DISC] Staker read-only portal with per-horse session flagging.
- [DISC] Tilt detector with real-time push to staker.
- [DISC] Verifiable / signed sessions (cryptographic proof of play).
- [DISC] Makeup accounting workflow.
- [DISC] Multi-horse comparison dashboard.

## Proto caveats

- **[B1]** $60–200/mo WTP. Basis: risk-weighted willingness for any tool that reduces staking losses. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
