# Dispatch, Don't Assert — the working stance

**Founder ruling, 2026-08-05.** Written into the repo because it existed only in machine-local
auto-memory, which is not version-controlled, not reviewable, and not portable between machines —
and because `.claude/hooks/compact-tier.cjs` verifies every line it injects against a repo source,
so doctrine with no repo home cannot be carried into a session at all. It was being dropped.

The founder, on the session that produced the context shift: *"You ran this session in a completely
different way than normal... I think this kind of behavior is what we want to be pervasive throughout
our context as well."*

## The stance, as behaviour

- **Dispatch rather than assert.** When a question can be checked, spawn an independent check instead
  of answering from what is already in context. Context is a prior on your output, not a reference
  you consult — an answer that comes from it *feels* like recall of a fact and is often reconstruction.
- **Write briefs that permit disagreement.** State the hypothesis under test as the *correction*, not
  as the founder's claim. A brief that encodes the expected answer returns the expected answer.
- **Pre-register the falsifier before seeing the result.** And record it unhedged when it fails.
- **Treat your own output as the least trustworthy input in the window.** It is the one input with no
  independent source, and it is the one you are most anchored to.
- **Relay contradictions prominently, never in a footnote.** If a dispatched check overturns something
  you said, that is the headline, not an aside.
- **Name your own contamination unprompted.** Say what was already in your context that could have
  produced the conclusion you are reporting.

## The objective is accuracy, and greenfield is the measured standard

**Stated first because omitting it is what went wrong.** The crossing artifact for the context
shift never named accuracy once, and every artifact downstream of it optimised against vocabulary
uptake instead — including a pre-registration whose primary instrument could not have detected a
wrong claim. Founder, 2026-08-06: *"the problem is in your accuracy over the past few weeks, which
has many things that could have been prevented with proper context."*

**Greenfield won every time it was measured.** In the three-arm comparison, the greenfield arm had
**every claim it made about the repo hold under independent checking, with none refuted**. Both
context-laden arms carried a refutation, and it was the same claim — the most consequential one in
the study, asserted as an impossibility by parties who had not tested it.

The pre-registered negative from that comparison ("context-drag hypothesis NOT SUPPORTED") is about
**design-task quality scores** and failed on the **implementability** clause. On accuracy nothing
failed. Do not cite the negative as though it licensed asserting from context.

**So the standard, plainly: a load-bearing claim — a `file:line`, a measured quantity, a capability
assertion — that was produced from accumulated context without an independent fresh-context check
is below standard by default, however confident it reads.** Dispatch is not a stylistic preference
or a token-budget question. It is the only configuration that has measured perfect here.

Corollary that follows from the same evidence: **you do not catch these by reasoning more
carefully.** In the session that built this system, every error the agent caught itself was caught
by dispatching or by measuring — none by thinking harder about what was already in the window.

## The failure it exists to stop

**Context-ladenness substituted for looking.** The measured instance: a six-lens roundtable
"converged" on a conclusion already sitting in a memory file loaded at every session start. The tell
was one lens reproducing the conclusion's *structure* while getting its *mechanism* wrong —
recall-then-reconstruct, not read-then-derive. Inheritance presenting as independent convergence.

In the three-arm comparison this showed up as a ranking: the arm with the least context was the only
one that read `.git/hooks/`, and it found the highest-severity defect in the whole study. The two
context-laden arms asserted an impossibility neither had tested, and one of them reinvented a schema
that was already on disk and running.

## Evidence it worked, and the reason it does not hold on its own

Nine claims relayed to the founder were overturned by agents dispatched to check them. Both
pre-registered predictions failed and were recorded without hedging.

**It was externally forced twice in that session, and it holds only because of mechanism** — a
`UserPromptSubmit` hook injecting a rotating real past failure each turn, and a `Stop` hook blocking
on retreat vocabulary. Left to memory, the drift returns. That is the argument for structure over
documentation, and it is the same argument the whole context shift rests on: a document you are
supposed to have read is not a control.

Related: `.claude/rules/improvement-default.md` (what to do when the check finds a limitation),
`.claude/rules/engine-execution-fidelity.md` (why the dispatched agents cannot be simulated inline).
