# Arm A — Greenfield Context Design

Written against `docs/context-system-requirements.md` and direct inspection of the running code.
No doctrine, session history, design docs, or memory files were opened. **Read §10 first if you are
the judge** — the harness injected several forbidden files into my context without my consent, and
that materially affects how C5 should be scored.

---

## 1. What I observed, before proposing anything

Facts, each verifiable at the cited path.

| # | Observation | Path |
|---|---|---|
| O1 | Four hook events already fire: `SessionStart`, `UserPromptSubmit`, `PreToolUse(Bash)`, `Stop`. | `.claude/settings.json:38-104` |
| O2 | `PreToolUse` `exit(2)` is a **hard deny** and is already used twice. | `git-guard.cjs:276`, `secrets-scan.cjs:98` |
| O3 | There is **no `PreToolUse` matcher for `Read`/`Grep`/`Glob`**. Reads are entirely ungoverned. | `.claude/settings.json:39` |
| O4 | A `UserPromptSubmit` hook already injects prose into *every turn*, and already rotates its payload to defeat banner-blindness. | `improvement-default.cjs:62-88` |
| O5 | A `Stop` hook already reads the transcript JSONL and returns `{decision:'block'}`. | `retreat-detector.cjs:46-107` |
| O6 | Another `Stop` script already walks transcript `tool_use` blocks and sums characters. The transcript-analysis substrate exists. | `cwos-stop-telemetry.js:20-45` |
| O7 | **No hook records that it fired.** `grep -n "writeFile\|appendFile\|cwos-event" .claude/hooks/*.cjs` → nothing. Recurrence is uncountable. | — |
| O8 | The always-loaded surface is ~33.7 KB (`CLAUDE.md`) injected **once**; the per-turn injection is ~1.1 KB injected **every turn**. Nothing measures bytes × turns. | `ls -l CLAUDE.md` |
| O9 | A context-bundle validator exists (includes/excludes/hashes/40 KB ceiling/lens-vs-persona check) and is good. Its single caller is a **local edit to a kit-managed file** (`cwos-reconcile.js` is in `kit/hashes-3.8.5.yaml:233`), which the next `/kit-upgrade` reverts. | `cwos-bundle-validate.js`, `cwos-reconcile.js:938-944` |
| O10 | `.git/hooks/` contains only samples. The six hooks in `kit/scripts/git-hooks/` are **not installed**. Nothing hung on git hooks runs today. | `ls .git/hooks/` |
| O11 | Two unrelated things are called `cwos-bundle-validate.js` — context bundles (`kit/scripts/`) and archetype bundles (`kit/scripts/lib/`, required by `cwos-verify.js:596`). | — |
| O12 | 35 analytical lenses in `.claude/agents/`; 43 product personas in `docs/design/personas/`. Both are called "personas" in prose. | `ls` counts |
| O13 | `kit/` is overwritten by `/kit-upgrade`; `.claude/hooks/` and `scripts/` are not. This is recorded in code. | `readiness-gate.cjs:14-16` |

**The negative space.** Everything above governs *writing* (commits, findings, scope-retreat in output).
Nothing governs *reading*, and nothing counts anything. The context system is entirely supply-side:
files are curated, then loaded by whatever the session happens to load. Accretion always wins a
supply-side fight, because adding is one edit and removing requires an argument.

---

## 2. Central idea

> **Control context where it is sampled, not where it is stored.**

The founder's premise is a statement about the sampling distribution: tokens present raise the
likelihood of tokens like them. Three consequences follow that a storage-shaped design misses.

**(a) Position dominates volume.** A 33.7 KB file injected at turn 0 competes with everything since;
a 1.1 KB block injected at turn 40 sits in the most recent tokens. If you want a term to shape the
answer, put it *late*, not *big*. So the always-loaded tier should not be a file at all — it should
be a per-turn emission. The repo has already discovered this accidentally (O4) and has not
generalised it.

