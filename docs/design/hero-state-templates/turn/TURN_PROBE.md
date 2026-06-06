---
archetypeId: TURN_PROBE
family: TURN_PROBE
voiceNotes: |
  Structurally framed headline (applies to the probing range, not one hand).
  Body's load-bearing idea: villain declined the flop cbet IP, which caps their
  range, and we attack that capped range by leading the turn OOP. Probe range =
  value we'd have check-called + hands that picked up equity. Branches: call,
  raise (villain's slowplays/floats), fold.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
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

**Probing the turn on {{handContext.boardTexture}} — villain checked back the flop, attacking a capped range.**

## Body

Villain had the chance to cbet the flop in position and declined. That check-back caps their range: the strongest hands usually bet for value and protection, so what remains is weighted toward marginal made hands, give-ups, and floats. We're OOP, and the turn is our chance to attack that cap by leading out — a probe.

Our probing range is the value we'd otherwise have check-called with ({{handContext.handStrength}} and better) plus the hands that just picked up equity and want to charge villain's draws and deny their realization. Because villain is capped, we get folds we wouldn't earn against an uncapped range. Our equity vs villain's check-back range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs the value that remains). {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}, sizing tuned to pressure the capped range rather than only fold out total air.

Check the hands with showdown value that beat villain's give-ups but don't want a raise — they'd rather see a cheap river than bloat the pot OOP.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) called — villain continues with the better part of a capped range; barrel rivers that stay scary, pot-control with thin value. (2) raised — a check-back-then-raise is the slowplay/float villain's line allows; respect it, fold marginal probes, continue nutted. (3) folded — the capped range surrenders, which is exactly why probing here prints.
