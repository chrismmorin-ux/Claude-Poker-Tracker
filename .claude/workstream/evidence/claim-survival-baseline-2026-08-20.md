# Claim-survival baseline — first run, 2026-08-20

**Status: PROVISIONAL. Gates did not all pass. These figures may not be cited, and no
Result Card may be stamped from them.**

Instrument: `scripts/context/claim-corpus-{extract,sample,score}.mjs`.
Corpus `3f00a0dfc311…`, seed 20260820, 60 claims across 37 transcripts (gate: 60 / >=8).

## What passed

| Gate | Result |
|---|---|
| **G1 seeded controls** — 6 false claims hidden in the packets, each REFUTED by construction | **11/11 caught, both arms. PASS.** A judge that returns HELD unconditionally is indistinguishable from a working one; this is the check that tells them apart, and both arms cleared it. |
| **G3 coverage** — every sampled claim scored by both arms | **60/60. PASS.** |

## What failed, and why it is my error rather than the judges'

| Gate | Result |
|---|---|
| **G2 inter-judge agreement** | raw 47/60 = 78.3%, **Cohen's kappa 0.460, floor 0.70. BELOW FLOOR.** |

**The arms were not two draws from one judge. They were two different judges, and I chose
the second one badly.** Arm A ran `general-purpose`; arm B ran `Explore`, whose own
description says it *"reads excerpts rather than whole files, so it locates code; it doesn't
review or audit it."* That is the wrong instrument for adjudication and the effort gap shows
it: **arm A averaged 105,496 tokens and 24.8 tool calls per packet; arm B averaged 45,559 and
16.6** — 2.3x less work.

The disagreement pattern matches: 11 of 13 disagreements are arm A returning REFUTED or
UNRESOLVABLE where arm B returned HELD. Arm B systematically under-refutes because it does
not read deeply enough.

**So kappa 0.460 measures my arm-selection error, not judge unreliability.** The fix is to
re-run arm B on the correct agent type, which is a removal of the defect rather than a
caveat on the number.

## The figure, with its label attached

**AGREEMENT WITH AN UNVALIDATED JUDGE — NOT AN ACCURACY RATE.** The judge is the same model
whose error rate is the object of study (`accuracy-program-handoff.md:265-267`).

| Arm | held | refuted | unresolvable | held/(held+refuted) | 95% CI |
|---|---:|---:|---:|---:|---|
| A (`general-purpose`) | 39 | 15 | 6 | 72.2% | [59.1, 82.4] |
| B (`Explore`) | 48 | 10 | 2 | 82.8% | [71.1, 90.4] |

UNRESOLVABLE is reported separately and never folded into either side.

## The question the design was actually about

Provenance came from the transcript. **The judges never saw it** — a brief that encodes the
expected answer returns the expected answer, and "asserted without opening the file"
telegraphs "probably wrong."

| provenance | held | refuted | refuted-share |
|---|---:|---:|---:|
| read (file opened in-session before the claim) | 27 | 3 | **10.0%** |
| push (always-injected) | 3 | 1 | 25.0% (n=4 — noise) |
| **neither (asserted without opening it)** | 10 | 3 | **23.1%** |

**Directionally, not-opening-the-file is associated with roughly twice the refutation rate.
That is the first evidence in this project that bears on the retrieval hypothesis at all.**
It is also thin: 13 claims in the estimand cell, kappa below floor, and the `push` cell at
n=4 comes out highest, which is a reminder of how little these counts can carry. **It is a
direction to test, not a result.**

## Defects this run found in the instrument itself

1. **Commit attribution used `git log --all`.** Measured: 12% of the sample (7 of 60) was
   assigned a commit that is NOT an ancestor of the session's own branch — one refutation
   traced to an orphan commit. A wrong commit produces confident REFUTED verdicts on true
   claims, manufacturing an error rate out of branch topology. **Fixed:** per-branch commit
   index, with a recorded `commit_basis` when a branch is gone. Caught by a judge, not by me.
2. **Committed state is not working-tree state.** Several judges correctly declined to refute
   claims about files authored but not yet committed. This is not fully recoverable — the
   transcripts' `file-history-snapshot` records carry `trackedFileBackups: {}`. It biases
   toward over-refuting and must stay stated.
