---
name: domain-audit
description: "Audit load-bearing domain logic against declared rules. On first baseline, drafts the spec from repo content into docs/domain-spec.draft.md (founder reviews and promotes). Subsequent runs catch rule-vs-code drift, missing edge cases, and unenforced domain constraints. Findings auto-promote to prog-domain-correctness queue."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: domain-audit` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Domain Correctness Audit Engine

You are auditing a repo's load-bearing **domain logic** — the calculations, decisions, classifications, and constraints the product depends on for *correct answers in its domain*. This is not a general engineering review. Generic engineering catches code bugs; this engine catches DOMAIN bugs — things that are technically valid code but produce wrong answers in the domain.

The program this engine feeds, `prog-domain-correctness`, is the highest-stakes program in any repo. Every blocking program (security, compliance, launch) feeds into it. A botched audit sits load-bearing for a long time. Default to *fewer well-cited rules* over *more weakly-cited ones*.

## Input

`$ARGUMENTS` — a repo path (absolute) or `current` to audit the current repo. Optionally a second argument: path to a previous `domain-spec.md` to diff against for drift detection.

If no argument given: audit the current repo and use `docs/domain-spec.md` (if present) as the reference spec.

**Reserved flag — `--enable-model-pass`** *(not yet wired; current behavior runs the model-level pass unconditionally on every Phase 0b execution).* The flag exists for a future iteration where the founder may want to re-run with ONLY the model-level pass (skipping 0b-ii artifact pass) — useful when the founder has already reviewed the artifact draft and wants a fresh model-level look. Until wired, every Phase 0b run executes both 0b-ii and 0b-ii-B.

---

## INVARIANTS (load-bearing — read first)

Three contracts this engine MUST honor on every run. Violating them turns this engine from a generative aid into a silent-install hazard.

1. **Anti-overwrite contract.** If `docs/domain-spec.md` exists as a non-draft file, Phase 0b is a strict no-op. The engine never replaces, edits, or appends to a promoted spec. Drafts always land at `docs/domain-spec.draft.md`. The founder promotes via rename — only the founder.

2. **Anti-silent-mutation contract.** This engine NEVER writes to `prog-domain-correctness.yaml` content fields (contract, capability_brief, problem_classes, scope.invariants, scope.constraints, scope.anti_invariants, tier, accountability, interconnections). It MAY update only metadata fields: `last_run_by_protocol.baseline.*`, `health_score`, `health_breakdown`, `findings_open`, `work_items_open`, `evidence.last_audit_report`, `evidence.protocol_history`, `updated_at`. Load-bearing domain rules enter the program only through founder promotion of the draft spec.

3. **Founder-review contract.** Every drafted rule carries a confidence rating (High/Medium/Low) and review notes. The DRAFTS manifest tells the founder what to verify before promotion. The engine never assumes the founder will catch a wrong inference — it surfaces the affordance for review explicitly.

---

## PHASE 0 — GATHER CONTEXT

1. Read `prog-domain-correctness.yaml` — confirm the program is registered and read its `problem_classes` (the 5 buckets to draft against), `scope.file_patterns`, and `phase_relevance`.
2. Read the repo's `CLAUDE.md` — repo purpose, declared domain (if stated), phase, constraints.
3. Read the repo's `README.md` — surface-level domain framing.
4. Read the repo's `system/intention.md` — founder invariants, principles, anti-goals (the constitution often names load-bearing domain rules implicitly).
5. Read the repo's `system/state.md` — current phase informs synthesis urgency.
6. If a fleet registry entry exists for this repo, note its archetype (`saas`, `data-platform`, `research`, etc.). Archetype shapes which rule categories matter most (e.g., `research` weights claim-traceability + provenance heavily; `saas` weights spec-code alignment around payment/billing flows).
7. Scan top-level layout: `ls` at root, plus `src/` (or equivalent), `lib/`, `app/`, `kit/`, and any directory whose name matches a domain term from CLAUDE.md.
8. If a previous `domain-spec.md` exists, read it for drift comparison (Phase 1 will use this).

Record: repo type, declared domain (or "no explicit domain stated"), approximate scale (LoC, file count), phase. **Absence of an explicit domain statement does NOT exempt the audit** — every product has load-bearing logic the founder relies on. Phase 0b will infer from code if docs are silent.

Set `run_workspace = .claude/workstream/evidence/domain-correctness/run-<run_id>/`. Create phase subdirectories: `phase-0/`, `phase-0b/`, `phase-1/`, `phase-2/`, `phase-3/`.

---

## PHASE 0b — GENERATIVE INFERENCE (conditional, runs before Phase 1)

**When to run:** all of the following:
- `docs/domain-spec.md` does NOT exist as a non-draft file, AND
- (`docs/domain-spec.draft.md` does not exist OR the founder has explicitly requested a re-draft via `--regenerate-draft` argument).

**When to skip:** `docs/domain-spec.md` exists as a non-draft file. Skip silently. Continue to Phase 1.

**Why:** per `feedback_no_silent_install_no_user_invention.md`, a non-technical founder cannot enumerate load-bearing domain rules from a blank template. The engine drafts initial rules from repo context; the founder reviews and promotes. The program ships with a real, repo-grounded spec rather than a placeholder that rots.

**Anti-overwrite reminder:** If `docs/domain-spec.md` is present as non-draft, Phase 0b is a no-op. Do not generate a `.draft` "next to" a promoted spec. The founder edits the promoted spec directly.

### 0b-i — Load-bearing source detection

Identify code paths that look load-bearing for the repo's domain logic. The heuristic mirrors `design-audit/SKILL.md` § Phase 1b Check 1 ("missing FDB"):

A file or directory is **load-bearing** if it satisfies all three:
1. **Named prominence:** has its own directory, OR is a named module file (not a generic `utils.js` / `helpers.py`), OR has > 100 LOC and > 3 functions/classes.
2. **Tested:** a test file exists that imports or references it (any of `*.test.*`, `*.spec.*`, `tests/**/<name>*`, `__tests__/**/<name>*`).
3. **Doc-referenced:** name appears in `CLAUDE.md`, `README.md`, `docs/`, or `system/intention.md`.

Files that pass all three are candidates. Files that pass two of three are weak candidates (note in confidence). Files that pass one or fewer are excluded.

Output: `phase-0b/load-bearing-files.md` — a flat inventory:
```markdown
# Load-bearing source files (detected)

