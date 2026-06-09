---
name: design-audit
description: "Score a repo on four UX surfaces independently (end-user, operator, builder, AI-conversation). Emits per-surface maturity, gap list, and convergence path. Findings auto-promote."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: design-audit` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Design Audit Engine

You are auditing a repo against the four-surface UX design rubric defined in `docs/programs/design.md` and `ADR-017`. This is not a general UX review — it is a scorecard with clear rubric levels per surface, and the output is a maturity assessment plus a convergence path toward the next level on each surface.

## Input

$ARGUMENTS — a repo path (absolute) or "current" to audit the current repo. Optionally a second argument: path to a previous scorecard to diff against for trend.

If no argument given: audit the current repo and compare to the most recent scorecard in `.claude/workstream/evidence/design/` if one exists.

---

## PHASE 0 — GATHER CONTEXT

1. Read `docs/programs/design.md` — the rubric definition
2. Read `docs/adrs/ADR-017.md` — the design decisions behind the rubric
3. Read the repo's `CLAUDE.md` — repo purpose, phase, constraints
4. Read the repo's `system/state.md` — current state
5. Read the repo's `system/context.md` — active concerns
6. Scan the repo's top-level layout: `ls` at the root, plus `docs/`, `src/` (or equivalent)
7. If a previous scorecard exists, read it for trend comparison

Record: repo type (from fleet registry if present; otherwise detect), approximate scale (LoC range, file count), and whether the repo has a frontend at all. **The absence of a frontend does NOT exempt end-user surface scoring** — for CLI tools, the end-user surface is output shape + documentation.

**Archetype detection** — identify which archetype supplements apply (per `docs/programs/design.md` archetype supplements section):
- SaaS: applies SaaS end-user supplement (API docs, error catalog)
- data-platform: applies data-platform operator supplement (freshness, source attribution, evidence tiers)
- research: applies research operator supplement (hallucination, assumption provenance, falsification) AND research end-user supplement (claim traceability, citation discipline)
- api-service / dev-tool (CLI/library): applies CLI/library end-user supplement (output format, error taxonomy) AND library builder supplement (public API surface, versioning)
- frontend: no supplements beyond core rubric

Also read project phase from repo's `system/state.md` if present. Phase informs convergence-path urgency (per spec), not scoring.

---

## PHASE 0b — GENERATIVE INFERENCE (conditional, runs before Phase 1)

**When to run:** if `design/personas/` is empty / contains only stubs / contains only .draft files AND/OR `design/features/` is empty AND/OR `design/journeys.md` does not exist. Skip sub-steps whose slot is already populated with non-draft content.

**Why:** per `feedback_no_silent_install_no_user_invention.md`, a non-technical founder cannot invent personas, journeys, and FDBs from scratch. The engine generates initial drafts from repo context; the founder reviews and promotes, rather than starting from empty files.

**Do not overwrite non-draft artifacts.** If `design/personas/<slug>.md` exists as a promoted (non-.draft) file, leave it. Generation only fills empty slots.

### 0b-i — Personas (when design/personas/ needs drafts)

Dispatch the **product-ux-engineer** persona as an agent with this mandate:

> Read the repo's CLAUDE.md, README.md, docs/PRODUCT.md (if present), and scan end-user-facing surfaces (public API routes, CLI entry points, user-facing templates/pages, published documentation).
>
> Infer 1-3 primary user personas. For each persona output:
> - Name (use a representative archetype name like "Founder-Adopter" or "Borrower-Dave", not a real person)
> - Role / context
> - Primary job they hire the product to do
> - Environment they work in (tools, constraints, time pressure)
> - What success looks like from their perspective
>
> Evidence: cite specific code paths, docs, or API endpoints that supported each inference. No inventing users who aren't reachable from the repo surface.
>
> If the repo is deeply internal (library, research repo with no outward users), name that explicitly and skip outward-persona generation — the founder becomes the sole inferred persona.

Write results to `design/personas/<slug>.draft.md` — one file per persona. Use the persona template from `kit/templates/design/artifact-framework/` (create `design/templates/persona-template.md` first if it doesn't exist).

### 0b-ii — Primary Journeys (when design/journeys.md absent)

Based on the Phase 0b-i personas, dispatch **product-ux-engineer** again with:

> For each persona from 0b-i, name their 2-3 most-hired journeys (end-to-end workflows). Cite the specific code paths / command surfaces / pages that implement each.

Write results to `design/journeys.draft.md` — a single file with a journey per section.

### 0b-iii — FDB Drafts (when design/features/ needs drafts)

Detect load-bearing features: code paths that are named (have their own directory or prominent file), have tests (test file exists near them), AND are referenced from docs (README, CLAUDE.md, or docs/).

Dispatch **architect** persona (core) with:

> Given this feature list with evidence, draft a Feature Design Brief per feature using the FDB template at `design/templates/FDB-template.md` (or `kit/templates/design/artifact-framework/FDB-template.md`).
>
> Fill only what you can infer: persona affected (from 0b-i), primary job, scenarios (happy path + 1-2 failure modes), code refs (the detected paths), related UXIs (leave empty — the founder fills these in), DDRs (list related ADRs from docs/adrs/ if any match).
>
> Status: Draft. Traceability status: aligned (initial state).

Write results to `design/features/FDB-NNN-<slug>.draft.md` — increment from existing FDB numbers.

### 0b-iv — Drafts Manifest

After generation, write `design/DRAFTS.md` summarizing:
- How many drafts were generated of each type
- Which repo evidence informed each
- How to promote a draft (rename `.draft.md` → `.md` and verify content)
- What the founder should review vs. accept as-is

This file persists until the founder removes it; it's the landing page after the engine runs with fresh drafts.

### 0b-v — Phase 0b reporting

In the final Phase 3 synthesis, include a section:

```
### Draft Artifacts Generated (Phase 0b)
- Personas: <count> draft files written to design/personas/
- Journeys: <count> journeys drafted in design/journeys.draft.md
- FDBs: <count> draft briefs written to design/features/

