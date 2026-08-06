# The Accuracy Program — Comprehensive Handoff

**Written 2026-08-06 at the end of a failed session.** Read this whole file before doing anything.
It is deliberately long. The previous handoff
(`.claude/projects/context-shift-implementation.md`) was **deliberately compact** — it said so in
its own second paragraph, on the theory that "a narrative handoff would move the drag rather than
leave it behind." **That compactness is why the session it launched failed.** It omitted the
problem being solved, and everything built downstream aimed at the wrong target for two days.

Founder, closing that session: *"this was a failed session because you didn't understand the
problem we're trying to solve, which is systemic 'I was wrong' over the past few weeks."*

---

## PART 1 — THE PROBLEM. Read this twice.

### 1.1 The problem is accuracy. It is not context size, drag, or vocabulary.

**The founder's actual complaint, verbatim (2026-08-06):**

> *"the problem is in your accuracy over the past few weeks, which has many things that could have
> been prevented with proper context. how is this not in the handoff?? and the use of greenfield as
> a standard that is literally 100% better than you doing it in quality measurement, everytime."*

The failing thing is **wrong claims**. A `file:line` that doesn't say what was claimed. A byte count
that was never measured. A capability asserted that doesn't work. A conclusion inherited and
repeated as fact. These are not stylistic problems. They compound, they get built on, and they cost
real rework.

**The previous handoff never once used the word "accuracy."** Verified: zero occurrences. It framed
the entire problem as vocabulary priors and context drag. Every artifact produced downstream
inherited that target — including a frozen pre-registration whose primary instrument measured
**vocabulary uptake**, which cannot detect a false claim at all. A context system could have passed
that study with the error rate completely unchanged.

### 1.2 The measured evidence that this is systemic

Do not take this on faith and do not re-derive it from scratch; it is recorded so it can be checked.

**(a) This session's own work, audited by a fresh-context agent:**

| | |
|---|---:|
| Load-bearing claims checked | **85** |
| Held | 39 |
| **Refuted** | **38** |
| Unverifiable | 8 |
| **Survival rate** | **45.9%** |

That is one session's output — hooks, a pre-registration, an evidence document, amended headers —
scored against the repo. Fewer than half its factual claims survived independent checking.

**(b) The three-arm comparison (`docs/context-system-comparison.md` §3):**

| Arm | Claims checked | Held | Refuted |
|---|---:|---:|---:|
| A — greenfield (fresh context) | 11 | **11** | **0** |
| B — context-laden | 4 | 4 | 1 |
| C — maximum drag | 4 | 4 | 1 |

Greenfield also won the judge's rubric decisively: **33.5 vs 24 and 24**, taking 6 of 7 criteria.

**IMPORTANT AND UNDER-STATED IN EVERY PRIOR ARTIFACT — the honest statistics:** 11/11 vs 4/5 is
**Fisher exact p = 0.3125**, not significant. Wilson intervals: greenfield [74.1%, 100%], laden
[37.6%, 96.4%] — they overlap almost entirely. The **rubric** win is large and solid; the
**claim-accuracy** comparison alone rests on one refuted claim at n=5. The last session converted
that n=5 into a calibrated 95% decision threshold and injected it as settled doctrine on every
turn. **Do not repeat that.** The direction is real; the precision was invented.

Also: the source says Arm A made **13** numbered observations and only **11 were checked**. Two were
never checked. "Held every claim it made" is an overstatement; "held every claim checked" is
accurate.

**(c) The failure modes are already recorded and nobody built a mechanism for them.** From the
project memory index — these are pre-existing entries, not new findings:

- *"Verify ticket premise at composition"* — **audit-authored tickets recurrently assume nonexistent
  data or scope, 8 recorded occurrences.** Tickets confidently describing things that aren't there.
- *"Shipped-but-inert capability"* — a capability ships behind an optional parameter no call site
  passes (WS-276 `perceivedHeroRange`, WS-284, `predictionAudit`). **It happened again this
  session:** the S7/B9 `withheld-source-cited` check is built and running, and **zero findings carry
  `context_bundle`**, so it can never fire.
- *"Kit upgrades half-apply via sidecar skew"* — preserved lib + overwritten caller = missing-symbol
  crash the gate misses.
- *"Lambda was tuned to a broken prior shape"* — two independent shape fixes each cost nats at the
  shipped value.
- *"Advice depth tracks machine load"* — refinement gated on wall-clock, so identical inputs give
  different advice under contention.