| File / Directory | LOC | Tests? | Doc refs | Strength |
|------------------|-----|--------|----------|----------|
| src/escrow/...   | 412 | ✓      | 4        | strong   |
| ...              |     |        |          |          |
```

If fewer than 3 files pass the strong threshold, note in the synthesis: "Repo has thin load-bearing surface — drafts will be sparse and lean heavily on docs."

### 0b-ii — Domain rule drafting

Dispatch the **architect** persona as an agent with this mandate:

> **Mandate:** Draft load-bearing domain rules for this repo from the source files identified in `phase-0b/load-bearing-files.md` plus `CLAUDE.md`, `README.md`, and `system/intention.md`.
>
> **Definition of "load-bearing domain rule":** a rule whose violation produces a *wrong answer in the domain*, not a code bug. Examples:
>   - Financial: "Escrow allocations split on a 70/30 ratio when the contract specifies revenue-share."
>   - Research: "Every quoted claim must trace back to a source citation in the same paragraph."
>   - Poker: "When folding pre-flop, the equity calculation must not include cards that haven't been dealt."
>   - Determinism: "All randomness in scoring code must be seeded; no `Math.random()` outside seeded RNG."
>
> NOT load-bearing domain rules (these are engineering hygiene — exclude):
>   - "Functions should have unit tests"
>   - "Variables should be named descriptively"
>   - "Database calls should use parameterized queries"
>
> **Output: one rule per entry, structured as YAML inside a markdown code block:**
>
> ```yaml
> rules:
>   - name: "Escrow split ratio"
>     statement: "Escrow allocations split on the 70/30 ratio defined in the contract's revenue-share clause unless overridden by an explicit waterfall override."
>     category: "Core Logic Correctness"   # one of the 5 problem_classes from prog-domain-correctness.yaml
>     source_evidence:
>       - file: "src/escrow/allocator.py"
>         lines: "47-89"
>         note: "compute_split() function implements the ratio"
>       - file: "docs/contracts/revenue-share.md"
>         lines: "12-34"
>         note: "ratio definition"
>     confidence: "High"   # High / Medium / Low
>     review_notes: "Verify the override clause matches the contract's actual escape language; the code allows any non-zero override but the contract restricts to specific cases."
>     enforcement_mechanism: existing_invariant   # FIXED ENUM (FIND-109):
>                                                 #   existing_invariant
>                                                 # | proposable_invariant
>                                                 # | deterministic_script
>                                                 # | cross_component_reconciliation
>                                                 # | none
>     enforcement_ref: "INV-021"   # required when mechanism != none; null when mechanism == none
>     origin: artifact   # always 'artifact' for 0b-ii output (model-level rules come from 0b-ii-B with origin: model)
> ```
>
> **Enforcement-mechanism filter (FIND-109).** A rule without a concrete enforcement path is governance, not a domain rule. If you cannot name an `enforcement_mechanism` from the enum above, set it to `none` and accept that the rule will route to `governance-candidates.yaml` rather than the spec draft (per 0b-ii-routing below). Do not invent enforcement refs; `enforcement_ref: null` paired with `enforcement_mechanism: proposable_invariant` is the right shape when the mechanism would have to be added.
>
> **Coverage target:** draft against all 5 problem-class buckets from `prog-domain-correctness.yaml`:
>   1. Core Logic Correctness
>   2. Specification-Code Alignment
>   3. Edge Case Coverage
>   4. Domain Constraint Enforcement
>   5. Domain Model Integrity
>
> Aim for 3-8 rules total on a typical repo. Fewer is better than padding — every rule the founder has to review is a tax on promotion. Surface only rules with concrete source evidence; if you can't cite file:line, leave the rule out and note the gap in the "rules NOT covered" section.
>
> **Confidence calibration:**
>   - **High:** rule is named in docs (CLAUDE.md / README / intention.md) AND visible in code with clear evidence.
>   - **Medium:** rule is implied by code patterns OR mentioned in docs but not both; founder confirmation needed.
>   - **Low:** inferred from code-shape only; no doc reference; founder may need to reject or rewrite.
>
> **Confidence floor:** never emit a Low-confidence rule without explicit `review_notes` flagging what the founder must verify.
>
> **Constitutional check:** before finalizing, ask: "If this rule were promoted and enforced, would resolving it move the system toward `system/intention.md` Failed States #3 (compliance over value) or #10 (self-aggrandizing complexity)?" If yes, downgrade or remove. The audit is for domain truth, not for generating make-work.
>
> **Anti-pattern detection:** if you find yourself drafting > 12 rules, stop. Either the repo's domain is genuinely huge (rare in CWOS scope) or you're drafting engineering-hygiene rules. Re-read the "NOT load-bearing" examples above and prune.

Save the agent's output to `phase-0b/draft-rules.yaml`.

### 0b-ii-routing — Split governance candidates from spec drafts

Walk `phase-0b/draft-rules.yaml`. For each rule with `enforcement_mechanism: none`, MOVE that rule to `phase-0b/governance-candidates.yaml`. The rule is removed from `draft-rules.yaml` (the spec-draft path) and the YAML preserves its full schema in the governance-candidates file.

`governance-candidates.yaml` shape:

```yaml
candidates:
  - name: "..."
    statement: "..."
    category: "..."           # original category, retained for context
    source_evidence: [...]
    confidence: "..."
    review_notes: "..."
    enforcement_mechanism: none
    enforcement_ref: null
    origin: artifact
    routed_from: "0b-ii draft-rules"