3. **The judges see only git.** One arm refuted a true claim about `MEMORY.md` because that
   file lives outside the repo (`~/.claude/projects/…/memory/`). The other arm checked disk
   and held it. Direct measurement confirms the claim: **97 pointer entries, 112 topic files.**
4. **`**WS-270 filed**` extracted as the quantity "270 file"** — a missing word boundary, the
   same false-positive shape that made the discarded 0/11 prototype unusable. Fixed.

## Corrections this run forced on earlier reporting

- The cross-critic's *"MEMORY.md has 110 entries, not 97"* is **WRONG**. Direct count: 97.
  The facilitator had flagged this and I relayed the cross-critic's version anyway. The
  original figure was right and my correction of it was the error.

## Next

Re-run arm B on `general-purpose`, recompute kappa. If it clears 0.70 the baseline stands as
a provisional pre-period for the founder-ruled seeded-coin channel experiment. The human-
adjudicated subsample and the `claimKind` schema decision both remain preconditions before
any of this becomes a citable rate.


---

# RUN 2 — the re-run, and it went the wrong way

**Pre-registered before dispatch: re-running arm B on the correct agent type would raise
kappa above the 0.70 floor. IT FELL, from 0.460 to 0.081. Recorded unhedged.**

| | run 1 | run 2 |
|---|---:|---:|
| Cohen's kappa | 0.460 | **0.081** |
| raw agreement | 78.3% | 70.0% |
| arm A held/(held+refuted) | 72.2% | 76.4% |
| arm B held/(held+refuted) | 82.8% | **96.6%** |
| seeded controls caught | 11/11 | **12/12** |

## Why it fell, and it is my error again

I diagnosed run 1's low kappa as **wrong agent type** and re-ran arm B on
`general-purpose`. That diagnosis was incomplete, and the fix I derived from it made
things worse in a specific, traceable way: **I also rewrote the brief.** The new brief
told arm B two things arm A was never told —

> *"Git is not the whole world"* … *"Committed state is not working-tree state. If the
> content appears in a commit shortly after, say UNRESOLVABLE rather than REFUTED."*

Both are true and both were needed. But applying them to **one arm only** converted a
methodological improvement into an **asymmetry between the arms**. Arm B duly went to
96.6% held; arm A, still grepping against committed state, stayed at 76.4%. **17 of 18
disagreements are A=REFUTED/UNRESOLVABLE against B=HELD.**

Two different briefs are two different judges. I removed one confound and introduced a
larger one in the same change.

## The real blocker, now specified precisely

The disagreements are not noise. They are a **missing definition**, and this run pinned
it by producing the split in both directions on the same corpus:

| claim | one arm | the other |
|---|---|---|
| `schemas.js` — cite exact, "seven weeks" false | **HELD** (the cite resolves) | **REFUTED** (the temporal assertion is load-bearing) |
| `findings-index.yaml` — substance right, line range wrong | **REFUTED** (the cited range is wrong) | **HELD** (substance confirmed) |

**Is "the claim" the citation, or the assertion the citation supports?** I never wrote it
down, so each judge chose per case, and they chose opposite ways on these two. Until that
rubric exists, this instrument cannot produce a reliable verdict on a real claim — and no
amount of judge quality fixes it.

## THE HEADLINE I GAVE THE FOUNDER DOES NOT SURVIVE

Run 1 reported: claims asserted without opening the file were refuted at **23.1%** versus
**10.0%** for claims where the file was read — "roughly double."

Run 2, on agreed claims only:

| provenance | held | refuted | refuted-share |
|---|---:|---:|---:|
| read | 28 | 1 | **3.4%** |
| push | 4 | 0 | 0.0% |
| **neither** | 9 | 0 | **0.0%** |

**The signal is gone.** The run-1 separation was an artifact of shallow checking — arm A
grepped where a deeper look found the content in a working tree, in a gitignored path, in
the out-of-repo memory store, or in a session lock file recording exactly what was being
edited at that moment. Every one of those resolutions was a REFUTED that should not have
been.

**So the retrospective corpus does not currently support the retrieval hypothesis, and it
does not refute it either. It produces no usable signal at this n under this rubric.**

