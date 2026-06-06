---
archetypeId: RIVER_SRP_VS_BET_IP
family: RIVER_SRP_VS_BET
voiceNotes: |
  Bluff-catching is the dominant frame. Body covers MDF + bluff-to-value ratio
  driving call/fold and the hand-class split (BLUFF_CATCHER → call vs fold by
  blocker, TWO_PAIR+ → raise/call, AIR → fold). IP raise is polarized (nuts +
  best blocker bluffs) but rare. Three-response branch summary explicit.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - handContext.handStrength
  - equity.overall
  - equity.vsRangeParts.vsValue
  - equity.vsRangeParts.vsBluff
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a river bet IP in a single-raised pot.**

## Body

Facing a river bet IP, the dominant frame is bluff-catching. Our equity is {{equity.overall}} — but the river-relevant breakdown is {{equity.vsRangeParts.vsValue}} when villain has it and {{equity.vsRangeParts.vsBluff}} when they don't, and that tells us which combos in our range earn a call. MDF says we have to defend roughly pot-odds-implied frequency or villain prints from any-two; the bluff-to-value ratio in their betting range tells us whether MDF is even relevant.

A {{handContext.handStrength}} {{handContext.handClass}} earns its continue by beating villain's value OR blocking it. Bluff-catchers prefer combos that unblock villain's bluffs and block their value — the same nominal hand strength that blocks bluffs (e.g., holds the bluff-side blocker like the busted-draw card) is closer to a fold than a call. Two-pair-plus has a raise/call decision: raise when villain's value range contains worse hands that pay us off, call when their range is mostly bluffs we want to keep in. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Position gives us the option to raise as a polarized line — IP raises against river bets are nuts plus best-blocker bluffs (the combos that block villain's calling range AND have no showdown value). The pure-bluff-raise frequency stays low; most of our defense is in the call range.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — the default for bluff-catchers and made hands that beat villain's bluffs but can't get more from worse. (2) raise — polarized: nut value plus blocker bluffs that fold out villain's marginal bluff-catchers. (3) fold — hands that block villain's bluffs (so their range is more value-weighted vs us) AND lose to value; without those two conditions the call has positive EV.
