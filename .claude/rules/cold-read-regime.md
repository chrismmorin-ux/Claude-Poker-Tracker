# The cold-read regime — the operating constraint everything is designed against

**Founder ruling, 2026-08-20.** This is not one rule among several. It is the condition the
whole system operates under, and most design mistakes in this repo trace to forgetting it.

> *"That's kinda the whole thesis, that I can sit down and apply these exploits limited to just
> the time I have with a particular villain. In majority of cases, there is no studying
> beforehand. Some villains are regulars, but I can't see players beyond a session on Ignition
> and I can't record every hand when playing live, so the data will always have limitations."*

## The regime

1. **No pre-study.** In the majority of cases the founder sits down having never seen this
   villain. There is no profile waiting. The clock starts at the first hand.
2. **The observation window is one session, and it is short.** Ignition does not carry a player
   across sessions. Live, not every hand gets recorded — attention at the table is the binding
   constraint, not disk.
3. **The data will always have limitations.** This is a permanent property of the problem, not a
   temporary state that more collection fixes. Design against it rather than for its removal.
4. **The founder's thesis, stated as a claim to be tested:** *"Modern villains is an unknown
   shape. But I think we can take a really, really good guess before we even need a single
   measurement, and that we can nail it from just a few tendencies."*

## What follows, and it inverts the obvious design

**The problem is identification, not accumulation.** The system's job is not to build a complete
model of a villain over many hours. It is to **locate him fast in the space of villain policies
from a handful of tendencies**, and to know how much of the exploit is already available at that
resolution.

Consequences that bind:

- **Speed of identification beats completeness of model.** A method that reaches 80% of the
  available edge in 20 hands beats one that reaches 95% in 500 hands the founder will never get.
  When those trade off, take the first — and say which you took.
- **Which question to ask next is a first-class output**, not a nicety. If a handful of
  tendencies locates a player, then *which* tendencies is the whole game, and optimal
  experimental design — pick the observation that discriminates most between the live
  hypotheses — is a core instrument. Not a research curiosity.
- **A prior that is good before any measurement is load-bearing infrastructure.** The founder's
  claim is that a really good guess exists ahead of data. If true, the population prior and the
  corpus-derived primitives are doing most of the work and deserve most of the investment.
- **The falsifier for the thesis already has a ticket.** WS-581 tests whether the villain policy
  matrix is effectively low-rank. If it is, few tendencies genuinely do locate a player and the
  thesis holds. If it is high-rank, the thesis is wrong and cold reading cannot work the way this
  system assumes. **That makes WS-581 the pivotal experiment in the project**, not a table-shape
  side quest.
- **"We'll have more data later" is never a plan.** It is the one thing the regime says will not
  happen. An item that only works at n the founder cannot reach is not deferred, it is wrong.

## What this does NOT license

It does not license shallow methods, small models, or shipping the cheap approximation. Removing
the limitation is still the default (`improvement-default.md`). What it changes is **which
limitation is the real one**: not "our model is too coarse", but "we have 40 hands and 90 minutes
and need the edge now." Build the instrument that wins under that constraint — do not shrink the
goal to fit an easier one.

Related: `.claude/rules/corpus-transfer-is-earned.md`, `.claude/rules/sparsity-refuse-or-shrink.md`,
WS-580 (a Conduct Card is a marginal policy), WS-581 (policy-space rank test), WS-583 (synthetic
round-trip validation).
