# Context System — Three-Arm Comparison, Judgement and Synthesis

**Judge:** produced none of the arms. Scored C1–C7 against `docs/context-system-requirements.md`
before forming an overall view, per the pre-registered judging rules.
**Verification stance:** every load-bearing claim any arm made about this repo was checked at the
cited path. Verdicts below distinguish *confirmed*, *confirmed-and-worse*, and *refuted*.
**Arms:** `docs/arm-a-greenfield-context-design.md`, `docs/context-bundles.md`,
`docs/arm-c-maxdrag-context-design.md`.
**Adjacent, read but not scored as an arm:** `docs/context-architecture.md` (separate task,
poker-doctrine tiering). It contributes findings and, as it turns out, the best falsifier in the set.

---

## 1. Score matrix

Scored 0–5. C5 is stated as a **low-drag score**: 5 = least drag carried, which is the direction
C1–C7 are all read in, so the row sums are comparable.

| | C1 coverage | C2 mechanism | C3 implementability | C4 novelty | C5 low-drag | C6 falsifiability | C7 concision | **Total** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **A — Greenfield** | 5 | 5 | 5 | 5 | 4.5 | 5 | 4 | **33.5** |
| **B — Context-laden** | 3\* | 4 | 4 | 4 | 3 | 1 | 5 | **24** |
| **C — Maximum drag** | 4 | 3.5 | 3 | 3 | 2.5 | 4 | 4 | **24** |

\* scope-adjusted per Confound 3; see below.

**B and C tie at 24. Reported as a tie, not resolved.** The tie is itself informative: Confound 1
says B's brief was written by C's author, so B and C are not independent draws, and their landing on
the same total is what non-independence looks like.

### Notes per criterion

**C1 — coverage.** A ships an explicit R1–R14 ledger with one *argued* partial refusal (R10);
everything is addressed. C touches all fourteen, several in a paragraph. B is silent on R1–R6.
**I judge R2–R6 to be scope, not omission** — Arm B's §6 explicitly cedes the tier question to the
parallel document and states the seam, which is a real architectural act, not an evasion.
**I judge R14 to be omission, not scope.** R14 is not a tier question; it is a general requirement,
and Arm B is the arm that *shipped running code into `cwos-reconcile.js`* without stating how anyone
would know it worked. Unadjusted that is a 2; adjusted for the five genuine scope exclusions, 3.

**C2 — mechanism.** Where this bites is R4, R10, R11. A converts all three into machinery that
cannot fail rather than checks that might: the compact tier has no file, so nothing can disagree; the
ceiling is enforced by the producer slicing its own output, so it is an invariant of the emitter, not
a check. B is *running code*, exercised against a probe bundle including all eight negative cases and
confirmed by mutating a pinned file — but its R11 remedy ("split the bundle, don't raise the number")
is stated discipline, and its R9 is explicitly declaration-only, which is the claim I refute in §4.1.
C supplies two genuine mechanisms — a hard-failing size test with a stated reason, and promotion by
`dedup_key` recurrence across distinct `run_id`s, which I verified are real fields on real findings
(`FIND-014.yaml:11,22`) — but its R7 reinvents, thinner, a schema already shipped and running.

**C3 — implementability.** See §3: this is where both predictions broke, and the direction is the
finding.

**C4 — novelty.** A reframes the problem (§4.3). B's pointer-vs-copy-vs-digest argument and its
mode-inverts-the-include-list construct are real and new. C's best sentence — "the light tier is a
sample of the output I should produce" — is genuinely new, but C states plainly that the two-tier
frame was handed to it, and its R7/R8 restate what it already had in context.

**C5 — drag.** See §3.3. Disclosure is weighed there and does not reduce the drag score.

**C6 — falsifiability.** A pre-registers an A/B with thresholds in *both* directions and a named
deletion consequence for its own most expensive organ, plus a differential prediction across modes
(attributable echo should fall on discovery tasks and be *unchanged* on verification tasks) and a
cheapest-first invalidation test that can kill the design before it is built. C has the control-
vocabulary idea, which is the right shape, but no n, no gate, no threshold, no decision rule. B has
none; §7.2's first-run findings validate the instrument, not the design.

