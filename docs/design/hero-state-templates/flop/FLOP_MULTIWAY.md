---
archetypeId: FLOP_MULTIWAY
family: FLOP_MULTIWAY
voiceNotes: |
  v1 stub per WS-139 plan-mode resolution. Multiway breaks HU
  range-vs-range reasoning per design doc §7.4 — full template
  needs sequential decision modeling (cascading folds, multiway
  fold-frequency math). Captured here at minimum coverage so the
  catalog is complete and the orchestrator has a fallback to
  render. Expand in v2.
v2_TODO: |
  Multiway invalidates HU range-vs-range reasoning (design doc
  §7.4). v1 stub. v2 should add:
    - Sequential decision modeling (multiway fold-frequency
      math: P(all fold) = ∏ P(player_i folds))
    - Bluff-frequency reduction formulas (cascading fold equity
      decays multiplicatively)
    - Equity dilution by player count (3-way ~75% of HU, 4-way
      ~60%)
    - Specific 3-way and 4-way archetypes (split FLOP_MULTIWAY
      into FLOP_MULTIWAY_3W and FLOP_MULTIWAY_4W+)
    - Position-specific multiway plans (3-way on the BTN vs
      3-way OOP have different shapes)
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - situation.playersRemaining
  - plan.primary.action
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} multiway flop — tighten and play face up.**

## Body

We're in a multiway pot ({{situation.playersRemaining}} players to the flop). The HU range-vs-range frame that the rest of the HSP catalog uses doesn't directly apply — our equity is diluted by every additional opponent, fold equity drops multiplicatively (every opponent has to fold, not just one), and bluff frequency has to drop accordingly. The default mode is value-heavy and face up.

Continue with strong made hands (top pair good kicker or better; overpairs on disconnected boards) and premium draws (combo draws, OESD with overcards). Marginal pairs that would float HU get folded multiway because (a) the equity dilution against multiple ranges is severe, (b) we have no fold equity to compensate, and (c) somebody usually has the hand we're worried about.

Sizing skews larger on value (charge multiple opponents for setting up draws) and smaller on bluff-light lines (when bluffing at all). Bet only with hands that genuinely want to be played for stacks at a higher frequency — donk leads, semi-bluff raises, value bets — and check-fold the marginals.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Default branches: (1) bet for value with strong made hands. (2) bet for protection with vulnerable made hands on dynamic boards. (3) check-fold most marginals. (4) selective semi-bluffs with strong draws when the field is passive. The full multiway decision tree is deferred to v2 (see `v2_TODO` frontmatter).