**(b) The unit of cost is bytes × turns, not file size.** A 211 KB document costs nothing until it is
read; a 2 KB injection costs 80 KB across a 40-turn session. No ceiling in this repo is denominated
in the unit that actually bills.

**(c) Reading is irreversible.** Once a conclusion is in the window, "don't rely on it" is not a
control. Withholding must happen *before* the tool call, or it has not happened.

Four organs follow. Each is a program that runs; none requires anyone to have read this document.

```
  UserPromptSubmit ──► PRIOR LINE   (≤2 KB, generated, every turn)      R1 R2 R4 R6 R13
  PreToolUse:Read  ──► THE BLIND    (deny withheld reads)               R7 R8 R9
  Stop             ──► ECHO METER   (measure recall vs derivation)      R11 R14
  all of the above ──► THE LEDGER   (count firings; nothing else does)  R5 R6
```

---

## 3. Organ 1 — The Prior Line  (R1, R2, R4, R6, R13)

`scripts/context/prior-line.mjs`, invoked by a `UserPromptSubmit` hook. Emits **≤2,000 bytes**.

**It is generated, never authored.** There is no file to open, no file to edit, and therefore no
second artifact that can disagree with the first. That is the whole of R4: *the compact tier has no
file.* Synchronisation cannot fail if there is nothing to synchronise.

Composition, in fixed priority order, truncated hard at 2,000 bytes:

1. `LENS: <id>` — the analytical lens the active task declared (§5).
2. `VOCAB:` — term *names* only, harvested from the `##`/`###` headings of the Standard-of-Record
   vocabulary file. Names, not definitions: the job is to make the word available, not to teach it.
3. `HOLDS:` — IDs and one-clause statements of invariants whose declared scope intersects the files
   touched this session (from `git status --porcelain` plus the transcript read-set).
4. `WITHHELD: n paths (bundle <id>)` — so the model knows it is operating blind, and says so.
5. `RECURRING:` — the single highest-weight correction from the Ledger not yet shown this session.
6. `STALE:` — one line if the active bundle's pins have drifted, so staleness reaches the model
   rather than only a report nobody runs.

**Selection criterion for R2** (asked for explicitly). A line earns the Prior Line iff:

- **it is derivable by script from a named source file** — no hand-written prose is admissible,
  which is what makes R4 structural rather than aspirational; and
- **its absence would change the *vocabulary* of a wrong answer, not merely its correctness.**
  The test: can I write a plausible-sounding wrong answer that never uses this term? If no, the term
  is already forced by the task and adds nothing. If yes, its presence is doing distributional work.

That criterion excludes almost everything, which is the point.

**Size ceiling and why 2,000 bytes** (R2 asks for the ceiling beyond which it stops being loaded *in
practice*). The failure mode is not truncation, it is skimming: `readiness-gate.cjs:9` already
records "a banner shown every session is a banner nobody reads by week three." The binding limit is
therefore attentional, not mechanical. 2 KB is roughly one screen, it is ~1.8× the injection already
proven to survive attention (O4), and at 40 turns it costs 80 KB — 2.4× the entire always-loaded
document, which is the number that should stop anyone from raising it. The ceiling is enforced by
the emitter slicing its own output, so it is not a check that can fail; it is an invariant of the
producer.

**Self-healing derivation.** Every emitted term is re-verified against its source at emit time. A
term no longer present in its source is dropped and the emitter appends `[dropped N]`. A generated
tier cannot go stale; it can only shrink and say so.

**R13 — native vocabulary.** Because `VOCAB:` is built *from* the repo's own vocabulary file, the
terminology that shapes every turn is by construction the repo's own. The Echo Meter closes the loop
from the other side: output terms that are neither in the vocabulary file nor a codebase identifier
are reported as *imported vocabulary* — the observable signature of a framework arriving as doctrine.

---

## 4. Organ 2 — The Ledger  (R5, R6)

`.claude/context/ledger.jsonl`, append-only. Written by every hook that fires.

