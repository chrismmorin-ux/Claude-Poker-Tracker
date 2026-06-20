# Situational Persona — Hybrid Context-Switch

**Type:** Situational (derived from [The Hybrid](../core/hybrid-semi-pro.md))
**Evidence status:** Proto
**Last reviewed:** 2026-06-13
**Owner review:** Pending

---

## Snapshot

The user just closed a live cash session (or is about to) and is moving to online MTT play — or the reverse. The core Hybrid persona models the *standing* need for one toolset across two venues; this situational persona isolates the **moment of switch**: closing one venue's session, opening the other's surface, and re-establishing context. It is the seam where the "two worlds, one toolset" promise is either kept or broken — the live session is in TableView with phone-entered seat reads, the online session lives behind the extension sidebar with anonymized player IDs, and nothing currently guides the hand-off between them.

---

## Situation trigger

- A venue transition begins: ending a live session and opening the extension for online play, or closing online and sitting down live.
- Includes the "import an old JSON" path — pulling a prior online/tournament export into the main app for review during or after the switch.
- Exits when: the new venue's session is active and the user is back in steady-state play (core persona) at that venue.

## Context (deltas from core persona)

- **Time pressure:** Low-to-moderate. This happens at a *session boundary*, not mid-hand — there is time to think, but the switch is error-prone and easy to do half-way.
- **Attention:** Available but divided between two mental models — live seat-based reads vs. online player-ID reads — and the cognitive cost of dropping one to pick up the other.
- **Device:** Crosses devices — phone (live) to desktop (online), or desktop-to-desktop with the extension. The cross-device seam is part of the switch.
- **Cognitive load:** Moderate but distinctive: the risk is *fragmentation* — leaving a live session un-ended, opening the wrong session, or starting online tracking without carrying over a reg's identity that appears in both venues.

## Goals

- **Cleanly close one venue and open the other** without leaving a session half-ended or losing its config (straddle, stakes, venue defaults).
- **Carry villain identity across the seam** — when a live reg also shows up online (or vice versa), link them rather than starting a fresh stranger.
- **Verify the new venue picked up correctly** — that the extension is capturing, or that the live session saved, before committing attention to play.
- **Import a prior export for cross-venue review** without manual re-entry.

## Frustrations

- No guided hand-off — the switch moment is undocumented and unsupported; the user improvises it every time.
- Two databases, no bridge (inherited from core): live "JohnD" and online "player8342" stay strangers across the switch.
- Manual JSON import with no loading state or confirmation that it landed.
- Discovering after the fact that the prior session was never properly ended, fragmenting bankroll/ROI.

## Non-goals

- Mid-hand decision support. That is the steady-state persona at each venue, not the switch.
- Drills, coaching. Already advanced.
- Real-time cross-venue sync of in-progress hands (out of scope; sync is Paused — see MT domain).

---

## Constraints

- **Time budget per interaction:** Seconds-to-a-minute at the boundary; not time-critical, but must not require a multi-step ritual the user will skip.
- **Error tolerance:** Low — a botched switch fragments the data the whole cross-venue value proposition depends on.
- **Visibility tolerance:** High for information; the user wants to *see* that the close/open/import succeeded.
- **Recovery expectation:** Undo for a mis-ended session; explicit confirmation that import/capture succeeded before play resumes.

---

## Related JTBD

- `JTBD-MT-*` multi-device / sync (cross-device boundary)
- `JTBD-MT-64` verify extension capture matches played hands (placeholder — Proposed)
- `JTBD-PM-*` player management (cross-venue identity linking — currently missing)
- `JTBD-SR-89` review the basis/history of live sidebar advice (post-hoc; placeholder — Proposed)

---

## What a surface must offer

1. **A clean close→open path** that ends the current venue's session (preserving its config) and opens the next, with confirmation at each step.
2. **Capture/save verification** — a visible signal that the live session saved or the extension is now capturing, before the user commits to play.
3. **Cross-venue identity carry** — a prompt or path to link a reg seen in both venues rather than re-creating them.
4. **Confirmed import** — a JSON import with a loading state and a "N hands imported" confirmation.

## What a surface must NOT do

- Leave a session in a half-ended state with no warning.
- Silently start the new venue without confirming the prior one closed.
- Import a file with no feedback on whether it succeeded or how many hands landed.
- Treat the cross-venue switch as if the two venues were unrelated — discarding the bridge that is the persona's whole reason for using one toolset.

---

## Change log

- 2026-06-13 — Created. Closes Stage-A finding A3 of the 2026-04-22 OnlineView blind-spot audit (WS-081 / DCOMP-W4-A3-F12). Founder decision 2026-06-13: author (not defer).