## What the instrument DID establish

1. **It detects seeded falsehoods reliably: 12/12 across both runs, both arms.** That is
   the property that separates a working verifier from a rubber stamp, and it is the one
   thing here that has now been measured twice and held.
2. **One claim survives as genuinely wrong under three independent arms:**
   `induceCore.mjs:110` cited for behaviour that lives at `:103`.
3. **Working-tree truth is recoverable after all** — from file mtimes, from gitignored
   paths, and best of all from `.claude/workstream/sessions/ses-*.yaml` `files_locked`,
   which records precisely which files a session had open. Run 1 called this "not fully
   recoverable." That was wrong; run 2's judges found three routes to it.

## What must happen before this yields a citable number

1. **Write the verdict rubric.** Claim unit = the assertion, with the citation as its
   support; an assertion whose support is misplaced but whose substance holds is a
   distinct verdict (`CITE-WRONG`) rather than being forced into HELD or REFUTED. Both
   run-1 and run-2 disagreements collapse under a four-valued scheme.
2. **One brief, both arms.** Every methodological instruction goes to both, or the arms
   are not comparable.
3. **Give both arms the working-tree routes** — mtime, gitignore, and `files_locked`.
4. Re-run. Kappa is the gate; the rate stays uncitable until it clears and a
   human-adjudicated subsample calibrates it.


---

# RUN 3 — pre-registration, written before dispatch

**Brief:** `scripts/context/claim-judge-brief.md`, sha256
`0d65be314f23c2addb2995a7b664aa2d7c3b8347012da09777a2e8fbeb02663c`. Both arms read *this
file* and record the hash in their output; the scorer's new **G0** fails the run if two
different hashes come back. Run 2's defect is now mechanically detectable rather than
something I have to remember not to do.

**Same corpus, same seed, same sample, same packets as runs 1 and 2** — `3f00a0df…`, seed
20260820, 60 claims / 37 transcripts. Nothing about the sample changed, so run 3 is
comparable to both predecessors claim-for-claim. Prior verdicts preserved, not deleted:
`verdicts-run1-explore/`, `verdicts-run2-splitbrief/`.

**Both arms are `general-purpose`.** With one brief and one agent type the two arms are two
draws from the same judge, so kappa now measures the instrument's own test-retest
reliability. That is the quantity the gate was always supposed to be about.

## The four fixes, as shipped

1. **Four-valued rubric** — `HELD` / `CITE-WRONG` / `REFUTED` / `UNRESOLVABLE`, derived
   mechanically from two axes the judge must state (substance ∈ HOLDS/FALSE/UNKNOWN,
   citation ∈ RESOLVES/MISPLACED/NA). New gate **G4** re-derives every verdict and fails an
   arm whose stated verdict contradicts its own axes — a rubric nobody applied cannot
   explain agreement *or* disagreement.
2. **One brief, both arms** — enforced by G0 on the recorded hash.
3. **Working-tree routes given to both arms** — commit, working tree, mtime, gitignored
   paths, `ses-*.yaml` `files_locked` (verified: 81 of 145 session files carry a populated
   list), and the out-of-repo memory store (verified: 113 files). Each arm records which
   route resolved each claim, so the next brief can be aimed.
4. **Re-run** — below.

**One gate was deliberately loosened, and it is not buried.** G1 now counts a control as
caught when the verdict is anything other than `HELD`, where before it required exactly
`REFUTED`. Reason: a seeded control is a planted false *citation* on a plausible sentence,
and a judge that locates real support elsewhere and returns `CITE-WRONG` has applied the new
rubric correctly and *has* detected the plant. The property G1 tests is rubber-stamp versus
verifier, and the rubber stamp returns HELD. Keeping the old criterion would have made G1
measure compliance with the rubric this run replaces. Per-control verdicts are printed.

## Predictions, unhedged, to be recorded either way