**(d) `.claude/hooks/improvement-default.cjs` carries six dated, specific recorded instances**
already, and rotates one into context every turn. It exists because the founder said this is *"every
single session for months, and almost the theme of the repo."*

### 1.3 The error signature — what these failures have in common

Every error in the last session fell into one of three shapes. Learn these; they are the target.

**SHAPE 1 — Changed after verified, never re-verified.** The single most common. Something is built,
tested, demonstrated working. Then it is changed. The test is not re-run. **This happened three
times in one session:**

1. The compact-tier turn counter was fixed and tested. Then the ceiling was made flat, which made
   the counter dead code — a full transcript parse every turn feeding a constant function.
2. The barrier was proven live with a denied read while the matcher was an explicit tool list. The
   matcher was then changed to `"*"` and only re-tested by piping JSON at the hook — exercising its
   logic, not its registration.
3. **The barrier was then completely broken.** `activeDeclaration()`'s return shape changed to
   `{decl, reason}` to add fail-open logging; `main()` was never updated; `decl.bundle_id` became
   `undefined`; **every call fell through to allow.** Its own test file was 7/7 red for a full
   revision while its header still claimed, unqualified, that it blocks. *The test that catches this
   in three seconds existed the whole time and was not run.*

**SHAPE 2 — Inherited and repeated as fact.** A number or claim is taken from a prior document and
restated without checking. The previous handoff's "accretion rate is the driver of drag" was adopted
untested and drove a whole design. Arms B and C both asserted an impossibility neither had tested —
and C inherited it from a **file header** written by B's author.

**SHAPE 3 — Measured once, then described from memory.** The harness-injection figure was stated as
51,684 B, then "corrected" to 56,435 B, and the real figure is **~71,953 B**. Both published figures
omit auto-memory (18,894 B) *while the sentences carrying the number explicitly name auto-memory as
a component*. And the stated cause of the correction was false: the entire delta between the two was
a new rules file, not the global `CLAUDE.md` the correction blamed.

**The bitter irony to internalise:** this design's founding evidence is *"the same measurement stated
five times with three different values inside a single file."* The last session then stated the
harness total three times with three values, and the session-start load twice with two values
(486,000 and 490,263; actual 494,735). **It reproduced the exact pathology it was built to prevent,
inside the documents building it.**

### 1.4 The finding that should reorganise your priors

The last session pre-registered that the *inherited* growth numbers would fail and its *own* numbers
would hold. **The exact opposite happened.**

All five inherited numbers reproduce to three significant figures from git:
`2,495 lines` · `62.48% in ten days` · `155.9 lines/day` · `prior-life 3.935/day` · `39.6×`.

**Every single failure was in a number describing the new machinery** — because nobody re-measured
after the machinery changed. You will be tempted to distrust what you inherit and trust what you
just built. **That instinct is backwards. Invert it.**

---

## PART 2 — WHAT THE LAST SESSION BUILT, AND ITS VERIFIED STATE

**EVERYTHING BELOW IS UNTRACKED IN GIT.** Nothing is committed. A fresh clone has none of it, and
`scripts/__tests__/contextBarrier.test.js` fails immediately on a clean checkout because its fixture
(`.claude/context/bundles/math-blindspot.yaml`) is also untracked. **`git status` before you trust
anything.**

### 2.1 Inventory

| Artifact | State | Notes |
|---|---|---|
| `.claude/hooks/compact-tier.cjs` | Runs, wired, **95% redundant** | 18 rules, 2,304 B, emitted every turn. Only ~118 B is content not already in the window. |
| `.claude/hooks/context-barrier.cjs` | **Repaired at end of session**, re-proven live | Was dead for a revision. Blocks literal-path reads. **Does not stop `Grep`.** |
| `.claude/hooks/context-bundle-check.cjs` | Works | SessionStart caller, advisory, repo-local so it survives `/kit-upgrade`. |
| `scripts/context/cwos-context-bundle-validate.cjs` | Works | Moved out of `kit/`, renamed. Resolves D1+D2. |
| `scripts/context/echo-meter.mjs` | Runs, **instrument defective** | Decoy pool is 45% kit-snapshot boilerplate; decoy carries 1.1–1.45× fewer grams than the read-set. |
| `scripts/context/vocab-rate.mjs` | Runs, **measures the wrong thing** | 76.3% of "treatment" mass is `equity`+`spr`, which the emitter does not control. |
| `scripts/context/enforcement-classes.cjs` | Works | The S9 three-clause catalogue, 14 checks. |
| `docs/context-shift-prereg.md` | **Invalid** | See 2.3. |
| `.claude/workstream/evidence/context-shift-preflight.md` | Contains refuted numbers | §2 superseded by §2a; §2a itself partly wrong. |
| `.claude/rules/dispatch-dont-assert.md` | Good content, **untracked** | Argues it exists *because* auto-memory isn't version-controlled, while itself not being version-controlled. 4 compact-tier rules anchor to it. |
| `scripts/__tests__/{compactTier,contextBarrier,enforcementClasses,falsifiedCounter}.test.js` | 42 pass | `compactTier` was load-sensitive and is now bounded + 30s timeout. |