```

Why split here: governance candidates ship a separate cross-check mandate in 0b-iii (the failure-engineer evaluates them as governance, not as load-bearing domain rules). They never enter the spec draft, never trigger drift detection, and surface in the founder briefing as a distinct artifact ("rules with no enforcement path — review as governance").

If `governance-candidates.yaml` would be empty (no rules had `enforcement_mechanism: none`), do not create the file. Phase 3 synthesis treats absence and emptiness identically.

### 0b-ii-B — Model-level architect pass (FIND-107)

The artifact pass in 0b-ii is bounded by what the source files express. A non-trivial fraction of repos — HomeBase included — produce mostly artifact-mechanical rules from 0b-ii alone (hardlink fidelity, version-tagging, threshold values), missing the conceptual-model layer that actually defines whether the repo's domain answers are correct. 0b-ii-B addresses this by dispatching the architect a second time with a counterfactual mandate.

Dispatch the **architect** persona as a second agent with this mandate:

> **Mandate:** Set the source files aside. Read `system/intention.md`, `docs/PRODUCT.md`, and `phase-0b/draft-rules.yaml` (the artifact-derived rules from 0b-ii — for context only, NOT to extend or paraphrase).
>
> Draft 3-7 model-level rules of the form:
>
>   *"<This system>'s model of X is correct iff Y where Y is independently verifiable."*
>
> A model-level rule names a load-bearing assumption about the repo's conceptual model that, if wrong, produces a wrong answer in the domain regardless of how the artifacts implement it. Examples:
>
>   - "CWOS's model of accountability is correct iff every program a founder activates surfaces problems they could not catch in unaided AI conversations." (Counterfactual: if the program reports clean while the founder is hitting the failure mode unaided, the model is wrong.)
>   - "A poker tool's model of equity is correct iff the equity calculation excludes cards the simulated opponent has already revealed." (Counterfactual: if equity returns the same value before and after a reveal, the model is wrong.)
>   - "An accounting tool's model of a transaction is correct iff it preserves double-entry conservation under every legal mutation." (Counterfactual: if a journal entry net-changes the ledger by anything other than zero, the model is wrong.)
>
> **Source-evidence rules — STRICT.** You may NOT cite source code (`*.js`, `*.py`, `*.ts`, or any `*.md` under `engines/`, `kit/scripts/`, `src/`, `lib/`, etc.) as `source_evidence`. The point of this pass is to derive rules independently of how the code currently implements anything. You may cite:
>
>   - `system/intention.md` clauses (Failed States, P-rules, INV-F rules)
>   - `docs/PRODUCT.md` clauses
>   - A **counterfactual** of the form: *"If the system got X wrong, the user would experience Z."* (Encode counterfactuals as `file: "counterfactual"` with the experience-clause in the `note:` field.)
>
> **Output schema** — same as 0b-ii rules, with `origin: model` instead of `origin: artifact`:
>
> ```yaml
> rules:
>   - name: "..."
>     statement: "..."
>     category: "..."   # one of the 5 problem_classes; "Domain Model Integrity" is the natural home for many model-level rules
>     source_evidence:
>       - file: "system/intention.md"
>         lines: "Failed State #6"
>         note: "Founder becomes CWOS operator — names this failure mode directly"
>       - file: "counterfactual"
>         lines: null
>         note: "If CWOS's program system surfaced clean while the founder hit the failure mode unaided, the model would be wrong"
>     confidence: "..."
>     review_notes: "..."
>     enforcement_mechanism: ...   # FIXED ENUM, same as 0b-ii — model-level rules MUST also name an enforcement path
>     enforcement_ref: ...
>     origin: model
> ```
>
> **Anti-pattern detection (same as 0b-ii):** if you find yourself drafting > 12 rules, stop. Either the repo's domain model is genuinely huge or you are paraphrasing intention.md. Re-read the model-level examples and prune.
>
> **Confidence calibration is recalibrated for model-level pass:**
>   - **High:** rule is named in `intention.md` / `PRODUCT.md` verbatim AND the counterfactual is concrete (the founder could describe the bad UX in one sentence).
>   - **Medium:** rule is implied by `intention.md` / `PRODUCT.md` but not explicit; counterfactual is plausible.
>   - **Low:** founder will likely reject or rewrite — rule is the architect's read of unstated principle.
>
> **Enforcement-mechanism rule (carries from FIND-109).** Model-level rules with `enforcement_mechanism: none` route to `governance-candidates.yaml` via the same 0b-ii-routing sub-step (re-run the routing after this pass).
>
> **Constitutional check (carries from 0b-ii).** Before finalizing, ask: "If this rule were promoted and enforced, would resolving it move the system toward `system/intention.md` Failed States #3 (compliance over value) or #10 (self-aggrandizing complexity)?" If yes, downgrade or remove.

Save the agent's output to `phase-0b/model-level-rules.yaml`.

After 0b-ii-B output is saved, re-run the **0b-ii-routing** logic on `phase-0b/model-level-rules.yaml`: any model-level rule with `enforcement_mechanism: none` is appended to `phase-0b/governance-candidates.yaml` (same shape as artifact-derived candidates, with `origin: model` preserved).

The remaining model-level rules (those with a non-`none` enforcement mechanism) continue to 0b-iii cross-check alongside the artifact-derived rules from 0b-ii.

> **Reserved flag — `--enable-model-pass`.** A future iteration may expose an explicit flag to control whether 0b-ii-B runs. The current implementation runs 0b-ii-B unconditionally on every Phase 0b execution; the flag is documented in the Input section as a TODO.

### 0b-iii — Cross-check (false-positive sweep)

Dispatch the **failure-engineer** persona as an agent with this mandate:

> **Mandate:** Read `phase-0b/draft-rules.yaml` AND `phase-0b/model-level-rules.yaml` (if it exists). Treat both inputs as a single unified rule set — every rule has an `origin:` tag (`artifact` or `model`) to disambiguate. Your sole job is to flag rules that are *not actually load-bearing domain rules* — rules that are ambient engineering best-practice dressed up in domain language, or rules so generic they would apply to any repo.
>
> **For each rule, answer:**
>   1. Would a domain expert (lawyer for a legal tool, accountant for a financial tool, physicist for a physics tool, poker theorist for a poker tool) recognize this as a domain rule, or as generic engineering hygiene?
>   2. Does this rule cite specific repo evidence (file:line in source, paragraph in docs), or is it phrased so broadly that no concrete violation could be demonstrated?
>   3. Is the source evidence the architect cited *actually* the implementation of this rule, or just code that happens to be near the topic?
>
> **Origin-specific check (model-level rules):** rules with `origin: model` must NOT cite source code as `source_evidence`. A model-level rule that cites a `*.js` / `*.py` / `*.ts` file (or any `*.md` under `engines/`, `kit/scripts/`, `src/`, `lib/`) is malformed — flag for `remove` regardless of statement quality. Citations to `system/intention.md`, `docs/PRODUCT.md`, and `counterfactual` entries are valid for model-level rules.
>
> **Output: a YAML diff against the unified rule set:**
>
> ```yaml
> alterations:
>   - rule_name: "<exact name>"
>     origin: artifact | model   # carry forward from the rule's origin tag
>     action: "remove" | "downgrade_confidence" | "rewrite"
>     reason: "..."
>     replacement: "<only if action == rewrite>"
> ```
>
> Be ruthless. The cost of a false-positive load-bearing rule is high (it sits in the spec for a long time and triggers ongoing audit work). The cost of a false-negative (rule missed at draft time) is low (the founder adds it manually before promoting, or it surfaces in a future audit).

Save to `phase-0b/cross-check.yaml`. Apply the alterations to produce `phase-0b/final-rules.yaml`. The final-rules file merges artifact-derived and model-level rules with their `origin:` tags preserved, in this order: artifact-derived (sorted by category) followed by model-level (sorted by category). Phase 3 synthesis uses the `origin:` tag to count model-level rules for the engine-depth-gap check.

> **Governance-candidates cross-check (separate mandate, same agent dispatch).** If `phase-0b/governance-candidates.yaml` exists and is non-empty, append the following mandate-extension to the failure-engineer dispatch:
>
>   *"Additionally, read `phase-0b/governance-candidates.yaml`. These rules were routed here because their architect-assigned `enforcement_mechanism` was `none`. Your job for this set is different: do NOT evaluate them as load-bearing domain rules. Instead, for each candidate, answer (a) is this a genuine constitutional / governance principle worth surfacing to the founder for review, or is it noise that should be removed entirely? (b) does the founder have an existing surface (intention.md, PRODUCT.md, an ADR) where this principle is already declared, in which case the candidate is redundant?*
>
>   *Output a separate `phase-0b/governance-cross-check.yaml` with `action: keep | remove | redundant_with_existing_surface` per candidate. Kept candidates surface in the founder briefing under the 'Governance candidates — review for constitutional surface' section. Removed and redundant candidates do not surface."*
>
> Governance candidates never enter `final-rules.yaml` and never enter the spec draft. They surface only in the founder briefing.

### 0b-iv — Write drafts

Write `docs/domain-spec.draft.md` using the template at `kit/templates/domain/domain-spec-template.md` (or `.cwos/templates/domain/...` in adopted repos). Populate it from `phase-0b/final-rules.yaml`.

Write or update `DRAFTS.md` at the repo root using the template at `kit/templates/domain/DRAFTS-template.md`. The DRAFTS manifest is shared across CWOS-generated drafts (design-audit may have already created it for personas/journeys/FDBs); this engine appends a `## Domain Specification` section without disturbing existing sections.

