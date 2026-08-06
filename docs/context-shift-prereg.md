# Context Shift — Pre-Registration (WS-424 / S11)

**Frozen 2026-08-05, BEFORE the compact tier, the barrier, or any other organ shipped.**
This file must not be edited after the first organ ships. If something in it turns out to be wrong,
that is a finding to record beside the result — not an edit to make. Same rule as
`docs/context-system-requirements.md`, and for the same reason.

---

## §0. CORRECTION, 2026-08-06 — THE PRIMARY INSTRUMENT MEASURED THE WRONG THING

**Recorded as a correction, not an edit, and made before any data was collected.**

As frozen, the primary statistic was `V = rate(TREATMENT) − rate(CONTROL)` — **vocabulary
uptake**. It measures whether words travel. **It cannot detect whether claims are true**, and
accuracy is the actual objective. A context system that raised vocabulary uptake while leaving
the error rate unchanged would have *passed* this study.

**Why the error happened, which matters more than the error.** The crossing artifact
(`.claude/projects/context-shift-implementation.md`) never names accuracy. Not once. It frames
the problem entirely as vocabulary priors and drag, so every downstream artifact — including
this one — inherited *that* target and optimised against it. The premise was adopted, never
tested. Founder, 2026-08-06: *"the problem is in your accuracy over the past few weeks, which
has many things that could have been prevented with proper context. how is this not in the
handoff??"*

**The accuracy measurement already existed and was ignored.** `docs/context-system-comparison.md`
§3 carries it:

| Arm | Claims checked | Held | Refuted |
|---|---:|---:|---:|
| **A — greenfield** | 11 | **11** | **0** |
| B — context-laden | 4 | 4 | 1 (the most consequential claim in the study) |
| C — maximum drag | 4 | 4 | 1 (same claim, inherited) |

**Greenfield was 100% accurate; both context-laden arms were not.** The pre-registered negative
("context-drag hypothesis NOT SUPPORTED") was about *design-task quality scores*, and it failed
on the **implementability** clause. On accuracy it did not fail at all — greenfield dominated.
Relaying the negative without that distinction understated the one result that bears on the
real problem.

### The corrected instrument hierarchy

**PRIMARY — claim survival under independent verification.** For an artifact making load-bearing
claims: the proportion of those claims that survive checking by a **fresh-context** agent that
did not produce them. This is exactly what the judge did by hand, and it is the only instrument
here that can see the failure the founder is describing.

**SECONDARY — vocabulary rate `V`.** Retained, demoted, non-decisional on its own. A vocabulary
shift with no accuracy improvement is not a success; it is the costume of one.

**GREENFIELD DISPATCH IS THE STANDARD, NOT AN OPTION.** It is the only configuration measured at
100%, and it won every time it was measured. A load-bearing claim asserted from accumulated
session context, without an independent check, is below standard by default — regardless of how
confident it reads. This is what `dispatch-dont-assert` is a reminder of; the reminder is not
the mechanism.

**Live baseline, this session, recorded unhedged:** 8 errors by the implementing agent. Two
reached the founder, three were shipped as code or stated as fact before anything caught them.
Every one that was caught internally was caught by **dispatching or measuring** — none by
reasoning more carefully from context. That is the effect size this study should be sized on.

**§2's gate, threshold, and deletion consequence below still stand for the secondary
instrument.** The primary instrument's gate is specified in §2b.

---

Baseline measurements and the power analysis behind every number here:
`.claude/workstream/evidence/context-shift-preflight.md`.
Instruments: `scripts/context/vocab-rate.mjs` (primary), `scripts/context/echo-meter.mjs` (secondary).

WS-424's accept criterion requires four things. They are §1–§4. A falsifier missing any one of them
is not accepted, so each is stated separately and completely.

---

## 1. The control vocabulary — published in advance

Frozen in code at `scripts/context/vocab-rate.mjs`, exported as `TREATMENT` and `CONTROL`.
Print them with `node scripts/context/vocab-rate.mjs --terms`.

**TREATMENT (15 terms)** — carried by the compact tier:
`dispatch · pre-register · prereg · falsifier · falsified · contamination · contradiction ·
replication · withheld · derive · spr · blocker · per-combo · equity · range-based`

**CONTROL (15 terms)** — drawn from the *same heavy tier*, deliberately **withheld** from the
compact tier:
`intransitive · intransitivity · antisymmetric · icm · malmuth · harville · bubble · ante ·
straddle · rake · realization · quantile · donk · squeeze · multiway`