Review them with: cat design/DRAFTS.md
Promote a draft with: mv design/personas/<slug>.draft.md design/personas/<slug>.md
```

---

## PHASE 1 — SURFACE-SPECIFIC DEEP SCAN (4 PARALLEL AGENTS)

Launch four agents in parallel, one per surface. Each agent scores ONLY its assigned surface against the `docs/programs/design.md` rubric. They do not coordinate; independence is the point.

### Agent 1: End-User Surface
Dispatch the **product-ux-engineer** persona as an agent with this mandate:

> Score the end-user surface against the `prog-design` L1-L5 rubric in `docs/programs/design.md`. Focus on: design tokens, component architecture, accessibility markers, end-user task flows, error/empty/loading states, information hierarchy.
>
> **Apply archetype supplements** from the spec based on the detected archetype (SaaS: API docs + error catalog; research: claim traceability + citation discipline; CLI/library: output format + error taxonomy).
>
> **L0 vs L1 distinction:** L1 requires the artifact to *function minimally*, not just exist. A one-line CLAUDE.md or boilerplate state.md is L0, not L1.
>
> **L3 vs L4 framework distinction:** docs-only design framework is acceptable at L3. L4 requires the framework to be load-bearing in code (referenced by implementation, enforced in verification, traceable from code to design docs).
>
> Evidence must be concrete: file paths, component names, token definitions, aria usage. If the repo has no traditional frontend, evaluate end-user output shape and documentation as the end-user surface.
>
> Output: score (L0-L5) with confidence (high/medium/low), per-criterion evidence, top 3 gaps with remedies, what's working. Flag low confidence if rubric didn't cleanly discriminate.

### Agent 2: Operator Surface
Dispatch the **operator-experience-designer** persona as an agent with the mandate defined in its persona file. Same rubric in `docs/programs/design.md`.

> **Apply archetype supplements:** data-platform (freshness, source attribution, evidence tiers, suppression rules) or research (hallucination tracking, assumption provenance, falsification criteria, multi-path verification).
>
> **L0 vs L1:** L1 requires the manual view to actually be used, not just exist. A `state.md` file that is boilerplate and unread is L0.
>
> Flag low confidence if the rubric feels SaaS-biased for the repo archetype. Low confidence triggers a rubric-improvement item, not a finding against this repo.

### Agent 3: Builder Surface
Dispatch the **developer-experience-designer** persona as an agent with the mandate defined in its persona file.

> **Apply library supplement** if archetype is library/api-service: public API surface enumerated, versioning documented, deprecation policy.

### Agent 4: AI-Conversation Surface
Dispatch the **ai-interaction-designer** persona as an agent with the mandate defined in its persona file.

> **L4 specifically requires:** coverage audit (every program, every open finding, every staleness signal reachable via commands) AND fidelity check (surfaced signals match source of truth — no stale cache, no drift from underlying state).

Wait for all four to complete before proceeding. Record each agent's scorecard.

---

## PHASE 1b — STRUCTURAL BLINDSPOT SWEEP

**Principle:** per `feedback_no_silent_install_no_user_invention.md`, "a perfectly-running system does not allow blindspot gaps to exist if run the way the system is meant to run." Phase 1b enforces this structurally — the engine detects blindspots, they don't require founder initiative.

Run these five detection checks in sequence. Each produces zero or more findings tagged `blindspot: true`. Blindspot findings **bypass the 8-item cap** on `prog-design` (capping structural gaps would defeat the point — they accumulate honestly until fixed or waived).

### Check 1 — Missing FDBs for detected features

Detection: load-bearing feature paths without a corresponding FDB.

Load-bearing feature heuristic:
- Code path is named (has its own directory or prominent file)
- Has tests (test file exists near it) OR is referenced from docs
- Is non-trivial (>100 LOC or >3 files)

For each load-bearing feature with no matching FDB in `design/features/`:
- Emit finding: "Feature `<path>` has no FDB. <N> LOC / <M> tests / <K> doc references detected. Suggested FDB slug: `FDB-NNN-<slug>`."
- Tag: `blindspot: true, blindspot_type: missing_fdb`

### Check 2 — Placeholder or missing personas

Detection: `design/personas/` empty OR contains only `.draft` files OR contains files whose content is <50 words (likely template placeholder).

If any: emit one finding per missing/placeholder persona slot.
- Tag: `blindspot: true, blindspot_type: placeholder_persona`
- Recommend: run design-audit (Phase 0b-i will regenerate drafts from repo context).

### Check 3 — Undefined journeys

Detection: `design/journeys.md` does not exist (or only the draft version exists and has not been promoted).

If absent: emit one finding.
- Tag: `blindspot: true, blindspot_type: undefined_journeys`
- Recommend: run design-audit (Phase 0b-ii will regenerate).

### Check 4 — Unaudited or stale surfaces

Detection: per-surface scorecard level is null (never audited) OR last_run older than 30 days.

For each surface with null or stale score:
- Emit finding.
- Tag: `blindspot: true, blindspot_type: unaudited_surface, surface: <name>`

### Check 5 — UXI referenced but not enforced

Detection: grep for `UXI-\d+` references across `design/`, `docs/`, `kit/commands/`, and code. For each UXI found:
- Verify it exists in `design/invariants.md` OR `system/invariants.md`
- Verify its enforcement status: either `enforced_by: <check>` is set OR status is `unenforced` with a tracking work item

For each UXI referenced but not backed by an invariants entry, OR referenced + unenforced without a tracking item:
- Emit finding per UXI.
- Tag: `blindspot: true, blindspot_type: unenforced_invariant, uxi: UXI-NNN`

### Check 6 — Traceability drift

Detection: read `design/traceability.yaml`. For each FDB with `status: aligned`:
- Walk each `code_refs` path
- Check git log: has this file been modified since the FDB's `last_verified` date?
- If yes, the FDB is in potential drift.

For each FDB with potential drift:
- Emit finding: "FDB-NNN `<title>` last verified <date>, but `<file>` has been modified <N> times since. Verify alignment or update traceability."
- Tag: `blindspot: true, blindspot_type: traceability_drift, fdb: FDB-NNN`

### Waivers

If a blindspot cannot be closed (e.g., FDB is intentionally deferred, UXI is aspirational and not yet enforceable), the founder can waive it by adding to `prog-design.yaml`:

```yaml
waived_blindspots:
  - finding_id: FIND-NNN
    reason: "UXI-015 is aspirational until meta-audit infrastructure lands in v4"
    waived_at: "2026-04-22"
    review_at: "2026-10-22"  # required; no indefinite waivers
