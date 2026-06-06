---
archetypeId: TURN_3BP_BARREL_IP
family: TURN_3BP_BARREL
voiceNotes: |
  Hand-conditioned headline. Body's distinctive frame vs the SRP version is
  low SPR — the 3-bet pot means the turn barrel often sets up a river
  commitment, ranges are tighter and stronger, and stack-to-pot drives the
  decision more than texture. References situation.sprZone. Branches: call
  (river-shove math), raise (very strong — fold non-nut), fold.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - situation.sprZone
  - equity.overall
  - equity.vsRangeParts.vsValue
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — barreling the turn IP in a 3-bet pot.**

## Body

We cbet the flop in a 3-bet pot and the turn is a second barrel IP. The defining difference from a single-raised pot is the stack-to-pot ratio: in the {{situation.sprZone}} SPR zone the pot is already large relative to stacks, so a turn bet frequently commits us — it's the front half of a river-shove plan, not an isolated bet. Decide the river before you fire the turn.

Ranges are tighter and stronger on both sides — the preflop 3-bet and call caps villain into a strong, narrow band. Our value barrels are overpairs and better ({{handContext.handStrength}}) plus the high-equity draws that have the equity to get it in. Our equity vs the continuing range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value). {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}, chosen so the river shove falls out naturally rather than leaving an awkward stub.

Check back the hands that don't want to commit and can't profitably stack off — pot control matters more when one more bet is all-in.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) called — low SPR means the river is usually a shove-or-give-up; barrel rivers that keep our equity, check back when we're drawing dead to value. (2) raised — villain's 3-bet-pot turn raise is near the nuts; fold everything but the top of our range. (3) folded — we collect the inflated pot uncontested.