Today this does not exist and the consequence is precise: **the repo cannot distinguish a correction
that recurs from one that fired once** (O7). R5 offers exactly that distinction — doctrine vs
archaeology — and there is currently no number to evaluate it with. The Ledger is what makes R5
decidable rather than a matter of taste.

Record shape:

```json
{"id":"COR-014","kind":"retreat|blind-deny|echo-alarm|founder-correction",
 "belief":"what was held","truth":"what is true","first_fired":"2026-08-05",
 "fire_count":3,"structural_fix":"src/…:120 | null","last_fired":"2026-08-05"}
```

**Where corrections live, and the argument (R5).**

- `fire_count >= 2` within a rolling 90 days → **doctrine**. It enters the Prior Line rotation,
  weighted by recency-adjusted count. Nobody decides this; the count decides it.
- `fire_count == 1` **and** `structural_fix != null` **and** no firing since the fix → **archaeology,
  and archaeology is deleted.** The record is reduced to `{id, truth, fix}` and moved to
  `docs/archive/corrections/`. The *old belief text is destroyed*.

That last clause is the argued part, and I expect it to be the most contested thing in this document.

The requirement notes that corrections-history "may also be the primary source of drag, since it
primes both the wrong idea and the right one." I think that is exactly right and I would go further:
for a correction with a structural fix, the narrative has **negative** expected value. The fix
already prevents recurrence, so the story buys nothing; the story raises the token likelihood of the
false belief, so it costs something. Keeping it is paying a real price for a benefit that has already
been collected by other means.

The counter-case is stated in the requirement itself: a prior roundtable "depended on knowing a
taxonomy had been falsified." I do not think that dependency argues for a narrative archive. If a
taxonomy was falsified, the correct action is that **the taxonomy is not loadable** — deleted from
the comprehensive tier, with a one-line tombstone at the code site that would have used it:
`// falsified 2026-06-11 (COR-014); do not reintroduce`. A tombstone is retrievable at exactly the
moment it is relevant. A narrative in a context file is present at every moment, including the many
where it is only noise. Same information; better conditional.

So: **doctrine is injected, archaeology is deleted, and the bridge between them is a tombstone at
the point of use, not a chapter in a document.**

**R6 — promotion of overlooked concepts.** Two detectors, both automatic:

- *Gets it wrong repeatedly* — `fire_count >= 2` promotes into the Prior Line (above). Decay
  demotes. No human curates the list, which is what stops it becoming another accreting file.
- *Never reaches for it at all* — the Echo Meter records, per session, which vocabulary terms
  appeared in output. A term defined in the vocabulary file with **zero** appearances across the
  last N sessions is a blind spot of a different and more dangerous kind: the system is not getting
  it wrong, it is not getting to it. These are reported monthly as promotion candidates. Cheap
  (substring counting over transcripts) and, as far as I can see, unmeasured today.

---

## 5. Organ 3 — The Blind  (R7, R8, R9)

`.claude/hooks/blind.cjs`, wired as `PreToolUse` with matcher `Read|Grep|Glob`.

It reads `.claude/context/active-task.json` — written when a task is claimed — containing
`{bundle_id, mode, lens, withheld:[globs], expires_at}`. On a read whose resolved path matches a
withheld glob it `exit(2)`s with a reason naming the bundle, the exclude category, and the release
command. Every denial appends to the Ledger. No active task, an expired task, or any internal error
→ `exit(0)`; it fails open.

**Why this matters more than it looks.** The existing validator states in its own header that
`excludes` "cannot prevent an agent from reading an excluded file. Nothing in this repo can; the
tools are not sandboxed per task." That claim is **false as written**, and the counter-example is in
the same repository: `git-guard.cjs` denies Bash tool calls via `PreToolUse` `exit(2)` (O2). The
mechanism exists; only the matcher is missing (O3). R9 is the requirement the repo currently comes
closest to satisfying on paper and furthest from satisfying in fact — `excludes` today is a
declaration with no enforcement behind it. Adding one matcher and ~150 lines converts it into a
barrier.