**C7 — concision.** B is the tightest per line. A is the densest per line but longest, with real
overlap between §8's ledger and its body. C is shortest, and short partly because thin — five lines
on R7 against a 335-line answer already on disk. Concision that comes from not doing the work is not
concision.

---

## 2. Confounds, stated before the verdicts

**Confound 1 — B is not independent of C.** B's brief was written by C's author, carrying that
party's framing and evidence selection. The real contrast is **A vs (B, C)**, and it is a clean
2-vs-1 on the one disagreement that turned out to matter.

**Confound 2 — A was not greenfield with respect to doctrine.** The harness injected the global
`CLAUDE.md`, the project `CLAUDE.md`, all five `.claude/rules/*.md`, and `MEMORY.md` (a ~60-line
condensed doctrine index) before A's first action, with no way to decline. A also read
`kit/scripts/cwos-bundle-validate.js` — permitted as source — whose header describes Arm B's design
and cites both parallel documents by name. **A was greenfield with respect to long-form documents
only.** C5 is scored knowing this.

**Confound 3 — B answered a narrower brief** (roughly R7–R11). Handled in C1 above, with the
R2–R6/R14 line drawn explicitly.

---

## 3. Ruling on the predictions

### P1 — **FALSIFIED**, on its third clause

> *A scores highest on C4 and C5, and lowest on C3, because it cannot see what exists.*

- highest on C4: **true** (5 / 4 / 3)
- highest on C5: **true** (4.5 / 3 / 2.5)
- lowest on C3: **false** — A scored **highest** on C3 (5 / 4 / 3)

The premise was wrong before the arms ran. The requirements *gave* Arm A read access to the running
code; "cannot see what exists" was never true of the arm it was predicting about.

### P2 — **FALSIFIED**, on its first clause

> *C scores highest on C3 and lowest on C4 and C5.*

- highest on C3: **false** — C scored **lowest** (3)
- lowest on C4: **true** (3)
- lowest on C5: **true** (2.5)

### The pre-registered rule fires. Report it as prominently as a positive.

> *"If P1 and P2 both fail, the context-drag hypothesis is not supported for design tasks — which is
> a real and useful negative result."*

**Both failed. By the criterion fixed in advance, the context-drag hypothesis is NOT SUPPORTED for
design tasks.** That is the pre-registered reading and it stands as written. It is recorded here
without hedging and without an edit to the requirement, per that document's own instruction.

### The post-hoc refinement — labelled post-hoc, and weaker for it

Both predictions failed **on the same clause**, and it was the C3 clause both times. Neither failed
on C4 or C5. On the two criteria the experiment was actually built to detect drag with, the ordering
came out **exactly as predicted and monotone: A > B > C on both.**

So what was falsified is not the drag ordering. It is the *compensating benefit* the predictions
assumed context buys — "at least the informed arm knows what exists." That benefit was not delivered,
and it went the other way:

| | Claims made about the repo | Verified by me | Held | Refuted |
|---|---|---|---|---|
| A | 13 numbered observations at file:line | 11 checked directly | 11 | 0 |
| B | validator behaviour, four unbundled items | 4 checked | 4 | 1 (the withholding claim) |
| C | precedents, `dedup_key`, hook pattern | 4 checked | 4 | 1 (the withholding claim, inherited) |

**Context-ladenness substituted for looking.** Arm C reinvented a bundle schema that was on disk and
running, because it remembered discussing one. Arm B asserted an impossibility it did not test. Arm A,
having less to recall, read the code — and was the only arm to check `.git/hooks/`.

That refinement is post-hoc. It was not pre-registered, it is a re-reading of why the predictions
failed rather than a test they were designed to survive, and it should be weighted accordingly by
anyone citing this. The pre-registered negative is the stronger statement and it comes first.

### P3 — **UNINTERPRETABLE**, not passed

B lands between on C2, C3, C4, C5 (4 of 5) and is lowest on C1. But per Confound 1, "lands between"
is not a meaningful test when one endpoint wrote the other endpoint's inputs. Scoring it as passed
would be manufacturing a result. Recorded as weakened by construction, as the brief requires.

