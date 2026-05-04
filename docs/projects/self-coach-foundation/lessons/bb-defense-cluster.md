---
conceptId: bb-defense-cluster
title: BB Defense — Pot-Odds + OOP-Penalty Math
tier: 2
leakTagIds:
  - hero-bb-defense-width
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §4.3 (BB defense)
  source_line: null
versionLineage:
  version: 2
  authored_at: 2026-05-03
  amended_at: 2026-05-04
  amendment_reason: "Reframed as cluster umbrella per WS-148 / SPR-033 high-granularity decision. Sub-concepts enumerated below; per-opener-position lessons + per-opener-position rule split = WS-146 v2 + WS-149."
---

## Exposition

BB defense is the only preflop spot where hero closes the action with a discount. The 1bb already invested means hero needs significantly less raw equity to call profitably than position alone would suggest. Against a 2.5x open, hero is putting 1.5bb to win 4bb (the open + the SB) — pot odds of about 2.7:1, requiring just 27% equity to break even.

That math justifies wide defense, but the OOP-penalty pulls it back. Realizing equity OOP without initiative is the worst combination of conditions in NLHE. A hand that flops a marginal pair OOP can't easily check-call multiple streets without bleeding chips to villain's barreling. So the defending range, while wider than positional intuition suggests, is tighter than pot odds alone would say.

The dominant lever in BB defense width is **opener position**. Per the SCF granularity floor, each opener position is its own concept (sub-lesson) because the solver baseline differs significantly:

- **bb-defense-vs-EARLY** — defend ~22% vs UTG/EP open. EP opens tightest range; BB defends only with hands that can withstand domination.
- **bb-defense-vs-MIDDLE** — defend ~32% vs MP/HJ open. MP range is concentrated; BB's marginal hands struggle.
- **bb-defense-vs-LATE** — defend ~45% vs LJ/CO open. CO range is moderately strong.
- **bb-defense-vs-BUTTON** — defend ~55% vs BTN open. BTN opens widest; BB has high realized equity vs the bottom of BTN's range.
- **bb-defense-vs-SMALL_BLIND** — defend ~62% vs SB open. SB-vs-BB heads-up dynamic; SB widens significantly because SB has poor equity realization OOP, so BB defends widest.

Today's `hero-bb-defense-width` rule fires on aggregate (one situation key spanning all opener positions). The per-opener-position rule split lives in WS-146 v2; once shipped, the leak badge will route to the specific sub-concept that crossed threshold.

Three structural takeaways apply across all sub-concepts:

1. **Suited hands defend wider than offsuit.** Suited connectors realize equity OOP via flush draws + straight draws + position-independent multi-street value. Offsuit broadways with weak kickers don't.
2. **Pocket pairs are the universal defends.** Set-mining works regardless of opener position. Even 22 vs EP open is a profitable defend at the right stack depths.
3. **The 3-bet is the safety valve.** Marginal hands that don't quite make the flat range often work as polarized 3-bets — taking initiative + denying villain the postflop OOP penalty hero would otherwise face.

The leak the SCF detector watches for is overfolding — defending tighter than the solver baseline. Underfolding (calling too wide) is also possible but less common in disciplined-player ranges.

## Worked example

**Spot 1 (vs LATE):** Hero in BB with K♠Q♥. CO opens to 2.5bb. Action folds to hero.

KQo is comfortably above the BB defense threshold vs CO (within the ~45% defend band). Hero has top-pair-or-better outs, blocker effects against CO's strong hands, and the OOP penalty is mitigated by the strength of the hand. Default: **call**. Mixing in 3-bets at low frequency vs aggressive openers is also fine.

**Spot 2 (vs EARLY):** Hero in BB with 6♠5♠. UTG opens to 2.5bb. Action folds to hero.

Suited connectors against EP ranges face a fold. UTG's range is concentrated on hands that dominate hero's draws (overpairs, AK that flop top pair). The OOP-penalty + tight EP range mean realized equity drops below the pot-odds threshold. Default: **fold**. (vs BTN open, the same hand defends; the position swing matters that much — that's why the rule splits per opener position.)

## Success criteria

Internalized when the user can name the BB defense width vs each opener position (vs BTN ~55%; vs CO ~45%; vs MP ~32%; vs EP ~22%; vs SB ~62%) and articulate the trade-off — pot-odds-discount widens defense; OOP-penalty narrows it; suited + pairs defend wider than offsuit because they realize equity better. For mastery at the cluster level, the user can also state which sub-cell (opener position) shifts the baseline up vs down without consulting the table.
