# JTBD Domain — Social / Group

Jobs involving more than one user — home games, friend groups, staker-horse relationships.

**Primary personas:** [Ringmaster](../../personas/core/ringmaster-home-host.md), [Banker](../../personas/core/banker-staker.md), [Apprentice](../../personas/core/apprentice-student.md) / [Coach](../../personas/core/coach.md) pair.

**Surfaces:** home-game settle mode, group stats, staker portal — all proposed.

---

## SG-54 — Settle home-game buy-ins / cash-outs

> When hosting a home game, I want to settle buy-ins and cash-outs across 9 players with minimal transactions, so nobody leaves disputing.

- State: **Proposed** (DISC-09).
- See [home-game-settle situational](../../personas/situational/home-game-settle.md).

## SG-55 — Group-wide stats (lifetime leaderboard)

> When hosting, I want lifetime stats across the group, so there's social engagement between sessions.

- State: **Proposed**.

## SG-56 — Private friend-group leaderboards

> When in a friend group, I want private leaderboards, so we compete without the data being public.

- State: **Proposed**.

## SG-57 — Share clip / hand card to group chat

> When something memorable happens, I want to tap one button and share a clip / card to group chat, so the hand lives on.

- State: **Proposed**.

## SG-58 — Staker read-access to horse sessions

> When staking a player, I want read-access to their session data and flagged hands, so trust is evidence-based.

- State: **Proposed** (DISC-08).

## SG-59 — Privacy controls (horse side)

> When I'm a staked horse, I want to control what my staker can see (hands yes, bankroll no), so it's not invasive.

- State: **Proposed**.

## SG-90 — Cryptographically signed sessions

> When reporting to a staker, I want session data that's signed so it can't be tampered with after the fact, so trust is cryptographic.

- State: **Proposed** (DISC-18).

---

## Domain-wide constraints

- Everything in this domain requires auth + multi-user + permissions.
- Privacy boundaries are not optional — design around "what can each party see" first.
- Home game and staking are distinct relationship models; don't conflate.

## Change log

- 2026-04-21 — Created Session 1b.
