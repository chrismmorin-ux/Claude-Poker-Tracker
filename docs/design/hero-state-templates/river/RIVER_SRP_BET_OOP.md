---
archetypeId: RIVER_SRP_BET_OOP
family: RIVER_SRP_BET
voiceNotes: |
  Hand-conditioned headline. Body stresses that betting OOP forfeits the option
  to bluff-catch — we're committing now, so the bet needs strong value or a
  polarized bluff with a blocker rationale. Block-bet line lives in
  RIVER_BLOCK_BET; this template covers full-pot or polarized OOP river bets.
  Range-advantage muddied by being OOP through three streets. Branches: vs raise,
  defending range is tightest in catalog — no future streets, OOP.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - handContext.handStrength
  - equity.overall
  - equity.vsRangeParts.vsValue
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — betting river OOP in a single-raised pot.**

## Body

Betting OOP at the river is committing — we give up the option to check-and-bluff-catch. {{plan.primary.action}} {{plan.primary.sizing}} only with hands that want to be called by worse or fold out better; everything else checks and uses the OOP bluff-catching frame. {{plan.primary.sizingRationale}}.

A {{handContext.handStrength}} in our class earns the bet by beating villain's calling range at this sizing band — our equity is {{equity.overall}} overall, but the relevant slice is {{equity.vsRangeParts.vsValue}} against the value combos that will call, and that's what determines whether the bet prints. Bluffs at this node are polarized: we pick combos with strong blocker reasons (block villain's nuts, unblock the bluff-catchers we want to fold). Range advantage from preflop is muddied because villain caught up by calling through three streets — assume their range is bluff-catcher-heavy on most run-outs.

Big sizing here signals nuts or air more clearly than IP — villain's check to us already showed weakness, so an overbet from OOP polarizes us in their eyes. That's the design, but it cuts both ways: villain's calling range tightens with our sizing.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Two responses we care about: (1) villain folds or calls — both are fine; the bet was sized for one of these outcomes. (2) villain raises — the tightest defending spot in the catalog. No future streets, no position, and villain's raise range is value-heavy because raising-as-bluff OOP is rare. Fold the bottom of our value range and all bluffs; call only with the top of our value range (two-pair+ or better).
