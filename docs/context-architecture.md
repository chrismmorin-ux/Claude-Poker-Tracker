# Context Architecture — the two-tier design for poker doctrine

**Status:** design, not implemented. Specifies WS-423.
**Measured against:** `.claude/context/POKER_THEORY.md` at HEAD `fe716f59`, **2,495 lines / 31,692 words / 200,905 chars (~50,200 tokens)**.
**Working-tree note:** the tree carries an uncommitted +120 lines (§11.1b, WS-402). Every count below is HEAD unless stated. Working-tree line numbers are used for `file:line` citations, because that is what a reader opens.

---

## Why this document exists

The founder's hypothesis, in his words:

> "every piece of old content drags us backward in a statistical, real effect … Maybe Poker theory becomes much more comprehensive and maintains a baseline at a pointer to a poker-theory-light because it forces the language into you … repeating words and references become kinda part of a higher statistical likelihood that you will reuse that context in your response."

The claim is that context is a **prior on the output distribution**, not a reference shelf. Terms present in context become more likely to appear in the response; framings present become more likely to be the framing reasoned within. A compact always-loaded document therefore shapes behaviour more reliably than a long selectively-read one.

Part 1 measures. Part 2 designs. Part 3 says how anyone would know it worked.

---

# Part 1 — MEASURE

## 1.1 Composition by kind

Every line of HEAD was assigned to exactly one kind at paragraph-block granularity (coverage asserted: 0 unassigned, 0 overlapping). Definitions:

- **Positive doctrine** — what is true and how to compute it.
- **Corrections-history** — a narrative of a past belief or implementation that was wrong and has since changed. Includes retractions, false alarms, before/after defect accounts.
- **Implementation inventory** — what the code currently does: file names, function names, shipped parameter values.
- **Measurement record** — a number and its provenance.
- **Governance / meta** — frontmatter, drift policy, "what this binds", enforcement mechanisms, scope boundaries, tracked-ticket pointers.
- **Changelog** — the versioned block in the frontmatter, reported separately because its position is the finding.

| Kind | Lines | % lines | Words | % words |
|---|---:|---:|---:|---:|
| Positive doctrine | 1,330 | **53.3%** | 16,100 | **50.8%** |
| Measurement record | 394 | 15.8% | 4,422 | 14.0% |
| **Corrections-history** | **313** | **12.5%** | **3,572** | **11.3%** |
| Governance / meta | 243 | 9.7% | 2,525 | 8.0% |
| Implementation inventory | 169 | 6.8% | 2,254 | 7.1% |
| Changelog (frontmatter) | 46 | 1.8% | 2,819 | **8.9%** |

**The founder's specific hypothesis, quantified: corrections-history is 12.5% of lines and 11.3% of words. Adding the changelog — which is corrections-history by content, in the frontmatter by position — gives 14.4% of lines and 20.2% of words.**

That is smaller than the hypothesis implies, and the honest reading is that **the founder is right about the mechanism and wrong about which content carries it.** Corrections-history is not the largest non-doctrine block; measurement records are (15.8% / 14.0%). And the two are not independent: nearly every measurement record in this document exists to support a correction. Taken together — corrections plus the measurements that justify them plus the changelog — the archaeological layer is **30.2% of lines and 34.1% of words**.

### Where it concentrates

The document-level averages hide the real distribution. Per top-level section:

| § | Lines | Doctrine | Corrections | Impl | Measurement | Governance | % corrections |
|---|---:|---:|---:|---:|---:|---:|---:|
| frontmatter | 64 | 0 | 0 | 0 | 0 | 18 | **71.9%** (changelog) |
| 1 Fundamentals | 30 | 30 | 0 | 0 | 0 | 0 | 0% |
| 2 Preflop | 206 | 143 | 23 | 11 | 21 | 8 | 11.2% |
| 3 Postflop | 204 | 167 | 17 | 0 | 12 | 8 | 8.3% |
| 4 Value / bluff-catch | 58 | 45 | 0 | 0 | 0 | 13 | 0% |
| 5 Weakness / exploit | 124 | 119 | 0 | 5 | 0 | 0 | 0% |
| 6 Math foundations | 112 | 89 | 0 | 22 | 1 | 0 | 0% |
| 7 First-principles | 138 | 123 | 0 | 0 | 0 | 15 | 0% |
| 8 Common mistakes | 32 | 32 | 0 | 0 | 0 | 0 | 0% |
| 9 Documented divergences | 84 | 63 | 0 | 17 | 0 | 4 | 0% |
| 10 Tournament / ICM | 77 | 70 | 0 | 1 | 0 | 6 | 0% |
| **11 Implemented algorithms** | **700** | **108** | **204** | **99** | **240** | 49 | **29.1%** |
| 12 Hero's perceived range | 120 | 48 | 26 | 7 | 0 | 39 | 21.7% |
| 13 Bluff selection | 134 | 100 | 22 | 0 | 12 | 0 | 16.4% |
| 14 Hand as denominator | 86 | 58 | 0 | 0 | 0 | 28 | 0% |
| 15 All-hands denominator | 169 | 87 | 15 | 0 | 47 | 20 | 8.9% |
| 16 Equity operator | 157 | 48 | 6 | 7 | 61 | 35 | 3.8% |