### 2.2 What genuinely held under adversarial review

- **D4 — the git-hooks outage was real and the fix works.** `core.hooksPath` pointed at an abandoned
  OneDrive tree, so `.git/hooks/` was never consulted and none of the six shipped hooks had run
  since the repo relocated (~134 commits). Now unset; dispatchers installed; demonstrated blocking a
  real commit. **But there is no regression detection whatsoever** — `.git/hooks/` is untracked,
  `.git/config` is local, nothing watches `core.hooksPath`, and `install-git-hooks.sh` is invoked
  from nowhere. It is a one-time manual action on one machine.
- **The `kit/scripts/cwos-reconcile.js` surgery** — clean, no orphans, a concurrent session's 86-line
  feature undamaged. The one item with no caveat.
- **`git-guard.cjs:276` is `process.exit(2)` at exactly that line.** Hooks *do* fire inside subagents
  (confirmed empirically, `agent: "general-purpose"` in the barrier log). `matcher: "*"` *does*
  dispatch to all tools.
- **The bundle machinery** (pointer-not-copy, sha256 pins, section anchors, closed exclude
  vocabulary, `persona-kind-confusion`) — exists, runs, well-argued.
- **All five POKER_THEORY growth figures.**

### 2.3 What is refuted — do not inherit these

**The pre-registration is invalid.** Three independent reasons:

1. **Its threshold is not reproducible from its own inputs.** It states MDE 0.85 abs / 36% rel. Its
   own formula with its own frozen SD and n gives **0.767 / 32.6%**.
2. **The estimand is not identified, and no sample size fixes it.** It compares two consecutive time
   windows written by one author. Topic mix dominates: one 15-file artifact family created on a
   single day carries V=7.41 against 2.02 for the rest. **Sixteen more such artifacts fake the entire
   effect.** The only identifying assumption is topic-mix stationarity; the corpus refutes it.
3. **1,080 "independent" blocks are 388 artifacts on 44 days**, top 5 days holding 69.7% of mass.
   Day-level variance inflation **9.05×**. Simulated true type-I error **0.557** against nominal
   0.05. The real MDE is **99%**, not 36%. The prereg rejected the original gate for being a
   108%-MDE "uninterpretable result wearing the costume of rigour" and **landed at 99%.**

Also: its gate (800 blocks in 60 days) is **unreachable** — actual production is 166 blocks/60 days,
i.e. 289 days. Its "frozen" baseline **is not frozen**: `vocab-rate.mjs` recomputes from disk at
analysis time and the baseline moved **+1.05% in 24 hours** with no intervention.

**Other refuted claims to purge:**

- "51,684 bytes harness-injected" and "56,435" — both wrong, both omit auto-memory. Real ~71,953.
- "The full 16-rule tier is 1,912 B" — it is **18 rules, 2,304 B**.
- "`Four Motivations` occurs zero times anywhere else" — appears in 6 other files.
- "`intransitiv*` occurs 114 times across 13 files" — 104/23 case-sensitive, 125/23 insensitive.
- "§8 is the only section with zero external citations" — **unverifiable**; no citation instrument
  exists and the only reproducible method returns 364 hits for §8.
- "`E(O,D)` is exactly 0 in every one of 26 sessions" — it is 25/26; and once the decoy is drawn
  from the right pool the control fires in 5 of 8 sessions, at up to **43% of the signal**.
- "Blocking to 1,000 words is the correct unit and lowers CV" — the improvement came from silently
  dropping 91 of 176 artifacts under 1,000 words. **Blocking alone makes CV worse** (1.857 vs 1.742).
