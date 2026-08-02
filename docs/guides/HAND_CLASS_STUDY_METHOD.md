# Hand-class study — standard practice

**Status:** v1, 2026-08-02 · **First instance:** `docs/guides/hand-class-99-TT-JJ.md`
**Harness:** `scripts/research/hand-class-sweep.mjs`

A hand-class study answers, for one class of starting hands: *how is it normally played,
how should it be played, and why.* This file is the procedure. The point of having a
procedure is that the answer should be **derived, not authored** — every claim traces to a
stage of a script anyone can re-run after the engine changes.

---

## The rule that makes this worth doing

> **A hand-class guide is a report on the engine, not a poker article.**

If a claim in the guide could have been written without running anything, it does not
belong in the guide. Existing poker literature is better at generic advice than we will
ever be. What this repo has that nothing else does is a per-combo equity engine, a
board-conditional percentile primitive, a population prior with support everywhere, a
game-tree EV surface, and a mined Reference pool — and the study is the act of pointing all
of them at one class at once and writing down what they say, **including where they
disagree with each other.**

A study that only confirms doctrine has not measured anything. Ship the negative results
(`hand-class-99-TT-JJ.md` §7.3) and the unexplained surfaces (§7.4).

---

## The six stages

Run in this order. Each stage is a subcommand of the harness; each maps to a section of the
output document.

| # | Stage | Question it answers | Exactness |
|---|---|---|---|
| 1 | `structure` | What boards does this class meet? | **Exact** — exhaustive C(50,3) |
| 2 | `percentile` | Where does it rank on those boards? (§15) | **Exact** — exhaustive, self-verifying |
| 3 | `priors` | What does the model think the pool does with it? | Exact read of a committed prior |
| 4 | `pool` | What does the Reference corpus say about the backdrop? | Exact read of mined counts |
| 5 | `equity` | What does it run into, and how does that scale multiway? | Sampled — state the CI |
| 6 | `evcurve` | Where does the EV surface put it, and how wide is the neutral zone? (§15.2) | Sampled — state the caveats |

**Order matters.** Stages 1–2 are exact and cheap; they set the structural facts everything
else is read against. Stage 6 is the most expensive and the most assumption-laden, and it is
worth far more once you already know the class's percentile distribution — otherwise you are
looking at an EV curve with no idea whether the class lands on a common part of it.

### Stage 1 — structure

Enumerate all 19,600 flops. Report the board-class distribution the hand actually meets,
carried through turn and river. **This is where you find the facts that are true regardless
of opponent**, and they are usually the load-bearing ones. In the 99/TT/JJ study, "99 reaches
the river with no overcard 6.73% of the time" did more work than any equity number.

### Stage 2 — percentile

POKER_THEORY §15: percentile within the full board-conditioned universe is the cross-board
coordinate. Sweep every flop, report the **distribution**, not the mean.

**The tail is the finding, nearly always.** Means compress; tails separate. Report p10,
median, p90 and at least two threshold shares (`≥95th`, `<75th`). Decompose by the structural
variable from stage 1 (overcard count for pairs; top-card rank for broadways) and by the
made-hand branch, because a class is usually a mixture and the mixture components behave
differently.

The percentile fast path must **assert** equivalence against `comboStrengthPercentile` at run
time, not assume it. (The first version of the 99/TT/JJ harness silently diverged by 10
percentile points because a 5-card board was passed to a 7-card evaluator. It was caught only
because the assertion existed.)

### Stage 3 — priors

`getPopulationPrior(position, action)` per position × action, reported as **propensity plus
rank within the 169-cell grid**. The rank is what makes it legible: `0.037` means nothing;
`0.037 (#4 of 169)` means the model thinks this is the 4th most likely hand in a 3-bet range.

**Binding label:** this is the *model's belief about the pool*. It is a founder/doctrine
estimate that has never been measured against live hands. Any sentence of the form "the pool
does X" that traces to this stage must say so.

### Stage 4 — pool

Read `handhqReferencePool` for the aggregate backdrop.