**§11 is the whole story.** It is 700 lines — **28% of the document** — and only **15% of it is positive doctrine**. It is 29% corrections-history and 34% measurement record. §1–§10, the doctrinal core, is 1,065 lines at **89% doctrine** and **4% corrections**.

The split is not thematic, it is chronological. §11.6 onward was written after 2026-07-28:

| Date | Lines | Δ |
|---|---:|---:|
| 2026-03-09 (first commit) | 389 | — |
| 2026-06-19 | 707 | +318 in 102 days |
| 2026-07-26 | 936 | +229 in 37 days |
| **2026-07-31** | **2,051** | **+1,115 in 5 days** |
| **2026-08-05 (HEAD)** | **2,495** | **+444 in 5 days** |

**62.5% of the document was written in the last 10 days**, at 156 lines/day against a prior-life average of 3.9 lines/day — a **40× acceleration with no ceiling and no eviction rule**. That, not the corrections-history ratio, is the mechanism the founder is feeling. The document is not drifting backward; it is accreting forward faster than anything can read it.

## 1.2 The changelog

**46 lines, 2,819 words, 18,954 characters — 8.9% of the document's words in 1.8% of its lines, and it occupies lines 10–55, before the reader reaches `## 1. Fundamental Concepts` at line 65.**

Every reader of this document pays **~4,740 tokens of archaeology before the first sentence of doctrine.** Three individual entries (WS-283, WS-366, WS-337) run 400–700 words each and restate their section's content in full.

Assessment: **archaeology in prime position.** Specifically —

- It is **not cited by anything.** The citation sweep found zero external references to a changelog entry.
- It is **duplicative.** Every entry restates a section that exists below it, usually at greater length than the section itself. The WS-283 entry is 640 words; §11.1a, which it describes, is 655.
- It is **already in git**, with better fidelity — `git log -p .claude/context/POKER_THEORY.md` gives the same information plus the diff.
- Its one genuine function — forcing a bump on edit — is a **governance requirement, not a reader requirement**, and can be satisfied by a version field with a validator.

**Verdict: move to `.claude/context/POKER_THEORY.changelog.md`. Keep `version`, `last_verified`, `governing_program` in the frontmatter.** This is the single largest reclamation available and it costs nothing: 4,740 tokens off the front of the most-loaded engine document, with no information destroyed.

## 1.3 Citation asymmetry

Measured across 3,864 files (all tracked + untracked-not-ignored), excluding `POKER_THEORY.md` itself. Method: `POKER_THEORY[.md]` → `§N` adjacency with an intervening-token filter, plus chained refs, reverse form, YAML `section:` form, and anchor form. A naive sweep returns 934+ hits and is heavily contaminated by `§N` references to *other* documents; the filtered count is **918 valid external section citations across 502 files.**

| § | Citations | | § | Citations |
|---|---:|---|---|---:|
| 9 Documented divergences | **174** | | 11 Implemented algorithms | 51 |
| 7 First-principles | **156** | | 10 Tournament / ICM | 36 |
| 6 Math foundations | **147** | | 1 Fundamentals | 35 |
| 3 Postflop | **132** | | 2 Preflop | 34 |
| 5 Weakness / exploit | 63 | | 4 Value / bluff-catch | 28 |
| 12 Perceived range | 25 | | 14 Hand denominator | 20 |
| 15 All-hands denominator | 9 | | 13 Bluff selection | 6 |
| **16 Equity operator** | **1** | | **8 Common mistakes** | **0** |

**Six sections (§3, §5, §6, §7, §9, §11) absorb 723 of 918 citations — 79%.**

### The never-cited section

