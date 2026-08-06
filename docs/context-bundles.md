# Context Bundles — scoped sub-contexts with per-task lens assignment

**Status:** prototype shipped, advisory. Validator:
`scripts/context/cwos-context-bundle-validate.cjs`, called from the repo-local SessionStart hook
`.claude/hooks/context-bundle-check.cjs`. Bundles: `.claude/context/bundles/*.yaml`.

> **Moved out of `kit/` on 2026-08-05 (WS-424 / D1, D2).** It previously sat at
> `kit/scripts/cwos-bundle-validate.js`, delegated from `cwos-reconcile.js` Phase 2c2. That was two
> exposures at once: the script was *unmanaged inside a managed tree* (absent from
> `kit/hashes-3.8.5.yaml` entirely) and its only caller was a *locally-modified managed file*, so the
> next `/kit-upgrade` would have reverted the wiring silently. It also collided by basename with
> `kit/scripts/lib/cwos-bundle-validate.js` (archetype bundles — a different subject, one directory
> apart). §4.3 below is superseded: see the note there.

**Why this file lives here.** `docs/design/` is the *product* design framework — personas, surfaces,
lifecycle gates — and putting an AI-context-architecture document inside it would collide with the
product-persona meaning of the word "persona", which is precisely the conflation §3 exists to
prevent. This sits at `docs/` root as a sibling to `docs/context-architecture.md` (the poker-doctrine
heavy/light tier, being designed in parallel). That file answers *how big should POKER_THEORY.md be*;
this one answers *which slice of it does this task load, and who is reading*. §6 states the interface.

---

## 0. The premise

Context is a **prior on the output distribution**, not reference material. Repeated vocabulary raises
its own likelihood of reuse. It follows that *which* context a task loads determines what it is
capable of noticing — and therefore that a monolithic session load is not a neutral convenience but
a standing bias applied uniformly to every task regardless of what the task is for.

Two observations from this repo make that concrete rather than theoretical.

**Lens assignment works, and was done by hand.** Six analytical lenses ran over the same repo with the
same brief and different framings. They found materially different defects: the estimation lens
computed a detector firing ~62% of the time under the null; the game-theorist found the live policy
constant in the opponent, so no exploit is definable against it; the information-theorist found a
computed credible interval on the wire with no renderer. **None of the others found any of those.**
Each brief was hand-written by a coordinator, which makes the result unreproducible — a different
coordinator gets different defects and nobody can tell whether the lens or the brief did the work.

**Withholding matters as much as including.** The cross-critic then showed the roundtable's headline
was partly *inherited*: the conclusion was already recorded at file:line in auto-memory that loads at
every session start. The lens did not derive it. It reconstructed something it had been told, and the
run reported it as a discovery.

So the design has three parts — a scoped unit, a binding from task to unit and lens, and a rule about
what to leave out — and one requirement: it has to be **runnable**, because a document you are
supposed to have read is not a control.

---

## 1. The bundle unit — a pinned manifest of pointers

**Decision: a bundle is a YAML manifest of file pointers with content hashes and optional section
anchors. Not a directory of copies. Not a generated digest.**

The three candidates fail differently, and the failure modes are not equally priced:

| Form | What goes stale | Cost when it does |
|---|---|---|
| Directory of copied files | The copy, against the source | **Highest.** Two divergent versions exist and neither is marked. A reader cannot tell which is current. |
| Generated digest / summary | The summary, against the source | **Highest, and worse.** A stale summary is a *confident wrong statement*. It reads as authoritative prose while asserting something no longer true. |
| **Manifest of pointers** | Only the *review status* | **Lowest.** The pointer is still correct — the file it names is still the right file. What is stale is that a human/agent last confirmed the bundle scopes what it claims. |

That last row is the whole argument. **A stale pointer is still correct; a stale summary is wrong.**
The manifest form converts staleness from a correctness problem into a review-currency problem, which
is a much cheaper thing to be wrong about.

### 1.1 The staleness answer, concretely

Every include carries `sha256` of the resolved content (CRLF-normalized — without that, every bundle
on a Windows checkout reports permanent drift, and a check that always fires is a check nobody reads).
When the source changes, the validator emits:

```
[content-drift] math-measurement pins .claude/context/MEASUREMENT_OVERSIGHTS.md at sha256
e43b8a8f4112…, but it now hashes to 1d191248132e…. The pointer is still correct — the REVIEW
is stale. Re-read the changed source, confirm the bundle still scopes what it claims, then:
node scripts/context/cwos-context-bundle-validate.cjs --rehash
```