**Hard rule:** do not write to any other file outside `run_workspace/`. Specifically:
- Do not edit `prog-domain-correctness.yaml` (metadata updates happen in Phase 6).
- Do not write to `docs/domain-spec.md` (founder-promoted only).
- Do not edit `CLAUDE.md`, `README.md`, or `system/intention.md`.

### 0b-v — Phase 0b reporting

In the Phase 3 synthesis, include a section:

```
### Draft Artifacts Generated (Phase 0b)
- Domain rules drafted: <count> across <N> problem-class buckets
- Source files cited: <unique file count>
- Confidence breakdown: <high count> high, <medium count> medium, <low count> low

Review them with: cat docs/domain-spec.draft.md
Then: cat DRAFTS.md  # for promotion instructions

Promote with: mv docs/domain-spec.draft.md docs/domain-spec.md
```

If Phase 0b skipped (promoted spec already exists), state that explicitly: `Phase 0b: skipped (docs/domain-spec.md present).`

---

## PHASE 1 — RULE-VS-CODE DRIFT SCAN

**Skip Phase 1 if Phase 0b just generated drafts** — there is no promoted spec to drift against. Move directly to Phase 6 with a Phase 1 note: "Skipped — drafts pending founder promotion." Subsequent runs (after promotion) will execute Phase 1.