- "six shipped pre-commit hooks" — five `pre-commit-*` plus one `post-commit-*`.
- "38 analytical lenses" — **35**.
- "`validateFindingProblemClass()` at `cwos-reconcile.js:759`" — defined at **768**.
- "`queue-index.yaml` 73,945 B at HEAD" — HEAD is 53,444; working tree 75,655.

### 2.4 The compact tier's specific defects

- **95% redundant.** 6 of 18 rules restate root `CLAUDE.md` near-verbatim, and `CLAUDE.md` is
  injected unconditionally every session. Novel payload ≈118 B of 2,304.
- **8 of 18 anchors are vacuous or accidental.** The anchor mechanism is `src.includes(anchor)`.
  `anchor: 'dispatch' → CLAUDE.md` matches only *"State updates via reducer dispatch only"* — a React
  rule; the dispatch doctrine is not in `CLAUDE.md` at all. `anchor: '3.4'` matches `3.47%` and
  `§13.4`. **Three anchor doctrine absent from the named source entirely** — `runout`,
  `inverse conditional`, `prior grid` all have zero hits.
- **It injected a factually inverted poker claim on every turn** until caught: it said the founder's
  game is "short-handed by comparison" to the corpus. The corpus is online **6-max and full-ring**;
  the founder's game is live **9-handed** — *longer*-handed. Cause: S4 bans magnitudes, so the
  handedness figures were paraphrased into words and the paraphrase reversed direction. Fixed.
- **The S5 "never a digest" test passes only because its haystack was scoped around its own
  failures** — `HEAVY = ['POKER_THEORY.md', 'CLAUDE.md']`, omitting `.claude/rules/*` and `MEMORY.md`,
  which are exactly where the copied lines came from.
- Costs ~30ms on every tool call (measured; an agent reported 90–116ms).

### 2.5 The barrier's real limit

`Grep(path=".claude/context", pattern="...")` **returns withheld content**, verbatim, with zero
adversarial intent. Bash quote-splitting (`"ME""ASUREMENT"`) and base64-decode-pipe also defeat it.

The reason is structural and worth stating precisely: **the hook gates on declared intent, not on
data access.** For any tool that resolves files on its own side — ripgrep's engine, Glob's walk — the
withheld path never appears in `tool_input` at all. This is not a matching bug to patch.

The honest capability statement, which supersedes the one now in the validator header:
**literal-path reads are enforceable; search is not; Bash is not soundly enforceable by substring.**
Closing it needs `PostToolUse` filtering on tool *results*, which is unbuilt and unverified.

---

## PART 3 — WHAT TO BUILD

The founder has not yet set scope. **Ask before building.** These are the candidates, with what is
known about each.

### 3.1 The accuracy instrument (this is the point of the whole program)

Measure **claim survival under independent verification**: the proportion of load-bearing claims in
an artifact that survive checking by a **fresh-context** agent that did not produce them. A claim is
load-bearing if it is a `file:line`, a measured quantity, or a capability assertion.

Known constraints, learned the hard way:
- The 45.9% figure above is the first real datapoint. It is one session, self-selected.
- **The judge is the same model whose error rate is the object of study.** That is a self-referential
  reference standard. It needs a human-adjudicated subsample to calibrate before any threshold is
  trustworthy. Report it as *agreement with an unvalidated judge* until then.
- Do not set a threshold off n=5 as the last session did.

### 3.2 Make the study identifiable

If any A/B is run: **randomize at session level by seeded coin on the session ID** — the hook already
has that ID. That makes arms exchangeable by construction rather than by assumption, kills the
topic-mix confound, and licenses a permutation test with the session as the unit (no normality, no
equal-variance, no ICC estimate). Pair with scoring each artifact **at the commit that created it**
(`git show <sha>:<path>`) rather than at HEAD, which closes the baseline-leakage channel in one line.

### 3.3 Re-target the channel

The last session spent 180 lines controlling a 2.3 KB per-turn channel and never touched the
**~72 KB injected unconditionally every session**, of which `MEMORY.md` alone is 18,894 B and is the
source of four of the tier's own rules. That is the duplication generator.

**The move that works is the one the founder made to the fleet context on 2026-08-06:** the fleet
knowledge was not shrunk — it was **routed** to a skill that loads when triggered, leaving a 23-line
always-loaded spine. Knowledge preserved, load freed. Nobody applied that to `MEMORY.md` or
`CLAUDE.md`.

### 3.4 Anchors that verify propositions, not substrings