```

Waivers without `review_at` are rejected. Waivers past `review_at` are re-surfaced as active findings.

### Phase 1b output

In Phase 3 synthesis, include a dedicated **Blindspots** block:

```
### Blindspots (Phase 1b)

<if zero blindspots:>
✓ No structural blindspots detected.

<if blindspots exist:>
<N> blindspots detected (not capped — structural findings bypass the 8-item limit):
- Missing FDBs: <count>
- Placeholder personas: <count>
- Undefined journeys: <count>
- Unaudited surfaces: <count>
- Unenforced invariants: <count>
- Traceability drift: <count>

<M> waived (review dates: <dates>). <K> waivers past review — re-surfaced as active.
```

---

## PHASE 2 — CROSS-SURFACE BOUNDARY CRITIQUE

Launch the **cross-critic** persona as an agent with this mandate:

> You have four surface scorecards from Phase 1. Your job is to look at the *boundaries* between surfaces — the gaps that no single surface audit will catch because they span two surfaces.
>
> For each adjacent pair, answer:
>
> 1. **End-user ↔ Operator:** Is the operator dashboard grounded in the same data model the end-user sees? Are there operator-only views that contradict the end-user experience? Does the founder have a way to reproduce what their users see?
>
> 2. **Builder ↔ AI-conversation:** Does the builder surface (docs, commands) shape the AI-conversation surface (preambles, response surfaces) consistently? Is there a mismatch — e.g., commands exist but CLAUDE.md doesn't reference them, or CLAUDE.md promises state visibility that no command actually surfaces?
>
> 3. **End-user ↔ AI-conversation:** Does what Claude says about the product match what the product says about itself? (Terminology, feature names, intended flows.)
>
> 4. **Operator ↔ Builder:** Can the founder, in their builder role, maintain and extend the operator surfaces (dashboards, alerts)? Or are the operator tools brittle one-offs that rot over time?
>
> Flag any boundary gap with: which surfaces are involved, what's the concrete symptom, severity (critical/high/medium/low), and suggested remedy.

---

## PHASE 3 — SYNTHESIS

Launch the **facilitator** persona as an agent with this mandate:

> You have four surface scorecards and a boundary critique. Synthesize into a single design-audit report with this structure:
>
> **Scorecard**
> ```
> Surface          | Level | Confidence | Trend (vs. last)
> End-user         | L[_]  | [h/m/l]    | [up/flat/down/new]
> Operator         | L[_]  | [h/m/l]    | [up/flat/down/new]
> Builder          | L[_]  | [h/m/l]    | [up/flat/down/new]
> AI-conversation  | L[_]  | [h/m/l]    | [up/flat/down/new]
> ```
> Composite advisory: `E[_] O[_] B[_] A[_]` (NOT averaged — minimum across surfaces).
>
> **Asymmetry highlights** — MANDATORY when spread ≥2 levels
> - Lead synthesis with the asymmetry.
> - Explain what it means for this repo (e.g., "Operator surface at L4 with End-user at L1 suggests the product is well-instrumented but under-designed for users — founder attention is on metrics, not the product itself").
> - **Emit MAINTENANCE DEBT callout** — two disparate design systems or maturity profiles have real maintenance cost. This is not a finding (not auto-promoted to queue); it is a risk flag for founder awareness. Specify the cost concretely ("Maintaining shadcn/ui + Django template CSS in parallel").
>
> **Phase-aware convergence urgency** — read project phase from `system/state.md`. Convergence-path urgency scales by phase per spec (foundation: expected low; pre-launch: operator urgent; launch: all urgent; etc.). Note which surface's gap is the most urgent given phase, not just lowest score.
>
> **Per-surface detail** (for each surface):
> - Level + one-sentence justification
> - Evidence (2-3 concrete references)
> - Top gap and recommended remedy
>
> **Boundary gaps** (from Phase 2): list each with severity.
>
> **Convergence path**: for the lowest-scoring surface, what three concrete changes would raise it one level? Each change should cite specific files, commands, or artifacts.
>
> **Open questions** (for founder): any ambiguity where the rubric can't answer without founder input (e.g., "is the Slack digest the notification surface, or is that something to build?").

---

## PHASE 4 — FINDING GENERATION

For each gap identified in Phase 1-3 that meets promotion criteria, generate a finding file.

**Promotion criteria:**
- Severity is high or critical → always promote
- Severity is medium AND on a surface currently at L1 or L2 → promote (we're bootstrapping this surface)
- Severity is medium on a surface at L3+ → promote only if it blocks the convergence-path recommendation
- Severity is low → aggregate into a single "polish pass" finding at most

**Low-confidence handling** — if a surface scored with LOW confidence because the rubric didn't discriminate cleanly, do NOT promote that surface's gaps as findings against the audited repo. Instead, generate a single **rubric-improvement item** scoped to HomeBase (`program: product-evolution`, not `program: design`) describing the rubric friction. This keeps adopted repos from being penalized for rubric immaturity.

**Respect the program finding cap:** `prog-design` allows max 8 open work items. If the program already has open items near this cap, note that in the output and only promote the highest-severity new gaps.

**Finding format:** one file per finding in `.claude/workstream/findings/`, following the existing FIND-*.yaml schema. Link each finding to `program: design` and tag with `surface: [end-user|operator|builder|ai-conversation]`.

---

## PHASE 5 — BACKLOG PROMOTION

For each finding promoted in Phase 4, create a corresponding WS-*.yaml work item in `.claude/workstream/queue/` with:
- `program: design`
- `capability: governance`
- Priority score floor: 30 (per prog-design accountability block)
- Clear `accept_criteria`: "Surface X raised from L[_] to L[_+1]" OR "Specific gap closed" — concrete, not aspirational

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

**Convergence-thread header (mandatory):** the first line of the work item `description` field is the convergence thread — a one-line statement connecting the atomic task to the surface-level arc. Template:

```
_Convergence: <context — e.g., "lifts end-user L2 → L3" OR "blocks maintenance-debt reduction" OR "blindspot sweep — missing FDB for <feature>">_
```

This header is what the founder sees in `/next` and other work-item preview surfaces. It preserves the narrative thread without requiring them to re-read synthesis.md. If the work item is promoted from a blindspot (Phase 1b), prefix with "_Convergence: blindspot — <type> — <specifics>_".

Update `.claude/workstream/queue-index.yaml` accordingly. Update `.claude/workstream/findings-index.yaml` accordingly.

---

## PHASE 6 — BRIEFING

Present the synthesis from Phase 3 to the founder. Format:

```
DESIGN AUDIT — [repo name], [date]
Composite: E[_] O[_] B[_] A[_]