**Bypass is allowed and recorded.** `BLIND_RELEASE=<bundle_id> <reason>` lifts the barrier for the
session and writes the release plus its reason to the Ledger. A control with no escape valve gets
deleted; a control with an unrecorded escape valve is theatre. `cwos-bypass-log.js` is the existing
precedent for the recorded-bypass shape.

**Honest limits, stated because the alternative is a false claim.** The Blind cannot withhold:
knowledge already in the model's weights; content the harness auto-injects before any hook runs
(`CLAUDE.md`, memory files — see §10); or a subagent's summary of a file the parent never read. That
last one is a live hole: delegation launders a withheld read into an allowed summary. Mitigation:
`active-task.json` is inherited by spawned agents and the Blind checks it in the child process too.
This is a real cost of the design and I have not fully closed it.

**R7 — the unit, and staleness.** The unit is `(problem_class × mode)`, which is what the existing
bundle schema already keys on; I adopt it rather than invent a rival. Staleness is answered in three
layers: (1) per-include SHA pins, which exist; (2) **section-scoped includes are mandatory** for any
source over 20 KB, so a pin drifts only when the relevant section changes rather than on every edit
to a large file — otherwise the check fires constantly and becomes wallpaper; (3) drift surfaces
through the Prior Line's `STALE:` slot, so it reaches the model mid-task rather than only a report.

**R8 — personas: keep them separate, mechanically.** 35 analytical lenses, 43 product personas, one
word (O12). The existing validator already flags cross-kind naming
(`cwos-bundle-validate.js:167`) and that check is correct — it should be kept and hardened, not
redesigned. Three additions: rename the analytical kind to **lens** everywhere in schemas and
scripts, so the collision cannot recur in a name; require a `lens` on any task carrying a
`problem_class`; and print `LENS: <id>` in the Prior Line every turn, because a lens declared once in
a YAML at turn 0 is not shaping token 12,000 — a lens re-stated at turn 40 is. Unifying the two kinds
would be an error: a product persona describes who a surface is *for*, and asking "who is this for"
of an estimator produces a category mistake, not an audit.

---

## 6. Organ 4 — The Echo Meter  (R11, R14)

`scripts/context/echo-meter.mjs`, wired as an additional `Stop` hook. Built on the transcript walker
that `cwos-stop-telemetry.js` already proves works (O6).

Per session it computes:

- **Read-set** `R` — every file and byte-range actually read, from transcript `tool_use` blocks.
- **Echo** `E(O,R)` — the fraction of the output's content 5-grams (lowercased, stopwords stripped,
  code blocks excluded) that appear verbatim in `R`.
- **Decoy echo** `E(O,D)` — the same measure against `D`, a size-matched random sample of repo
  markdown *not* read this session. This is the control for coincidental overlap; without it the raw
  echo number means nothing, because a poker repo talks about poker.
- **Attributable echo** `A = E(O,R) − E(O,D)`.
- **Cited-but-unread** — files cited as sources in the output that never appear in `R`. This is the
  exact signature of the 2026-08-05 failure the requirements describe: a conclusion reproduced in
  structure while its mechanism was wrong, i.e. recalled rather than read. It is a boolean, it is
  cheap, and nothing computes it today.
- **Imported vocabulary** — output terms in neither the vocabulary file nor the codebase (R13).
- **Read-set bytes** and **injection bytes × turns**.

**R11 — three ceilings, each with something behind it.**

| Ceiling | Value | Enforced by |
|---|---|---|
| Prior Line | 2,000 B | Emitter truncates. Cannot be exceeded. |
| Bundle resolved size | 40,000 B | `cwos-bundle-validate.js:58`. Exists; keep. |
| **Session read-set** | 250,000 B | Echo Meter, warn + name the three largest reads. **New.** |

The third is the one that bites. A document's size costs nothing until it is read, so a ceiling on
files is a ceiling on the wrong quantity. 250 KB is set at roughly half the current mandated
session-start load, which makes it a target rather than a rubber stamp — and I would rather it fire
often at first and be raised with an argument than be set where it never fires.

