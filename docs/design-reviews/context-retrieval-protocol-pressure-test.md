# Design pressure-test — `docs/context-retrieval-protocol.md`

**Engine:** `design-critique`, executed 2026-08-20 with the declared multi-agent method.
**Phases:** 9 independent lenses (fresh context, adversarial briefs) → cross-critic adjudication → facilitated synthesis.
**Roster deviation, recorded:** the declared five (architect, failure-engineer, senior-engineer, performance-engineer, security-engineer) plus four domain lenses (information-theorist, ai-interaction-designer, research-scientist, evolution-analyst). Added, not substituted.
**Verdicts:** 5 REFRAME, 3 AMEND, 1 falsifier-refutation. **Zero greenlights.**

---

## 0. What this run established, in one screen

**The problem is real. The urgency was invented. The design is three separate projects wearing one name.**

- **Measured and solid:** ~108 KB of doctrine is pushed at every session *and again at every subagent* — a six-persona roundtable costs ~176,000 tokens before any lens opens a file. The channel grew **+117% in 15 days**.
- **Assumed, not measured:** that wrong claims are *caused by failure to retrieve*. The repo's own record says the most common error signature is something else entirely.
- **Already running:** `MEMORY.md` is a pointer index over a pull corpus — P1 and P3, shipped, for months. **9 of its 112 topic files have ever been Read. 8%.**

---

## 1. The pre-registered falsifier, resolved unhedged

**AS-CRP-2** was pre-registered before any lens output was seen: *"the bundle system reached 1/410 adoption because retrieval was never forced, not because curation was too expensive."*

**REFUTED as posed. Neither branch was right.**

- *Not curation cost* — **supported.** The validator prints the exact edit verbatim (`Add: context_bundle: "math-measurement"`). Marginal cost is one dictated line, zero judgment. Fifteen days, unwritten.
- *Because retrieval was unforced* — **not supported.** Those are *binding* failures, not retrieval failures. A forcing function on retrieval would never have written the field into WS-405.

**The real cause: no write-executor and no consumer.** `context_bundle` has five references repo-wide, *all inside the validator that complains about it*. A field read only by its own critic.

**And the number was worse than reported.** The 1-of-410 declarant is `WS-422.yaml` — the ticket about the bundle system itself. Adoption outside the mechanism's own ticket is **zero**. `lens:`, shipped in the same commit, died identically — an independent replication inside the same experiment.

---

## 2. Factual errors in the design under test

