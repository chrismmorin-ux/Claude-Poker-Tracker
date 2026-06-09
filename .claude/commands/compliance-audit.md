---
name: compliance-audit
description: "Audit a repo's compliance posture. On first baseline, drafts privacy-policy / consent-flows / applicable-regulations from repo content + dependencies + user-facing copy + founder-named jurisdictions into docs/compliance/*.draft.md (founder reviews and promotes). Subsequent runs catch drift, blindspots, and unenforced regulatory checkpoints. Findings auto-promote to prog-compliance queue. Coexists with legal-safety (the deep-audit engine) — compliance-audit drafts and tracks; legal-safety reviews findings with veto authority."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: compliance-audit` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Compliance Audit Engine

You are auditing a repo's **compliance posture** — the legal and regulatory commitments it makes (or should make) to users, regulators, and enterprise customers. This is not a general legal review. The deep legal audit (privacy assessment, regulatory veto, intervention-risk evaluation) is `legal-safety`. This engine is the **drafting + drift-tracking** engine: on first baseline it drafts the three load-bearing compliance artifacts; on subsequent runs it tracks whether code matches the promoted commitments.

The program this engine feeds, `prog-compliance`, blocks `prog-launch`. A wrong commitment in a promoted privacy policy or consent flow has real-world legal exposure. Default to *fewer well-cited drafts* over *more weakly-cited boilerplate*.

## Input

`$ARGUMENTS` — a repo path (absolute) or `current`. Optionally a second argument: path to a previous compliance set for drift comparison.

If no argument given: audit the current repo and use `docs/compliance/` (if it has promoted artifacts) as the reference set.

---

## INVARIANTS (load-bearing — read first)

Three contracts this engine MUST honor. Violating them turns the engine from a drafting aid into a silent-install hazard.

1. **Anti-overwrite contract.** If any of `docs/compliance/privacy-policy.md`, `docs/compliance/consent-flows.md`, `docs/compliance/applicable-regulations.md` exists as a non-draft file, that artifact's Phase 0b sub-step is a strict no-op. The engine never replaces, edits, or appends to a promoted artifact. Drafts always land at `*.draft.md`. The founder promotes via rename.

2. **Anti-silent-mutation contract.** This engine NEVER writes to `prog-compliance.yaml` content fields (contract, capability_brief, problem_classes, scope.invariants, scope.constraints, scope.anti_invariants, tier, accountability, interconnections). It MAY update only metadata fields: `last_run_by_protocol.<protocol>.*`, `health_score`, `health_breakdown`, `findings_open`, `work_items_open`, `evidence.last_audit_report`, `evidence.protocol_history`, `updated_at`. Load-bearing compliance commitments enter the program only through founder promotion of drafts.

3. **Founder-jurisdiction contract.** Compliance is unique among the generative-phase programs: the load-bearing input (which jurisdictions apply) cannot be inferred from code alone. The engine MUST surface a founder-jurisdiction prompt during interactive baseline runs unless `fleet/registry.yaml` already records `jurisdictions:` for this repo. In non-interactive mode (autopilot), the engine proceeds with detected signals only and flags the jurisdiction set explicitly in the synthesis output as "engine-inferred — founder must confirm before promotion."

---

## PHASE 0 — GATHER CONTEXT

1. Read `prog-compliance.yaml` — confirm registration; read `problem_classes`, `scope.file_patterns`, `tier_triggers`, `phase_relevance`.
2. Read `CLAUDE.md` — repo purpose, declared customer base, declared jurisdictions (if any).
3. Read `README.md` — public framing of customer-base and jurisdiction signals.
4. Read `system/intention.md` — founder principles + anti-goals; check for compliance-shaped commitments (e.g., "no PII off the device", "GDPR by default").
5. Read `fleet/registry.yaml` (if present in adopter repo) — extract `archetype` and `jurisdictions:` (if recorded).
6. Read dependency manifests — try `package.json`, `pyproject.toml`, `requirements.txt`, `Gemfile`, `go.mod`. Parse as plain text; no AST.
7. Scan repo top-level layout for compliance-relevant directories: `docs/compliance/`, `legal/`, `privacy/`, `consent/`. List existing files (drafts vs promoted).
8. If a previous compliance set exists, read each promoted artifact for drift comparison (Phase 1 will use these).

Record: repo type, archetype, declared customer base, declared jurisdictions (or "none stated"), dependency-derived signals, tier. Set `run_workspace = .claude/workstream/evidence/compliance/run-<run_id>/`. Create `phase-0/`, `phase-0b/`, `phase-1/`, `phase-2/`, `phase-3/`.

---

## PHASE 0b — GENERATIVE INFERENCE (conditional, runs before Phase 1)

**Per-artifact conditional skip.** Phase 0b has three drafting sub-steps (privacy-policy, consent-flows, applicable-regulations). Each sub-step is independently gated:

- If the artifact exists as a non-draft (`docs/compliance/<name>.md`), skip that sub-step. Do NOT generate a `.draft` next to a promoted file.
- If only `.draft.md` exists OR neither file exists, run the sub-step.
- If `--regenerate-draft <artifact>` argument is passed, regenerate the named artifact (still never overwriting a non-draft promoted file).

**Why:** the founder may promote some artifacts and still be drafting others. Per-artifact gating respects that working state.

### 0b-i — Jurisdiction & regulation detection

Compose a regulation-signals report from four input streams:

1. **Dependency manifests.** Match against this keyword list (extend as the fleet teaches):
   - `stripe` / `stripe-*` → PCI DSS
   - `auth0` / `okta` / `firebase-auth` → SOC2 paths (depends on app context)
   - `hipaa-*` / `phi-*` → HIPAA
   - `gdpr-*` / `cookie-consent` / `quantcast-*` → GDPR / ePrivacy
   - `ccpa-*` / `do-not-sell-*` → CCPA / CPRA
   - `cosmos-sdk` / `web3-*` / `ethers` → varies by jurisdiction (financial-services overlay)
   - `sentry` / `datadog` / `mixpanel` / `segment` → user-data third-party transfer (GDPR Schrems II concern)
   - `aws-sdk` / `gcloud` / `azure-storage` → data-residency tracking (per regulation)

2. **User-facing copy.** Regex scan across `app/`, `pages/`, `templates/`, `views/`, `components/`, public docs. Patterns:
   - Jurisdiction names: `\b(GDPR|CCPA|CPRA|HIPAA|PIPEDA|LGPD|PDPA|SOX|PCI[\s-]?DSS|COPPA|FERPA|GLBA|FCRA|TILA|FCPA|UK GDPR|EU|California|Quebec|Brazil)\b`
   - Customer-class markers: `\b(EU users|California residents|HIPAA[\s-]?covered entity|enterprise|healthcare|financial)\b`
   - Consent verbs: `\b(consent|opt[\s-]?in|opt[\s-]?out|do not sell|right to delete|right to access|data portability)\b`

3. **Repo archetype hints** (from `fleet/registry.yaml` `archetype` field if available, else from CLAUDE.md detection):
   - `saas` → likely PCI/CCPA/GDPR (depending on customer base)
   - `data-platform` → likely GDPR/SOC2/CCPA
   - `research` → likely IRB / HIPAA-adjacent / institutional review
   - `frontend` → likely cookie consent / CCPA / GDPR
   - `api-service` / `dev-tool` → varies; usually B2B SOC2 paths
   - `research-clinical` → HIPAA / FDA 21 CFR Part 11

4. **Founder-declared signals.** From CLAUDE.md / README / intention.md (text-search for jurisdiction names + customer-class markers).

Combine into `phase-0b/regulation-signals.md`:
```markdown
# Regulation signals (detected)