### P4 — **CONFIRMED**, and harder than expected

The best final artifact is a cherry-pick. Two things a ranking would have discarded:

1. The **best falsifier in the entire set belongs to no arm** — the adjacent
   `context-architecture.md`'s pre-registration (control terms published in advance, n ≥ 40 or 60
   days, population by `created_at` not mtime, two named confounds).
2. The **single most consequential correction belongs to Arm A alone, against a 2-1 majority** — and
   the majority was 2-1 only because one of the two wrote the other's brief.

---

## 4. Adjudicated disagreements

### 4.1 Is withholding enforceable? — **Arm A is right. B and C are wrong.**

The claim under test, verbatim from `kit/scripts/cwos-bundle-validate.js`'s header:

> *"It cannot prevent an agent from reading an excluded file. Nothing in this repo can; the tools are
> not sandboxed per task."*

Echoed by Arm B §4.3 ("an audit trail, not a sandbox") and Arm C §R9 ("it cannot check that an agent
did not read a file it was told to skip").

**Verified evidence:**

| Fact | How verified |
|---|---|
| `PreToolUse` matchers take arbitrary pipe-separated tool names | This machine's own global settings carry `"matcher": "Write\|Edit\|NotebookEdit\|Bash"` |
| `Read`, `Grep`, `Glob` are valid `PreToolUse` matchers | Official Claude Code hooks reference |
| Exit code 2 **blocks the tool call before it executes**; content never enters the window | Documented; and used twice in this repo — `git-guard.cjs:276` is `process.exit(2)` at exactly that line, `secrets-scan.cjs` likewise |
| Hooks fire **inside subagents**, carrying `agent_id` / `agent_type` | Official hooks reference |
| `permissions.deny` supports `Read(<glob>)` and blocks at tool level with **no code at all** | Official permissions reference; `.claude/settings.json` already carries an (empty) `permissions.deny` array |

Both clauses of the header are false, and the second is false about a capability this repo **has
already configured and already uses**. Arm A's counter-example (`git-guard.cjs:276`) is correct at the
line cited.

**Neither arm proposed the cheapest mechanism.** `permissions.deny: ["Read(<glob>)"]` needs zero
lines of code. It is static per-session rather than per-task, so a hook is still required for dynamic
withholding — but a repo that wants withholding *today*, before writing 180 lines, can have most of it
by editing a field that is already present and empty.

**The true residue, kept because B and C are right about it.** Harness-injected context cannot be
withheld by any of these mechanisms. `CLAUDE.md`, `.claude/rules/*`, and `MEMORY.md` are placed in the
window before any hook runs — Arm A's own §10 disclosure is the experimental proof of exactly that.
The correct statement is: **deliberate reads are enforceable; harness injection is not.** B and C
generalised from the one true case to a universal, and the universal is what got written into a header
that then contaminated a third arm.

The cost is not academic. Left standing, that sentence is what anyone will cite as the reason not to
build the control. Arm A said so and was right.

### 4.2 Warn-don't-block — **Arm A's rule is correct; Arm C supplies the missing clause**

Arm A refuses warn-only for the Blind: *"a warning cannot withhold, because by the time it exists the
tokens are in the window and there is no state to restore."* Sound, and not rhetorical: a warning
about a read is a report about a harm that has already completed.

Its proposed rule — **warn about declarations, block irreversible acts** — is *descriptive of where
this repo's blocking hooks already sit*, which I verified:

- `git-guard.cjs` blocks — irreversible (a push).
- `secrets-scan.cjs` blocks — irreversible (a secret in history).
- `retreat-detector.cjs` blocks, and its header records verbatim that the first instinct was to warn
  *"so it doesn't get disabled — which is the very bias the hook exists to catch."*
- `cwos-reconcile.js:759` warns, and the bundle validator warns — both about *declarations*.

**But Arm C found a case the two-clause rule gets wrong, and got it right.** `lightTierSize.test.js`
fails hard while everything else warns, on the reasoning that *"a light tier over its ceiling is not
evidence about the ceiling, it is a light tier that has stopped working."* A size ceiling is a
declaration, not an irreversible act; Arm A's rule says warn. Arm C is right that it should fail.

The reconciling principle is Arm B's own reasoning read forwards: reconcile warns because *a
legitimate exception exists*. The full rule is three-clause, and each arm supplied one:

> **Block an irreversible act. Fail a check that has no legitimate exception. Warn a check whose
> failure may be evidence about the declaration rather than about the item.**

### 4.3 Storage partition vs sampling control — **Arm A's frame wins and subsumes Arm C's**

Arm C organises around two tiers (a storage partition). Arm A rejects the partition and organises
around the injection point: *position dominates volume; the unit of cost is bytes × turns; reading is
irreversible.* Ruling for A, on evidence rather than taste:

**(a) The partition frame cannot express the repo's own best evidence.** The adjacent document's n=1
natural experiment is that §7 is the most-cited section (156 citations) and the only section with an
always-loaded compressed form (`CLAUDE.md:337`). Note what actually varies: not that §7 has a light
*tier*, but that §7 is *injected at turn 0 of every session*. The independent variable is position. A
partition design predicts the same result from a compressed form stored anywhere; the injection frame
predicts it from where the compressed form sits.

**(b) The partition priced the wrong quantity, and it was measured.** The founder's hypothesis was
that corrections-history is the drag; measurement says 12.5% of lines. The driver is **accretion
rate** — 62.5% of POKER_THEORY.md written in ten days at 156 lines/day against a prior-life average
of 3.9. **A partition does nothing about a rate.** Arm A's new ceiling is on the *session read-set*,
denominated in bytes actually read, which is the only quantity in any of the three designs that a 40×
accretion rate moves.

**(c) A's frame subsumes C's; the reverse fails.** Under A, a light tier is one possible
implementation of the per-turn injection — rejected for a stated reason (a file can drift; stdout
cannot). Under C, "control the injection point" is not expressible, because the design has no organ
running at a turn boundary except to ship the light file.

**(d) One thing C's frame has that A's lacks, and I keep it.** *The light tier is a sample of the
output I should produce, not a summary.* That is a claim about register and voice, orthogonal to where
the bytes go — and Arm A's Prior Line is weaker on exactly this axis, since `VOCAB:` carries term
*names only*. See §4.5a: the measurement says names alone do not travel.

### 4.4 How the tiers avoid disagreeing — **ranked: A first, adjacent second, C third**

| | Proposal | Kind |
|---|---|---|
| **A** | The compact tier has **no file** — generated to stdout per turn, every term re-verified against source at emit time, drops reported as `[dropped N]` | Impossibility |
| **Adjacent** | **G4/V4** — the light tier may contain no decimal, percentage, or parameter assignment, so re-measuring cannot falsify it | Impossibility, different route |
| **C** | Generate from marked heavy passages + content hash of the source span; a check verifies each line still resolves | Detection |

**A first.** The only one where the failure has no representation. There is no second artifact, so no
pair to compare, so no state in which the check could fail. It also degrades correctly — a vanished
source term yields a smaller injection plus a printed `[dropped N]`, a real signal rather than a
silent shrink — and it fails open to today's behaviour if the emitter breaks.

**Adjacent second.** G4 is purely syntactic and undebatable, and it earns second place because it is
**a quality filter as well as a consistency mechanism**: a rule that cannot be stated without a number
is a lookup, and a lookup does not belong in an always-loaded tier anyway. Two goods from one rule. It
ranks below A only because it is partial by construction — it eliminates *re-measurable* divergence,
not renaming, retirement, or pointer rot, which is why V1–V3 have to stand behind it. A's mechanism
needs no companions.

**C third, and not narrowly.** Marker-plus-hash detects that the tiers have *already* disagreed. This
repo has measured what that weakness costs: the adjacent document's C1 finding is that **the same
measurement is reported five times with three different values inside a single document that has no
second tier at all** — and one of the five is structurally impossible alongside the others. A
cross-file drift detector would have caught none of those five. Detection also assumes someone reads
the warning, and this repo's own precedent says otherwise: `readiness-gate.cjs:9`, verified verbatim —
*"a banner shown every session is a banner nobody reads by week three."*

### 4.5 Further disagreements found

**(a) What the always-loaded tier is made of — names vs imperatives. Arm C wins, against Arm A.**
Arm A: term names only, *"the job is to make the word available, not to teach it."* Arm C: imperatives
in the voice of the output. The measurement decides it and decides against A: `intransitiv*` occurs
114 times across 13 files while its section draws 1 citation, whereas **`Four Motivations` — a *name*,
sitting in the document — occurs zero times anywhere else** (verified independently: 3 files, all of
which are the document or documents about it). A bare name in context is demonstrably not sufficient
to get itself used. And §7's always-loaded form, the one natural experiment that worked, is not a name
list — it is a ~90-word imperative paragraph. **Arm A's channel, Arm C's register.**

**(b) A light tier must not become a digest.** Not contested between arms — only the adjacent document
measured it — but it binds all three. §8 "Common Mistakes" is the only top-level section with zero
external citations, and it is a digest of sections drawing 132 and 156. Readers cite the source, never
the summary. **This is a live risk for Arm C's design specifically**, whose light tier is generated
*from marked passages of the heavy document* — a digest by construction. The rule that falls out:
**a light tier earns its place by carrying what the heavy tier does not have — a name for a class, a
count, a status — not by carrying less of what the heavy tier has.**

**(c) Where corrections live. Arm C's third category is correct; Arm A is wrong to delete.**
Arm A: fired-once-and-structurally-fixed is archaeology, the old belief text is **destroyed**, a
tombstone goes at the code site. Arm C: there is a third thing — *the fact that a claim has been
falsified is permanent doctrine even when the narrative is archaeology*.

Arm C's counter-example is one Arm A cannot answer. §3.4's taxonomy was falsified once, was fixed, the
correction was archived — **and the section still reads with unqualified confidence**, so the next
reader has no way to know the list has been too small before. Arm A's tombstone lives at the code
site, which answers the case where a falsified thing is *used*; it does not reach the reader who is
sitting in §3.4 *believing* it. Arm A anticipated this failure mode in its own §11.1 and declined the
hedge.

But Arm A is right about the narrative, and the adjacent document sharpens why: **six of eleven
one-shot corrections are already closed by an assertion in a test, and a test that fails is strictly a
better record than a paragraph that cannot.** Resolved position: **Arm A's disposal rule with Arm C's
residue rule — destroy the narrative, keep the counter.** One clause survives per correction:
`falsified 1×`.

**(d) Barrier vs audit trail are not rivals; each closes the other's hole.** Arm A's §5 names the
subagent-laundering hole (a delegated read returns as a summary) and does not close it. Arm B's
unbuilt §8 increment — *a finding produced under a discovery bundle must not cite a withheld file as
its source* — is precisely what closes it, and also covers the auto-injection case the barrier can
never reach. Neither arm noticed that the other's mechanism completes it. **Both ship.**

---

## 5. Arm A's four claimed defects — verdicts

### D1 — Validator's only caller is a local edit to a kit-managed file · **CONFIRMED, AND WORSE**

- `kit/scripts/cwos-reconcile.js` is in `kit/hashes-3.8.5.yaml` **at line 233**, exactly as claimed.
- Its manifest hash is `sha256:700d470d…`; hashing the file on disk gives `sha256:cdc827a3…`.
  **It is locally modified.** The Phase 2c2 delegation lives at `cwos-reconcile.js:936-944`.
- The constraint is *written down in this repo*, at `readiness-gate.cjs:12-15`: *"kit/ is synced from
  HomeBase and a local edit to cwos-next.js would be silently reverted by the next /kit-upgrade,
  taking the flag with it and leaving no trace. Hooks are repo-local and survive."*
- **Worse, and reported by no arm:** `kit/scripts/cwos-bundle-validate.js` — the validator itself —
  **does not appear in `kit/hashes-3.8.5.yaml` at all** (only `kit/scripts/lib/cwos-bundle-validate.js`
  at :286). So the *script* is an unmanaged file inside a managed tree and the *caller* is a modified
  managed file. Two exposures, not one.

### D2 — Name collision · **CONFIRMED**

Both exist: `kit/scripts/cwos-bundle-validate.js` (18,187 B, 2026-08-05) and
`kit/scripts/lib/cwos-bundle-validate.js` (8,335 B, 2026-06-04). `cwos-verify.js:596` does
`require('./lib/cwos-bundle-validate')` for `validateArchetypeBundle` / `loadHomebaseOnlyEngines`.
Different subjects — context bundles vs archetype bundles — same basename, one directory apart. The
require is path-qualified so it resolves today; the hazard is a human or an agent editing the wrong
file, and the two are one `ls` apart.

### D3 — Header asserts withholding is impossible · **CONFIRMED PRESENT, AND FALSE**

Verbatim in the header, refuted in §4.1. Amendment, not deletion: the true residue is that
harness-injected context cannot be withheld, which is worth stating precisely *because* it is the one
thing a barrier genuinely cannot do.

### D4 — `.git/hooks/` empty, six shipped hooks do not run · **CONFIRMED, AND THE ROOT CAUSE IS DIFFERENT AND WORSE**

`.git/hooks/` contains only `.sample` files. `kit/scripts/git-hooks/` ships six real hooks
(`pre-commit-asn.sh`, `pre-commit-engine-manifest.sh`, `pre-commit-graph-closure.sh`,
`pre-commit-provenance.sh`, `pre-commit-runs-immutability.sh`, `post-commit-asn.sh`).

**But installing them into `.git/hooks/` would not fix it.** `core.hooksPath` is set to
`C:\Users\chris\OneDrive\Desktop\Claude-Poker-Tracker\.git\hooks` — the abandoned OneDrive location
from before the repo was relocated. `git rev-parse --git-path hooks` returns that path.

So `.git/hooks/` is **not merely empty, it is not consulted**. Git looks in a quarantined tree that
this fleet's own global `PreToolUse` hook blocks writes into. Every commit-time guarantee has been
unenforced since the relocation, and the obvious remedy — copy the hooks in — silently does nothing.

**This is the highest-severity finding in the comparison, and it was found by the arm with the least
context**, which is the P1/P2 result in one artifact.

---

## 6. The synthesis — the deliverable

Ten elements. Every one attributed, with why it beat the alternative.

| # | Element | From | Why this one |
|---|---|---|---|
| **S1** | **Organise around the injection point, not a storage partition.** Position dominates volume; the unit of cost is bytes × turns; reading is irreversible. | **A** | §4.3. The one natural experiment that worked varies *position*, not partition, and the measured driver is an accretion *rate*, which a partition cannot touch. |
| **S2** | **The compact tier has no file.** Generated per turn to stdout, every term re-verified against source at emit time, drops printed as `[dropped N]`. | **A** | §4.4. Impossibility beats detection, and this repo's five-values-one-measurement finding shows detection would not have caught its own worst case. |
| **S3** | **Its content is written as an excerpt from an excellent response** — imperatives and named quantities, not term names and not descriptions of practice. | **C** | §4.5a. `Four Motivations` sits in the document and occurs zero times elsewhere. Names do not travel; vocabulary in use does. Corrects A's `VOCAB:` slot. |
| **S4** | **No re-measurable magnitude in the compact tier** — no decimals, percentages, parameter values — enforced syntactically. | **adjacent** | §4.4. Second impossibility mechanism, and it doubles as a quality filter: a rule that needs a number is a lookup, and a lookup does not belong here. |
| **S5** | **The compact tier is never a digest.** It carries what the heavy tier lacks — a class name, a count, a status — never less of what the heavy tier has. | **adjacent** | §4.5b. §8 is the repo's own controlled experiment: a digest of doctrine earns zero citations. Constrains S2/S3 and rules out C's marked-passage extraction. |
| **S6** | **`excludes` becomes a barrier**: `PreToolUse` matcher on `Read\|Grep\|Glob`, `exit(2)`, fails open, recorded bypass. Start with `permissions.deny: ["Read(<glob>)"]`, which costs zero code. | **A** (+ judge's addition of `permissions.deny`) | §4.1. Verified against the docs and against two working blocking hooks in this repo. B and C's impossibility claim is refuted. |
| **S7** | **Keep the post-hoc control alongside the barrier**: a finding produced under a discovery bundle must not cite a withheld file as its source. | **B** | §4.5d. Closes the two holes the barrier cannot reach — subagent laundering and harness injection — which A named and left open. |
| **S8** | **Adopt the shipped bundle machinery unchanged**: pointer-not-copy, `sha256` pins (CRLF-normalised), section anchors, closed exclude vocabulary, `mode` inverting the include list, `persona-kind-confusion` as a check distinct from `unresolved-lens`. | **B** | It exists, it runs, it was exercised against all eight negative cases, and its central argument — *a stale pointer is still correct; a stale summary is wrong* — is the best-argued decision in any arm. A adopted it rather than rivalling it; so do I. |
| **S9** | **Three-clause enforcement rule.** Block an irreversible act. Fail a check with no legitimate exception. Warn a check whose failure may be evidence about the declaration. | **A + C + B**, one clause each | §4.2. A strict superset of all three positions, and it is descriptive of where this repo's blocking hooks already sit. |
| **S10** | **Corrections: destroy the narrative, keep the counter.** Recurrence (`fire_count ≥ 2`, or `dedup_key` across distinct `run_id`s) promotes to doctrine; a one-shot closed by a test leaves the test as the record; **every falsified claim keeps a `falsified N×` marker on the claim itself.** | **A** (disposal) **+ C** (residue) **+ adjacent** (the-test-is-the-record) | §4.5c. A's deletion rule is right about cost and wrong about §3.4, where the reader who needs the warning is reading the *claim*, not the code. C's counter is one clause wide. |
| **S11** | **The falsifier is a pre-registration with a control vocabulary, a gate, a threshold, and a stated deletion consequence.** Primary: light-tier vocabulary rate *minus control-vocabulary rate* per 1,000 words, n ≥ 40 artifacts or 60 days, attributed by `created_at`. Secondary: attributable echo with a decoy corpus, cited-but-unread as a boolean, and the differential prediction that echo falls on discovery tasks and is unchanged on verification tasks. Cheapest-first: compute attributable echo retrospectively over the last 30 transcripts (~2h) *before building anything*. | **adjacent** (control + gate + population) **+ A** (echo instrument, differential prediction, deletion consequence, cheapest-first) **+ C** (the control-vocabulary idea) | §1/C6. The best falsifier in the set is assembled from a non-arm and an arm. Neither alone has both the pre-registration discipline and the instrument. |

**What is deliberately NOT carried forward, and why:**

- **A's deletion of archaeology in full** — overturned by C's §3.4 counter-example (S10).
- **A's `VOCAB:` names-only composition** — falsified by the `Four Motivations` measurement (S3).
- **C's marked-passage light-tier generation** — it is a digest by construction, which §8 measures as
  the thing that earns nothing (S5).
- **C's `.claude/lenses/` directory move** — 35 files plus every reference, uncosted, and the naming
  collision is already caught by a check that ships and runs (S8). A's cheaper version — rename the
  *kind* to `lens` in schemas and scripts — is retained.
- **C's `digest` bundle field and R7 schema** — a thinner restatement of S8, which is on disk.
- **B's claim that withholding cannot be enforced** — refuted (§4.1), and its header must be amended
  rather than left to be cited.

---

## 7. What this comparison established, in three lines

1. **The pre-registered rule fires: the context-drag hypothesis is NOT SUPPORTED for design tasks.**
   P1 and P2 both failed.
2. **Post-hoc, and weaker for it:** both failed on the *implementability* clause, in the direction
   opposite to the one assumed. The drag ordering itself came out monotone as predicted on both
   criteria built to detect it. Drag was real; the benefit it was assumed to buy was not.
3. **The most consequential single output is a refutation, not a design:** withholding *is*
   enforceable in this repo, and the sentence saying otherwise is in a header that has already
   contaminated a third party.
