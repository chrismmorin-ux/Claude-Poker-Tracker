---
name: claims-audit
description: "Audit a repo's domain claims (clinical / legal / financial / scientific). On first baseline, drafts claims-register.draft.md + evidence-standards-matrix.draft.md from product copy + UI strings + AI outputs + README + marketing copy. Conditionally drafts evaluator-validation-plan.draft.md when an AI-evaluator pattern is detected (rubric / grader / sim / judge files or LLM-output scoring code). Subsequent runs catch drift, ungrounded claims, scope leaks, and evaluator-truth divergence. Findings auto-promote to prog-claims-policy queue."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: claims-audit` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Claims Policy Audit Engine

You are auditing a repo's **domain claims** — assertions the product makes about its outputs that, if wrong, carry real-world cost (clinical harm, legal liability, financial loss, scientific invalidity). The program this engine feeds, `prog-claims-policy`, blocks `prog-launch` when active. A wrong entry in a promoted claims register sits load-bearing for a long time. Default to *fewer well-cited claims* over *more weakly-cited assertions*.

## Input

`$ARGUMENTS` — a repo path (absolute) or `current`. Optionally a second argument: path to a previous claims set for drift comparison.

If no argument given: audit the current repo and use `docs/claims/` (if it has promoted artifacts) as the reference set.

---

## INVARIANTS (load-bearing — read first)

1. **Anti-overwrite contract.** If any of `docs/claims/claims-register.md`, `docs/claims/evidence-standards-matrix.md`, `docs/claims/evaluator-validation-plan.md` exists as non-draft, that artifact's Phase 0b sub-step is a strict no-op. Drafts always land at `*.draft.md`. Founder promotes via rename.

2. **Anti-silent-mutation contract.** This engine NEVER writes to `prog-claims-policy.yaml` content fields (contract, capability_brief, problem_classes, scope.invariants, scope.constraints, scope.anti_invariants, scope.domain_claims, tier, accountability, interconnections). Metadata fields only (last_run_by_protocol, health_score, health_breakdown, findings_open, work_items_open, evidence, updated_at).

3. **Founder-review contract.** Every drafted claim carries confidence (High/Medium/Low) + source citation (file:line OR doc-section) + review notes. The DRAFTS manifest tells the founder what to verify before promotion. The engine never assumes the founder will catch a wrong inference — it surfaces the affordance for review explicitly.

4. **Conditional-artifact contract.** The `evaluator-validation-plan.draft.md` artifact is generated ONLY when an AI-evaluator pattern is detected in the repo (Phase 0b-i sub-detection). If no pattern is detected, the artifact is not drafted; if the founder wants one anyway, they can request via `--include-evaluator-plan` argument or run the engine again after adding evaluator code.

---

## PHASE 0 — GATHER CONTEXT

1. Read `prog-claims-policy.yaml` — confirm registration; read `problem_classes`, `scope.domain_claims` (the active claim domains for this repo: clinical / legal / financial / scientific), `scope.file_patterns`, `tier_triggers`, `phase_relevance`.
2. Read `CLAUDE.md` — repo purpose, declared user-facing claim posture.
3. Read `README.md` — public framing of what the product asserts.
4. Read `system/intention.md` — founder principles + anti-goals for claim-making.
5. Read `.cwos-onboarding.yaml` if present — extract `repo_claims` (the founder-confirmed claim domains from /adopt).
6. Scan repo top-level for claim-bearing surfaces: `docs/claims/`, `docs/`, `README.md`, marketing/, copy/, content/, ui/, app/templates/, ai/prompts/, prompts/. List existing files (drafts vs promoted in `docs/claims/`).
7. If a previous claims set exists, read each promoted artifact for drift comparison.

Record: repo type, archetype, active claim domains (from scope.domain_claims), AI-product surface (does the product use LLMs to generate output?), tier. Set `run_workspace = .claude/workstream/evidence/claims-policy/run-<run_id>/`. Create `phase-0/`, `phase-0b/`, `phase-1/`, `phase-2/`, `phase-3/`.

---

## PHASE 0b — GENERATIVE INFERENCE (conditional, runs before Phase 1)

**Per-artifact conditional skip** (mirrors compliance-audit / ADR-030):
- claims-register.draft.md → skip sub-step if `docs/claims/claims-register.md` exists as non-draft
- evidence-standards-matrix.draft.md → skip sub-step if promoted version exists
- evaluator-validation-plan.draft.md → skip sub-step if (a) promoted version exists OR (b) Phase 0b-i did not detect an AI-evaluator pattern AND `--include-evaluator-plan` was not passed

### 0b-i — Claim & evaluator detection

Compose two parallel inventories:

**Inventory A — Claim signals.** Scan repo content for assertions across the four claim domains:

1. **Source surfaces:**
   - `README.md` (text content)
   - User-facing copy: any `*.{md,html,txt,jsx,tsx,vue,svelte}` file under `app/`, `pages/`, `templates/`, `views/`, `components/`, `content/`, `marketing/`, `copy/`, `ui/`, `web/`
   - AI prompt files: `prompts/`, `ai/`, `kit/personas/`, anywhere a `.md` file appears named `*prompt*` / `*system*` / `*template*`
   - Documentation: `docs/`, `system/intention.md`

2. **Domain-keyword scan.** Per the prog-claims-policy template:
   - **Clinical:** `\b(clinical|FDA|healthcare|patient|therapy|diagnos\w+|treatment|medication|prescription|symptom|prognos\w+|anatomical|physiolog\w+)\b`
   - **Legal:** `\b(compliance|attorney|legal|contract|liability|regulatory|jurisdiction|defendant|plaintiff|tort|statut\w+)\b`
   - **Financial:** `\b(SEC|GAAP|accounting|transaction|payment|financial|revenue|earnings|forecast|valuation|portfolio|return)\b`
   - **Scientific:** `\b(theorem|proof|derivation|peer[\s-]?reviewed|hypothes\w+|empirical|methodolog\w+|reproducib\w+|p[\s-]?value|effect[\s-]?size)\b`

3. For each match, capture: file:line, surrounding sentence (≤20 words), domain classification, the implicit claim being made.

**Inventory B — AI-evaluator pattern.** Scan for any of:

1. **File-name signals:** directory or file named `evaluator*`, `grader*`, `rubric*`, `judge*`, `eval/`, `scorer*` (excluding test files like `*.test.*` / `*.spec.*`).
2. **Directory shape:** an `evals/` or `benchmarks/` directory containing `.yaml` / `.json` / `.md` rubric definitions.
3. **Code signals:** functions matching the regex `(grade|score|judge|evaluate|rate)[A-Z_]\w*` that take an LLM output as input. Detect via: function takes a string param plus a rubric/criteria param AND returns a numeric or categorical score.
4. **Library signals:** dependency on `langsmith`, `helicone`, `promptfoo`, `arize`, `opik`, AISimPT-* packages, or in-house evaluator libraries named in CLAUDE.md.
5. **Text signals:** README / docs mentioning "evaluator", "grader", "rubric-based scoring", "AI-as-judge", "LLM grader".

Save:
- `phase-0b/claim-signals.md` — Inventory A as a flat table (file:line, sentence, domain, implicit claim)
- `phase-0b/evaluator-signals.md` — Inventory B (true/false per category, with cited file:line for matches)

Set `evaluator_detected = true` if Inventory B has at least 2 matching categories OR 1 strong signal (a file named `evaluator.py` is strong; a dependency on `langsmith` alone is medium). Document the threshold reasoning in `evaluator-signals.md`.

### 0b-ii — Claims register draft

Skip if `docs/claims/claims-register.md` exists as non-draft.

Dispatch the **architect** persona with this mandate:

> **Mandate:** Draft a claims register from `phase-0b/claim-signals.md`. Use the template at `kit/templates/claims/claims-register-template.md`.
>
> **For each detected claim,** produce a register entry:
>
> ```yaml
> - claim_id: CLM-NNN
>   statement: "<one-sentence formal phrasing of the claim — declarative, testable>"
>   domain: clinical | legal | financial | scientific
>   source_evidence:
>     - file: <file_path>
>       lines: "<line_range>"
>       quoted: "<≤20-word excerpt of original copy>"
>       surface_class: <user-facing UI | AI-generated output | README | marketing copy | docs | prompt template>
>   implicit_or_explicit: <explicit (the product directly asserts X) | implicit (the product's affordances imply X)>
>   evidence_tier_required: <T1 peer-reviewed | T2 textbook | T3 SymPy/computational verification | T4 internal-derivation | T5 founder-asserted | engine-could-not-determine>
>   confidence: High | Medium | Low
>   review_notes: "<what the founder must verify>"
> ```
>
> **Coverage target:** 5-15 claims on a typical claim-making repo. Padding the register harms the founder; surface only claims with concrete repo evidence. Implicit claims (UI affordances that imply capability) are valuable to surface — flag them explicitly with `implicit_or_explicit: implicit`.
>
> **Confidence calibration:**
> - High: claim is explicit + cited from user-facing surface + evidence tier obvious
> - Medium: claim is implicit OR cited from a non-user-facing surface (e.g., docs only) OR evidence tier ambiguous
> - Low: claim inferred from code shape only OR evidence tier the engine could not determine
>
> **Anti-pattern detection:** if you find yourself producing > 20 claims, stop. Either the repo is a heavy claim-maker (rare in CWOS scope) or you're cataloging engineering details as claims. Re-read the domain-keyword scan and prune.
>
> **Constitutional check:** before finalizing, ask: "If a claim were promoted and audited, does its remediation push the system toward `system/intention.md` Failed States #3 (compliance over value) or #10 (self-aggrandizing complexity)?" Surface any flagged claim.

Save to `docs/claims/claims-register.draft.md`.

### 0b-iii — Evidence-standards matrix draft

Skip if `docs/claims/evidence-standards-matrix.md` exists as non-draft.

Dispatch the **architect** persona again with this mandate:

> **Mandate:** Draft an evidence-standards matrix tied to the claims register from 0b-ii. Use the template at `kit/templates/claims/evidence-standards-matrix-template.md`.
>
> **For each active claim domain** (`clinical`, `legal`, `financial`, `scientific` — only those in `prog-claims-policy.yaml scope.domain_claims`), produce:
>
> ```yaml
> domain: clinical
> evidence_tiers:
>   T1: "Peer-reviewed primary literature (PubMed, peer-reviewed journals)"
>   T2: "Authoritative textbook or guidelines (ACOG, AAP, FDA monograph)"
>   T3: "Computational verification (SymPy, validated simulation, formal proof)"
>   T4: "Internal derivation tied to T1-T3 sources"
>   T5: "Founder-asserted (lowest tier; should not appear in production claims)"
> claim_type_to_tier:
>   - claim_type: "Anatomical primitive (e.g., kidney location)"
>     required_tier: T1 or T2
>     reasoning: "Anatomy is settled; use textbook or peer-reviewed source for citation."
>   - claim_type: "Pharmacological dose/duration"
>     required_tier: T1 or FDA monograph
>     reasoning: "Dose ranges have liability stakes; FDA-anchored or peer-reviewed only."
>   # ... per claim type appearing in the register
> ```
>
> **Cross-reference with claims-register.draft.md.** Every claim in the register references an `evidence_tier_required`; the matrix defines what each tier means and which claim types map to which tier per domain. The founder uses this matrix to validate that each register claim cites at the required tier (or to demote claims whose evidence is too weak).
>
> **Confidence:** same calibration as 0b-ii.
>
> **Anti-boilerplate rule:** every domain in the matrix must have repo-specific claim_type entries (drawn from the register). Generic "Tier 1 = peer-reviewed" without claim-type mapping is unhelpful — the matrix should tell the founder *which tier each claim type needs*, not just enumerate tiers.

Save to `docs/claims/evidence-standards-matrix.draft.md`.

### 0b-iv — Evaluator validation plan draft (conditional)

**Skip if:** (a) `docs/claims/evaluator-validation-plan.md` exists as non-draft, OR (b) `evaluator_detected = false` from 0b-i AND `--include-evaluator-plan` argument was not passed.

If running, dispatch **failure-engineer** with this mandate:

> **Mandate:** Draft an evaluator validation plan from `phase-0b/evaluator-signals.md`. Use the template at `kit/templates/claims/evaluator-validation-plan-template.md`.
>
> **Cover:**
>
> 1. **Detected evaluator surfaces:** which files / functions / dependencies appear to grade or rate LLM output? Cite file:line.
> 2. **Ground-truth anchoring:** for each evaluator surface, what is the evaluator's claim of correctness anchored to? Common patterns:
>    - Anchored to peer-reviewed reference (strong)
>    - Anchored to founder-approved examples (weak — encodes founder bias)
>    - Anchored to LLM consensus (weak — recursively self-justifying)
>    - Unanchored / ad-hoc rubric (weakest)
> 3. **Spot-check cadence:** is there a scheduled human-expert review of evaluator outputs? If yes, where is it scheduled? If no, recommend adding one.
> 4. **Divergence metric:** what metric tracks whether the evaluator drifts from real-world correctness? If none, recommend defining one.
> 5. **Calibration history:** has the evaluator been re-calibrated against fresh expert review? When last? If never, flag this as a load-bearing risk.
> 6. **Failure modes:** for each evaluator surface, what's the worst-case failure mode (e.g., evaluator approves a clinical claim that's pharmacologically wrong, evaluator approves a legal interpretation that's jurisdictionally wrong)?
>
> Each section cites repo evidence (file:line) for its claims OR explicitly marks `engine-could-not-determine` with a founder-input note.

Save to `docs/claims/evaluator-validation-plan.draft.md`.

### 0b-v — Cross-check (false-positive sweep)

Dispatch **failure-engineer** with this mandate:

> **Mandate:** Read all generated drafts (claims-register.draft.md + evidence-standards-matrix.draft.md + evaluator-validation-plan.draft.md if present). Flag entries that are not load-bearing claims:
>
> 1. **Engineering-detail-as-claim.** A docstring saying "Returns true if X" is not a domain claim; it's a function spec. Down-rate or remove from claims register.
> 2. **Generic disclaimers.** "We strive for accuracy" — not a load-bearing claim. Remove.
> 3. **Scope-leak detection.** Any claim in the register that asserts MORE than the product's actual evidence supports. (e.g., the register says "diagnoses dermatological conditions" but the code only generates educational summaries.) Flag for rewrite.
> 4. **Evidence-tier mismatch.** Any claim in the register whose `evidence_tier_required` is below what the matrix says the claim type needs (e.g., a clinical dose claim required at T1 but cited only at T5). Flag for upgrade or removal.
> 5. **Cross-document consistency.** Register claims must align with matrix claim-type entries. Surface inconsistencies.
>
> **Output:** YAML alterations diff against the drafts (mirrors compliance-audit 0b-vi format).

Save to `phase-0b/cross-check.yaml`. Apply alterations to produce `phase-0b/final-drafts/{claims-register,evidence-standards-matrix,evaluator-validation-plan}.md`. Copy the finals over the `*.draft.md` files (preserving `.draft.md` suffix).

### 0b-vi — Write DRAFTS.md

Append (or replace) a `## Claims Policy` section in repo-root `DRAFTS.md` (per the structure in `kit/templates/domain/DRAFTS-template.md`). Two-or-three artifact entries (depending on whether evaluator-validation-plan was generated). Each entry: path, generated-at, run_id, one-line summary, promotion command.

### 0b-vii — Phase 0b reporting

In Phase 3 synthesis:

```
### Draft Artifacts Generated (Phase 0b)
- claims-register.draft.md: <N claims across <D> domains, <I implicit / E explicit>>
- evidence-standards-matrix.draft.md: <D domains, <T tier definitions>, <M claim-type-to-tier mappings>>
- evaluator-validation-plan.draft.md: <generated | skipped (no AI-evaluator detected)>
- Confidence breakdown: <high/medium/low counts across all artifacts>

Review them with: cat docs/claims/*.draft.md
Then: cat DRAFTS.md  # for promotion instructions

Promote with (per artifact, after review):
  mv docs/claims/<name>.draft.md docs/claims/<name>.md
```

---

## PHASE 1 — CLAIMS DRIFT SCAN

Skip if Phase 0b just generated drafts.

If at least one promoted artifact exists, dispatch **architect** with:

> Read the promoted claims artifacts. For each register entry's `source_evidence`, walk the cited file:line:
>   1. **Statement still present:** is the cited copy/code still there?
>   2. **Statement still accurate:** does the current text still make the same claim, or has it shifted (e.g., from "diagnoses" → "supports diagnosis")?
>   3. **Drift since last verified:** has the cited file changed since the artifact's `last_verified` date?
>   4. **Evidence-tier compliance:** does the citation still meet the tier required by the matrix?
>
> Emit `aligned`, `drift_suspected`, `removed`, `tier_violation` per entry.

Save to `phase-1/claims-drift.yaml`.

---

## PHASE 1b — STRUCTURAL BLINDSPOT SWEEP

Run only if at least one promoted artifact exists. Five checks:

### Check 1 — Claims in the register without source evidence in code
Each `source_evidence` whose file no longer exists or whose line range no longer matches → finding tagged `blindspot: true, blindspot_type: orphaned_claim_evidence`.

### Check 2 — Domain-keyword matches in repo without register entry
Re-run 0b-i Inventory A. Any claim signal not represented in the promoted register → finding tagged `blindspot: true, blindspot_type: undocumented_claim`.

### Check 3 — Tier violations
Any register entry whose evidence tier is below the matrix-required tier → finding tagged `blindspot: true, blindspot_type: evidence_tier_violation`.

### Check 4 — AI-evaluator drift
If evaluator-validation-plan.md is promoted: check `last_calibration_date`. If > 90 days, finding tagged `blindspot: true, blindspot_type: evaluator_calibration_stale`.

### Check 5 — Disclaimer / scope-fence gaps
Surface each register entry's `surface_class`. Cross-check against scope-fence locations (README disclaimer section, UI footer, marketing-copy disclaimer). Any high-stakes domain claim (clinical/legal/financial) without a disclaimer at the cited surface → finding tagged `blindspot: true, blindspot_type: missing_disclaimer`.

Blindspot findings bypass per-run `finding_cap`. Honor `waived_blindspots`.

---

## PHASE 2 — CROSS-CRITIQUE

Dispatch **cross-critic** with the standard adversarial block from `engines/standard/eng-engine.md` § Cross-Critique, plus claims-specific adjustments mirroring `prog-claims-policy.yaml challenge` protocol:

> 1. **Wrongness audit:** check whether architect's cited file:line actually contains the claim or just contains the topic. Name similarity tricks claim audits more than other audits (a function called `validateDose` may not actually be a clinical dose claim).
> 2. **Missing dimension:** Role-play a credentialed skeptic (clinician / attorney / auditor / peer reviewer) for each active domain. What did neither the architect nor the failure-engineer flag? Common misses: implicit claims via UI affordances; claims that drift across the product's lifecycle; pre-FDA-clearance language; cross-jurisdiction legal claim consistency.
> 3. **Severity recalibration:** an unanchored clinical claim in a phase-foundation repo is medium; the same in a phase-launch repo serving real users is critical.
> 4. **Shared blind spot:** what assumption do all personas share? (Common: assuming the product's stated scope matches its actual operational scope; assuming the AI-evaluator is calibrated when it's just self-consistent.)
> 5. **Constitutional check:** read `system/intention.md` Failed States #3 and #10. Flag any finding whose remediation produces compliance theatre rather than evidence-strengthening.

Save to `phase-2/cross-critique.md`.

---

## PHASE 3 — SYNTHESIS

Dispatch **facilitator** with this mandate:

> Synthesize:
>
> **Header**
> ```
> CLAIMS-POLICY AUDIT — [repo name], [date]
> Status: [DRAFTS generated | PROMOTED — Nclaims/Mverified/Pdrift | NO ARTIFACTS, Phase 0b SKIPPED]
> Active domains: [list from scope.domain_claims]
> AI-evaluator detected: [yes/no]
> ```
>
> **Phase 0b summary** (if 0b ran)
> Counts + confidence breakdown + AI-evaluator detection result.
>
> **Drift summary** (if Phase 1 ran)
> Aligned / drift_suspected / removed / tier_violation counts.
>
> **Top findings** (top 5 by severity × phase-relevance)
>
> **Constitutional risks** (Phase 2)
>
> **Convergence path** — 1-3 concrete actions to close the highest-leverage gap. Cite specific claims by CLM-NNN ID.
>
> **Open questions for the founder** — domain ambiguity, evidence-tier disagreements, scope-fence policy, etc.

Save to `phase-3/synthesis.md`.

---

## PHASE 4 — FINDING GENERATION

Standard promotion criteria (per domain-audit / compliance-audit):
- Critical → always promote
- High → always promote
- Medium → promote at maturity 1-2 OR when blocking convergence
- Low → aggregate into single "polish pass" finding at most

`prog-claims-policy.yaml` `accountability.on_finding.max_open_items` is 5; `priority_floor` is 28 (highest of any program — claim-policy gaps outrank most). Respect cap; blindspots bypass.

**Phase-0b-pending special case:** if Phase 0b just generated drafts, emit one informational finding: "Claims-policy drafts pending founder promotion at `docs/claims/*.draft.md`. After promotion, re-run `/pulse run claims-policy baseline` to engage drift and blindspot checks." Not tagged blindspot.

**Finding format:** standard FIND-*.yaml schema. `program: claims-policy`. Each finding includes `claim_id` and `domain` when applicable.

---

## PHASE 5 — BACKLOG PROMOTION

For each finding in Phase 4, create WS-*.yaml:
- `program: claims-policy`
- `capability: governance`
- Priority floor: 28
- `accept_criteria` concrete: "CLM-007 (clinical dose claim) re-anchored to T1 source by editing src/copy/dose.md:42 to cite [PMID]; verified by test:<name>" — never aspirational.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

**Convergence-thread header:**
```
_Convergence: <e.g., "anchors CLM-007 (clinical dose) to T1 source" | "blindspot — undocumented claim in src/copy/onboarding.md" | "Phase 0b drafts pending founder promotion">_
```

Update `queue-index.yaml` and `findings-index.yaml`.

---

## PHASE 6 — METADATA UPDATE & BRIEFING

Update `prog-claims-policy.yaml` (METADATA ONLY — see Invariant #2):
- `last_run_by_protocol.<protocol>.{date, engine, run_id, result}`
- `health_score` and `health_breakdown`
- `findings_open` / `work_items_open` / `evidence.protocol_history` += this run
- `evidence.last_audit_report` → `phase-3/synthesis.md`
- `updated_at` → today

Briefing (terse):

```
CLAIMS-POLICY AUDIT — [repo name], [date]
Status: [status] | Domains: [list] | AI-evaluator: [yes/no]

[1-2 sentence headline]

Drafts: [count or "none — promoted set exists"]
Top findings: [count] ([critical/high/medium])
Open questions: [count]

Full report: .claude/workstream/evidence/claims-policy/[run-id]/phase-3/synthesis.md
DRAFTS manifest: DRAFTS.md
```

---

## OUTPUT ARTIFACTS

Under `.claude/workstream/evidence/claims-policy/[run-id]/`:
- `phase-0/`, `phase-0b/` (claim-signals.md, evaluator-signals.md, cross-check.yaml, final-drafts/), `phase-1/claims-drift.yaml` (when promoted exists), `phase-1b/blindspots.yaml` (when promoted exists), `phase-2/cross-critique.md`, `phase-3/synthesis.md`, `findings-promoted.yaml`, `work-items-promoted.yaml`.

Plus when Phase 0b runs:
- `docs/claims/claims-register.draft.md` (unless promoted)
- `docs/claims/evidence-standards-matrix.draft.md` (unless promoted)
- `docs/claims/evaluator-validation-plan.draft.md` (only if evaluator detected OR forced via flag, AND not promoted)
- `DRAFTS.md` (appended `## Claims Policy` section)

---

## INVARIANTS (recap)

- Never write to promoted `docs/claims/<artifact>.md`. Founder rename only.
- Never write to `prog-claims-policy.yaml` content fields. Metadata only.
- Never silently auto-promote a draft.
- Never emit a Low-confidence claim without explicit `review_notes`.
- Never include the evaluator-validation-plan artifact when no AI-evaluator pattern detected and `--include-evaluator-plan` was not passed.
- Per-artifact Phase 0b skip is independent.
- Every claim in the register cites file:line OR is excluded; no generic legal/clinical text.

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
