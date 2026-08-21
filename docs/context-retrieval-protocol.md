# Context Retrieval Protocol — making the pull channel mandatory

**Status:** design, not implemented. Pre-critique draft, authored 2026-08-20.
**Siblings:** `docs/context-bundles.md` (the bundle *unit*, shipped advisory),
`docs/context-architecture.md` (the *push* tier design, WS-423, unimplemented),
`.claude/hooks/context-barrier.cjs` (the *withholding* mechanism, wired but dormant).
**Owning program:** `prog-anti-hallucination` (health 0, baseline never run).

---

## 0. The problem, as measured

The founder's statement of it: *"Our 'I was wrong, and I had the info' rate is really high."*
Per `.claude/rules/founder-read-detects-site-not-direction.md` that read locates the **site**, not
the direction, so the site was measured rather than the claim accepted.

### 0.1 The channel asymmetry

| Channel | Bytes | Mechanism | Enforcement |
|---|---:|---|---|
| **Push** — injected every session before any hook runs | `CLAUDE.md` 37,054 + `.claude/rules/*` (16 files) 48,362 + global `CLAUDE.md` 1,375 + `MEMORY.md` 21,034 = **107,825** | harness injection | none possible — `context-barrier.cjs` documents this as the irreducible residue |
| **Pull** — read only on deliberate action | `.claude/context/` + `docs/standard-of-record/` = **731,704**; all of `docs/` = **10,571,438** across 659 files; 113 memory files = 496,245 of which 21,034 (the index) loads | Read / Grep / Glob | **no index, no coverage map, no forcing function** |

~108KB is pushed. ~730KB of load-bearing doctrine is pull-only and unindexed. A model
answers from the push channel by default because it is the only channel guaranteed present.
**That is the "wrong, and I had the info" shape stated mechanically:** the information was on
the pull side and nothing made the model go get it.

### 0.2 The existing mechanism, and its measured adoption

`docs/context-bundles.md` (367 lines, 2026-08-05) already establishes the correct scoped unit —
a pinned manifest of pointers, hash-verified, with an explicit withholding rule. Its premise is
the right one and this design inherits it: *"a document you are supposed to have read is not a
control."*

| | Measured 2026-08-20 |
|---|---:|
| Bundles authored | **2** |
| Problem classes covered | 4 |
| Queue items declaring `context_bundle` | **1 of 410** |
| Validator severity | advisory — blocks nothing |
| `active-bundle.json` present | **no** → `context-barrier.cjs` fails open on every call |
| Validator findings outstanding | 8 (3 content-drift, 1 budget-breach, 4 unbundled-task) |

**The repo built the withholding half and never built the retrieval half.** The barrier can stop
a read outside the active bundle. Nothing anywhere forces a read inside one.

### 0.3 The push channel is past the point where it works

`docs/context-architecture.md` §2.0 measured the always-loaded path at **60,116 chars (~15,000
tokens), 5 rules files**, and designed a light tier to fit a **250-line / 12,000-char ceiling**
inside it. That design was never implemented. The same path today is **106,450 chars, 16 rules
files** — **+77% in 15 days**, unbounded and ungated. External evidence puts retrieval
correctness degrading around 32k tokens; the push channel alone is ~27k before the founder types.

---

## 1. Primitives

### P1 · `coverage-index` — a segmented map with claimed coverage

A machine-checked index, one or two layers deep, in which **every file** under `.claude/context/`,
`docs/standard-of-record/`, `.claude/rules/`, `docs/adr/`, and the memory store is assigned to
exactly one segment, or explicitly marked out-of-scope with a stated reason.

The defining property is not compression, it is **claimed coverage**. An unassigned file is a
visible hole rather than an invisible absence. This is the same move `unexamined` already makes
in a Guide (`.claude/rules/sparsity-refuse-or-shrink.md`) — the holes become the work queue.

Segments are the existing `bundle` unit, scaled from 2 to full coverage of the corpus.

### P2 · `claim-citation-check` — mechanical, not advisory

A check that scans assistant output for load-bearing claim shapes — a `file:line`, a measured
quantity with units, a capability assertion ("X does not exist", "nothing reads Y") — and verifies
each resolves to content actually retrieved this session.

Published precedent (arXiv 2512.12117): mandatory citation validated by interval arithmetic
against the retrieved chunk set achieved **100% precision detecting hallucinated claims across
1,080 responses, zero false positives**. The load-bearing detail for this design: **models
self-cited only 62–88% of the time when merely instructed to.** Instruction alone leaves a
12–38% hole. Only the mechanical check closes it.

Parts already exist: `context-barrier.cjs` logs every read; `retreat-detector.cjs` is a `Stop`
hook that already scans assistant output for vocabulary.

### P3 · `retrieval-affordance` — what makes pulling cheap enough to happen