**Binding constraint (`docs/domain-spec.md`, founder-ratified 2026-07-22):** the HandHQ
corpus is **online, July 2009, Reference-class**, and is never served to live segments. It
supplies aggregate frequencies for an online population. It is not evidence about a live
9-handed table and must never be written as though it were.

### Stage 5 — equity

Equity against **constructed ranges of varying width**, not just one range. The width sweep
is the point: POKER_THEORY §7.3 says strength buckets are relative to the range, and the
cleanest way to demonstrate it is to show a class separating against a 50%-wide range and
collapsing against a 3%-wide one.

Always include:
- at least one very narrow range (3-bet / 4-bet) — this is where classes collapse;
- both a **linear** and a **polar** version of the same-width range — the difference between
  them is frequently the entire exploitable edge;
- **true N-way multiway** (`handVsRangesMW`, not per-villain composition) at 3/4/5-way,
  compared against fair share. This app is for 9-handed live poker; a heads-up-only study is
  answering the wrong game.

State trials and CI on every sampled number.

**Run every sampled stage twice, and compare orderings, not just values.** A spread smaller
than the error bar is not a small difference, it is *no measured difference*, and the
cheapest way to catch yourself asserting one is to see the ordering flip between runs. In
the 99/TT/JJ study the first draft claimed "JJ is last against a 3-bet range"; the
verification run reversed it. The corrected statement — *the ordering is not resolvable at
this sample size* — was both true and a stronger finding than the one it replaced. Either
raise trials until the ordering is stable, or report that it isn't. Never report a ranking
you have not shown to survive a re-run.

### Stage 6 — evcurve

Join `comboStrengthPercentile` (x-axis) to `computePerComboEV` / `computePerComboCheckEV`
(y-axis) — the composition POKER_THEORY §15.2 specifies. Sweep **every legal holding** on the
board, not just the class, so the class can be located on a curve rather than evaluated in
isolation.

Report:
- the **decile table** — this is where the sign change is legible;
- the **neutral zone**, as a hull plus in-zone density, explicitly **not** claimed contiguous;
- the **slope** in chips per percentile point, in at least two regions, since "steep vs flat"
  is the §15.2 quantity that tells you whether the decision is pointwise or regional;
- where the class sits relative to the crossing.

Sweep at least one **river** board. Per §12 the river is the only street where the perceived-
range correction is complete; flop and turn figures carry a known bias toward villain knowing
hero's cards, and that must be restated wherever those numbers appear.

**Always restate:** these functions are node-level components of the depth-2 tree, called
outside the recommendation path with population defaults. They measure the shape of the EV
surface. They do not measure what the app would advise.

---

## Required sections in the output document

1. **Bottom line** — the finding, in one paragraph, before any table.
2. **Method, scope, and what this study cannot say** — the limits, stated up front rather
   than discovered later. Non-negotiable.
3. One section per stage, in stage order.
4. **Where the engine handles this class badly** — see below.
5. **Playbook** — the practical answer, every line citing the section it rests on.
6. **What would falsify this** — a table of claim → how it dies.

### On section 4

Three distinct things belong here and must not be blurred:

- **Candidate finding** — a specific mechanism whose behaviour contradicts the engine's own
  numbers. Name the file, quote the code, show the contradicting table, and state what would
  keep it from being real. File it via `/workstream`; do not fix it inside a study.
- **Honest negative** — a place where doctrine is right and the cost of violating it happens
  to be low here. Record it. A study that never reports a negative is not a measurement.
- **Question, not finding** — an unexplained surface where the study lacks the context to
  judge. Say so plainly and say who could judge it. Recording it is what stops it being
  discovered a second time.

### On the falsification table

Every claim strong enough to change play needs a row. Include at least one row for the
**largest untested gap** — in the 99/TT/JJ study, blockers and equity realization were both
uncomputed, and saying so is more useful than the numbers that were computed.

---

## Guardrails

- **Read POKER_THEORY.md before starting.** A study authors doctrine-adjacent content; it
  must not contradict the canonical file, and where it extends it, that extension should be
  proposed as a §-addition rather than smuggled into a guide.