| # | Prediction | Basis |
|---|---|---|
| **1 · PRIMARY** | Four-valued kappa **clears 0.70**. | The rubric split was the diagnosed cause and it is now defined. This is the claim under test; if it fails the diagnosis was wrong. |
| **2** | Substance-axis kappa **≥** four-valued kappa. | The citation axis adds a distinction both arms must apply identically; disagreement should concentrate there. |
| **3** | `CITE-WRONG` is used on **≥3 of 60** claims by at least one arm. | If it is never used, the category is dead weight and the run-2 disagreements had some other cause. |
| **4** | Controls **12/12 not-HELD**, both arms. | Held twice already, across three different judge configurations. |
| **5** | **No retrieval signal.** On agreed claims, `neither`'s refuted-share does not exceed `read`'s by more than 10 points. | Run 2's null replicates. Predicting the null, not hoping for the effect. |
| **6** | The `files_locked` route resolves **≥1** claim. | Run 2 called it the best source; it has never been given to a judge deliberately before. |

Prediction 1 is the one that decides whether rank 2 closes. The rate stays uncitable
regardless of the outcome until a human-adjudicated subsample calibrates it and the
`claimKind` schema decision is made.


---

# RUN 3 — RESULT. All gates passed. The instrument closes, and it immediately reports that the thing it was built to measure is nearly unmeasurable at this n.

| | run 1 | run 2 | **run 3** |
|---|---:|---:|---:|
| Cohen's kappa (4-valued) | 0.460 | 0.081 | **0.723 — PASS** |
| raw agreement | 78.3% | 70.0% | **93.3%** |
| disagreements | 13/60 | 18/60 | **4/60** |
| seeded controls caught | 11/11 | 12/12 | **12/12** |
| G0 one brief | — | violated | **PASS** |
| G4 derivation consistency | — | — | **PASS, 132/132 rows** |

**The scorer rewrite is not a confound.** Re-scored against the archived verdicts it
reproduces run 1 (κ 0.460, 78.3%) and run 2 (κ 0.081, 70.0%) to three decimals. The
movement is the rubric, not the arithmetic.

## Predictions — 5 of 6 held, and the one that failed is recorded first

**PREDICTION 2 FAILED, and in the opposite direction to the one I predicted.** I predicted
substance-axis kappa ≥ four-valued kappa, reasoning that disagreement would concentrate on
the citation axis. **Observed: substance-axis κ = 0.654, BELOW the four-valued κ = 0.723**,
despite *higher* raw agreement (58/60 vs 56/60). Collapsing `CITE-WRONG` into `HELD` pushes
the marginal to 58 of 60 in one cell, which drives chance agreement up and punishes kappa.
The four-valued split spreads the marginal and is the *better-conditioned* statistic — the
opposite of my reasoning, arrived at for a reason I did not anticipate.

| # | Prediction | Outcome |
|---|---|---|
| **1 · PRIMARY** | 4-valued κ clears 0.70 | **HELD — 0.723.** See the stability caveat below; it is load-bearing. |
| **2** | substance κ ≥ 4-valued κ | **FAILED — 0.654 < 0.723.** |
| **3** | `CITE-WRONG` used on ≥3/60 | **HELD — 5 in each arm.** The category earns its place. |
| **4** | controls 12/12 not-HELD | **HELD — 12/12, and all 12 were `REFUTED`, not `CITE-WRONG`.** The G1 loosening was never exercised. |
| **5** | no retrieval signal | **HELD — 0.0% (read) vs 5.9% (neither), a 5.9-point gap on ONE refuted claim.** |
| **6** | `files_locked` resolves ≥1 | **HELD — 7 uses.** |

## THE GATE PASSED ON A POINT ESTIMATE THAT IS NOT STABLE

κ = 0.723 against a 0.70 floor is a margin of 0.023 on **four disagreements out of sixty**.

**Bootstrap 95% CI: [0.383, 0.940]** (20,000 resamples, seed 20260820).
**P(κ < 0.70 under resampling) = 0.426.**

Nearly half of resamples of this same data fall below the floor. The pre-registered gate is
passed as written and I am not moving the goalposts after the fact — but *"the instrument is
reliable"* is not what this establishes. What it establishes is that the rubric fix moved
agreement from 70.0% to 93.3% and cut disagreements from 18 to 4. That change is large and
is almost certainly real. The precision of κ itself, at n=60, is not.

## What the routes did — and it retro-invalidates the earlier refutation counts