Re-pinning is one command, and is deliberately a **separate, explicit act** from editing the source.
That separation is the entire mechanism: it makes "someone confirmed this bundle still scopes what it
claims" into a recorded event rather than an assumption. An include with no hash is itself flagged
(`unpinned-include`) — an unpinned include cannot report drift, so the bundle's review status is
unknowable, which is worse than known-stale.

### 1.2 Section anchors

`section:` names a markdown heading; the slice runs to the next heading of the same or higher level.
This is what makes bundles viable at all — `.claude/context/POKER_THEORY.md` is ~211KB, and a bundle
that could only point at whole files could never include any of it. A section pointer that stops
resolving reports `missing-section` rather than silently shrinking the bundle to less than it claims.

---

## 2. Schema

```yaml
id: math-measurement                    # unique; the handle a task binds to
name: "..."
program: methodology-integrity          # owning program — supplies problem_class vocabulary
mode: discovery | verification          # governs the withholding rule (§4)
default_lens: estimation-theorist       # analytical lens, resolves to .claude/agents/<name>.md
lenses: [ ... ]                         # other lenses licensed to read this bundle
budget_bytes: 36000                     # this bundle's own ceiling (<= global 40000)

includes:
  - path: <repo-relative>
    section: "<optional markdown heading>"
    sha256: "<pinned, via --rehash>"
    reason: >                           # why this is in scope — prose, for the next curator
excludes:
  - path: <repo-relative or USER_MEMORY/ sentinel>
    reason: states-the-conclusion | raises-vocabulary-likelihood | budget | irrelevant
    note: >
vocabulary: [ ... ]                     # terms checked against docs/standard-of-record/VOCABULARY.md
applies_to:
  problem_classes: [ ... ]              # from the owning program's declared list
```

---

## 3. The task → context → lens binding, and the two kinds of persona

### 3.1 Binding

A queue item gains two optional fields:

```yaml
context_bundle: "math-measurement"
lens: "estimation-theorist"          # optional; defaults to the bundle's default_lens
```

This builds on machinery that already exists rather than duplicating it. Programs already declare
`problem_classes` and protocols carrying `engine:` and `prompt_additions`; findings are already
validated against the program's declared class vocabulary (`cwos-reconcile.js:759`). A bundle
declares `applies_to.problem_classes` **from that same list**, so the binding is transitive and
mostly automatic: an item's `program` gives it a class vocabulary, its `problem_class` selects a
bundle, and the bundle supplies the lens. Most items never need to write either field — the
validator only speaks up when an item's class is claimed by a bundle and the item scoped nothing.

### 3.2 The two persona kinds — and why they must not merge

This repo has two things called personas. They are different kinds and unifying them would be a real
error, not a tidy-up.

| | **Analytical lens** | **Product persona** |
|---|---|---|
| Lives in | `.claude/agents/*.md` (38 files) | `docs/design/personas/{core,situational}/` (40 files) |
| Answers | *Who is auditing this code?* | *Who is this surface for?* |
| Examples | `estimation-theorist`, `game-theorist`, `failure-engineer` | `chris-live-player`, `multi-tabler`, `mid-hand-chris` |
| Binds to | a **task** | a **surface**, via the design gates |
| Governed by | this document | `docs/design/LIFECYCLE.md` Gates 1–5 |

They are orthogonal, and a single work item can legitimately carry both: `lens: estimation-theorist`
(who audits it) and a Gate-1 persona (who it is for). Merging them produces nonsense in both
directions — asking `chris-live-player` to audit a Bayesian estimator, or asking
`estimation-theorist` what the sidebar should feel like.

Two deliberate design choices follow. First, **the field is named `lens:`, not `persona:`** — keeping
the words apart is cheap and the confusion is expensive. Second, the validator loads the product
personas *solely in order to detect the confusion*, never to resolve a lens against:

```
[persona-kind-confusion] probe.yaml names "chris-live-player" as an analytical lens, but that is
a PRODUCT persona (docs/design/personas/). Product personas describe who a surface is FOR;
analytical lenses (.claude/agents/) describe who AUDITS it.
```

Without that check the failure is silent — a misnamed lens would just look like a typo
(`unresolved-lens`), and the curator would fix the spelling rather than notice the category error.

---

## 4. The withholding rule

**A discovery bundle must declare what it withholds, and why.** This is a first-class part of the
schema, not a footnote, because the recorded failure was not "we loaded too much" — it was "the lens
was told the answer and reported finding it."

### 4.1 Mode determines the obligation

- **`mode: verification`** — the task is checking, fixing, or confirming a *known* defect. Loading
  the recorded conclusion is **correct**; you want the lens to check its work against what is on file.
  No withholding requirement.
- **`mode: discovery`** — the task is looking for a defect nobody has named. The validator requires at
  least one exclude with `reason: states-the-conclusion`, or emits `no-withholding`.