**§8 "Common Mistakes This Document Prevents" is the only top-level section with zero external citations.** 32 lines, 708 words, fourteen numbered mistakes — and nothing in 3,864 files has ever written `POKER_THEORY.md §8`. Two bare `§8` references exist inside POKER_THEORY-scoped audit blocks; neither is a citation *of* it.

This is diagnostic rather than damning. §8 is a **digest of §3.4, §7.2, §7.3, §7.4** with pointers back to them — and the sections it digests draw 132 and 156 citations. Readers cite the source, not the summary. **That is the single most important finding for Part 2: a digest of doctrine earns no citations, because a digest is not what a reader needs from an always-loaded tier.** The light tier must not be §8 with a smaller font.

### Thirty subsections with zero external citations

`§1.1`, `§1.2`, `§2.2`, `§3.4.2`, `§3.6.1`, `§4` (bare), `§8`, `§10.5`, `§10.7`, `§10.8`, `§10.9`, `§11.1a`, `§11.2`, `§12.1`, `§12.2`, `§12.3`, `§12.5`, `§13.2`, `§13.4`, `§13.5`, `§14.4`, `§15.1`, `§15.2`, `§15.4`, `§16.1`–`§16.6`.

Notable: **all six subsections of §16 are uncited**, and §16 as a whole draws exactly one citation (`src/utils/pokerCore/__tests__/equityOperator.test.js:285`). §16 is 157 lines written 2026-08-05. §11.2 (SPR zones + the continuous sizing multiplier) is uncited despite being a shipped algorithm.

### The finding that decides the design

**Section numbers do not travel. Vocabulary does.**

