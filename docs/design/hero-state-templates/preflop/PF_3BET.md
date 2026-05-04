---
archetypeId: PF_3BET
family: PREFLOP_3BET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes polarized 3bet
  construction (value + blockers/bluffs, no merged middle), fold
  equity vs the opener's continuing range, postflop SPR shape.
  Branches: opener calls (3bp postflop), opener 4bets (fold/call),
  opener folds (take the pot).
slotsUsed:
  - handContext.hand
  - handContext.handClass
  - situation.positionClass
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - situation.sprZone
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} {{situation.positionClass}} — 3bet vs the open.**

## Body

We're 3-betting at {{plan.primary.sizing}}. {{plan.primary.sizingRationale}}. The 3bet range is polarized, not merged: the top of our range (premiums for value, dominating the opener's continuing range) plus selected bluffs with blocker equity (suited Axs, low suited connectors) — and almost no merged middle (offsuit broadways, weak suited connectors). The polarized shape gets value from the opener's continuing combos and folds out the marginal hands that would call a smaller 3-bet but fold to a polarized one.

Postflop, we'll play a 3-bet pot with initiative at SPR around {{situation.sprZone}}. That SPR shapes our cbet plan: lower SPR means more concentrated value-betting and tighter calling ranges; higher SPR allows for more multi-street planning.

Position relative to the opener matters. IP we 3bet wider (cbet more, fold equity from position). OOP we 3bet tighter and more polarized — the extra fold equity preflop has to compensate for the OOP postflop deficit.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses from the opener: (1) call → 3bet pot with initiative; cbet plan depends on board texture and SPR. (2) 4-bet → call only with the very top of our range (the part that does well vs their 4bet calling range); fold blockers and middle. (3) fold → take the pot down preflop, EV from fold equity realized.
