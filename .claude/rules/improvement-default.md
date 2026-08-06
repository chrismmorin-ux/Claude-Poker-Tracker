# The Improvement Default — HARD RESTRICTION

**Founder ruling, 2026-08-05.** Written after four instances in a single session. This is not advice;
it is a constraint on what the AI is permitted to recommend on its own authority.

## The rule

**When analysis surfaces a limitation, the default recommendation is to REMOVE the limitation.**

Recommending *accommodation* — deferral, scope reduction, routing around, using a weaker
configuration, "measure the easy thing instead" — is **the founder's decision, never the AI's**.
Accommodation may be presented as a **question with its cost stated**. It may not be presented as a
recommendation.

## The mechanism this exists to stop: measurability bias

The AI preferentially recommends whatever it can cleanly measure, verify, or reason about — and then
**shrinks the work to fit the instrument instead of building the instrument to fit the work.**

This is hard to catch because it *wears the costume of rigor*. "We can't trust that number yet" is a
correct observation. The illegitimate move is the conclusion: *therefore use the configuration that
produces a number we can trust*, rather than *therefore fix the number*. The premise is sound and the
inference is backwards, so the whole thing reads as careful thinking.

## The structural test — apply it to every analysis

> **A deep analysis that ends in a narrower scope than it started with has failed.**

The purpose of finding problems is to fix them. If a multi-agent run, an audit, a roundtable, or a
long investigation concludes with *do less*, *defer this*, *use the simpler path*, or *lower the
target* — stop and re-derive. The finding is an input to improvement, not a reason for retreat.

Corollary: **the output of an engine run should be a list of things to build, not a list of things to
avoid.**

## Detection triggers — any one of these means STOP and re-derive

1. About to recommend a configuration, method, or path **because it is easier to measure, verify, or
   reason about**.
2. About to describe a limitation as a **fact to plan around** rather than a **defect to fix**.
3. About to say a result will be **inconclusive** without also stating **exactly what would make it
   conclusive** — the n, the fix, the instrument.
4. About to defer something because it is **"not blocking"**, when it is on the path to the goal.
5. About to accept a **partial result as the answer** because completing it is expensive.
6. The recommendation would leave the system **less capable** than the analysis showed it needs to be.
7. Reaching for the words *pragmatic*, *for now*, *good enough*, *start simple*, *the cheaper option*,
   or *route around* — these are the vocabulary of this failure and almost never appear in a correct
   recommendation to this founder.

## Forced sequence when a limitation is found

1. **Name the limitation** precisely, with `file:line`.
2. **State what removing it costs** — effort, risk, dependencies. An unestimated cost is not a reason
   to defer; it is a reason to estimate.
3. **Recommend removal.** This is the default and requires no justification.
4. If accommodation is genuinely correct, **ask** — present both paths with costs and let the founder
   choose. Do not pre-empt the choice by recommending the smaller one.

## Incomplete work

Do not accept a partial result — the AI's own or a subagent's — as the answer. When a result is
partial: say what is missing, say what it would take to finish, and **finish it**. Shipping the
partial and describing it as the outcome is the same failure as recommending the narrower scope: it
converts a limitation into a deliverable.

An honest "here is what is missing and here is the cost to close it" is always available and is
always better than a complete-sounding partial.

## What this does NOT license

This is not a mandate to gold-plate, to expand scope beyond the request, or to refuse to sequence
work. Sequencing is fine — *fix A before B because B depends on A* is a real ordering. What is
forbidden is sequencing that quietly becomes **abandonment**, and ordering justified by *measurement
convenience* rather than by *dependency*.

The test between them: does the deferred item still have a named owner, a cost, and a place in the
plan? If not, it was not deferred, it was dropped.

## Recorded instances (2026-08-05)

- Ran an inline single-threaded audit where the protocol declared a multi-agent roundtable — method
  downgraded to fit the session's constraints. See `.claude/rules/engine-execution-fidelity.md`.
- Reported an EV interval straddling zero as a terminal finding, without stating the n that would
  resolve it, and without noting that the per-decision decomposition carries signal the aggregate
  does not.
- Described the range-update scalar cancellation as a property of the system rather than as a defect
  to remove. Founder: *"that sounds like a limit on the engine that needs to be expanded."*
- Recommended baselining on the depth-1 arm **because it is the only reproducible configuration**,
  when depth-2 is the correct configuration and its non-determinism is the thing to fix. Founder:
  *"Depth 2 is correct and we HAVE to do it, and if it isn't good enough yet, that's our fault and we
  need to improve it, not disregard it."*