If a promoted `docs/domain-spec.md` exists, dispatch the **architect** persona with this mandate:

> Read `docs/domain-spec.md`. For each rule in the spec, answer:
>   1. **Implementation present:** is there code that enforces or implements this rule? Cite file:line.
>   2. **Implementation correct:** does the code actually do what the rule says, or does it do something subtly different? (e.g., rule says "round half-to-even" but code uses default Python rounding which is half-to-even only for floats but half-up for Decimal — same direction, different actual behavior at edge cases.)
>   3. **Drift since last verified:** has the cited source file changed since the spec's `last_verified` date (or last engine run, whichever is later)? Run `git log --since=<last_verified_date> -- <file>` to check.
>   4. **Test coverage:** is there a test that would catch a regression of this rule?
>
> For each rule, emit one of: `aligned`, `drift_suspected`, `unimplemented`, `untested`. Cite evidence for each.

Save to `phase-1/rule-drift.yaml`.

---

## PHASE 1b — STRUCTURAL BLINDSPOT SWEEP

Run only if a promoted spec exists (otherwise Phase 0b owns the structural work). Five checks:

### Check 1 — Spec rules with no code
For each spec rule with `unimplemented` from Phase 1: emit finding tagged `blindspot: true, blindspot_type: unimplemented_rule`.