[Asymmetry highlight in one sentence]

Scorecard:
[table from Phase 3]

Convergence path ([lowest-scoring surface], L[_] → L[_+1]):
1. [concrete change]
2. [concrete change]
3. [concrete change]

Findings promoted: [count] ([surface breakdown])
Questions for you: [count]

Full report: .claude/workstream/evidence/design/[run-id]/synthesis.md
```

Keep this brief block scannable. Detail goes in the evidence directory.

---

## OUTPUT ARTIFACTS

All artifacts write to `.claude/workstream/evidence/design/[run-id]/`:

- `scorecard.yaml` — machine-readable per-surface scores, trend, composite
- `synthesis.md` — the Phase 3 narrative report
- `phase-1-surfaces/` — each persona's full Phase 1 output
- `phase-2-boundary-critique.md` — cross-critic output
- `findings-promoted.yaml` — list of FIND-* created with links
- `work-items-promoted.yaml` — list of WS-* created with links

Update `prog-design.yaml`:
- `last_run_by_protocol.baseline` (or `.sweep`) → record run_id, date, engine, result summary
- `health_score` and `health_breakdown` → recompute based on per-surface scores and finding count
- `findings_open` / `work_items_open` → bump by Phase 4/5 counts
- `updated_at` → today

---

## INVARIANTS

- Never produce a composite score that hides per-surface asymmetry. The composite is always expressed as the per-surface string (`E_ O_ B_ A_`), not a single number.
- Never exempt a repo from any surface. CLI tools have end-user surfaces (output + docs); libraries have operator surfaces (how the consumer monitors them); every repo has AI-conversation surface the moment Claude is used.
- Never propose remediation as part of this engine's output. The engine scores and surfaces; remediation is opt-in via queue items the founder approves through `/next`.
- Never auto-remediate during fleet propagation. Installation of the program is mandatory; remediation is the adopter's choice.

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