| Phrase | Files | Occurrences |
|---|---:|---:|
| `intransitiv*` (§16 vocabulary) | 13 | **114** |
| `antisymmetr*` (§16 vocabulary) | 13 | 37 |
| `MDF` | 166 | 597 |
| `equity realization` | 56 | 84 |
| `perceived range` (§12) | 22 | 53 |
| **`Four Motivations` (§3.4's own heading)** | **0** | **0** |

§16 has **1** section-number citation and **151** occurrences of its distinctive vocabulary. §3.4 has **19** section-number citations and its heading phrase appears **nowhere else in the repo**.

So citation-by-number measures *bureaucratic* uptake and vocabulary-count measures *cognitive* uptake, and they are close to uncorrelated. The founder's hypothesis is about the second. **The light tier must be selected on vocabulary transmissibility, not on section importance** — and Part 3's falsifier must measure vocabulary rate, not citation count.

### Corroborating evidence for the hypothesis, already in the repo

**§7 is the most-cited section in the document (156 citations) and is the only section with an always-loaded compressed form** — `CLAUDE.md:337`, a ~90-word paragraph beginning "First-principles decision modeling (CRITICAL)", plus a one-line echo in `MEMORY.md`. No other section has one. This is a natural experiment with n=1 and it points the founder's way; it is not proof, and Part 3 exists because it is not.

### Dangling citations — five classes of pointer that resolves to nothing

| Cited as | Instances | Example |
|---|---:|---|
| `§3.8` | 8 | `docs/upper-surface/audits/btn-vs-bb-srp-ip-dry-q72r-river_after_barrel-audit.md:16` (§3 stops at §3.7) |
| `§181` | 5 | `.claude/workstream/programs/prog-domain-correctness.yaml:536` |
| `§4.3` | 2 | `docs/projects/self-coach-foundation/lessons/bb-defense-cluster.md:10` (§4 stops at §4.2) |
| `§0` | 1 | `src/components/views/PrintableRefresherView/__tests__/ClassDispatchedTemplate.test.jsx:21` |
| **`§FSA`** | 1 | **`.claude/context/POKER_THEORY.md:2353` — the document cites itself for a section it does not contain** |

Only **2** anchor-form citations exist repo-wide, both to §7.6. Sixteen citation-instances point at nothing, and nothing detects it. This is the concrete case for validator rule V1 in Part 2.

## 1.4 Recency and contradiction

Verified at HEAD by reading, with working-tree `file:line`.

**C1 — The same measurement is reported five times with three different values, and one of them is structurally impossible alongside the others.**

| Location | Claim |
|---|---|
| changelog `:25` | facing a raise, missed the true hand **45%** → coverage 55%; after: **~94% flat** |
| §3.6.1 `:460–461` | coverage flop→turn→river **89/71/56 → ~94% flat**; facing a raise **55% → 93%** |
| §11.6 `:1543` | facing a raise the old cut "missed villain's real hand **~40%** of the time" → coverage 60% |
| §11.6 `:1561` | after: **94/94/94**, chained **87/87/87** |
| §11.9 `:1921` | *"coverage is 100% everywhere post-§11.6 (**the floor guarantees it**)"* |

Two independent contradictions. (a) Pre-fix coverage facing a raise is 55% in two places and 60% in a third. (b) Post-fix coverage is ~94% in two places and **100%** in a third — and §11.9's stated reason is correct by construction: if every combo carries positive weight, the true hand is never assigned zero, so coverage is 100% *by definition*. Which means the "94%" figure is measuring something other than coverage and is mislabelled in both places it appears.

**This is the WS-291 mechanism — nothing forcing two numbers onto one axis — reproducing inside the document that exists to prevent it.** It is the most serious finding in Part 1.

**C2 — §14/§15's FSA bindings, restated accurately.** The brief's framing needs one correction: **FSA Phase 3 landed on 2026-08-05 via WS-350** (`docs/standard-of-record/VOCABULARY.md:240` — "CLOSED by WS-350. FSA Phase 3 landed."). So §14.4 and §15.4's bindings are no longer aimed at vapour. What *is* still true, and is the real defect: **`§FSA` at `:2353` names a section of POKER_THEORY.md that does not exist** — verified, zero `## …FSA` headings in the file. Every other `§` in this document refers to its own sections, so the reference is unresolvable by its own convention. The correct target is `.claude/projects/five-surface-atlas.md`.

**C3 — §11.4's fold-curve prose is superseded by §11.1a and was not updated.** `:1376` still reads *"The postflop fold curves are fitted in pot-fraction units around a **0.75 midpoint**"*. WS-283 (`:1170`, same document, 2026-08-05) moved the midpoint to **0.35** and states the 0.75 anchor was wrong by 0.40 pot-fractions, above 71% of all real bets. The sentence defers to WS-283 for "absolute calibration" but its stated number is the refuted one. **Downstream risk, flagged not asserted:** `:1336`'s `sprMidpointMultiplier` clamp `(0.65, 1.20)` scales "the fold-curve midpoint" and was calibrated when that midpoint was 0.75; against 0.35 it now spans 0.23–0.42. Whether that range is still intended is a question for the engine, not for this document.

**C4 — §3.4 asserts a closed taxonomy that has already been falsified once, with no marker.** `:331`: *"Every bet is motivated by one or more of the following."* The taxonomy went Three → Four in WS-256/WS-278 when protection/equity-denial was found missing. **The document contains zero self-incompleteness markers of any form** (verified: `grep -c "has been incomplete before|this list has been wrong|may be incomplete"` returns 0). And the same section is internally inconsistent: the heading says "The Four Motivations" while the body names five, the fifth ("inducing", `:341`) arriving unnumbered — the exact spot where the taxonomy previously proved too small.

**C5 — §4.2's bluff-catcher is a pedagogical idealisation presented as a modelling category.** `:531`: *"A bluff catcher is a hand that beats **all** bluffs in the opponent's range but loses to **all** value hands."* No such hand generally exists — §11.6's own soft-narrowing guarantees villain's range is a continuum with positive weight everywhere, so "beats all bluffs, loses to all value" is a set that is typically empty. Teaching it is fine; §4.2 has 12 citations and is consumed by code, and a definition that cannot be satisfied is a definition code cannot implement.

## 1.5 The "I was wrong" inventory

Every correction narrative in the document, classified by the brief's test: **does it prevent a *recurring* error (→ doctrine), or does it only record history (→ archaeology)?** A correction is doctrine if its *class* has fired more than once; archaeology if it fired once and was closed structurally, most decisively by a test that now asserts the fix.

**Twenty-four correction narratives.** They collapse into **six recurring families** plus **eleven one-shot events**.

### The six recurring families — these are doctrine

| Family | Instances in the doc | Count |
|---|---|---:|
| **A threshold standing where a posterior belongs** | §7.6/AP-RL-01, §11.5 (WS-285), §3.6.1/§11.6 (WS-291), §2.1 (WS-302), §13.3 (FIND-040 tier-1 gate) | **5** |
| **A constant standing where game state belongs** | §11.4 (invented `f`, 0.85/0.70/0.04), §13.3 ×3 (`0.55` population fold, the 10:1 prior outvote, the wrong formula) | **4** |
| **A parameter transplanted across conditioning sets** | §11.1a (midpoint 0.75, plus two downstream copies), §11.4 (linearised at 0.75), §2.1/WS-366 (postflop IQR tau applied preflop), §11.1b/WS-402 (raise axis + wrong curve + wrong anchor) | **4+** |
| **A comparison across different decision sets measures the decisions** | §11.5 (fallback-level table), §11.8 (showdown selection), §11.9 ("NOT COMPARABLE"), §14 (denominators), §15.3.1 (selected intersection) | **5** |
| **One site is a hypothesis; two sites is a finding** | §11.7's RESOLVED block — "three separate claims this session were asserted from one site and then contradicted by the second" | **3 in one session** |
| **A large conditional is not a large aggregate** | §11.9 (10.3/34.3 → 2–3 points), §15.3.1 (82.5% nesting → +4.7 points over baseline) | **2** |

**The document already names five of these six as recurring, in its own prose** — §3.6.1 `:485` says *"third instance of the same threshold-instead-of-posterior shape"*; §13.3 names *"the FIND-040 family"*. **The families exist; nothing collects them.** They are distributed across 313 lines of narrative in eight sections, and a reader meets each one as a story about a ticket rather than as a rule.

### The eleven one-shot corrections — these are archaeology

WS-304 (33-level strength score), WS-256 (subclass built independently, Σ children > parent in 151/169 cells), WS-312 (thin value vs semi-bluff), WS-276 (omniscient villain equity), WS-291's chaining off-by-one, §11.7's "an earlier draft of this section claimed… that is false", §11.7's two false alarms, §11.8's cross-axis retraction, §11.9's "neither reproduced", §16.5's invalid cycle locator.

**Six of these eleven are now closed by an assertion in a test** — §11.7's critical-softness boundary (`postflopNarrower.test.js` test 4), §2.5.3's containment, §11.9's narrowing count, WS-283's hold-out fixture, §11.4's one-seat identity, §16.3's `buildCompressionClaim` refusal. **For those six, the test is a strictly better record than the prose**: it runs, it fails, and it cannot go stale. The prose is a duplicate that can drift away from it.

**This distinction is the whole design question, and it resolves cleanly: ~6 named failure modes replace ~24 narratives.** The families are ~40 lines of rule. The instances are 313 lines of story. The story is evidence *for* the rule and belongs where evidence lives, not where doctrine lives.

---

# Part 2 — DESIGN

## 2.0 The budget this must fit inside

What is actually always-loaded today:

| File | Chars | ~Tokens |
|---|---:|---:|
| `CLAUDE.md` | 33,774 | 8,440 |
| `MEMORY.md` (global auto-memory) | 18,511 | 4,630 |
| `.claude/rules/*.md` (5 files) | 7,831 | 1,960 |
| **Total** | **60,116** | **~15,000** |

`POKER_THEORY.md` is **not** in that path. `CLAUDE.md:276` gates it on *"If touching engine code"*; `:292–296` explicitly lists it under **Skip** for four of six task types. It is ~50,200 tokens — **3.3× the entire always-loaded budget.** The always-loaded poker content today is **one paragraph** (`CLAUDE.md:337`, ~600 chars) plus MEMORY.md one-liners.

So the founder's proposal is not "compress the heavy tier"; it is **"create an always-loaded tier where today there is a paragraph."**

## 2.1 What goes in the light tier

**Its job is to force the language in.** Per §1.3, that means it is selected for **vocabulary transmissibility**, not for importance, and it is explicitly **not a summary** — §8 is the repo's own controlled experiment showing a digest of doctrine earns zero citations.

### Selection criterion — four gates, all must pass

**G1 — It is a term or a rule that must shape the *framing*, not a fact that can be looked up.**
Test: *if this were got wrong, would the response still look right?* If yes → light tier, because nothing downstream will catch it. If the response would be obviously wrong → heavy tier, because the error is self-detecting. `MDF = 1 − b^(1/N)` is a lookup; *"a required fold rate and a predicted fold rate are different quantities"* is a framing.

**G2 — It is cross-cutting.** Binds ≥2 engines or is referenced by ≥3 heavy-tier sections. Single-surface rules stay in that surface's own `CLAUDE.md` (`exploitEngine/CLAUDE.md` is 685 lines and already does this job).

**G3 — For failure modes: the class has fired ≥2 times.** This is §1.5's test, mechanized. One-shot corrections do not enter.

**G4 — It carries no re-measurable magnitude.** No decimals, no percentages, no parameter values. This is the consistency mechanism (§2.2) and it is also a quality filter: a rule that cannot be stated without a number is a lookup, and G1 already excluded it.

### Ceiling

**250 lines / 12,000 characters / ~3,000 tokens.** That is 6% of the heavy tier and a 20% increase to the always-loaded budget.

**The ceiling must be enforced in code, not intended.** POKER_THEORY.md grew from 389 to 2,495 lines with no ceiling, 62.5% of it in ten days at 156 lines/day (§1.1). At that rate an unenforced light tier reaches 2,495 lines in **six weeks**. The ceiling is the only part of this design with no judgement in it, which is exactly why it is the part most worth mechanizing.

### Proposed contents

**Block A — Vocabulary (~90 lines).** Term + one-clause definition + `binds:` pointer. Built from `docs/standard-of-record/VOCABULARY.md`'s existing register, which is already the right shape and already the repo's native language. Terms earning a place: *range · equity realization · MDF (and its documented collision — Mass Data Field vs minimum defense frequency, `VOCABULARY.md:146`) · pot odds · SPR · fold-through · perceived range · represented range · required fold · predicted fold · fold gap · capped / uncapped · polar / merged / linear · protection / equity denial · bluff-catcher · warrant · Result Card · Deal Book · Field · Decision Atom · divergence · stratum · leak · intransitivity.*

**Block B — Invariants that bind every response (~70 lines).** Stated as rules, no numbers.
- Labels are outputs, never inputs — position, bucket, style, archetype, M-zone. *(Already at `CLAUDE.md:337`; it moves here and the CLAUDE.md copy becomes a pointer.)*
- A range never assigns zero. Narrowing reweights; it does not eliminate. The one legitimate zero is a fold.
- Every number carries its conditioning set, and the inverse conditional supports the opposite read.
- A response is a **curve** with an **axis** and an **anchor**. Naming the axis wrong, the anchor wrong, and the level wrong are three different errors.
- A **required** fold rate is arithmetic; a **predicted** fold rate is a measurement. They are never the same quantity and never substitute.
- Two methods are compared on the **same** decisions, differenced per decision. Any comparison across different decision sets is measuring the sets.
- A rare sizing is a **range**, not a sizing.
- Any comparative claim resolves to a Result Card. *(ADR-009, already binding.)*
- Online-mined **structure** may inform a live model; an online **base rate** may not. Say "transferred, not measured".

**Block C — The six named failure modes (~40 lines).** §1.5's families, by name only, each with its light-tier name, its one-line signature, and a `binds:` pointer to the heavy-tier instances. **No instances, no ticket numbers, no stories.** Naming them is the entire point: a named failure mode is recognizable in a new costume, which is precisely what the instances failed to make it.

**Block D — Standing honesty statements (~20 lines).** The founder's game is live 9-handed 1/2–1/3; the corpus is online 2009. Any live claim anchored on it is transferred. The top-ranked suspected-fault entry, in one line, per `DISCLAIMER-AND-FAULT-REGISTER.md`.

**Block E — Routing table (~30 lines).** Which heavy-tier section to open for what. This is the pointer the founder describes — *"maintains a baseline at a pointer to a poker-theory-light"*, inverted: the light tier is always loaded and points *out*.

### What is deliberately excluded, and why

Every measured magnitude (G4). All engine parameter values (G1 — self-detecting). §9's documented divergences (174 citations, but they are per-line lookups, not framing). §16's compression tables. §11's implementation inventory. All 24 correction narratives — replaced by Block C's six names.

## 2.2 How the light tier stays true to the heavy one

The brief is right that two documents that can disagree is the WS-291 mechanism. §1.4's C1 shows it has *already happened inside the single document* — five statements of one measurement, three values. Adding a second file without a mechanism guarantees more of it.

**The primary defence is structural, not procedural: G4 makes most divergence impossible.** If the light tier carries no re-measurable quantity, then re-measuring anything cannot falsify it. That removes the entire class of drift that produced C1, C3, and the changelog's duplication — at the cost of a rule that is purely syntactic and therefore cheap to enforce.

What remains is enumerable: a term renamed, a binding rule retired, a pointer rotting. Those get a validator.

### The validator — modelled directly on `validateFindingProblemClass`

The precedent at `kit/scripts/cwos-reconcile.js:738` is the right shape and its reasoning transfers almost line for line. It declares a vocabulary as data, checks usage against it, and — this is the load-bearing part — chose **WARNING, not VIOLATION**, on the explicit reasoning that *"a genuinely unclassifiable finding is a FINDING ABOUT THE PROGRAM (its class list is incomplete), and that case must be able to persist in the tree without failing reconcile."*

That reasoning applies to one of the four rules below and not to the other three. The distinction is whether a legitimate exception exists.

| Rule | Check | Severity | Why |
|---|---|---|---|
| **V1** | Every `binds:` pointer in the light tier resolves to an existing heavy-tier heading | **VIOLATION** | A pointer to a nonexistent section is corruption, not hygiene. §1.3 measured 16 dangling instances across 5 classes, including the document citing itself for `§FSA`. There is no legitimate dangling pointer. |
| **V2** | Every heavy-tier section marked `binding: true` has a light-tier entry | **WARNING** | The `problem_class` reasoning applies exactly: a binding rule with no expressible light-tier form is a **finding about the rule** — probably that it is a lookup wearing a rule's clothes — and must be able to persist without failing reconcile. |
| **V3** | Light tier ≤ 250 lines / 12,000 chars | **VIOLATION** | The one rule with no judgement in it. §1.1's growth curve is the argument. |
| **V4** | Light tier contains no decimal, percentage, or parameter assignment | **VIOLATION** | G4 mechanized. Purely syntactic, undebatable, and it is the rule that makes V1–V3 sufficient rather than merely helpful. |

Bidirectionality is enforced by **co-editing, not by review** — the repo's own established rule, from `MEMORY.md`: *"every new editor ID field ships with its picker filter in the same change."* A heavy-tier section marked `binding: true` carries a `light_tier_entry:` key; adding the marker without the entry trips V2, removing the entry without the marker trips V1.

**Register the tiers in `docs/CANONICAL_SOURCES.md`**, which already exists for exactly this — *"only ONE source is authoritative. If documents conflict, the canonical source wins."* The rule to add: **the heavy tier is canonical for every claim; the light tier is canonical for nothing and is a projection of it.** A conflict is therefore always resolved the same way, and "which is right" is never a judgement call.

## 2.3 Where corrections-history lives

Four destinations, assigned by §1.5's test. Nothing is deleted without a replacement record.

| Kind | Count | Destination |
|---|---:|---|
| **Recurring family** (≥2 instances) | 6 | **Light tier, Block C** — name and signature only. This is the content that earns always-loaded status, and it is ~40 lines replacing 313. |
| **One-shot, closed by a test** | 6 | **The test is the record.** Prose deleted; heavy tier keeps a one-line pointer to the assertion. A test that fails is a better record than a paragraph that cannot. |
| **One-shot, not structurally closed** | 5 | **Heavy tier, attached to the claim it qualifies** — as an inline marker on the specific sentence, not as a separate narrative. §3.4 gets a falsified-once marker (C4). This is the founder's *"attached to the specific claim"* option and it is right for this class. |
| **Everything else** (changelog, superseded entries) | 46 lines | **`.claude/context/POKER_THEORY.changelog.md`** — out of the frontmatter (§1.2). |

**The brief's counter-example is the reason for row 3, and it is decisive.** This session's roundtable relied on knowing §3.4 had been falsified before. That knowledge has to survive — but note *what* was needed: not the WS-278 narrative, only the **fact that the taxonomy has been too small once.** A marker carries that in one clause. The narrative carries it in a paragraph and buries it.

## 2.4 "Concepts we see are overlooked"

The founder asked for early introduction of concepts the engine gets wrong or omits. Assessed against G1–G4:

| Concept | Verdict | Reasoning |
|---|---|---|
| **Labels are outputs, never inputs** | **Light tier — and it is already the proof** | Already always-loaded (`CLAUDE.md:337`), and §7 is the most-cited section at 156. Keep it, move it to Block B, and note that this is the one natural experiment supporting the whole design. |
| **Required vs predicted fold rate** | **Light tier — highest priority addition** | Passes all four gates. Both terms already exist natively (`VOCABULARY.md:87–88`, WS-411), it is cross-cutting (§6.1, §6.3, §11.1, §13.3, §13.4), and confusing them has fired **twice** — §13.4's `s/(1+s)` vs `s/(1+2s)`, and again in the uncommitted §11.1b (WS-402), where the raise axis omitted villain's posted bet from the denominator. G3 satisfied. |
| **Fold elasticity is a fitted curve, not a constant** | **Light tier, generalized** | Ships as *"a response is a curve with an axis and an anchor"* rather than as a fact about the fold curve. G1: the specific parameters are self-detecting; the framing is not. Its family (parameter transplanted across conditioning sets) has 4+ instances. |
| **A rare sizing is a range, not a sizing** | **Light tier** | Vocabulary-shaped, cross-cutting (§3.5, §11.6, §12.4), and it reframes rather than informs. |
| **Numbers carry their conditional (+ the inverse)** | **Light tier — added from the measurement, not from the list** | Not on the founder's list, but §1.5 shows its family has **5** instances — tied for the most in the document — and it is already standing doctrine in `MEMORY.md` while being absent from every always-loaded file. |
| **Same decisions, differenced per decision** | **Light tier — added from the measurement** | §11.5's rule. 5 instances. The most expensive single omission: three retractions in one session (§11.7). |

---

# Part 3 — THE FALSIFIER

**A context restructure that cannot be evaluated is faith.** The instrument below is the one the repo would demand of any other comparative claim, and per ADR-009 this *is* a comparative claim about model quality.

## The measure

**Rate of light-tier vocabulary per 1,000 words in newly-authored artifacts**, against a **control vocabulary** drawn from the heavy tier and deliberately excluded from the light tier.

The control is the whole design. Per §11.8 and §15.3.1's standing rule — *"every verdict is read against the control from this same run"* — a rise in light-tier vocabulary alone proves nothing, because the project's vocabulary drifts anyway. The prediction is **differential**.

## Pre-registration (required before the change ships, per `VOCABULARY.md`)

- **Primary measure:** light-tier vocabulary rate minus control vocabulary rate, per 1,000 words.
- **Population:** artifacts *created* after the light tier ships — `.claude/workstream/queue/WS-*.yaml`, `findings/`, `sessions/`, and `docs/` — attributed by `created_at`, never by mtime.
- **Baseline:** measured today from the same instrument. The Part 1 sweep is that baseline and is reproducible: 918 section citations, 502 files, plus the phrase table (`intransitiv*` 114, `perceived range` 53, `Four Motivations` **0**).
- **Control terms:** heavy-tier-only vocabulary, fixed and published before the run — candidates: *satellite inversion, M-ratio, Youla decomposition, noise replica, Guttman nesting, rake-adjusted EV, realization table.*
- **Gate:** n ≥ 40 new artifacts, or 60 days, whichever is later.
- **Direction, stated in advance:** light-tier rate rises; control rate does not rise by more than half as much.

## What refutes it

**If the light-tier vocabulary rate does not rise relative to the control, the mechanism did not fire and the light tier should be deleted rather than tuned.** That is a real outcome and the design must be willing to take it — deleting is cheap because G4 guarantees the light tier holds no information the heavy tier lacks.

Two confounds, named because they are the ones that would fake a pass:
1. **The light tier is in context, so its terms are trivially available to any agent writing an artifact.** This does not invalidate the measure — that availability *is* the mechanism — but it means the measure cannot distinguish "adopted the framing" from "echoed the words." The control absorbs the general case; it does not absorb this one.
2. **Authorship mix.** A month of heavy §16 work would lift `intransitiv*` regardless. Mitigation: report the rate per artifact and by program, never pooled — §14's rule, applied to this instrument.

## Two secondary measures, reported but not primary

- **Citation asymmetry (§1.3), re-run.** Prediction: the light tier does *not* accumulate section citations, because §8 shows digests do not earn them. **A rise in light-tier citations would be evidence the light tier has become a summary — i.e. that the design failed in the specific way §1.3 warned about.** Recorded as an inverted indicator.
- **Dangling citations (§1.3), re-run.** V1 should take the count from 16 to 0 and hold it there. This one is not a hypothesis; it is a regression check.

---

## Appendix — reproducing Part 1

- Composition: block-level classification over HEAD `fe716f59`, coverage-asserted (0 unassigned, 0 overlapping). Classes and line ranges are in the WS-423 evidence record.
- Citation sweep: 3,864 files; `POKER_THEORY[.md]` → `§N` adjacency with an intervening-token filter, plus chained, reverse, YAML and anchor forms. Naive adjacency returns 934+ and is contaminated by `§N` refs to other documents; report only the filtered 918.
- Growth: `git log --reverse -- .claude/context/POKER_THEORY.md`, line count per commit.
- All contradiction claims in §1.4 verified by reading the file at the cited line, not from commit messages.