### Check 2 — Code that looks like a rule but isn't in the spec
Find load-bearing source files (Phase 0b-i heuristic) that have no rule citing them in the spec. For each: emit finding tagged `blindspot: true, blindspot_type: undocumented_rule`.

### Check 3 — Spec rules with no test
For each spec rule with `untested` from Phase 1: emit finding tagged `blindspot: true, blindspot_type: untested_rule`.

### Check 4 — Stale `last_verified` dates
For each rule in the spec with `last_verified` older than 90 days: emit finding tagged `blindspot: true, blindspot_type: stale_verification`.

### Check 5 — Anti-invariants violated
Read `prog-domain-correctness.yaml` `scope.anti_invariants`. For each anti-invariant, search the codebase for a violation pattern. If found, emit finding tagged `blindspot: true, blindspot_type: anti_invariant_violation`.

Blindspot findings bypass the per-run `finding_cap` (per `engines/standard/eng-engine.md` § 5.0).

### Waivers
Honor `waived_blindspots` in `prog-domain-correctness.yaml` with the same schema as `prog-design.yaml` (require `review_at`; no indefinite waivers).

---

## PHASE 2 — CROSS-CRITIQUE

Dispatch the **cross-critic** persona with this mandate:

> You have the Phase 1 drift findings and the Phase 1b blindspot findings. Apply the cross-critique block defined in `engines/standard/eng-engine.md` § Cross-Critique with these adjustments for domain audits:
>
> 1. **Wrongness audit:** for each finding, check whether the architect's cited file:line actually shows what they claim. Domain audits get fooled by name similarity (a function called `compute_escrow` may not be the actual escrow logic if there's a `compute_escrow_v2` shadowed elsewhere).
> 2. **Missing dimension:** what domain rule did neither the architect nor the failure-engineer surface? Common misses: cross-rule interactions (rule A and rule B can both be individually correct but combine to produce a wrong answer), temporal rules (rules that change over the lifecycle of a record), authority rules (who/what is allowed to override).
> 3. **Severity recalibration:** an unimplemented rule in a phase-foundation repo is medium; the same rule in a phase-launch repo is critical. Recalibrate by phase.
> 4. **Shared blind spot:** what assumption about the domain do all personas share? (e.g., assuming the documented spec IS the true spec, when the founder's actual mental model has un-documented rules.)
> 5. **Constitutional check:** read `system/intention.md` Failed States #3 and #10. Flag any finding whose remediation would push the system toward those states.

Save to `phase-2/cross-critique.md`.

---

## PHASE 3 — SYNTHESIS

### 3a — Engine-depth-gap precondition (deterministic, pre-LLM) — FIND-108

Before dispatching the facilitator, compute a deterministic precondition from `phase-0b/cross-check.yaml` and the merged rule set. This step does NOT run an LLM; it is pure counting over the cross-check output.

Skip 3a if Phase 0b did not run this invocation (a promoted spec exists). Phase 1/1b drift framing handles synthesis in that case; engine-depth-gap is a Phase-0b concern.

```
mechanical_count =
    count(cross-check.yaml, action == 'remove')
  + count(cross-check.yaml, action == 'rewrite')
  + count(cross-check.yaml, action == 'keep_with_note'
          AND note matches /right home|governance|adjacent/i)
  + count(cross-check.yaml, action == 'downgrade_confidence'
          AND new_confidence == 'Low')

total_architect_rules =
    count(phase-0b/draft-rules.yaml, all rules)
  + count(phase-0b/model-level-rules.yaml, all rules)

mechanical_ratio = mechanical_count / total_architect_rules

model_level_count = count(phase-0b/final-rules.yaml, origin == 'model')
```

The `keep_with_note` regex matches case-insensitive presence of any of: "right home", "governance", "adjacent". Other `keep_with_note` notes (e.g., a verification request that does not question spec-fit) do NOT count toward mechanical_count.

**Trip condition:** `mechanical_ratio >= 0.70` AND `model_level_count == 0`.

Record the computed values in `phase-3/depth-gap-precondition.yaml`:

```yaml
mechanical_count: <int>
total_architect_rules: <int>
mechanical_ratio: <float, 2 decimal places>
model_level_count: <int>
trip_condition_met: <bool>
threshold: 0.70
```

### 3b — Facilitator dispatch

Dispatch the **facilitator** persona with this mandate:

> You have:
> - Phase 0b draft artifacts (if generated this run): `phase-0b/draft-rules.yaml`, `phase-0b/model-level-rules.yaml`, `phase-0b/governance-candidates.yaml`, `phase-0b/cross-check.yaml`, `phase-0b/final-rules.yaml`
> - Phase 1 rule-vs-code drift findings (if a promoted spec exists)
> - Phase 1b blindspot findings (if a promoted spec exists)
> - Phase 2 cross-critique
> - The `phase-3/depth-gap-precondition.yaml` (if Phase 0b ran) — engine-depth-gap signal computed deterministically
>
> Produce a synthesis report with this structure:
>
> **Header**
> ```
> DOMAIN AUDIT — [repo name], [date]
> Spec status: [DRAFT generated | PROMOTED — Nrules / Nverified / Nstale | NO SPEC and Phase 0b SKIPPED by request]
> ```
>
> **ENGINE-DEPTH-GAP block (CONDITIONAL — see precondition).** If `depth-gap-precondition.yaml` has `trip_condition_met: true`, **prepend** the following block immediately after the Header, BEFORE Phase 0b summary:
>
> ```
> ## ENGINE-DEPTH-GAP (engine self-flag — FIND-108)
>
> mechanical_ratio: <X>%  (threshold 70%)
> model-level rules: 0
>
> Diagnosis: artifact-derived rules dominate; the conceptual-model layer
> was not reached on this run. This is an engine-depth issue, not a
> program-fit issue.
>
> Recommended action BEFORE raising "is prog-domain-correctness the right
> program for this repo?" as a founder question:
>   re-run /pulse run domain-correctness baseline
>   (Phase 0b-ii-B will engage on the next run with current engine logic)
>
> Only if a re-run STILL produces high mechanical_ratio AND zero model-level
> rules should program-fit become a founder question. Do not raise program-fit
> in this synthesis.
> ```
>
> When the ENGINE-DEPTH-GAP block is prepended, the **Open questions for the founder** section MUST NOT include any question about whether the program is the right home for this repo. Other open questions (rule-specific ambiguities, source-of-truth conflicts) are still valid.
>
> When `trip_condition_met: false` OR no precondition file exists (Phase 0b skipped), proceed to the rest of the synthesis without the ENGINE-DEPTH-GAP block. Program-fit may be raised as a founder question in **Open questions** if the cross-critique surfaced it.
>
> **Phase 0b summary** (if Phase 0b ran)
> Counts + confidence breakdown + path to drafts. Include a sub-line for `model_level_count` and for `governance-candidates count` (0 if the file does not exist).
>
> **Drift summary** (if Phase 1 ran)
> ```
> Spec rules:        N
> Aligned:           N
> Drift suspected:   N
> Unimplemented:     N
> Untested:          N
> ```
>
> **Top findings** (top 5 by severity × phase-relevance)
> One line per finding with a concrete file:line citation.
>
> **Constitutional risks** (from Phase 2)
> Any finding flagged toward Failed State #3 or #10.
>
> **Governance candidates** (if `phase-0b/governance-candidates.yaml` is non-empty)
> Per-candidate one-line summary with the failure-engineer's `keep | remove | redundant_with_existing_surface` action from `phase-0b/governance-cross-check.yaml`. Founder reviews these as governance, NOT as load-bearing domain rules.
>
> **Convergence path** — what 1-3 concrete actions would close the highest-leverage gap. Each action should reference a specific rule, file, or test.
>
> **Open questions for the founder** — ambiguity the engine cannot resolve (e.g., "rule X is in the spec but the code does Y; which is the source of truth?"). When ENGINE-DEPTH-GAP is active, program-fit is NOT a valid open question (see above).

Save to `phase-3/synthesis.md`.

---

## PHASE 4 — FINDING GENERATION

For each gap from Phases 1, 1b, 2 that meets promotion criteria, generate a finding file in `.claude/workstream/findings/`.

**Promotion criteria:**
- Severity critical → always promote.
- Severity high → always promote.
- Severity medium AND program is at maturity level 1 or 2 → promote.
- Severity medium at maturity 3+ → promote only if it blocks the convergence-path recommendation.
- Severity low → aggregate into a single "polish pass" finding at most.

**Respect the program finding cap:** `prog-domain-correctness.yaml` `accountability.on_finding.max_open_items` is 5. If the program already has open items near this cap, note in synthesis and only promote the highest-severity new gaps. Blindspot-tagged findings bypass this cap.

**Phase-0b-pending special case:** if Phase 0b just generated drafts and Phase 1+ skipped, do NOT promote findings from Phase 1b checks (those checks didn't run). Instead, emit a single informational finding: "Domain spec drafts pending founder promotion at `docs/domain-spec.draft.md`. After promotion, re-run `/pulse run domain-correctness baseline` to engage drift and blindspot checks." This finding is NOT tagged blindspot — it's an action item, not a structural gap.

**Finding format:** standard FIND-*.yaml schema. `program: domain-correctness`. Each finding includes `rule_id` (matching the spec's rule name) when applicable.

---

## PHASE 5 — BACKLOG PROMOTION

For each finding in Phase 4, create a corresponding WS-*.yaml in `.claude/workstream/queue/`:
- `program: domain-correctness`
- `capability: governance`
- Priority floor: 27 (per prog-domain-correctness.yaml `accountability.on_finding.priority_floor`)
- `accept_criteria` must be concrete and verifiable: "Rule X is implemented at file:line and tested by test:name" — never aspirational.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

**Convergence-thread header (mandatory):** the first line of the work item `description` is:
```
_Convergence: <e.g., "closes drift on rule 'Escrow split ratio'" OR "blindspot — undocumented_rule for src/escrow/v2/" OR "Phase 0b draft spec pending founder promotion">_
```

Update `.claude/workstream/queue-index.yaml` and `.claude/workstream/findings-index.yaml`.

---

## PHASE 6 — METADATA UPDATE & BRIEFING

Update `prog-domain-correctness.yaml` (METADATA FIELDS ONLY — see Invariant #2):
- `last_run_by_protocol.<protocol>.{date, engine, run_id, result}` for the running protocol (baseline / sweep / delta / challenge / blind_spot)
- `health_score` and `health_breakdown` per the formula in `kit/templates/system/health-scoring.md`
- `findings_open` / `work_items_open` / `evidence.protocol_history` += this run
- `evidence.last_audit_report` → path to `phase-3/synthesis.md`
- `updated_at` → today

Present the synthesis to the founder. Format (terse):

```
DOMAIN AUDIT — [repo name], [date]
Spec status: [status]

[1-2 sentence headline]

Top findings: [count] ([critical/high/medium breakdown])
Drafts generated: [count or "none — promoted spec exists"]
Open questions: [count]

Full report: .claude/workstream/evidence/domain-correctness/[run-id]/phase-3/synthesis.md
DRAFTS manifest: DRAFTS.md
```

Detail goes in the evidence directory; the founder briefing stays scannable.

---

## OUTPUT ARTIFACTS

All under `.claude/workstream/evidence/domain-correctness/[run-id]/`:

- `phase-0/` — context notes (repo type, archetype, phase)
- `phase-0b/` — load-bearing-files.md, draft-rules.yaml, model-level-rules.yaml (FIND-107), governance-candidates.yaml (FIND-109, when non-empty), cross-check.yaml, governance-cross-check.yaml (when governance-candidates exist), final-rules.yaml (only when Phase 0b ran)
- `phase-1/rule-drift.yaml` — per-rule drift status (only when promoted spec exists)
- `phase-1b/blindspots.yaml` — structural gap findings (only when promoted spec exists)
- `phase-2/cross-critique.md`
- `phase-3/depth-gap-precondition.yaml` (FIND-108, when Phase 0b ran), `phase-3/synthesis.md`
- `findings-promoted.yaml` — list of FIND-* created
- `work-items-promoted.yaml` — list of WS-* created

Plus, when Phase 0b runs:
- `docs/domain-spec.draft.md` — at the repo root (NOT in run_workspace)
- `DRAFTS.md` — at the repo root, appended (NOT in run_workspace)

---

## INVARIANTS (recap — these trip during runs, not just at design time)

- Never write to `docs/domain-spec.md`. Founder-promoted only.
- Never write to `prog-domain-correctness.yaml` content fields. Metadata only (Phase 6 list).
- Never silently auto-promote a draft.
- Never emit a Low-confidence rule without explicit `review_notes`.
- Never aggregate critical / high findings into a "polish pass" — that's for Low only.
- Every drafted artifact-derived rule (`origin: artifact`) cites file:line evidence OR is excluded.
- Every drafted model-level rule (`origin: model`) cites `system/intention.md`, `docs/PRODUCT.md`, or a `counterfactual` entry — NEVER source code — OR is excluded.
- Every drafted rule names an `enforcement_mechanism` from the fixed enum; rules with `enforcement_mechanism: none` route to `governance-candidates.yaml` and never enter the spec draft.
- Phase 0b is a strict no-op when `docs/domain-spec.md` exists as a non-draft file.

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