- **Numbers carry their conditional** (§14). Every rate ships with its opportunity count and
  its denominator. "36.3% equity" is meaningless; "36.3% equity vs a QQ+/AK 3-bet range,
  120k trials, ±0.7pp" is a number.
- **Strength claims state their universe** (§15.4). "84.5th percentile" requires the board.
- **Live and online never merge** (domain-spec, ratified 2026-07-22).
- **Do not fix code during a study.** A study that edits the engine it is measuring has
  destroyed its own baseline. File findings; fix them in a separate sprint.
- **Commit the harness with the guide.** A study whose numbers cannot be regenerated is an
  opinion with tables.
- **Verify the harness end-to-end before trusting a stage that has only ever been run
  piecewise.** Two silent-truncation defects were caught this way while writing the first
  study, both of which would have produced a *shorter* output that still looked complete:
  piping a long run through `head` (SIGPIPE kills the producer mid-sweep), and calling
  `process.exit(0)` after the last `console.log` (buffered stdout to a pipe or file is
  discarded on explicit exit). A truncated sweep does not announce itself — it just reports
  fewer boards than you swept.

---

## Adversarial review — required before the guide is considered done

A hand-class study is doctrine-adjacent content built on a long chain of engine assumptions,
which is exactly the shape of artifact that reads as authoritative while being wrong. Run an
independent review pass with the full context laid out, and give the reviewers licence to
attack rather than to summarise. The standing panel:

| Reviewer | Attacks |
|---|---|
| `research-scientist` | Falsifiability, load-bearing assumptions, over-claiming, whether the negatives are real |
| `cto-agent` / `architect` | Whether the harness measures what it claims, whether findings are traceable to code |
| `failure-engineer` | Where the numbers break — sampling error, degenerate boards, silent divergence |

Reviewers must receive the guide, the harness, and the doctrine file — not a summary of
them. **Record what the review changed** in a numbered section of the guide itself. A review
that changed nothing was either unnecessary or not adversarial enough, and both are worth
knowing.

### What the first run of this panel actually caught

Listed because they are the failure modes to expect, not because they were unusual.

- **A headline number no stage computed.** The most prominent sentence in the guide was
  authored from a scratch table that never made it into the harness. Rule that follows: grep
  every number in the document against the harness's output before review, not after.
- **A claim falsified by re-running the unmodified script.** A reviewer re-ran the harness
  and got a different decision label. Precision had outrun resolution by two orders of
  magnitude. Rule: a stage that samples must measure and print its own error bar, and must
  refuse to print a categorical label it cannot resolve.
- **A self-check that could not fail.** A run-time equivalence assertion compared a function
  against itself via a delegation the author had not noticed. Rule: prove a check can fail —
  break the thing deliberately and confirm the assertion fires — before citing it as rigour.
- **A caveat pointing at the wrong mechanism.** The non-determinism note blamed a sampler
  that is deterministic, and reassured readers about the street where the error actually was.
  Rule: trace a caveat to a line of code, the same as a finding.
- **Silently narrow scope.** Every board swept was rainbow, unpaired and disconnected, and
  the "river" boards were the flops run out. Rule: state the axes of the sweep, and make sure
  the boards vary along the axis whose effect you are claiming.
- **A finding filed too weakly.** One "candidate finding" was actually provable, and the
  reviewer proved it. Under-claiming is a failure mode too — it leaves a real bug unfixed.

---

## Cost

Roughly one session. `structure`/`priors`/`pool` are seconds, `percentile` a few minutes,
`equity` a few minutes at 120k trials, `evcurve` the long pole at ~10 minutes per
board × range pair. Budget the sweep list accordingly and **log what was dropped** — a
board list silently truncated to what fit reads as full coverage when it is not.

## Candidates

66/77/88 (the class below — does the tail keep widening?), QQ/KK (where the tail vanishes
and blockers start to dominate), AK/AQ (a non-pair class, so stage 1's structural variable
changes from overcard count to pair-the-board), suited connectors (where realization, the
gap this method currently does not measure, is the whole story).