**38 of 132 verdicts (29%) were resolved by a route other than the commit.**

| route | uses |
|---|---:|
| commit | 84 |
| **working-tree** | **22** |
| **outside-repo** (memory store) | **8** |
| **`files_locked`** | **7** |
| none | 7 |
| gitignored | 2 |
| mtime | 2 |

Substance survival went 72.2% / 82.8% (run 1) → **96.6% / 98.3%** (run 3). **The earlier
"low survival" was substantially an instrument artifact** — judges grepping committed state
for claims whose author was looking at an uncommitted working tree, a gitignored path, or a
file outside the repo entirely. Runs 1 and 2 manufactured refutations out of where they were
allowed to look. That is now measured, not suspected.

## The two figures, with their labels attached

**AGREEMENT WITH AN UNVALIDATED JUDGE — NOT AN ACCURACY RATE.**

| Arm | held | cite-wrong | refuted | unres. | SUBSTANCE survival | CITATION accuracy |
|---|---:|---:|---:|---:|---|---|
| A | 52 | 5 | 2 | 1 | 96.6% [88.5, 99.1] | 91.2% [81.1, 96.2] |
| B | 52 | 5 | 1 | 2 | 98.3% [90.9, 99.7] | 91.2% [81.1, 96.2] |

The four disagreements, which are the human-adjudication queue:

| claim | A | B |
|---|---|---|
| `layout-doctrine.md` | HELD | UNRESOLVABLE |
| `useLiveActionAdvisor.js` | REFUTED | HELD |
| `compute-runner.js` | CITE-WRONG | HELD |
| `findings-index.yaml` | HELD | CITE-WRONG |

Two of four are `CITE-WRONG vs HELD` — the split the category was added for, now *isolated*
rather than contaminating the substance verdict. `findings-index.yaml` is the same claim that
split the arms in run 2; it still splits, but now on the citation axis where the disagreement
actually lives.

## THE FINDING THAT CHANGES THE PLAN FOR RANK 5

The founder ruled that channel composition is settled by a seeded-coin experiment, and that
ruling made this instrument its hard prerequisite because *"the arms need an outcome measure."*
**The instrument now works, and it reports that the obvious outcome measure has a floor.**

Substance refutation ran at **1.7%** (1 refuted / 58 agreed substance verdicts). At that base
rate, per arm, α=.05, power=.80:

| measure | base rate | effect | **n per arm** |
|---|---:|---|---:|
| substance refutation | 1.7% | doubling | **1,349 claims** |
| substance refutation | 1.7% | tripling | **445 claims** |
| **citation misplacement** | **8.8%** | **doubling** | **232 claims** |
| citation misplacement | 8.8% | halving | 499 claims |

**Citation misplacement is the measure with signal** — a 5.2× higher base rate and roughly a
fifth of the sample requirement at comparable effect size. It is also the axis that only
exists because of the four-valued rubric: runs 1 and 2 could not have used it, because they
were forcing these cases into HELD or REFUTED at each judge's discretion.

Cost is known and affordable: **12,066 tokens per claim-verdict measured this run**
(1,592,659 tokens / 132 verdicts). 2,156 adjudicable claims are already extracted; 60 are
used. The corpus has the headroom.

## What is still true, unchanged by this run

- **The retrieval hypothesis remains neither supported nor refuted.** Run 1's "2× refutation
  without opening the file" stays retracted. Run 3's `neither` cell shows 1 refutation in 17.
  At a 1.7% base rate this corpus cannot discriminate at n=60, and now we know it would take
  **~445 claims per provenance group** even to detect a tripling.
- **The rate is not citable.** Two preconditions stand: the human-adjudicated subsample, and
  the `claimKind` schema decision (founder's, still open).
- **G1 was loosened before the run and never exercised** — all 12 controls came back
  `REFUTED`, so the loosening changed no result. It stays disclosed anyway.

## Artifacts

`scripts/context/claim-judge-brief.md` (sha256 `0d65be31…`) · `scripts/context/claim-corpus-score.mjs`
(G0 and G4 added) · `.claude/workstream/evidence/verdicts-run3/` · prior runs preserved at
`verdicts-run1-explore/` and `verdicts-run2-splitbrief/`.
