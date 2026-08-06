# Context System — Requirements and Comparison Pre-Registration

**Written 2026-08-05, BEFORE any arm produced a design.** This file is the fixed input to a
three-arm comparison and the pre-registered basis for judging it. It must not be edited after the
arms begin. If a requirement turns out to be wrong, that is a finding to record beside the results,
not an edit to make.

---

## Why this comparison exists

The founder's premise: **context is a prior on the model's output distribution, not reference
material.** Terms present in context become more likely to appear in the response; framings present
become more likely to be the framing reasoned within. It follows that accumulated context can *drag*
— old content pulling output toward superseded conclusions with real statistical force.

Direct evidence from this repo, 2026-08-05: a six-lens blind-spot roundtable "converged" on a
finding already recorded at file:line resolution in a memory file loaded at every session start. The
cross-critic caught it. The tell was that one lens reproduced the conclusion's *structure* while
getting its *mechanism* wrong — recall-then-reconstruct, not read-then-derive. Inheritance
presenting as independent convergence.

So the question is not only "what should the context system contain" but "does starting fresh
produce a better design than starting informed." This comparison tests both at once.

## The three arms

| Arm | What it has | What it lacks |
|---|---|---|
| **A — Greenfield** | This requirements file; read access to the running code | All doctrine, session history, design documents, memory, and the other arms' output |
| **B — Context-laden** | Full brief with session evidence, the validator precedent, the repo's own machinery | — |
| **C — Maximum drag** | The entire session in working context, all findings, all corrections | — |

Arm C is not the expected winner. It is the control: if drag is real, it should be most visible
here, and that is the measurement.

---

## Requirements

Numbered so the judge can score against them individually. A design need not satisfy every one — an
argued refusal is a valid response and should be judged as such.

### Core mechanism

**R1 — Exploit the prior, do not merely store.** The design must treat context as shaping output
distribution, not as a library to consult. A structure that is merely well-organised storage does
not satisfy this.

**R2 — An always-loaded compact tier.** Dense in the vocabulary and invariants that must shape every
response. Its job is to force the language in, not to summarise. State the selection criterion and
the size ceiling beyond which it stops being loaded in practice.

**R3 — A comprehensive tier.** Complete, authoritative, not always loaded. State what earns a place
here that does not earn a place in R2.

**R4 — The tiers must not be able to disagree.** A *mechanism*, not an intention. Two artifacts that
can drift apart is a failure mode this repo has been burned by repeatedly.

**R5 — Corrections-history has a home, and it is argued.** "We thought X, we were wrong, actually Y"
has real value — a prior roundtable depended on knowing a taxonomy had been falsified before. It may
also be the primary source of drag, since it primes both the wrong idea and the right one. Decide
where it lives and defend it. A useful distinction to consider: a correction that has fired more
than once is doctrine; a correction that fired once and was fixed structurally is archaeology.

**R6 — Overlooked concepts get early introduction.** Concepts the system repeatedly gets wrong
should appear early and prominently rather than deep in a document. The design should say how such
concepts are identified and promoted.

### Scoping

**R7 — Scoped sub-contexts per task type.** Not every task should load everything. Define the unit,
and answer how a bundle avoids going stale against the files it names.

**R8 — Persona assignment to a task.** A task declares the analytical lens it is executed under.
NOTE: this repo contains two different things called "personas" — product-user personas (who uses
the product) and analytical-lens personas (how a problem is examined). Conflating them would be a
material error; the design must keep them distinct or explicitly justify unifying them.

**R9 — A withholding rule.** Sometimes context must be *excluded* so a task derives a conclusion
rather than recalls one. This is the inverse of how context is usually designed and it is a hard
requirement, not an optimisation.

### Enforcement

**R10 — Machine-enforced, warn-don't-block.** A document someone is supposed to have read is not a
control. Precedent in this repo: a validator that checks declared vocabulary and emits a *warning*,
never a violation — because an item that fails the check may be evidence about the declaration
rather than about the item.

**R11 — Size ceiling with something enforcing it.** A bundle that grows without bound becomes the
monolith it replaced.

**R12 — Works without having been read.** The design must not depend on the AI having read the
design.

### Fidelity

**R13 — Native vocabulary preserved.** This repo has deliberately built its own terminology.
External frameworks may be quantified and learned from; they must not be imported as doctrine.

**R14 — A falsifier.** State how anyone would know whether the system worked. A context restructure
that cannot be evaluated is faith. The falsifier must be something actually measurable, not a
sentiment.

---

## Pre-registered comparison criteria

Scored by a judge that produced none of the arms. **Fixed before any arm was written.**

| # | Criterion | What earns a high score |
|---|---|---|
| **C1** | Requirement coverage | Addresses R1–R14; an argued refusal counts as addressed, silence does not |
| **C2** | Mechanism over intention | Proposes enforceable machinery rather than stated discipline. R4, R10, R11 are where this bites |
| **C3** | Implementability | Grounded in what actually exists; a design requiring machinery the repo does not have must say so and cost it |
| **C4** | Novelty against the status quo | Does it propose something genuinely different, or restate the current arrangement with new names? |
| **C5** | Drag markers | Does it carry forward superseded framings, dead vocabulary, or conclusions it did not derive? Lower is better. **This is the criterion the whole experiment exists to measure.** |
| **C6** | Falsifiability | Is R14 answered with something measurable |
| **C7** | Concision | Does it earn its length |

### Predictions, recorded before the outcome

Stated so they can be wrong.

- **P1** — Arm A (greenfield) scores highest on C4 (novelty) and C5 (drag markers), and lowest on C3
  (implementability), because it cannot see what exists.
- **P2** — Arm C (maximum drag) scores highest on C3 and lowest on C4 and C5.
- **P3** — Arm B lands between them on all five.
- **P4** — The best final artifact is a cherry-pick across arms rather than any single arm.

If P1 and P2 both fail, the context-drag hypothesis is not supported *for design tasks* — which is a
real and useful negative result, and must be reported as prominently as a positive one.

### Judging rules

- The judge must not know which arm is which where that is concealable, and must score C1–C7 before
  forming an overall view.
- Ties are reported as ties. Do not manufacture a winner.
- The deliverable is a **cherry-picked synthesis** naming which arm contributed each element, not a
  ranking. The ranking is the by-product; the artifact is the point.