The sharpest expression of this: `.claude/context/MEASUREMENT_OVERSIGHTS.md` is the **first include**
of `math-measurement.yaml` and the **central exclude** of `math-blindspot.yaml`. Same subject, same
file, opposite loading rule, decided by mode. That is why they are two bundles rather than one bundle
with a flag — the include list genuinely inverts.

### 4.2 The closed exclusion vocabulary

An uncategorised exclusion cannot be audited, so `reason` is closed:

| Reason | Meaning |
|---|---|
| `states-the-conclusion` | Already asserts what the lens is asked to derive. The inherited-convergence case. |
| `raises-vocabulary-likelihood` | Its terminology would bias *which framing* the lens reaches for — the founder's premise applied to itself. |
| `budget` | Dropped for size alone. No epistemic claim. |
| `irrelevant` | Out of subject scope. |

**The corollary that keeps this from being anti-knowledge**, recorded in the bundle itself: if a
discovery run *re-derives* an entry that already exists in the withheld document, that is a **good**
outcome — it is independent replication, and the entry should be marked replicated. Withholding is
only valuable when the lens *could* have seen the answer. The goal is not ignorance; it is knowing
which findings were derived and which were recalled.

### 4.3 The limit — REFUTED 2026-08-05, and corrected here

> **This section was wrong, and it is left standing with its correction rather than deleted, because
> it did measurable damage.** It asserted an impossibility it had not tested; a third arm of the
> comparison read it as a source and inherited the claim. It is the sentence anyone would have cited
> as the reason not to build the control. `falsified 1×`.

**The original claim:** *"Withholding cannot be enforced at read time. Nothing stops an agent from
opening an excluded file; the tools are not scoped per task."*

**Both clauses are false.** A `PreToolUse` matcher accepts arbitrary pipe-separated tool names,
including `Read`, `Grep`, and `Glob`; exit code 2 blocks the call **before it executes**, so the
content never enters the window. This repo already does exactly that twice
(`.claude/hooks/git-guard.cjs:276`, `.claude/hooks/secrets-scan.cjs`). Hooks also fire *inside*
subagents. And `permissions.deny` supports `Read(<glob>)` with zero lines of code — the field was
already present in `.claude/settings.json`, and empty.

**The true residue, which is what this section should always have said:**

> **Deliberate reads are enforceable. Harness injection is not.**

`CLAUDE.md`, `.claude/rules/*`, and auto-memory land in the window before any hook runs — 51,684
bytes of it, measured. The original generalised from that one true case to a universal.

**So the declaration is not replaced by the barrier; the two close different holes and both ship.**
The barrier (`.claude/hooks/context-barrier.cjs`) stops a deliberate read. The post-hoc control below
covers what the barrier cannot reach: harness injection, and a subagent returning a withheld file's
content as a summary. The bundle still records what should not have informed a finding, so a reviewer
can ask whether it did.

Claiming otherwise would be the same category of error the fault register already names — a prose
matcher claiming to measure structure. The mechanism is worth having anyway, for the same reason a
pre-registration is worth having without a police force: it makes the intended discipline checkable
after the fact, and it makes violating it a deliberate act rather than an accident. The next
increment with real teeth is checking that a finding produced under a discovery bundle does not cite
a withheld file as its source — mechanically checkable once findings carry `context_bundle`.

---

## 5. Size discipline

**Global ceiling: 40,000 bytes of resolved content per bundle (~10k tokens).** A bundle may declare a
lower `budget_bytes`; declaring a higher one emits `ceiling-breach`.

The number is anchored to the artefact bundles exist to replace, not chosen for feel. At HEAD:

| Artefact | Bytes |
|---|---|
| `.claude/context/POKER_THEORY.md` | 211,190 |
| `.claude/workstream/queue-index.yaml` | 73,945 |
| `.claude/context/SYSTEM_MODEL.md` | 72,285 |
| `docs/standard-of-record/VOCABULARY.md` | 35,536 |
| root `CLAUDE.md` | 33,774 |
| `DISCLAIMER-AND-FAULT-REGISTER.md` | 30,859 |
| `system/state.md` | 28,303 |
| **Mandated session-start load** | **~486,000 (~121k tokens)** |

At 40KB, no single bundle can reach 19% of POKER_THEORY.md alone — so **a bundle cannot silently
become the monolith it replaced** — while a task may compose three bundles and still load a quarter
of today's default. The two shipped bundles resolve to ~31KB and ~15KB.

**What enforces it.** Two checks, both advisory:
- `ceiling-breach` — the declared budget exceeds 40,000.
- `budget-breach` — resolved content exceeds the bundle's own declared budget.