| # | Claim | Reality |
|---|---|---|
| 1 | *"The push tier was never implemented"* (`:5`, `:53`) | **False.** `.claude/hooks/compact-tier.cjs` is wired at UserPromptSubmit and emits 2,304 B every turn. (Phase-1's counter-claim that it implements `context-architecture.md` Part 2 "point for point" is *also* wrong: Block A zero of ~26 terms, Block B 4 of 9 with the "highest priority addition" absent, Block C zero of six, Block E absent.) |
| 2 | *"`context-barrier.cjs` logs every read"* (`:84`) | **False.** Blocks and bypasses only. Caught independently by three lenses. |
| 3 | *"generated from headings, `binds:` pointers, …"* (`:104`) | **`binds:` has zero occurrences repo-wide.** A named signal that does not exist. |
| 4 | *"every file … and the memory store assigned to exactly one segment"* (`:62-64`) | **Not implementable.** 113 memory files / 496,245 B / ~37% of the corpus sit outside `repoRoot`; `resolveInclude` does `path.join(repoRoot, …)` and `context-barrier.cjs:209-212` hard-skips `USER_MEMORY/`. |
| 5 | *"External evidence puts retrieval correctness degrading around 32k"* (`:53-54`) | **Unsourced.** `32k` occurs **exactly once repo-wide** — here. And it was used as a hard capacity budget when the underlying effect is a soft graded curve. |
| 6 | §0 heading *"The problem, as measured"* | Contradicts `:109` fourteen lines later. What was measured is the *channel asymmetry*. |

**Not an error, though two lenses said it was:** *"the rate is not measured anywhere"* (`:109`) is **defensible as written**. `context-shift-prereg.md:145` measures *held/(held+refuted)* — "is the claim true." The design measures "claim contradicted by information **present in the repo at the time**." Different conditioning set, different denominator. The cross-critic overturned the correction. (Separately: the 45.9% figure quoted in Phase 1 is superseded — the pre-registered statistic gives 39/77 = **50.6%**, and its own source says to report it as *"agreement with an unvalidated judge."*)

---

## 3. Assumptions refuted on data already in the tree

| ID | Status | Evidence |
|---|---|---|
| **AS-CRP-1** — absent forcing function causes low accuracy | **REFUTED** | Arm A (greenfield) had the full push channel, no index, no citation check, **no forcing function** — and scored **11/11**. |
| **AS-CRP-2** — the forced-vs-cost dichotomy | **REFUTED** (§1) | False dichotomy; third cause measured. |
| **AS-CRP-3** — a Stop hook changes behaviour | **NEVER TESTABLE** against this hook | `retreat-detector.cjs:68` (`if (input.stop_hook_active) exit(0)`) fires at most once per turn, so the re-derived response is never checked; `:102-104` states that asserting legitimacy is a valid exit. **Ruling: a Stop hook is a control over whatever it pattern-matches and only that** — a control over the emitted string, a logger with respect to the underlying recommendation. |
| **AS-CRP-4** — claim shapes mechanically detectable | **OPEN** | The 0/11 prototype result was **not a measurement** — see §5. |
| **AS-CRP-5** — marked holes get filled | **REFUTED, weakly (n=4)** | The same four `unbundled-task` findings named 2026-08-06 are the same four firing today. 0/4 in 15 days. |
| **AS-CRP-6** — relocation preserves framing | **RELOCATED, not dead** | `compact-tier.cjs` re-emits the operative imperatives every turn, anchor-verified. The answerable form: does the imperative deliver what the full rule delivered? Size on the measured **1.6× action** multiplier, not the 17× vocabulary one. |

---

## 4. The finding nine lenses walked past

**`MEMORY.md` is P1 + P3, already shipped, running for months.** A pointer index with one-clause routable summaries over a pull corpus, injected every session.

Measured across 119 transcripts / 18,849 tool calls:

- **9 of 112 topic files ever Read — 8.0%**
- **10–11 Read events total**
- The other ~165 references are **Edit (75), Write (45), Bash (43)** — the index's targets are *written*, not *read*

The cross-critic caught itself here: it first measured 175 references, was about to report *"71% — the mechanism works,"* then split by tool name and refuted itself. Same shape as `feedback_condition_before_you_correct`.

**Honest caveat, and it is the crux:** routing-by-summary is indistinguishable from ignoring **without an accuracy instrument**. That ambiguity is precisely the dependency edge that puts P5 ahead of P1.

**Corollary:** relocated doctrine lands at ~8% delivery — not the 0.24% two lenses assumed (wrong denominator: declaration ≠ delivery), and not 0%.

---

## 5. Two Phase-1 headlines the cross-critic overturned

**"P2 scored 0/11" was a label, not a measurement.** Four defects in the prototype: it captured the line number and never used it (basename substring match, discarding the interval arithmetic the cited precedent credits for its precision); it implemented **1 of 3** declared claim shapes; it auto-classified push-channel citations as false positives via its own spec bug — the push channel **is** retrieved, and a correct P2 seeds the retrieved set with it; and it labelled five flags false without adjudicating whether the claims were true. It sampled the **14 smallest** transcripts — least accumulated context, least of the error under study. Re-run unmodified, **its own output says "2 TP-candidate."**

**"`runs_on` proves generation beats curation" — wrong unit by three orders of magnitude.** `runs_on` is a four-value enum with a default on an object that already exists (3 real readers, not 8 — two were string collisions). A segment is a multi-file manifest with pinned hashes whose author must have read every included file, priced at 104 person-hours. **`WS-422` DEFECT 4 stands unrefuted:** *"a bundle whose curator has not read its contents is a manifest of the monolith with extra steps."*

**And WS-422 supplies the measurement that supersedes the whole P4 debate.** `WS-422.yaml:70-81` records the ten-entry `MEASUREMENT_OVERSIGHTS.md` payload independently re-checked: **4 of 10 overstated, each in the same direction; 2 with wrong file paths. 60% survival — hand-curated, ten entries, one subject, authored by someone who had read it.** Generation at 165 files will not beat 60%. **Both arms fail at the accuracy the design needs. That is the finding.**

---

## 6. Inherited convergence — the highest-value result of Phase 2

Agreement is only evidence if it was reached independently. Every lens received `compact-tier.cjs` output on every turn, including *"spawn an independent check rather than answering from what is already in context."*

| Consensus | Verdict |
|---|---|
| P5 must become retrospective, fresh-context-judged (7 of 9) | **INHERITED VERBATIM** — pre-written sentence-for-sentence at `accuracy-program-handoff.md:260-263`, including the definition of "load-bearing claim." |
| P6 leads / re-target the channel (4 lenses) | **INHERITED** — `accuracy-program-handoff.md:281-289` names `MEMORY.md` and `CLAUDE.md` explicitly. P6 is repo doctrine the design failed to cite, not a discovery. |
| "Retrieval good, pre-loaded content bad" | **INHERITED** — that sentence is injected into every lens every turn. |
| **"Nothing gets deleted" (9 of 9)** | **ZERO INFORMATION.** `improvement-default.cjs` injects the rule every turn and `retreat-detector.cjs` **blocks** on the vocabulary. Nine agents agreed with a rule they could not have disagreed with without being blocked. |
| **"P2 is not a blocking control in its proposed form" (8 of 9)** | **RATIFIED** — pre-stated nowhere, reached by three distinct mechanisms. |
| Barrier-log de-contamination (4 lenses) | **INDEPENDENT** — four lenses each opened `contextBarrier.test.js:17` and saw `cwd: REPO_ROOT`. |
| Hook consolidation (2 lenses) | **INDEPENDENT** — both measured. |

Two *structure-right / mechanism-wrong* tells were found, the exact pattern `dispatch-dont-assert.md` predicts: the security lens on the barrier's matcher, and the information-theorist on the label ledger (145 is a **census of label families**, not a violation count; the "blocking gate" is a doc↔data drift test, not a usage check).

---

## 7. The build list — ranked, nothing dropped

> **RANK 1 SHIPPED 2026-08-20.** All four repairs applied and verified against their stated falsifiers. 26/26 in `contextBarrier.test.js` (up from 19 — 7 new regression tests), 1362/1362 across `scripts/`. Evidence in §11.
>
> **RANK 2 CLOSED 2026-08-21 — the instrument passes all gates.** Run 3: Cohen's κ **0.723**
> against the 0.70 floor (runs 1–2: 0.460, 0.081), raw agreement 93.3%, 12/12 controls,
> 60/60 coverage, and two new gates — **G0** (one brief, verified by hash) and **G4**
> (derivation consistency, 132/132 rows). The blocker was the undefined verdict rubric; it
> is now `scripts/context/claim-judge-brief.md`, four-valued with `CITE-WRONG`.
> **Two results that change the plan, both in the evidence record:** (a) κ's bootstrap CI is
> [0.383, 0.940] — the gate passes on a point estimate that 43% of resamples would fail, so
> the rubric fix is established and κ's *precision* at n=60 is not; (b) substance refutation
> runs at **1.7%**, a floor that would need ~1,349 claims per arm to detect a doubling, while
> **citation misplacement runs at 8.8% and needs ~232** — so the founder-ruled seeded-coin
> experiment (rank 5) should be powered on the citation axis, which only became measurable
> because of this rubric. Also measured: 29% of verdicts resolved by a non-commit route,
> which means runs 1–2's low survival was substantially instrument artifact.

| Rank | Item | Disposition | Cost |
|---|---|---|---|
| **1** | ~~**Repair block**~~ **— DONE** — (a) de-contaminate the barrier log (`contextBarrier.test.js:7,17` writes production state; `context-barrier.cjs:137` produces invalid YAML); (b) fix the validator's repair command (`:253`, `:67-69` — wrong directory, filename **and** extension, in two places); (c) close the directory-level withholding gap; (d) fill `prog-methodology-integrity.yaml:49,55` `[CUSTOMIZE:]` placeholders | build now, unconditional | ~1.5 sessions |
| **2** | **P5 · baseline-instrument** | **build-reshaped** — retrospective, fresh-context-judged, over the 119 transcripts on disk; scored at the creating commit (`git show <sha>:<path>`), two judges for inter-rater agreement, reported as *agreement with an unvalidated judge* until calibrated | 2–3 sessions |
| **3** | **P8 · staleness-model** | **build-reshaped and re-aimed** — from *document* staleness to **verification staleness** (SHAPE 1). **No inbound dependency.** | 1 session to design |
| **4** | **P6a · ceiling in code + channel meter** | build now, relocate nothing yet. **No inbound dependency.** | 1 session |
| **5** | **Seeded-coin channel experiment** *(not in the original eight)* | build-after P5 — session-level randomization on the session ID the hook already has; arm A current channel, arm B rules relocated; permutation test with session as the unit. **Highest information-per-token item on the list.** | 0.5 session + 2 weeks wall-clock |
| **6** | **P2 · claim-citation-check** | **build-reshaped** — run the design's own falsification test (`:147`) to the gate at `context-shift-prereg.md:151`: 60 claims / ≥8 artifacts, line-**span** arithmetic, all three claim shapes, push channel seeded into the retrieved set, **largest** transcripts. Ship as annotator, not gate. Named hole: absence claims are 11.3% of claim volume and structurally invisible. | 1 session |
| **7** | **Hook consolidation** *(not in the original eight)* | build now — 14 processes → 4; ~40 s median / ~96 s p90 of pure spawn today. Per-module `try/catch` with a **named** fail-open record is non-negotiable. **No inbound dependency.** | 1 session |
| **8** | **P1 + P3** | **build-reshaped and merged** — instrument the index that already exists before building a second one. Only the trigger-set keyed on emitted text has the *fires-without-a-query* property. **P1 is under-specified, not wrong:** `:60-70` never states what a segment is *for*. Real index cost is ~2,364 tok minimum, **~7,400 at routable density — larger than the 6,498-token channel P6 shrinks to.** | 1–2 sessions, after P5 |
| **9** | **P6b · the relocation list** | build-after Decision (a) + rank 5 | depends |
| **10** | **P4 · generated-vs-curated** | **superseded** by the WS-422 60%-survival measurement. When P1's consumer exists: generated, then **adversarially** reviewed, review triggered by invocation, generation→review delta recorded as a measurement. | 1 session |
| **11** | **P7 · bundle-reconciliation** | **build-as-is**, decidable immediately after rank 1 — today you would be deciding about wreckage, not a mechanism | 0 sessions |

> **RANK 4 SHIPPED 2026-08-21.** `scripts/context/push-channel-meter.mjs` measures the four
> pushed components (`CLAUDE.md` 37,054 · `.claude/rules/*` 48,362 across 16 files · global
> `CLAUDE.md` 1,375 · `MEMORY.md` 21,409) = **108,200 B, ~27,050 tok (estimate)**, against the
> 478,300 B / 113-file pull store reported separately so the asymmetry stays visible.
> The ceiling ships as a **ratchet at today's high-water mark** in
> `.claude/context/push-channel-ceiling.json`: growth past it exits 1, and raising it needs
> `--set --why "<reason>"` so the raise lands in a diff next to whatever justified it.
> Picking a *target* size would force relocation decisions that are the founder's; picking
> "no larger than today" forces nothing and still stops the measured +117%-in-15-days growth.
>
> **RANK 5 BUILT AND INERT 2026-08-21 — and the ticket's premise was wrong.**
> The build list specified "session-level randomization on the session ID the hook already
> has; arm A current channel, arm B rules relocated." **A hook cannot produce arm B.** The
> push channel is composed by the harness from files on disk *before any hook runs* — every
> `.claude/rules/*.md` arrives as a project instruction — and hooks can only ADD context,
> never withhold. Compounding it, this repo runs 4–6 concurrent sessions against one working
> tree, so per-session file relocation would have one session's coin changing another's
> channel mid-flight.
> **The arms are therefore produced inversely, which is the identical contrast:** the seven
> rulings are thinned to routing stubs (pushed to all), full text moves to
> `.claude/context/relocated-rules/`, and `.claude/hooks/channel-arm.cjs` **re-injects the
> full text for arm A** while arm B gets only the stub. Per-session, concurrency-safe.
> Ships `mode: "off"` — assigns and logs, injects nothing — and is **not wired into
> `settings.json`**. Fail-open is toward arm A and is recorded as `A-failopen`, never folded
> into A. 18 tests in `scripts/__tests__/channelArm.test.js`, live path included.
> **Outcome measure is citation misplacement, not substance refutation** (rank 2's finding).

**Ranks 1, 3, 4 and 7 have no inbound dependency and start on a free session today.** Per `improvement-default.md`, a deferred item keeps a named owner, a cost and a place in the plan — all eleven have all three.

---

## 8. Gaps flagged, not filled

- **G1 — the owning program does not own the problem.** `prog-anti-hallucination` is a kit template about hallucinated *code* — phantom imports, invented SDK methods, stale docstrings. None of its six problem classes resembles "a claim contradicted by information present in the repo." *"Health 0, baseline never run"* is not a neglected program; it is a program pointed somewhere else.
- **G2 — no differentiated subagent channel was proposed**, despite 7× per roundtable being the largest number in the study and `engine-execution-fidelity.md` making the dispatch that produces it mandatory. Channel cost scales with the exact behaviour the channel exists to cause.
- **G3 — the design violates the rule it cites two lines earlier.** `:14-15` invokes `founder-read-detects-site-not-direction.md` and `:26-27` immediately adopts the founder's causal direction as the foundation of all eight primitives. The **site** ("claims are wrong") is real; the **direction** ("because retrieval failed") is untested. Zero of nine lenses caught it.
- **G4 — the error-class mix was never measured.** `accuracy-program-handoff.md:96-107` names **SHAPE 1, "changed after verified, never re-verified," as "the single most common"** — three instances in one session, one of which left a hook's own test file red for a full revision while its header claimed unqualified that it blocks. That is staleness of the agent's own prior verification. **Six of the eight primitives target retrieval.**

---

## 9. Four founder decisions

**Two were ruled on 2026-08-20, immediately after this review. Both captured as `heavy` decisions.**

> **RULED — (a): settle it by experiment.** The seven rulings stay pushed in arm A and move behind a routing entry in arm B, randomized at session level on the seeded coin, claim survival deciding. This promotes **rank 5** and makes **rank 2** (the accuracy instrument) its hard prerequisite, since the arms need an outcome measure. Rank 9 (P6b, the relocation list) is now gated on the experiment's result rather than on an argument.

> **RULED — (d): exempt it as infrastructure.** An instrument whose subject is the repo itself need not name a live-table path under `surfaces-reach-the-table.md`. The cost was stated before the ruling and is accepted: this creates a precedent later instruments may cite to avoid the same question, and the rule being exempted was written on 2026-08-20 precisely because study surfaces were outnumbering live ones. **Scope of the exemption: infrastructure whose subject is the repo — not strategy surfaces.** G4 (the unmeasured error-class mix) is unaffected and remains open: exemption from the table-path requirement is not evidence that retrieval is the right target.

> **STILL OPEN — (b) and (c).** Neither blocks ranks 1–5. (b) blocks rank 2's output from becoming a *citable* claim, not from being built.

Recorded below in full; both paths and costs stated, no recommendation attached.

**(a) Should the seven founder rulings of 2026-08-20 be relocated to an ~8%-delivery channel?** They were authored in one commit yesterday, specifically to be present, closing ~90 per-item decision flags — and they are 56% of P6's claimed saving. *Keep pushed:* saving drops ~19,764 → ~8,686 tok; the 7× multiplier stays largely intact. *Relocate:* ~92% of sessions lose them, and the failure is silent — a ruling that did not fire looks exactly like one that did not apply. *Third path:* rank 5 settles it by experiment in two weeks.

**(b) The `claimKind` schema decision, blocking any Result Card.** `SURFACE_KINDS` is frozen at four poker surface kinds; all seven `REQUIRED_CONSTANTS` are poker-engine quantities; `manifestProblems` refuses a manifest missing any. A context-system accuracy run has no Deal Book and none of those constants. *Extend the schema:* touches frozen enums load-bearing for every poker Result Card, 1–2 sessions plus a careful test pass. *Declare it outside ADR-009:* the number becomes a decision input that must refuse the moment it is displayed or cited — including in the design's own falsifier. **This does not block building rank 2; it blocks rank 2's output becoming a citable claim.**

**(c) Proportionality against WS-581.** Not a scheduling conflict — WS-581 is `runs_on: node1`, this is G16 authoring, and `machine-affinity.md` exists so they do not compete. **The real tension is contamination:** if the pivotal experiment is specified by an instrument whose error rate is unmeasured, against a 9-occurrence record of that instrument mis-specifying tickets, it answers the wrong question. A wrong answer to the pivotal question is worse than a late one.

**(d) Is "errors about the repo" the class worth fixing?** `surfaces-reach-the-table.md` requires every instrument to name how it reaches the table. **No error this design targets is an error about poker.** *Exempt it as infrastructure:* creates a precedent that will be cited by the next instrument that would rather not answer. *Require the table path:* it exists — this instrument's output is the trustworthiness of every ticket, spec and measurement that reaches the table, WS-581 included — but making that argument explicitly puts pressure on P1, P4 and P7.

**The adjacent question, relayed prominently rather than in a footnote.** `POKER_THEORY.md` alone is 243,816 B — 18% of the coverage corpus, ~2.3× the entire push channel, grown 389→2,495 lines with 62.5% of that in ten days. The alternative hypothesis is that **a ~336,000-token doctrine corpus for a single-user project is itself the defect**, and the answer is fewer documents rather than better retrieval for more of them. **No lens raised it. It is foreclosed by `improvement-default.md` and its vocabulary is blocked by `retreat-detector.cjs`.** *"Nine lenses did not consider it" and "a Stop hook blocks the vocabulary in which it would be expressed" are the same fact.* Not recommended — recorded, because it is the only one of these that no agent in this run could have offered.

---

## 10. Live evidence produced by the run itself

- **`retreat-detector.cjs` fired during Phase-1 relay**, on quoted compliance language. That resolves an ambiguity a lens could not: **the hook runs, and it leaves no trace** — it has no `recordBypass`, a fix its sibling `context-barrier.cjs:72-81` received and it never did. Precision on that fire: 0. Consistent with the measured 0/12 post-shift, where every hit was the model *refusing* to retreat.
- **`compact-tier.cjs:171-180`** records an anchor-verified line that was **false in a load-bearing direction** — the corpus described as *"short-handed by comparison"* when the founder's game is 9-handed; the magnitude ban forced a paraphrase that reversed the direction and the anchor check passed it. Corrected 2026-08-06. It stands as the production proof of P2's own failure mode.
- **The design document is a worked example of its own thesis:** a pull-side document nobody was forced to read, whose author had not read four of its five declared siblings.

---

*Record of record for this review. The design document it tests requires revision against §2, §3 and §7 before implementation.*

---

## 11. Rank 1 — shipped 2026-08-20, verified against the stated falsifiers

| Repair | Falsifier | Result |
|---|---|---|
| **1a-i · the log writer emitted invalid YAML** — `context-barrier.cjs` escaped `"` and nothing else, so a Windows path made `\U` a malformed unicode escape. Unparseable since event #3 of 1301. Replaced with `JSON.stringify` per scalar: a YAML 1.2 double-quoted scalar is JSON-compatible, so one call is correct *and* total. | *"Parse the log with a YAML parser; it succeeds."* | **PASS.** `yaml.safe_load` round-trips a path containing raw backslashes intact. |
| **1a-ii · the test suite wrote production state** — `contextBarrier.test.js` spawned the hook with `cwd: REPO_ROOT` while `ACTIVE`/`LOG` resolved from `__dirname`, so every run created and deleted the live declaration file and appended fixtures to the live log. `ACTIVE`, `LOG` and `BUNDLE_DIR` are now env-overridable; the suite redirects into a tmpdir; every record carries `source:`. | *"Run the suite; production log event count is unchanged and `active-bundle.json` is untouched."* | **PASS.** Production log byte-identical across a full run (213203 → 213203 before quarantine; 352 → 352 after). `active-bundle.json` still absent. A new test asserts the property rather than a comment requesting it. |
| **1a-iii · the contaminated log** | — | **QUARANTINED, NOT DELETED.** 213,201 bytes moved to `context-barrier-log.quarantined-2026-08-20.yaml` with a header stating what it is and why ~3% of it is real. A fresh, parseable log replaces it. |
| **1b · the repair command never existed** — `:253` printed `node kit/scripts/cwos-bundle-validate.js --rehash`: wrong directory, wrong filename, wrong extension. Every drift finding the mechanism ever emitted instructed the reader to run it. Also wrong in the usage block (`:67-69`) and the title (`:3`). The *historical* references at `:59` and `:63` are deliberate and were left intact. | *"Copy the printed command, paste it, it runs."* | **PASS.** |
| **1c · the barrier did not withhold** — the leaf/substring check caught an input that *named* the file and missed every input that named a container and let the tool enumerate. Added `reachesByDirectory()`: a token is a directory reach if a withheld path starts with it plus a separator, floored at two segments, with a specific sibling file explicitly not a reach. | *"`Grep{path: '.claude/context/'}` either blocks or is documented as permitted."* | **PASS — 5 newly-closed routes.** Before: Read BLOCKED; Grep-on-dir, Glob-on-dir, `cat dir/*`, `git grep -- dir`, and Task-by-directory all **ALLOWED**. After: all six BLOCKED, while sibling reads, a bare one-segment `.claude`, unrelated directories and repo-root commands stay ALLOWED. Seven regression tests added. |
| **1d · `[CUSTOMIZE:]` in the owning program** — four placeholders, not the two first reported, in `prog-methodology-integrity.yaml`. Filled with dated in-repo instances (the 45.9%-vs-50.6% denominator, the 145-census-as-violation-count, the 14-smallest-transcripts sample, the 0/11 relabel, the one-quantity-three-values residue) rather than generic examples — matching the one class that was already filled. | *"Zero `[CUSTOMIZE:` occurrences."* | **PASS.** YAML parses; 5 problem classes, all with examples. |

**Regression surface:** `contextBarrier.test.js` 19 → **26 tests**, all passing. Full `scripts/` suite: **75 files, 1362 tests, all passing.** The no-declaration fast path — the state every real session is in — still fails open on every input shape at ~72 ms/call.

**Concurrent-session discipline:** files were snapshotted before editing and diffed after. `.claude/workstream/chain-anchors.yaml` and `scripts/backtest/heroEvTask.mjs` were dirty from other live sessions throughout and were not touched.

**Next by dependency:** rank 2 (the retrospective accuracy instrument) — prerequisite for the founder-ruled seeded-coin experiment, since the arms need an outcome measure. Ranks 3, 4 and 7 have no inbound edges and can start in any order.