The interface by which a segment is actually loaded. Candidates: a slash command; a skill whose
description is always scanned (progressive disclosure); an MCP retrieval tool; or a
`UserPromptSubmit` hook that resolves the turn to a segment and injects its *pointer list* rather
than its content.

This primitive is the suspected cause of P1's historical failure and is step-1-critical for that
reason.

### P4 · `generated-vs-curated` — how the index comes into existence

Two options with different failure modes:

- **Curated** — a human or agent authors each segment, as `math-measurement.yaml` was. Highest
  quality per segment; adoption measured at 2 segments in 15 days.
- **Generated** — segments derived mechanically from the corpus (headings, `binds:` pointers, the
  citation graph, program `problem_classes`), then reviewed. Lower quality per segment;
  coverage-complete on day one by construction.

### P5 · `baseline-instrument` — the rate itself

The "wrong, and I had the info" rate is **not measured anywhere**: zero findings record it, and
`prog-anti-hallucination` has never run a baseline. Per ADR-009 a claim that this protocol
improved accuracy is a comparative claim and resolves to a Result Card or it is not a claim.

Proposed: a capture at the moment of occurrence (`cwos-capture friction`, one line, one field —
*was the contradicting information present in the repo at the time?*), plus a retro pass over
session logs for the shape.

### P6 · `push-channel-budget` — an enforced ceiling on injection

A mechanized ceiling on `CLAUDE.md` + `.claude/rules/*`, with content over the line relocated into
the pull index rather than deleted. `docs/context-architecture.md` §2.1 already argues the ceiling
must be in code: *"The ceiling is the only part of this design with no judgement in it, which is
exactly why it is the part most worth mechanizing."*

### P7 · `bundle-reconciliation` — reuse or replace

Whether the coverage index extends `.claude/context/bundles/*.yaml` and `context-barrier.cjs`, or
supersedes them. Also: whether P1's segments and WS-423's always-loaded light tier are one object
seen from two sides, or two objects competing for one budget.

### P8 · `staleness-model` — how a segment stays true

Inherits the bundle design's pinned-`sha256` manifest, whose argument is already settled in
`docs/context-bundles.md` §1: *"A stale pointer is still correct; a stale summary is wrong."*
External corroboration: arXiv 2602.20478's three-tier codified-context system reported staleness
as its primary failure mode — *"agents trusted outdated specifications implicitly"* and the
resulting errors *"appeared syntactically correct."*

---

## 2. Labeled assumptions

| ID | Assumption | Falsification test |
|---|---|---|
| **AS-CRP-1** | The cause of low accuracy is **absence of a forcing function**, not absence of content. | If a session given an explicit, correct index still answers from the push channel at the same error rate, this is refuted and the cause lies elsewhere. |
| **AS-CRP-2** | The bundle system reached 1/410 adoption because **retrieval was never forced**, not because curation was too expensive. | **PRE-REGISTERED, PRIMARY.** If the cause is curation cost, P1-as-curated inherits the identical failure and P4 must resolve to *generated*. To be recorded unhedged either way. |
| **AS-CRP-3** | A `Stop`-hook check changes subsequent behaviour rather than only producing a post-hoc correction. | The claim is already emitted when `Stop` fires. If flagged claims recur at the same rate in later turns, the hook is a logger, not a control, and enforcement must move earlier. |
| **AS-CRP-4** | Load-bearing claim shapes are **mechanically detectable** in assistant output at usable precision. | Hand-label N turns of transcript; measure detector precision/recall. Below usable precision P2 fails and the design needs a different trigger. |
| **AS-CRP-5** | Coverage-completeness converts blind spots into visible holes that then get filled. | If segments marked `unexamined` age without being filled, the index is documentation, not a queue. |
| **AS-CRP-6** | Relocating content from push to pull does not lose the framing effect the push channel provides. | Directly contested by `docs/context-architecture.md`, which argues the always-loaded tier works *because* repetition raises reuse likelihood. If that holds, P6 trades accuracy for budget and is wrong. |

---

## 3. The falsifier, pre-registered

**Primary measure:** the rate at which an assistant claim is contradicted by information present
in the repo at the time the claim was made — measured before, and after, on the same instrument.

**What refutes this design:** the rate does not fall, or falls only in sessions where the founder
was already going to catch the error anyway.

**What refutes AS-CRP-2 specifically, and forces a redesign:** evidence that bundle non-adoption
traces to curation cost. In that case the hand-curated index in P1 is the same mechanism that
already failed, and P4 must resolve to *generated-then-reviewed*.

---

## 4. Explicitly out of scope

Deleting doctrine. Reducing what the system knows. Every relocation in P6 moves content between
channels; nothing is dropped. Per `.claude/rules/improvement-default.md`, a design that ends in a
narrower corpus than it started with has failed.