**And what the remedy is, which is the actually important part.** The instruction on breach is
*split the bundle*, not *raise the number*. Splitting forces the curator to name the second subject,
and naming it is the useful act — it is the step that converts "this got big" into "these are two
different things." Raising the ceiling is a decision to be argued in this section, not a field to be
edited.

---

## 6. Interface with `docs/context-architecture.md`

That document is being written in parallel and owns the **poker-doctrine tier**: auditing
POKER_THEORY.md for context drag and splitting it into heavy/light. This document owns the
**task-scoping and lens tier**. They compose through exactly one seam:

> **Bundles address doctrine by `path` + `section` heading, never by line number.**

So a heavy/light split can rename, reorder, or re-tier sections freely. If a heading this document's
bundles point at disappears, the validator reports `missing-section` against the named bundle rather
than silently delivering less context than it claims. The two shipped bundles both point at
`POKER_THEORY.md § "7. First-Principles Decision Modeling"`, which is the assumption to preserve or
deliberately break.

If the split introduces a canonical "light" tier, the natural follow-on is a `tier:` field on an
include (`light` | `heavy`) so a bundle can request the summary and escalate. Not built — noted so
it slots in without reshaping the schema.

---

## 7. The validator

`scripts/context/cwos-context-bundle-validate.cjs`, called from `.claude/hooks/context-bundle-check.cjs` (SessionStart) via the same
`spawnSync --json` pattern as `validatePlanDocs` and `validateStaleness`. Absent script or malformed
output → skip silently, so a repo that has not adopted bundles reconciles exactly as before.

| Check | Fires when |
|---|---|
| `missing-include` / `missing-section` | An include path or section anchor does not resolve |
| `content-drift` | Pinned sha256 no longer matches — the review is stale (§1.1) |
| `unpinned-include` | An include has no hash, so drift is undetectable |
| `unresolved-lens` | Named lens has no `.claude/agents/<name>.md` |
| `persona-kind-confusion` | Named lens is a **product** persona (§3.2) |
| `ceiling-breach` / `budget-breach` | Size discipline (§5) |
| `no-withholding` | `mode: discovery` withholds nothing that states a conclusion (§4) |
| `bad-exclude-reason` | Exclusion reason outside the closed vocabulary |
| `unbundled-task` | An open queue item's `problem_class` is claimed by a bundle, but it scopes nothing |
| `vocabulary-drift` | A declared term appears nowhere in `VOCABULARY.md` (ADR-009) |
| `empty-bundle` / `duplicate-bundle-id` / `bad-mode` | Structural |

### 7.1 Warning, never violation — and why that is not timidity

This copies `validateFindingProblemClass()` (`cwos-reconcile.js:759`) and its recorded reasoning: an
unclassifiable finding is *a finding about the program*, and that state must be able to persist in
the tree without failing reconcile.

The same logic holds here, and it is stronger than "be gentle". Every state this validator detects is
one a healthy repo is legitimately in for a while — a drifted hash means a source file was edited,
which is normal work; a breached budget means a bundle is growing, which is worth **seeing** before it
is worth **stopping**; an unbundled math task means nobody has scoped it *yet*. A validator that
blocked on any of these would be routed around within a week, and a routed-around check is worse than
no check because it still looks like coverage.

### 7.2 What it found on first run

Five unpinned includes (resolved by `--rehash`) and **four open work items carrying a math/measurement
`problem_class` with no scoped context**:

```
WS-405  "Scoring/Classification Bias"            → math-measurement
WS-406  "Methodology Drift"                      → math-blindspot
WS-416  "Sample Size & Statistical Validity"     → math-measurement
WS-417  "Cross-Method Consistency"               → math-measurement
```

WS-405 is worth naming: it is the item recorded on `prog-methodology-integrity.yaml` as *"a P1 the
founder had specifically asked for, which could not compose because its own program was over cap."*
It would have run against whatever the session happened to load.

All eight negative cases were additionally exercised against a throwaway probe bundle and each fired
correctly; drift detection was confirmed by mutating a pinned file and re-running.

---

## 8. What is not built

- **Load-time enforcement of `excludes`.** Not possible today (§4.3).
- **Findings carrying `context_bundle`**, which is what would let a reviewer check that a discovery
  finding did not cite a withheld source. This is the next increment with real teeth.
- **`tier:` on includes**, pending the heavy/light split (§6).
- **Bundles beyond mathematics/measurement.** The two shipped bundles are the founder's named area.
  Sidebar, persistence, and design work are obvious candidates; none is scoped here, because a bundle
  whose curator has not read its contents is a manifest of the monolith with extra steps.