---

## 7. R14 — the falsifier

**Primary instrument: attributable echo, under a pre-registered A/B.**

Take 20 findings already recorded in this repo whose conclusion is stated in some loadable file.
For each, re-run its declared lens twice:

- **Arm INCLUDED** — the conclusion-stating file is in the bundle.
- **Arm WITHHELD** — it is excluded, `reason: states-the-conclusion`, and the Blind enforces it.

Score three things per run: (a) conclusion agreement with the recorded finding; (b) **mechanism
correctness**, graded against the recorded mechanism by a grader who has not seen which arm produced
which output; (c) attributable echo `A`.

Pre-registered decision rule, stated so it can come out against me:

- **Drag confirmed** iff WITHHELD's mechanism-correct rate exceeds INCLUDED's by **≥15 points**
  while conclusion agreement stays within **10 points**. That combination is the signature of
  derivation replacing recall: the same answer, better understood.
- **Drag refuted** iff mechanism-correctness differs by **<5 points**. In that case withholding buys
  nothing, and the Blind — the most expensive and most intrusive organ here — **should be deleted**.
  I am saying that in advance so it is not renegotiated afterwards.
- Between 5 and 15 points: underpowered at n=20, and the honest answer is to run 40 more pairs, not
  to interpret.

Cost, stated because C3 asks: 40 runs plus a blind grading pass. The grading is the expensive part —
roughly one founder afternoon, or a rubric grader with a held-out calibration set. Not free, and not
skippable: attributable echo alone cannot distinguish "recalled the right answer" from "derived the
right answer using the right words," which is exactly the distinction the whole thing turns on.

**Secondary instrument, continuous and free:** the Echo Meter logs `A`, cited-but-unread count, and
read-set bytes every session. The trend is the health signal between studies. Specific expectations:
cited-but-unread should go to zero and stay there; `A` should fall on discovery-mode tasks and be
*unchanged* on verification-mode tasks, because verification is *supposed* to reproduce the recorded
answer. If `A` falls equally on both, the system is degrading recall rather than converting it to
derivation, and that is a failure I would want to catch.

---

## 8. Requirement ledger

| R | Disposition | Mechanism |
|---|---|---|
| R1 | Met | Every organ acts on the sampling distribution — per-turn injection, pre-read denial, post-hoc echo measurement. Nothing here is a library. |
| R2 | Met | Prior Line, ≤2 KB, generated per turn; derivability + vocabulary-of-a-wrong-answer as the stated selection criterion; ceiling argued attentionally, enforced by the producer. |
| R3 | Met | Comprehensive tier stays as files. Criterion: content whose value is in being **retrievable at a specific moment** (evidence, mechanism, measurement) vs the Prior Line's content, whose value is in being **present at all moments**. |
| R4 | Met, structurally | The compact tier has **no file**. It is stdout from a generator that reads the comprehensive tier and re-verifies each term at emit time. Two artifacts cannot drift when there is one artifact. |
| R5 | Met, argued | Doctrine (`fire_count>=2`) is injected; archaeology (fired once, structurally fixed) is **deleted**, leaving a tombstone at the code site. Argument in §4; I expect pushback and have stated the counter-case. |
| R6 | Met | Two automatic detectors: recurrence promotion from the Ledger, and zero-appearance vocabulary from the Echo Meter. No human curates either list. |
| R7 | Met, adopting existing schema | Unit = `(problem_class × mode)`. Staleness: SHA pins (exist) + mandatory section scoping over 20 KB + `STALE:` reaching the model via the Prior Line. |
| R8 | Met, kept distinct | Rename analytical kind to `lens`; existing cross-kind check kept; lens re-declared every turn. Unification refused with reason. |
| R9 | Met | The Blind. Upgrades `excludes` from declaration to barrier; the "nothing in this repo can" claim is falsified by `git-guard.cjs:276`. |
| R10 | **Partially refused** | See below. |
| R11 | Met | Three ceilings; the new one is denominated in bytes actually read. |
| R12 | Met | Hooks and generated injections only. The sole hand-authored artifact is a bundle YAML; its absence degrades to today's behaviour. |
| R13 | Met | Prior Line's vocabulary is generated *from* the repo's vocabulary file; imported-vocabulary detection closes the loop from the output side. |
| R14 | Met | Pre-registered A/B with a stated refutation threshold and a named deletion consequence. |