## Jurisdictions
| Jurisdiction | Signal source(s) | Confidence |
|--------------|------------------|------------|
| GDPR (EU) | dep:cookie-consent + copy:"EU users" | High |
| CCPA (California) | copy:"California residents" | Medium |
| ... | ... | ... |

## Regulations
| Regulation | Triggering signal(s) | Confidence |
|------------|---------------------|------------|
| PCI DSS | dep:stripe | High |
| HIPAA | dep:hipaa-* + copy:"covered entity" | Medium |
| ... | ... | ... |

## Third-party data transfer concerns
| Service | Data exposed | Concern |
|---------|--------------|---------|
| Sentry | user IPs, browser fingerprints | GDPR Schrems II |
| ... | ... | ... |
```

### 0b-ii — Founder jurisdiction prompt (conditional, interactive only)

**Run if:** `fleet/registry.yaml` for this repo has no `jurisdictions:` field AND the run is interactive (not autopilot).

**Skip if:** `jurisdictions:` is recorded OR the run is non-interactive.

If running, surface this prompt:

```
We detected these jurisdiction signals from your repo:
- [list from 0b-i]

Which of these apply to your product? Are there jurisdictions we missed?

Examples of jurisdictions to consider:
- Where do your customers live? (US states, EU, Canada, Brazil, India, Asia-Pacific...)
- Is your product B2B? Then where do your customers' end-users live?
- Are you in a regulated industry? (healthcare → HIPAA; finance → PCI/SOX; education → FERPA; consumer apps with kids → COPPA)
```

Capture founder response to `phase-0b/founder-jurisdictions.yaml`:
```yaml
jurisdictions:
  - name: GDPR
    scope: "EU customers + EU end-users of B2B clients"
    founder_confidence: high
  - name: CCPA
    scope: "California residents"
    founder_confidence: high
  # ...
