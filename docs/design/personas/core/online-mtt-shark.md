# Persona — The Online MTT Shark

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Plays 6–12 concurrent online tournaments — Sunday majors, Bounty Builders, daily schedules. Push/fold shortcuts dominate mid-game; ICM dominates late. Needs chip-EV vs $-EV deltas at final tables. A third of decisions happen in under 5 seconds.

## Context

- **Venue:** Online MTT.
- **Format:** Tournaments — standard MTT + bounty + satellite.
- **Skill:** Advanced to expert.
- **Volume:** 100–160 hrs/month.
- **Device:** Desktop, multi-monitor.
- **Intent:** Real-time decision support + off-session review.
- **Role:** Solo pro.

## Goals

- Push/fold charts by effective stack + ICM, delivered in real time.
- Identify short-stack shovers and nit 3-bet spots quickly.
- Recognize late-registration weak fields.
- Late-game FT exploits with per-seat ICM deltas.
- Bounty-adjusted EV for marginal calls.

## Frustrations

- ICM calcs are too slow to trust mid-hand.
- Bounty-adjusted EV is a blind spot across tools.
- Satellite bubble dynamics (survival > chips) underserved.
- Multi-table attention fragmentation — the tool must be instant.

## Non-goals

- Cash-game theory.
- Coaching.
- Drills.

---

## Constraints

- **Time pressure:** Extreme. 3–6 seconds per action.
- **Error tolerance:** Zero in high-ICM moments.
- **Visibility tolerance:** Maximum density.
- **Complexity tolerance:** Extreme for information; zero for friction.

---

## Related situational sub-personas

- [Push/fold at 10bb](../situational/push-fold-short-stack.md)
- [FT 3-handed decision](../situational/final-table-play.md)
- [Late reg decision](../situational/late-reg-decision.md) (placeholder)
- [Bubble decision](../situational/bubble-decision.md)

---

## Use-case on `TournamentView` (clarification, 2026-04-29)

The Online MTT Shark's primary live-decision surface is the **sidebar (Z2 Decision)**, not the main-app TournamentView. Multi-tabling 6–12 concurrent windows means TournamentView's full-screen layout is structurally incompatible with their attention budget — they cannot leave a single table to inspect tournament state on the main app without losing tempo on the others.

**TournamentView is consulted in two contexts only:**

1. **Off-tabling review** — between sessions, when reviewing a final-table run for stage-specific leaks. Read-only consumption: ICM pressure, M-ratio guidance at each level, blind-out projections retrospectively.
2. **Single-table escalation** — when down to one or two remaining tables (deep run), TournamentView's denser projections may justify the surface switch. Specifically: the per-seat ICM payout delta surface (TS-40, currently proposed) would be Online-MTT-Shark-primary if shipped.

**Not a Shark surface for live multi-tabling.** The Shark's live-decision needs are served by:
- Sidebar Z2 with ICM overlay (cross-product gap noted in 2026-04-21 sidebar-tournament-parity discovery).
- TableView's `IcmBadge` + `mRatioGuidance` overlay — passive, glanceable, doesn't require leaving the table.

The TournamentView surface artifact's `Personas served` line ("primary for online MTT (usually via the sidebar; this view is post-session context)") encodes the same boundary, with this clarification supplying the "what does post-session context mean" detail the audit Stage A2 flagged as missing.

## Related JTBD

- `JTBD-TS-*` tournament-specific (all items)
- `JTBD-MH-07` short-stack push/fold
- `JTBD-MH-03` bluff-catch frequency
- `JTBD-MT-*` multi-device sync (cross-tournament memory)

## Product line

- **Sidebar-primary.**

## Tier fit

- **Pro (Grinder) ~$49–79/mo**. ICM + bounty features must justify price.

---

## Missing-feature needs

- [DISC] Bounty-adjusted EV mode.
- [DISC] Satellite / seat-bubble strategy switch.
- [DISC] ICM payout structure import.
- [DISC] Sidebar-only tier track.

## Proto caveats

- **[OMS1]** $60–150 WTP. Basis: ICMIZER Coach + Hand2Note Edge. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-29 — DCOMP-W4-A2-F12 closeout: added `Use-case on TournamentView` section resolving audit Stage A2 (ambiguous post-session-context framing).