### The refusal: R10

R10 asks for warn-don't-block, with a good reason — a failing check may be evidence about the
declaration rather than about the item.

I accept that **for validators of declarations**: bundle validity, hash drift, vocabulary drift,
unbundled tasks. The existing validator is right to warn and its header argues the case well.

I refuse it **for the Blind**. A warning cannot withhold. By the time a warning about a read exists,
the tokens are in the window, and the tokens *are* the harm — there is no state to restore. Warn-only
withholding is not a weaker control; it is not a control.

The repo already agrees with me, in code rather than in prose: `retreat-detector.cjs:6-11` blocks,
and its header records that the first instinct was to warn "so it doesn't get disabled" — identifying
that instinct as the very bias the hook exists to catch.

So I propose a rule sharper than either position:

> **Warn when the check is about a declaration. Block when the check is about an irreversible act.**

Reading is irreversible within a session. Committing is irreversible. A mislabelled `problem_class`
is not. That line is principled, it is already where this repo's two blocking hooks sit, and it
predicts where the next one should go.

---

## 9. What exists, what I must build, what it costs

**Already exists — adopt, do not rebuild:**

- Context bundles with includes/excludes/section slicing/SHA pins/40 KB ceiling/closed exclude
  vocabulary/lens-vs-persona check — `kit/scripts/cwos-bundle-validate.js`. This is good work and my
  design leans on it rather than replacing it. **Three defects to fix first:**
  1. Its only caller is a local edit to a kit-managed file (O9). Move the invocation to a repo-local
     hook or `scripts/`, per the constraint recorded at `readiness-gate.cjs:14-16`. **~1 hour.**
  2. Name collision with `kit/scripts/lib/cwos-bundle-validate.js` (O11). Rename to
     `cwos-context-bundle-validate.js`. **~30 min.**
  3. Its header asserts withholding is impossible. Correct it once the Blind lands, or it will be
     cited as a reason not to build one. **~10 min.**
- Per-turn `additionalContext` injection with rotation — `improvement-default.cjs`. The Prior Line is
  this pattern, generalised and generated.
- Transcript walking from a `Stop` hook — `cwos-stop-telemetry.js`.
- `PreToolUse` deny — `git-guard.cjs`.
- Recorded bypass — `cwos-bypass-log.js`.

**Must be built:**

| Organ | LOC (est.) | Effort | Risk |
|---|---|---|---|
| Prior Line generator + `UserPromptSubmit` wiring | ~250 | 1 session | Low — pattern proven by O4 |
| The Ledger + append calls in each existing hook | ~120 | 0.5 session | Low |
| The Blind + `active-task.json` + subagent inheritance | ~180 | 1 session | **Medium** — I have not verified that a `PreToolUse` matcher accepts `Read`; verify first, ~15 min. Subagent inheritance is the unclosed hole (§5). |
| Echo Meter (5-grams, decoy sampling, cited-but-unread) | ~300 | 1.5 sessions | Medium — decoy sampling needs tuning so `A` is stable across sessions |
| R14 A/B study (40 runs + blind grading) | — | 1 founder afternoon + runs | The grading is the cost |

**~850 LOC across ~4 sessions, plus one study.** All of it in `.claude/hooks/` and `scripts/`, none
in `kit/`, per O13.

**One thing I would fix that is outside this design's scope:** `.git/hooks/` is empty (O10). Six
pre-commit hooks ship and none run. Anything anyone believes is enforced at commit time is not.

---

## 10. Disclosure — what I read that I should not have

