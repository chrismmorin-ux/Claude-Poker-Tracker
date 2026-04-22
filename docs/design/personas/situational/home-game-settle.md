# Situational Sub-Persona — Home Game Settle

**Type:** Situational (single-persona)
**Applies to:** Ringmaster (primary), other players at home game (passively)
**Evidence status:** PROTO
**Last reviewed:** 2026-04-21

---

## Snapshot

The home game is winding down. Players are starting to cash out. The host needs to reconcile the game: who bought in for how much, who cashed out for how much, who owes whom. The output is a clean debt graph — ideally Venmo-ready amounts so nobody leaves disputing numbers.

---

## Situation trigger

- Host calls the game over, or enough players are leaving that settlement is underway.
- Exits when: all debts are settled.

## Context

- **Time pressure:** Low-to-medium — players want to leave, but a wrong number is worse than a slow settlement.
- **Attention:** Shared — drinks, conversation, people gathering their things.
- **Cognitive load:** Moderate. Host is doing math and hospitality simultaneously.
- **Social stakes:** High. A wrong settlement damages the weekly game.

## Primary need

- Accurate per-player buy-in + cash-out totals.
- Debt graph that minimizes number of transactions (nobody wants 8 Venmos when 4 will do).
- Venmo-ready amounts — exact cents matter.

## Secondary needs

- Lifetime P&L per regular so the game has light social stats.
- Share a settlement summary to the group chat.
- Record ragequit-departures where a player left early with chips still on table.

## What a surface must offer

1. **Buy-in / cash-out ledger** per player, editable before finalizing.
2. **Optimized debt graph** showing the minimal set of transactions needed to settle.
3. **Copy-to-clipboard** or **share-sheet** for Venmo amounts.
4. **Lifetime aggregation** across weekly sessions for long-running games.

## What a surface must NOT do

- Require the host to do the minimization math manually.
- Silently handle rounding errors that make the ledger disagree by pennies.
- Expose sensitive debts to the whole group when the host only wants to share summaries.

---

## Related JTBD

- `JTBD-SG-54` settle home game cleanly
- `JTBD-SG-55` group-wide stats
- `JTBD-SG-57` share a clip or card to group chat

## Related core personas

- [Ringmaster](../core/ringmaster-home-host.md) — primary

## Missing features

- [DISC] Home-game settle mode with debt-graph minimization.
- [DISC] Venmo-ready share card.
- [DISC] Lifetime group stats per recurring game.
- [DISC] Multi-player session mode.

---

## Change log

- 2026-04-21 — Created Session 1b.