**Why the control is not optional.** This repo's artifacts talk about poker and about method whatever
any injection does. A rise in treatment terms *alone* is indistinguishable from the repo simply
getting busier on that subject — which, at 156 lines/day of POKER_THEORY accretion, it demonstrably
is. Only the difference isolates the injection. Both lists are drawn from the same document and the
same register, so they are exchangeable under the null.

**The primary statistic:**

> **V = rate(TREATMENT) − rate(CONTROL), per 1,000 words.**

**Unit of analysis: the 1,000-word block, not the artifact.** Measured on the frozen baseline arm, not
assumed — the per-artifact unit has **CV 3.050** against the block's **2.497**, because one term hit
in a 60-word finding reads as 16/1k and carries almost no information. Blocks do not span artifact
boundaries.

**Population is attributed by creation date, NEVER by mtime** — mtime moves on touch, reformat, or
checkout and would silently re-date the baseline on any bulk operation. Two admissible sources:
`created_at:` frontmatter, or the file's **first-commit date** from
`git log --diff-filter=A`. Files datable by neither are **excluded and counted as excluded**, never
silently dropped.

---

## 2. The gate — stated in units the study can actually reach

| | |
|---|---|
| **Baseline arm (frozen today)** | **1,079 blocks · 1,431,619 words · 785 artifacts**, everything created ≤ 2026-08-04 |
| **Baseline V** | **mean 2.3494 · SD 5.8658 · CV 2.497** |
| **Gate** | **60 days AND a treatment arm of ≥ 800 blocks (≈800,000 words), whichever is LATER** |

**WS-424 specified `n ≥ 40 artifacts or 60 days`. That gate is wrong and is corrected here, which is
a legitimate pre-registration act because nothing has shipped yet.** At 40 artifacts (~46 blocks) the
minimum detectable effect is about **108%** — the study could only detect V *doubling*. Freezing that
number would have produced an uninterpretable result wearing the costume of rigour, which is the
precise failure this whole ticket exists to prevent.

**Pre-registered minimum detectable effect at the gate: a 36% relative change in V** (80% power,
α=.05, two-sided, n₁=1,079 / n₂=800). Stated in advance so it cannot be renegotiated when the number
arrives. The study cannot see a 20% change and will not be claimed to.

---

## 2b. The PRIMARY gate — claim survival under independent verification

**Unit:** one load-bearing claim. A claim is load-bearing if it is stated as fact about the repo
or the domain and something downstream depends on it — a `file:line` assertion, a measured
quantity, a capability claim. Rhetoric and hedged statements are not claims and are not scored.

**Procedure:** a fresh-context agent that did not produce the artifact checks each claim against
the repo and returns held / refuted / unverifiable. Fresh context is not a nicety — it is the
treatment being tested, and an agent carrying the producing context is measuring itself.

**Statistic:** survival rate = held / (held + refuted). Unverifiable is reported separately and
never silently counted as held — that is the move that manufactures a good score.

| | |
|---|---|
| **Baseline** | The comparison's own audit: context-laden arms **4/5 = 80%** survival. Greenfield **11/11 = 100%**. Plus this session's implementing agent: **8 errors**, 3 shipped before detection. |
| **Gate** | 60 claims scored across at least 8 distinct artifacts. Claims, not artifacts, are the unit — one artifact can carry many. |
| **Threshold** | Survival must reach **≥ 95%** with the lower bound of its 95% interval above the 80% laden baseline. |
| **Both directions** | Below 90%: the context system is not delivering accuracy and the deletion consequence in §4 fires for the compact tier. Between 90% and 95%: underpowered or partially effective — hold and keep accruing; do NOT read it as success. |

**Deletion consequence, named in advance:** if survival does not beat the laden baseline, the
compact tier is deleted per §4 — because a per-turn reminder that does not improve claim accuracy
is spending bytes × turns on nothing. **The greenfield-dispatch standard is NOT deleted by this
result**, because it is not on trial: it was already measured at 100% and it is the control the
rest is compared against.

**Confound, stated now:** claims produced *because* a dispatch was run are not independent of the
dispatch standard. Score the artifact's claims as written, and record separately whether each was
produced by assertion or by dispatch — that split is the actual comparison and it is worth more
than the aggregate.

---

## 3. The threshold and the decision rule — in BOTH directions

Let ΔV be the treatment-arm V minus the baseline-arm V, tested two-sample at α=.05.