out_of_scope:
  - name: HIPAA
    reason: "We don't process PHI; not a covered entity"
considered_but_unclear:
  - name: PIPEDA
    reason: "Have Canadian users but unsure if our processing volume triggers it"
```

If non-interactive: write `phase-0b/founder-jurisdictions.yaml` with `mode: engine_inferred_only` and the detection signals from 0b-i. Synthesis must surface this explicitly: "Engine-inferred jurisdictions only — founder must confirm before promoting."

### 0b-iii — Privacy policy draft

Skip if `docs/compliance/privacy-policy.md` exists as non-draft.

Dispatch the **legal-guardian** persona as an agent with this mandate:

> **Mandate:** Draft a privacy policy skeleton for the jurisdictions in `phase-0b/founder-jurisdictions.yaml`. Use the template at `kit/templates/compliance/privacy-policy-template.md` (or `.cwos/templates/compliance/...` in adopted repos).
>
> **Coverage:** for each in-scope jurisdiction, populate sections:
>   - Data collection: what is collected (cite repo evidence — code paths that capture user data, dependency declarations that imply data-collection)
>   - Processing purposes: what each category is used for
>   - Retention: how long data is held + when deleted (cite TTL configuration if found, or mark as "founder must specify")
>   - Sharing: third-parties that receive user data (from dependency analysis — Sentry, Datadog, Stripe, etc.)
>   - User rights: jurisdiction-specific rights (GDPR Art. 15-22; CCPA right to know / delete / opt-out; etc.)
>   - Contact info: placeholder for founder
>
> **Confidence calibration per section:** High = repo evidence + jurisdiction-specific language verified; Medium = inferred from archetype + dependencies; Low = generic template needing founder review.
>
> **Each claim cites repo evidence** (file:line, dependency name, or "engine-inferred from archetype = X"). No claims without citation.
>
> **Anti-boilerplate rule:** if a section has no repo-specific evidence, do NOT pad with generic template text. Mark the section as "needs founder input" with explicit review notes.

Save to `docs/compliance/privacy-policy.draft.md`.

### 0b-iv — Consent flows draft

Skip if `docs/compliance/consent-flows.md` exists as non-draft.

Dispatch **legal-guardian** again with:

> **Mandate:** Draft a consent-flows artifact for the jurisdictions in `phase-0b/founder-jurisdictions.yaml`. Use the template at `kit/templates/compliance/consent-flows-template.md`.
>
> **For each consent type required by the jurisdiction set,** produce a row:
>   - Consent name (e.g., "Cookie consent — analytics", "Marketing email opt-in", "Terms of Service acceptance")
>   - Triggering jurisdiction(s)
>   - When triggered (page / action / lifecycle event — cite repo code paths if a flow exists)
>   - Wording template (compliant for the most strict applicable jurisdiction)
>   - Withdrawal mechanism (UI path + technical effect — what happens when consent is withdrawn)
>   - Audit-log requirement (what must be recorded — timestamp, user_id, consent_version, IP, etc.)
>   - Code reference (existing implementation if found, "to be built" otherwise)
>
> **Cross-reference with privacy-policy draft** — every consent flow must align with what privacy-policy.draft.md says about that data category. Flag inconsistencies.
>
> **Confidence calibration + evidence-citation rules:** same as 0b-iii.

Save to `docs/compliance/consent-flows.draft.md`.

### 0b-v — Applicable regulations draft

Skip if `docs/compliance/applicable-regulations.md` exists as non-draft.

Dispatch the **architect** persona with:

> **Mandate:** Draft an applicable-regulations artifact for the regulations identified in `phase-0b/regulation-signals.md` + `phase-0b/founder-jurisdictions.yaml`. Use the template at `kit/templates/compliance/applicable-regulations-template.md`.
>
> **For each regulation:**
>   - Name + jurisdiction
>   - Applicability rationale (why this regulation applies — cite the trigger from regulation-signals.md)
>   - Load-bearing requirements as **code-level checkpoints**, not generic legal language. Each requirement formatted as:
>     ```yaml
>     - requirement_id: GDPR-Art-17
>       summary: "Right to erasure — users can request deletion of all their data"
>       enforced_by:
>         - file: api/users/delete.py
>           lines: "12-87"
>           note: "DELETE /api/users/<id> endpoint with cascade-delete to associated records"
>           status: implemented   # or: missing | partial | needs_verification
>       founder_review_notes: "Cascade currently deletes auth + profile; verify it also deletes uploaded media in object store"
>     ```
>   - For requirements with no enforced_by code path, mark `status: missing` and produce a "founder must implement" review note.
>
> **Confidence calibration + evidence-citation rules:** same as 0b-iii.
>
> **Anti-boilerplate rule:** every requirement is either (a) tied to specific code via `enforced_by` OR (b) explicitly marked as `missing` with a founder note. No middle ground of generic legal text.

Save to `docs/compliance/applicable-regulations.draft.md`.

### 0b-vi — Cross-check (false-positive sweep)

Dispatch **legal-guardian** a third time with this mandate:

> **Mandate:** Read all three drafts (`docs/compliance/*.draft.md`). Your job is to flag clauses that are NOT actually load-bearing for the founder's repo:
>
>   1. **Generic legal boilerplate** dressed up as jurisdiction-specific (e.g., "We respect your privacy" — not load-bearing). Down-rate or remove.
>   2. **Regulations named without code-level checkpoints** in applicable-regulations.draft.md. If the regulation cannot be tied to even one specific enforcement mechanism (existing or to-be-built), the founder is unlikely to be able to track compliance against it. Recommend either (a) adding a missing-enforcement work item, or (b) removing the regulation if it doesn't actually apply.
>   3. **Consent flow wording that wouldn't survive legal review.** Specifically: language that's too generic ("We use cookies") instead of jurisdiction-specific ("We use cookies for analytics — your data may be transferred to the United States. Click here to consent."). Flag for rewrite.
>   4. **Cross-document contradictions.** Privacy policy says X, consent flow implements Y, regulations say Z — must align. Surface any disagreement.
>   5. **Veto-flag opportunities.** If anything in the drafts triggers your veto authority (per the legal-guardian persona definition), flag it for founder attention before promotion.
>
> **Output: a YAML diff against the three drafts:**
> ```yaml
> alterations:
>   - artifact: privacy-policy
>     section: "Data sharing"
>     action: "rewrite" | "remove" | "downgrade_confidence" | "veto_promotion"
>     reason: "..."
>     replacement: "<only if action == rewrite>"
> ```

Save to `phase-0b/cross-check.yaml`. Apply the alterations to produce `phase-0b/final-drafts/{privacy-policy,consent-flows,applicable-regulations}.md`. Copy the finals over `docs/compliance/*.draft.md` (preserving the `.draft.md` suffix — never promote).

### 0b-vii — Write DRAFTS.md

Append a `## Compliance` section to the repo-root `DRAFTS.md` (using the structure defined in `kit/templates/domain/DRAFTS-template.md`). Three artifact entries: privacy-policy, consent-flows, applicable-regulations. Each entry includes path, generated-at, run_id, one-line summary, promotion command, link to the per-draft promotion checklist.

If `DRAFTS.md` already has a `## Compliance` section from a prior run, REPLACE it with the new content. Do NOT remove other engines' sections (e.g., `## Domain Specification` from domain-audit).

### 0b-viii — Phase 0b reporting

In Phase 3 synthesis, include:

```
### Draft Artifacts Generated (Phase 0b)
- privacy-policy.draft.md: <N sections, M jurisdiction-specific>
- consent-flows.draft.md: <N consent flows across J jurisdictions>
- applicable-regulations.draft.md: <N regulations, M with code-level enforcement, P marked missing>
- Confidence breakdown: <high/medium/low counts>
- Founder jurisdictions input: <yes (interactive) | no (engine-inferred — must confirm before promotion)>

Review them with: cat docs/compliance/*.draft.md
Then: cat DRAFTS.md  # for promotion instructions

Promote with (per artifact, after review):
  mv docs/compliance/<name>.draft.md docs/compliance/<name>.md
```

If all three sub-steps skipped (everything already promoted): "Phase 0b: skipped (all 3 compliance artifacts present as non-drafts)."

---

## PHASE 1 — COMPLIANCE DRIFT SCAN

**Skip if Phase 0b just generated drafts** (no promoted set to drift against). Move to Phase 6 with: "Skipped — drafts pending founder promotion."

If at least one promoted artifact exists, dispatch **architect** with:

> Read the promoted compliance artifacts (whichever exist as non-draft). For each enforced_by entry in applicable-regulations.md, walk the code path:
>   1. **Implementation present:** does the cited file:line still implement the requirement?
>   2. **Implementation correct:** does the code do what the regulation says, or does it do something subtly different?
>   3. **Drift since last verified:** has the cited source file changed since the artifact's `last_verified` date? Run `git log --since=<date> -- <file>`.
>   4. **Test coverage:** is there a test that would catch a regression?
>
> For each requirement: emit `aligned`, `drift_suspected`, `unimplemented`, `untested`. Cite evidence.

Save to `phase-1/regulation-drift.yaml`.

---

## PHASE 1b — STRUCTURAL BLINDSPOT SWEEP

Run only if at least one promoted artifact exists. Five checks:

### Check 1 — Regulations with no code (unimplemented)
For each `enforced_by.status: missing` entry: emit finding tagged `blindspot: true, blindspot_type: unimplemented_regulation`.

### Check 2 — Code that looks compliance-relevant but isn't in the spec
Scan for code paths matching `**/privacy*`, `**/consent*`, `**/gdpr*`, `**/legal*`, plus dependency manifest hits from 0b-i. For each that has no entry in promoted applicable-regulations.md: emit finding tagged `blindspot: true, blindspot_type: undocumented_compliance_code`.

### Check 3 — Consent flows without audit logging
For each consent in promoted consent-flows.md: verify code reference (if implemented) emits to an audit log. If not: emit finding tagged `blindspot: true, blindspot_type: unaudited_consent_flow`.

### Check 4 — Stale `last_verified` dates
For each artifact with `last_verified` older than 90 days: emit finding tagged `blindspot: true, blindspot_type: stale_compliance_verification`.

### Check 5 — Cross-document drift
Re-run the cross-check from 0b-vi against promoted artifacts (not drafts). Any inconsistencies emit findings tagged `blindspot: true, blindspot_type: compliance_artifact_drift`.

Blindspot findings bypass the per-run `finding_cap`. Honor `waived_blindspots` per `prog-compliance.yaml` (require `review_at`; no indefinite waivers).

---

## PHASE 2 — CROSS-CRITIQUE

Dispatch **cross-critic** with the standard adversarial block from `engines/standard/eng-engine.md` § Cross-Critique, plus compliance-specific adjustments:

> 1. **Wrongness audit:** check whether legal-guardian's cited file:line actually implements the regulation, or whether name similarity tricked it. Compliance-shaped function names ("validateGDPR", "checkConsent") may not be the actual enforcement.
> 2. **Missing dimension:** what regulatory area did neither legal-guardian nor architect surface? Common misses: cross-jurisdiction conflicts (GDPR delete vs SOX retention), data-residency vs cross-border-transfer (Schrems II), accessibility (WCAG / ADA), record-retention timing across jurisdictions.
> 3. **Severity recalibration:** an unimplemented GDPR Art. 17 in a phase-foundation repo is medium; the same in a phase-launch repo with EU users is critical.
> 4. **Shared blind spot:** what assumption do all personas share? (e.g., assuming the founder-named jurisdiction set is complete; assuming each jurisdiction's regulations are stable since training-cutoff.)
> 5. **Constitutional check:** read `system/intention.md` Failed States #3 and #10. Flag any finding whose remediation would push the system toward those states (e.g., compliance theatre that adds tracking without actual user benefit).

Save to `phase-2/cross-critique.md`.

---

## PHASE 3 — SYNTHESIS

Dispatch **facilitator** with this mandate:

> You have:
> - Phase 0b draft artifacts + cross-check results (if 0b ran)
> - Phase 1 regulation-drift findings (if promoted set exists)
> - Phase 1b blindspot findings (if promoted set exists)
> - Phase 2 cross-critique
>
> Produce a synthesis with:
>
> **Header**
> ```
> COMPLIANCE AUDIT — [repo name], [date]
> Compliance status: [DRAFTS generated | PROMOTED — Nregs / Mverified / Pmissing | NO ARTIFACTS and Phase 0b SKIPPED]
> Jurisdictions: [list, with flag if engine-inferred-only]
> ```
>
> **Phase 0b summary** (if 0b ran)
> Drafts generated counts + confidence breakdown + jurisdiction-input mode + path to drafts.
>
> **Drift summary** (if Phase 1 ran)
> Regulations with implementation drift, missing enforcement, untested.
>
> **Top findings** (top 5 by severity × phase-relevance)
> One line per finding with concrete file:line citation.
>
> **Constitutional risks** (from Phase 2)
> Compliance-theatre flags or any finding pushing toward Failed State #3/#10.
>
> **Convergence path** — what 1-3 concrete actions close the highest-leverage gap.
>
> **Open questions for the founder** — jurisdiction confirmation, ambiguity in regulation applicability, etc.

Save to `phase-3/synthesis.md`.

---

## PHASE 4 — FINDING GENERATION

Standard promotion criteria (per domain-audit Phase 4):
- Critical / high → always promote
- Medium → promote if program is at maturity 1-2, OR if it blocks convergence-path
- Low → aggregate

`prog-compliance.yaml` `accountability.on_finding.max_open_items` is 3 (lower than domain-correctness). Respect the cap; blindspot-tagged findings bypass.

**Phase-0b-pending special case:** if Phase 0b just generated drafts and Phase 1+ skipped, emit a single informational finding: "Compliance drafts pending founder promotion at `docs/compliance/*.draft.md`. After promotion, re-run `/pulse run compliance baseline` to engage drift and blindspot checks." Not tagged blindspot.

**Finding format:** standard FIND-*.yaml schema. `program: compliance`. Each finding includes `regulation_id` and `jurisdiction` when applicable.

---

## PHASE 5 — BACKLOG PROMOTION

For each finding in Phase 4, create a corresponding WS-*.yaml:
- `program: compliance`
- `capability: governance`
- Priority floor: 27 (per prog-compliance.yaml)
- `accept_criteria` concrete and verifiable: "GDPR Art. 17 enforced by DELETE /api/users/<id> with cascade to <list>; verified by test:<name>" — never aspirational.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

**Convergence-thread header (mandatory):** first line of `description`:
```
_Convergence: <e.g., "closes drift on GDPR Art. 17 enforcement" | "blindspot — undocumented compliance code in src/billing/" | "Phase 0b drafts pending founder promotion">_
```

Update `.claude/workstream/queue-index.yaml` and `findings-index.yaml`.

---

## PHASE 6 — METADATA UPDATE & BRIEFING

Update `prog-compliance.yaml` (METADATA FIELDS ONLY — see Invariant #2):
- `last_run_by_protocol.<protocol>.{date, engine, run_id, result}` for the running protocol
- `health_score` and `health_breakdown` per `kit/templates/system/health-scoring.md`
- `findings_open` / `work_items_open` / `evidence.protocol_history` += this run
- `evidence.last_audit_report` → `phase-3/synthesis.md`
- `updated_at` → today

Present the synthesis (terse format):

```
COMPLIANCE AUDIT — [repo name], [date]
Status: [status] | Jurisdictions: [count] [(*founder-confirmed | engine-inferred)]

[1-2 sentence headline]

Drafts generated: [count or "none — promoted set exists"]
Top findings: [count] ([critical/high/medium breakdown])
Open questions: [count]

Full report: .claude/workstream/evidence/compliance/[run-id]/phase-3/synthesis.md
DRAFTS manifest: DRAFTS.md
```

---

## OUTPUT ARTIFACTS

All under `.claude/workstream/evidence/compliance/[run-id]/`:

- `phase-0/` — context notes (repo type, archetype, declared customer base, deps inventory)
- `phase-0b/` — regulation-signals.md, founder-jurisdictions.yaml, cross-check.yaml, final-drafts/ (only when 0b ran)
- `phase-1/regulation-drift.yaml` — per-requirement drift status (only when promoted set exists)
- `phase-1b/blindspots.yaml` — structural gaps (only when promoted set exists)
- `phase-2/cross-critique.md`
- `phase-3/synthesis.md`
- `findings-promoted.yaml` — list of FIND-* created
- `work-items-promoted.yaml` — list of WS-* created

Plus, when Phase 0b runs:
- `docs/compliance/privacy-policy.draft.md` (unless promoted version exists)
- `docs/compliance/consent-flows.draft.md` (unless promoted version exists)
- `docs/compliance/applicable-regulations.draft.md` (unless promoted version exists)
- `DRAFTS.md` (at repo root; appended `## Compliance` section, replacing prior compliance section if present)

---

## INVARIANTS (recap — these trip during runs, not just at design time)

- Never write to `docs/compliance/<artifact>.md` (non-draft). Founder-promoted only.
- Never write to `prog-compliance.yaml` content fields. Metadata only (Phase 6 list).
- Never silently auto-promote a draft.
- Never emit a Low-confidence section without explicit `review_notes`.
- Never name a regulation in applicable-regulations without either an `enforced_by` code path OR `status: missing` + founder note. No middle-ground generic text.
- Per-artifact Phase 0b skip is independent: if privacy-policy.md is promoted but consent-flows.md is still a draft, sub-step 0b-iii skips and 0b-iv runs.
- Compliance is the only generative-phase program with a mandatory founder-jurisdiction input. The engine MUST surface 0b-ii in interactive runs unless `fleet/registry.yaml` records jurisdictions for this repo.

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