Stated at length because a contaminated arm reported as clean makes the whole comparison worthless.

**Injected without my consent, before my first action.** The harness placed the following into my
system context automatically, as a `system-reminder`, before I took any action and with no way to
decline: the global `~/.claude/CLAUDE.md`; the project `CLAUDE.md` in full; all five files in
`.claude/rules/`; and the project `MEMORY.md` in full. `MEMORY.md` is a condensed doctrine index —
roughly 60 one-line entries, each naming a standing rule, a project, or a correction, with links.

This is material contamination of Arm A on precisely the axis under test. **C5 (drag markers) should
be scored with the knowledge that this arm was not, in fact, greenfield with respect to doctrine —
only with respect to the long-form documents.** I have deliberately avoided reusing the terminology I
saw there (my terms — Prior Line, Ledger, Blind, Echo Meter, attributable echo — are chosen new), but
I cannot certify that no framing leaked, and I would not believe anyone who claimed they could.

If the comparison is re-run, the fix is a settings override that suppresses `CLAUDE.md` and memory
injection for the greenfield arm. Without it, "Arm A" is misnamed.

**Read deliberately, within the permitted set, with a caveat.** I read
`kit/scripts/cwos-bundle-validate.js` in full — explicitly permitted as source code. Its header
comments are unusually discursive and describe a context-bundle *design*, citing
`docs/context-bundles.md` and `docs/context-architecture.md`. Both files carry mtimes of
2026-08-05 22:07–22:13, minutes before the requirements file (22:14), so they are near-certainly
parallel-arm or immediately-prior artifacts. **I therefore have secondhand exposure to an adjacent
design's rationale through a permitted channel.** The influence is visible and I have not hidden it:
§5 and §7 adopt that bundle schema rather than inventing a rival, and §9 says so. Where I differ from
it — the compact tier having no file, deletion of archaeology, blocking rather than declaring,
measurement at the Stop hook — those are mine.

**Not opened.** `docs/context-bundles.md`; `docs/context-architecture.md`; anything under
`.claude/context/`, `docs/design/`, `docs/standard-of-record/`, or `.claude/workstream/`; any
`CLAUDE.md` by my own action; git log or commit history. I listed **names, sizes, and mtimes** in
several of those directories and used those in §1 (file sizes, persona/lens counts, bundle presence).
I judged metadata to be within "file and directory names anywhere"; if the judge disagrees, the
affected claims are O8, O9, and O12.

---

## 11. Where this design is most likely wrong

1. **Deletion of archaeology (§4) may destroy something irreplaceable.** My argument assumes a
   structural fix makes the narrative redundant. If fixes are more often partial than I assume, I
   will have deleted the only record of a live failure mode. Cheapest hedge: a 6-month quarantine in
   an unreadable location (`.git`-tracked but excluded from every bundle and denied by the Blind)
   before actual deletion. I did not adopt the hedge by default because a quarantine that is never
   emptied is just an archive with an apology attached — but it is the right first move if the R14
   study comes back ambiguous.
2. **The Prior Line will be gamed by its own success.** Once its slots are known, there will be
   pressure to add a seventh. Every one of them will be justified. The only defence is that the
   emitter truncates and the priority order is fixed, so a seventh slot displaces the sixth visibly
   rather than growing the block. Watch for the first PR that raises 2,000.
3. **Attributable echo may be too noisy at session granularity.** 5-gram overlap against a decoy
   corpus is a crude instrument and a poker repo has high baseline self-similarity. If `A` has a
   session-to-session standard deviation comparable to the effect size, it cannot serve as the
   continuous signal and the A/B study becomes the only instrument. That is testable before building
   anything else: compute `A` retrospectively over the last 30 transcripts, ~2 hours. **Do that
   first** — it is the cheapest thing here that can invalidate the most expensive.
4. **Subagent laundering (§5) is not closed.** A delegated read of a withheld file returns as a
   summary. Inheritance of `active-task.json` helps and does not solve it.