The current mechanism cannot tell whether the doctrine still says what the rule claims. Candidates:
pin a content hash of the anchored span; require an anchor phrase of N words that appears exactly
once; assert the anchored span still contains the rule's key terms.

### 3.5 Track everything, first

Before any of the above: `git add` the whole body of work. "Frozen" with no commit is not frozen, and
four compact-tier rules currently anchor to a file a clean checkout does not have.

---

## PART 4 — HOW TO NOT REPEAT THIS SESSION

### 4.1 Hard rules, derived from the specific failures above

1. **Re-run the tests after every change, especially the last one.** Three of this session's worst
   defects were changes made after verification. If you change a function's return shape, grep every
   caller *in the same edit*.
2. **A passing unit test is not a working feature.** The barrier's tests passed while it was dead,
   because the tests were green *before* the break and nobody re-ran them. Prove capability with the
   real thing — a denied read, a blocked commit — not with a test of the logic.
3. **Never restate an inherited number without re-measuring it.** If you write a figure you did not
   compute in this session, either compute it or mark it explicitly as inherited-unverified.
4. **State the same measurement once.** If you must correct it, correct it everywhere in the same
   edit and say what the old value was and why it was wrong.
5. **Dispatch fresh-context agents to check load-bearing claims before reporting them.** Every error
   this session that was caught internally was caught by dispatching or measuring — **none** by
   reasoning more carefully from context.
6. **Write briefs that permit disagreement.** State the hypothesis as the *correction*: "assume the
   author was overconfident; find what's wrong." A brief that encodes the expected answer returns it.
7. **Do not convert a small-n observation into a calibrated threshold.**

### 4.2 The standing rules that are already mechanised

- `.claude/rules/improvement-default.md` — a limitation found by analysis is REMOVED by default;
  accommodation is the founder's call, never the AI's. Enforced by a `UserPromptSubmit` hook that
  rotates a real past failure into context every turn.
- `.claude/rules/engine-execution-fidelity.md` — a declared multi-agent engine is executed by
  spawning those agents, or you stop and say why. Inline simulation is prohibited and its output
  invalid.
- `.claude/rules/dispatch-dont-assert.md` — the working stance. **Untracked; commit it.**

### 4.3 Do not read this file's conclusions as premises

The findings above are stated with their evidence and their file paths so they can be re-checked.
**If you re-derive one independently, that is replication and it is worth more than the
inheritance.** If you find one of them wrong, that is the most valuable thing you can produce —
this handoff is the output of a session with a 45.9% claim-survival rate, and it has not itself been
independently audited.

---

## PART 5 — OPEN DECISIONS FOR THE FOUNDER

1. **Scope.** Rebuild the context system on a randomized design, or narrow to just the accuracy
   instrument and leave the tier/barrier as-is (defective but documented), or delete both and start
   from the accuracy measurement alone?
2. **The compact tier.** It delivers ~118 bytes of novel content per turn for 2,304 bytes. Repair it
   by removing the redundant 95%, re-target it, or delete it?
3. **The barrier.** It cannot stop `Grep`. Build `PostToolUse` result-filtering, accept it as a
   partial control with the limit documented, or remove it?
4. **`prog-strategy-of-record.yaml` will block the next commit that touches it** — the ASN gate is
   live for the first time and that file has four missing assumption fields. Fix the fields, or see
   it fire once?
5. **The ASN gate's grandfathering rewards never starting:** files with no `assumptions:` key are
   exempt forever; the one file that partially adopted the schema is the one that gets blocked.

---

## APPENDIX — Files to read, in order

1. This file.
2. `docs/context-system-comparison.md` — the judge's synthesis (S1–S11) and §3 accuracy table.
3. `docs/context-system-requirements.md` — R1–R14, pre-registered, still binding.
4. `.claude/workstream/evidence/adversarial-review-predictions.md` — predictions recorded before the
   review, and how they scored. P0 was wrong in the author's favour; P3 and P6 were confirmed and
   much worse than predicted.
5. `.claude/workstream/queue/WS-424.yaml` — the implementing ticket.
6. `.claude/projects/context-shift-implementation.md` — the previous handoff, **with the corrective
   section added at its top on 2026-08-06.** Read that section; the body below it carries the wrong
   framing.
7. `.claude/workstream/evidence/context-shift-preflight.md` — measurements, with §2 superseded.
8. `docs/context-bundles.md` — bundle design; §4.3 was refuted and amended in place.

**Do not read the previous session's transcript.** It is 200k+ tokens and its conclusions are the
thing under suspicion.