| Outcome | Reading | Consequence |
|---|---|---|
| **ΔV ≥ +0.85 (≈ +36%), p < .05** | The compact tier moves the vocabulary it carries, against a control it does not. | **Confirmed.** Keep the emitter. Re-derive the ceiling schedule on the observed distribution. |
| **ΔV not distinguishable from 0** | The injection does not move the output distribution at a magnitude this design can see. | **Null → the deletion consequence in §4 fires.** |
| **ΔV ≤ −0.85, p < .05** | The compact tier *suppressed* its own vocabulary. | **Refuted, more strongly than null.** §4 fires, and the inversion is recorded as a finding in its own right. |
| **Treatment arm reaches 60 days but < 800 blocks** | Underpowered. | **Not a result.** Hold, keep accruing, report as incomplete. Do NOT read a null off an underpowered arm. |

**The null and the refutation have the same consequence.** That is deliberate: an organ that cannot
be shown to work does not get to survive on the grounds that it was not shown to fail.

---

## 4. The named deletion consequence — which organ dies, named in advance

**On a null or a refutation, `.claude/hooks/compact-tier.cjs` is DELETED — the whole emitter, not a
tuned-down version of it.** Not reduced in size, not narrowed to fewer terms, not moved behind a
flag, not "kept for the poker half."

Named now, in advance, precisely so it cannot be renegotiated once there is a number and a sunk cost.
The vocabulary being tested *is* the vocabulary the emitter carries; if it does not move, the emitter
has no second job to justify the bytes × turns it spends on every turn of every session.

**What survives a null, and why it is not a loophole:** the bundle machinery (S8), the withholding
barrier (S6/S7), and the corrections counter (S10) are **not** tested by this instrument and are not
deleted by it. Each has its own falsifier below. Listing them here is what stops "delete the light
tier" quietly becoming "delete nothing."

### 4a. The barrier's own falsifier — separate organ, separate test

The founder ruled (DF1) to build the per-task hook rather than run the study on static
`permissions.deny`. That ruling carries its own pre-registration:

- **Instrument:** cited-but-unread rate on findings produced under `mode: discovery` bundles.
- **Baseline:** **33 of 61 citations (54.1%)** across 26 sessions [preflight §1]. Recorded as a
  **floor**, because the citation regex is conservative.
- **Gate:** 40 discovery-bundle findings.
- **Decision:** if cited-but-unread among discovery findings is not *lower* than the all-sessions
  baseline at α=.05, **`.claude/hooks/context-barrier.cjs` is deleted** and `excludes` reverts to a
  declaration-only audit trail.

---

## 5. Secondary and exploratory measures — pre-registered as NON-decisional

**Attributable echo `A = E(O,R) − E(O,D)` is explicitly demoted to descriptive.** The cheapest
invalidation ran before anything was built and found CV ≈ 1.00 at session granularity: detecting a
halving would take 64 sessions per arm, 128 total, against 57 transcripts in this project's entire
life [preflight §1]. **No decision in §3 or §4 may cite it.** It is reported each run because it is
nearly free once the walker exists, and because a paired within-session design — which removes the
between-session variance by construction rather than averaging it down — would make it decisional
later. That design is named, not deferred into silence.

**Cited-but-unread** is decisional for §4a only, and exploratory elsewhere.

**Two confounds, recorded now rather than discovered later:**

1. **The author of the compact tier's content also fixed the treatment vocabulary.** Mitigated by the
   control list being drawn from the same document, but not eliminated. Anyone citing this should
   weight it.
2. **51,684 bytes are harness-injected every session and cannot be withheld** — root `CLAUDE.md` plus
   all seven `.claude/rules/*.md`. Some treatment vocabulary already appears there. The measured
   effect is therefore the *incremental* effect of the compact tier **on top of** an already-present
   prior, not the effect of that vocabulary from zero. This biases toward the null.

---

## 6. Prediction, recorded so it can be wrong

**P-A —** V rises, but by less than the 36% the gate can resolve, giving a null that is a power
failure rather than a mechanism failure. If this is what happens, §3's fourth row is what governs and
the honest report is "underpowered", not "does not work."

**P-B —** cited-but-unread falls under discovery bundles, and by more than V rises — because a
barrier that blocks a read is a harder intervention than an injection that adds vocabulary.

Both are stated before any organ exists. If both fail, the injection-point frame (S1) is the thing in
question, not the parameters.
