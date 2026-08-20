# Unmeasured constants — ship both arms, report the delta

**Founder ruling, 2026-08-20.** Resolves ~6 open queue items that each carried this as a
per-item decision flag.

## The rule

**When a constant is needed and has not been measured: run both arms and report the delta.**

The founder's estimate is one arm. The measured value — or the best available derivation — is
the other. They run as separate arms of the same instrument, and **the difference between them
is itself a result**, not a diagnostic to be looked at once and discarded.

This is neither "ship the estimate and tag it" nor "block until measured." Both of those were
refused, and the reasons are worth keeping:

- **Tagging and shipping** is how WS-291 survived the life of the project. A tag that nothing
  enforces is read by nobody. The estimate becomes the value, the follow-up ticket ages, and
  the fact that a number was hand-set stops being visible at the point of use.
- **Blocking until measured** stalls work behind compute that can take days, and converts a
  measurement question into a schedule question.

Running both converts it into a **measurement**. The delta is a number, so it can be tracked,
compared, and made to cross a threshold.

## Applying it

1. **Both arms are real arms.** Same Deal Book, same partition, same seeds, same engine commit —
   differing only in the constant. Anything else and the delta measures the setup, not the
   constant.
2. **The delta is reported, not buried.** It goes in the Result Card's metrics with the two arm
   values beside it. A delta of zero is a finding: it says the constant is not load-bearing on
   this path, which is worth knowing and is often surprising.
3. **A large delta promotes the constant.** If the answer moves materially between arms, that
   constant is now a first-class measurement target and gets its own item — not a footnote in
   the item that discovered it.
4. **Neither arm is "the answer" by default.** Which one a downstream consumer takes is a
   declared choice recorded in the manifest, never an implicit default that drifts.

## The cost this ruling accepts, named

**It doubles the compute on every affected path.** That was chosen with the price stated, and
node1 is the reason it is affordable — this is precisely the class of work that should be
queued up and left running. Cost is a thing to engineer around, never a reason to ship the
shallower answer.

Related: `.claude/rules/sparsity-refuse-or-shrink.md` (thin data rather than missing data),
`.claude/rules/improvement-default.md`, DEC-053 (validation of our own math uses ground truth
that is not our own code).
