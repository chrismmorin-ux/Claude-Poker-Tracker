# Persona — Chris, Live Player

**Type:** Core
**Evidence status:** Proto — partially verified
**Last reviewed:** 2026-04-21
**Owner review:** Pending

---

## Snapshot

Chris owns and directs this project. He is a live poker player using the app at the table to compensate for the memory and pattern-recognition limits humans hit across a 9-handed game. He is not a software engineer; Claude is the sole developer. When Chris uses the app, he is also generating the feedback that shapes it — which means every awkward tap at a real table becomes a design signal.

---

## Context

- **Environment:** Live poker rooms. Variable lighting, often dim. Other players and a dealer at the table. Ambient noise. Interruptions (dealer shuffle, player arrivals/departures, food delivery, bathroom breaks).
- **Device:** Samsung Galaxy A22 landscape is the primary target device (1600x720 CSS pixels after Android's chrome). Other phones in portrait or landscape are possible. Tablet use is plausible but not primary.
- **Session shape:** 3–6 hour live poker sessions. Bursty usage — active for ~60s per hand, mostly idle between. ~30 hands per hour.
- **Available attention:** Split between cards, chips, opponents, dealer, and app. App cannot demand sustained focus; it must survive half-second glances.
- **Available hands:** Often one-handed. Dominant hand is sometimes on chips, cards, or a drink. Thumb reach in landscape is the binding constraint.

---

## Goals

- **Remember what the app told him earlier** — advice, villain reads, prior hand context — without scrolling back.
- **Log what just happened fast** — pre-flop actions, bet sizes, villain's behavior — within the time he'd otherwise spend on social chatter.
- **Get better decisions than he'd make unaided** — especially in marginal spots where equity, SPR, and opponent tendencies all matter.
- **Trust the app enough to rely on it in real money situations** — false confidence is worse than uncertainty.
- **Extend the app himself** — he directs Claude but wants to understand and verify changes.

## Frustrations

- **Dense displays that require more than a half-second glance** — the sidebar rebuild program (2026-04-12 → 2026-04-16) was triggered by this. [EVID-2026-04-12-SIDEBAR-S1-S5]
- **Destructive actions adjacent to common actions** — misclicks at the table cost time and data. [EVID-2026-04-21-CLEAR-PLAYER]
- **Forms that don't fit the landscape viewport** — data entry that cuts off or refuses to scroll. [EVID-2026-04-21-LANDSCAPE-SCROLL]
- **State that disappears unexpectedly** — losing hand data to phone sleep or accidental navigation.
- **Overly generic advice** — recommendations that ignore bucket-by-player context. [EVID: memory `feedback_reasoning_quality.md`, `feedback_first_principles_decisions.md`]

## Non-goals

- **Pretty for its own sake.** Visuals that don't shave time or reduce error are wasted effort.
- **Onboarding flows.** He knows the app; any first-run friction is pure cost.
- **Cross-device sync as a primary use case.** Single-device single-user is the default path; sync is a nice-to-have (currently PAUSED in backlog).

---

## Constraints specific to this persona

- **Time pressure:** Varies wildly by situation. See situational sub-personas for calibrated ranges.
- **Error tolerance:** Very low during hands, moderate between hands, high post-session.
- **Visibility tolerance:** Primary actions must be obvious within the thumb-reach arc. Secondary actions can be one tap away. Destructive actions need visual distinction + cost-of-misclick proportionate to impact.
- **Recovery expectation:** Undo within 5s for reversible actions (retro-link undo toast is a good pattern). No recovery needed for clearly-labeled destructive actions; but misclicks on benign-looking buttons that destroy data are the worst failure mode.

---

## Related JTBD

- See [JTBD Atlas](../../jtbd/ATLAS.md) for the full list.
- Most relevant this session: `player-management` domain jobs.

## Related situational sub-personas

- [Mid-hand Chris](../situational/mid-hand-chris.md) — 3–30 second decision window under table pressure.
- [Between-hands Chris](../situational/between-hands-chris.md) — 30–90 seconds for logging + lightweight reads.
- [Seat-swap Chris](../situational/seat-swap-chris.md) — player leaves, new one sits, needs fast reassignment.
- [Post-session Chris](../situational/post-session-chris.md) — off-table review, depth over speed.

---

## Proto-persona caveat

Marked PROTO until owner confirms or refines. Key assumptions:

- **[A1]** Primary use context is live in-person poker rooms (not online). Basis: exploit engine designed for 9-handed live play; memory notes "live poker hand tracker"; Samsung A22 landscape target. Verify by owner statement.
- **[A2]** Session length 3–6 hours typical. Basis: industry norm for live sessions. Verify by owner statement or session-length data from IndexedDB.
- **[A3]** One-handed operation is the binding ergonomic constraint during hands. Basis: live-table reality. Verify by owner report of which hand holds phone vs. chips/cards.
- **[A4]** Chris uses the app across both cash and tournament play. Basis: presence of Tournament context and Online view in codebase. Verify by usage breakdown.
- **[A5]** Stakes / bankroll size unknown; does not drive design directly but would shape "trust the advice" threshold. Not worth verifying unless a design question hinges on it.
- **[A6]** No other humans use the app. Basis: single-user app design; memory notes "AI is sole developer." Verify by owner statement.

Any A1–A6 that turns out false should flag re-review of Frustrations + Constraints sections.

---

## Change log

- 2026-04-21 — Created in Session 1 of design-framework project. Proto-status; awaiting owner confirmation of assumptions.
