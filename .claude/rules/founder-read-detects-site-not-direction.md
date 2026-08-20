# The founder's read detects the SITE, not the DIRECTION

**Founder ruling, 2026-08-20.** Resolves WS-290 and governs every use of founder disagreement as
evidence.

> *"Sometimes I am correctly refuted by you, and many other times I have to correct you. I'm
> certainly flawed in my own poker game, so I'm not a truth candle, but I can tell you the
> experience of a poker player, which is a pretty good detector of nuance without having a great
> set of terms to describe it. That's the limit of the validation I can provide on data. That and
> going and executing it. We're on our own otherwise."*

## The rule

**Founder disagreement is a high-quality signal that something is wrong AT THIS SPOT. It is not
a value to update toward.**

The read locates the fault. It does not sign it.

- **Never** take the founder's stated number, direction, or preferred action as the target the
  model should move to. He is explicit that he is not ground truth, and the record bears it out
  in both directions — his corrections have overturned the model, and the model has correctly
  refuted him.
- **Always** treat the disagreement as a **flag on the spot**: something in this situation is not
  being represented, and the model's account of it should be re-derived from first principles
  rather than nudged.
- The value he supplies is **nuance detection without vocabulary**. He can tell that a spot is
  wrong before anyone can say why. That is exactly the signal a model cannot generate about
  itself, and it is worth more than a number would be.

## Applying it

1. **Record every divergence** — the spot, the model's action and its reasoning, the founder's
   action, and the date. This is the only live signal the system has and it is never discarded.
2. **A divergence opens an investigation, not an update.** The output is a re-derivation of the
   spot: what does equity, pot odds, SPR and players-remaining actually say, and which layer of
   the stack is producing the disagreement.
3. **Score the divergences both ways.** Who was right, when it resolves. Over time this measures
   two things worth knowing — the model's accuracy, and the founder's — and neither is assumed.
4. **Cluster them.** A single divergence is an anecdote; five in the same spot class is a defect
   with a location. Clustered divergences are the highest-value finding source available.
5. **Never let the model learn his biases.** No path exists from a recorded divergence to a
   parameter change without a re-derivation in between. That gap is the rule.

## The stakes, stated plainly

*"We're on our own otherwise."* There is no external validator for this system. The founder's
read and executing the play at a real table are the two reality checks that exist. That raises
the burden on DEC-053 — validation of our own math must use ground truth that is not our own
code: analytic values, known-answer anchors, published references. Where those do not exist, a
divergence flag is what is left, and it must not be wasted by being treated as a number.

Related: `.claude/rules/dispatch-dont-assert.md`, `.claude/rules/cold-read-regime.md`, DEC-053.
