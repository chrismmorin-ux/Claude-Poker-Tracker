---
archetypeId: FLOP_MULTIWAY
family: FLOP_MULTIWAY
voiceNotes: |
  Catch-all multiway template (3+ players to flop with null or unknown
  potType). Three sibling sub-archetypes — FLOP_MULTIWAY_SRP / _3BP /
  _LIMPED — handle the load-bearing pot-type cases (WS-154 / SPR-106,
  2026-06-04). This template fires only when potType doesn't classify
  (defensive default). Generic multiway pedagogy applies: equity
  dilution, cascading fold equity, capped caller ranges, value-heavy
  mode. See HERO_STATE_DESIGN.md §7.4 for the multiway taxonomy.
v3_TODO: |
  Multiway model is v2 (WS-154). Open follow-ups, file ONLY if
  observed usage demands them:
    - TURN_MULTIWAY / RIVER_MULTIWAY pot-type splits (mirror the flop
      taxonomy if multiway-turn/river hands prove common)
    - Pairwise villain-range conditioning primitive in src/utils/
      exploitEngine/multiwayRangeNarrower.js (narrow villain₂'s range
      given villain₁'s prior action — would enable real role-partition
      computation per-villain, currently null multiway)
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - situation.playersRemaining
  - situation.multiwayHeroRole
  - equity.overall
  - equity.realization
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} multiway flop — tighten and play face up.**

## Body

We're in a multiway pot ({{situation.playersRemaining}} players to the flop) where the pot type didn't classify into one of the load-bearing shapes (SRP / 3BP / limped). The heads-up range-vs-range frame doesn't apply — our overall equity against the field is {{equity.overall}}, diluted by every additional opponent, and equity realization is discounted further. The default mode is value-heavy and face up.

Cascading fold equity is structurally weak multiway because every opponent has to fold, not just one. The probability that everyone folds scales multiplicatively with player count; bluff frequency must drop accordingly. The recommended action is {{plan.primary.action}} for {{plan.primary.sizingRationale}}, with the multiway fold-equity collapse and equity-realization discount already baked into the EV math.

Continue with strong made hands (top pair good kicker or better; overpairs on disconnected boards) and premium draws (combo draws, OESD with overcards). Marginal pairs that would float HU get folded multiway: equity dilution is severe, we have no fold equity to compensate, and somebody usually has the hand we're worried about. Sizing is {{plan.primary.sizing}} — larger on value lines (to charge multiple opponents for setting up draws) and smaller on bluff-light lines (when bluffing at all). Bet only with hands that genuinely want to play for stacks at a higher frequency.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Default branches: (1) bet for value with strong made hands. (2) bet for protection with vulnerable made hands on dynamic boards. (3) check-fold most marginals. (4) selective semi-bluffs with strong draws when the field is passive. The pot-type-conditioned templates (FLOP_MULTIWAY_SRP / _3BP / _LIMPED) carry more specific guidance; this catch-all body applies when potType is null or unknown at classification time.
