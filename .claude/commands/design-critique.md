---
name: design-critique
description: "Pressure-test an architectural design BEFORE implementation. Per-primitive worksheet (load-bearing assumption / ceiling / alternative / rationale / falsification test). Tiered depth. Greenlight or amendment list."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: design-critique` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Design Pressure-Test Engine

You are pressure-testing an architectural design **before any code is written against it**. The premise: every architectural primitive has a load-bearing assumption, an effectiveness ceiling, and at least one alternative. The job of this engine is to expose that surface area — so the founder can either greenlight the design with confidence or amend it before re-work is needed.

This is **not** the same as design-audit (which scores UX surfaces) or research-review (which audits research claims). This engine targets architectural decisions: ADRs, system specs, plan-mode outputs, or any document that proposes structural primitives the codebase will be built on.

The methodology is the labeled-assumptions discipline (`feedback_labeled_assumptions.md`): every load-bearing claim ships with an AS-N identifier and a falsification test, so a future AI evaluator can diagnose where a design failed.

## Input

`$ARGUMENTS` — a path to the design document, plus optional flags:

- **`<doc-path>`** (required): absolute or repo-relative path. Examples:
  - `docs/adrs/ADR-018.md`
  - `docs/specs/event-log-schema.md`
  - `.claude/workstream/plans/PLAN-042.md`
- **`--depth=tiered|full|sample`** (default: `tiered`)
  - `tiered`: full depth on step-1-critical primitives, tight on the rest (recommended)
  - `full`: full depth on every primitive
  - `sample`: top 4 most load-bearing only (use only when time-boxed)
- **`--blind-spots="topic1,topic2,..."`** (optional): topics that MUST be covered. Use when prior critique flagged specific gaps.
- **`--full-depth="primitive-id-1,primitive-id-2,..."`** (optional): override which primitives get full depth (otherwise inferred from doc structure).
- **`--out=<path>`** (optional): override output artifact location. Default: `docs/design-reviews/<doc-stem>-pressure-test.md`.

If no argument given, ask: "Which design document should I pressure-test? (path required)"

---

## PHASE 0 — GATHER CONTEXT

### 0a. Read the source design document

1. Read the full document at `<doc-path>`. If the file does not exist, abort and tell the user.
2. Detect the document type:
   - **ADR**: filename matches `ADR-NNN*.md` or has a "Status:" / "Decision:" header
   - **Spec**: has sections labeled "Architecture", "Primitives", "Components", or "Design"
   - **Plan**: has sections labeled "Steps", "Build Order", or "Sequencing"
   - **Other**: surface to user — ask whether to proceed and how to enumerate primitives

### 0b. Read project context

1. Read `CLAUDE.md` — project purpose, constraints, tech stack
2. Read `system/state.md` — current state, milestone, vital signs
3. Read `system/invariants.md` — rules any design must satisfy
4. Read `system/constraints.md` — boundaries the design operates within
5. Read `system/decisions.md` — prior decisions this design must respect
6. Read `docs/adrs/INDEX.md` if it exists — sibling ADRs for context

### 0c. Enumerate primitives

A **primitive** is an atomic architectural element the design proposes — a data structure, mechanism, layer, protocol, or subsystem. Examples from ADR-018: "event log format", "tracks", "composition layer", "tiered cascade", "dual representation", "four trust tiers", "JSONL-over-YAML", "hash-chain", "JSON schema validation", "Ajv runtime", "command instrumentation strategy".

Extract the primitive list from the source doc:

1. **Explicit list:** Look for "Scope", "Decision", "Architecture", "Primitives", or "Components" sections that enumerate the design's parts.
2. **Implicit list:** If no explicit list, scan the "Decision" section's numbered items, the "Scope" bullets, and the "Build order" steps for noun phrases that are introduced as architectural elements.
3. **Existing labeled assumptions:** If the source doc has a `## Labeled assumptions` table, ingest the existing AS-N IDs. Do NOT re-use these IDs for newly introduced assumptions; assign the next free AS-N for any new claim this engine surfaces.

Each primitive MUST have a stable identifier (kebab-case, e.g., `event-log-jsonl`, `composition-layer`, `tiered-cascade`). Use the doc's own naming where possible; otherwise propose one and use it consistently.

### 0d. Tier the primitives

Based on `--depth` flag:

- **tiered (default):** A primitive is `full-depth` if any of these are true:
  - Listed in the source doc's first-step / first-cut scope (e.g., ADR-018 "Step 1" scope)
  - Has zero existing alternatives explored in the source doc's "Alternatives considered"
  - Tagged for full-depth via `--full-depth` flag
  - Otherwise: `tight-depth`
- **full:** all primitives are `full-depth`
- **sample:** rank primitives by `dependents_in_doc x recency_of_introduction`, take top 4 as `full-depth`, drop the rest

### 0e. Resolve blind-spot topics

Combine three sources into a single blind-spots checklist:

1. Topics passed via `--blind-spots` flag
2. Topics named in the source doc's own "Validation evidence" or "Cross-critic" section as flagged but unresolved
3. Topics from the source doc's "Out of scope" section IF those topics could plausibly invalidate a chosen primitive (e.g., "rollback strategy out of scope" → must verify primitives still hold under rollback failure)

### 0f. Confirm the plan with the user

Before launching agents, present a one-screen plan:

```
## Design Pressure-Test Plan

**Source:** <doc-path>
**Document type:** <ADR | spec | plan | other>
**Primitives enumerated (N):**
  Full depth (N):
    - <primitive-1>
    - <primitive-2>
  Tight depth (N):
    - <primitive-3>
    - ...

**Blind-spot topics to cover (N):**
  - <topic-1>
  - <topic-2>

**Output artifact:** <out-path>
**Personas to dispatch:** architect, failure-engineer, senior-engineer, performance-engineer, security-engineer (then cross-critic, then facilitator)
**Estimated time:** ~15 min for ≤6 full-depth primitives, +5 min per 4 tight-depth primitives

Proceed?
```

If the user changes the primitive list, depth tiering, or blind-spot list, regenerate the plan and re-confirm. **Do not skip this confirmation** — the primitive list is the contract for everything downstream.

---

## PHASE 1 — DISPATCH EXPERT AGENTS (PARALLEL)

Each persona receives the full primitive list, the source doc path, the blind-spot topics, and the per-primitive worksheet template. They fill out one worksheet per primitive from their analytical lens.

### Agents

#### Agent 1: Architectural Ceilings (architect persona)

> **Task:** For each primitive in the list, fill out the per-primitive worksheet from an architectural perspective.
>
> Source doc: `<doc-path>` (read in full before starting)
> Primitives (full-depth): [...]
> Primitives (tight-depth): [...]
> Blind-spot topics: [...]
>
> For EACH primitive (full-depth: deep treatment; tight-depth: 3-4 sentences per field max):
>
> - **Load-bearing assumption (AS-N format):** What single claim, if false, would invalidate this primitive? Phrase as a falsifiable statement, not an aspiration. Assign next free AS-N (>= the highest existing in the source doc).
> - **Ceiling of effectiveness:** At what scale, complexity, or context shift does this primitive stop working? Be specific (e.g., "breaks at 10K events/day" not "doesn't scale").
> - **Strongest alternative:** Name one concrete alternative architecture or mechanism that could occupy the same role. Link to public references where applicable (papers, frameworks, prior art). If the source doc's "Alternatives considered" already names this, note that — but ALSO propose one alternative the source doc did NOT consider.
> - **Rationale for chosen over alternative:** Why does the chosen approach win FOR THIS CONTEXT? Not abstract pros/cons — context-specific reasoning.
> - **Falsification test:** What concrete observation, when, would prove the load-bearing assumption is false? Include WHEN it can be measured (during step 1? step 3? after fleet migration?).
> - **Verdict:** HOLDS | AMEND | INVESTIGATE
>   - HOLDS: assumption is sound, alternative is genuinely worse for this context
>   - AMEND: alternative is superior — recommend changing the source doc
>   - INVESTIGATE: cannot decide without more data — name the experiment
>
> For full-depth primitives: also propose ≥2 alternatives, not just one.
>
> Cover all blind-spot topics by tagging which primitive(s) address them. If a topic is unaddressed by any primitive, flag it explicitly as an unaddressed blind spot.

#### Agent 2: Failure Modes (failure-engineer persona)

> **Task:** Same worksheet, same primitives, but lens is failure modes and falsification.
>
> For each primitive, your specific contribution:
>
> - **Load-bearing assumption:** What is the single quietest failure mode of this primitive — the failure that would happen WITHOUT raising an alarm? Phrase the assumption as "this quiet failure does not occur."
> - **Ceiling of effectiveness:** When does the primitive's failure mode become catastrophic vs. recoverable? What is the blast-radius gradient?
> - **Strongest alternative:** Propose an alternative primitive that has a LOUDER, EARLIER failure mode (even if costlier in the happy path). Trading happy-path efficiency for failure-path observability is often correct for foundational primitives.
> - **Rationale for chosen over alternative:** Does the chosen primitive's silent-failure cost actually beat the alternative? When is the silent-failure window? Will it be noticed?
> - **Falsification test:** Design a chaos test or fault-injection experiment that would force the failure mode to surface. What's the minimum harness needed?
> - **Verdict:** Same as architect.
>
> Specifically for blind-spot topics: if "rollback" is on the list, verify that EVERY primitive has a documented rollback path. If "first-session artifact" is on the list, verify that any primitive that mutates state in step 1 produces a founder-readable artifact.

#### Agent 3: Implementation & Maintainability (senior-engineer persona)

> **Task:** Same worksheet, same primitives, lens is implementation viability.
>
> For each primitive, your specific contribution:
>
> - **Load-bearing assumption:** What is the implementation-complexity assumption? (e.g., "Ajv schema validation is < 5ms per event" or "JSONL append is atomic on NTFS").
> - **Ceiling of effectiveness:** When does maintaining this primitive become a tax on velocity? At what code-volume does the abstraction stop paying its complexity cost?
> - **Strongest alternative:** Propose a SIMPLER alternative that does 80% of the job at 30% of the complexity. Sometimes the right answer is a less ambitious primitive.
> - **Rationale for chosen over alternative:** Is the additional complexity actually load-bearing for downstream goals, or is it speculative future-proofing?
> - **Falsification test:** Time-box: build the smallest possible implementation of this primitive in N hours. If it takes longer, the complexity assumption is wrong.
> - **Verdict:** Same.
>
> Specifically: for any primitive that the source doc defers ("step 2", "step 3", "future ADR"), verify the deferral doesn't depend on a step-1 commitment that would be hard to reverse.

#### Agent 4: Performance & Scaling Ceilings (performance-engineer persona)

> **Task:** Same worksheet, same primitives, lens is performance and scaling.
>
> For each primitive:
>
> - **Load-bearing assumption:** What throughput, latency, or resource ceiling does this primitive's design assume?
> - **Ceiling of effectiveness:** Quantify when the primitive becomes a bottleneck. (e.g., "JSONL append works fine until log exceeds 100MB, then truncation/rotation overhead dominates")
> - **Strongest alternative:** Propose an alternative with a different scaling profile — even if it's slower in the happy case.
> - **Rationale for chosen over alternative:** Are the assumed scales realistic for the actual workload? Cite the source doc's own falsification data (e.g., ADR-018's 49 events / 30 days).
> - **Falsification test:** Synthetic load test at 10x the assumed scale. Where does it break?
> - **Verdict:** Same.

#### Agent 5: Trust Boundaries & Integrity (security-engineer persona)

> **Task:** Same worksheet, same primitives, lens is trust boundaries.
>
> For each primitive:
>
> - **Load-bearing assumption:** What trust assumption does this primitive make about its inputs, outputs, or runtime environment?
> - **Ceiling of effectiveness:** When does the trust model break? (e.g., adversarial input, compromised environment, shared filesystem with untrusted process)
> - **Strongest alternative:** Propose an alternative with a tighter trust boundary, even if more cumbersome.
> - **Rationale for chosen over alternative:** Is the looser trust model justified by context (HomeBase is single-user) or is it accidental?
> - **Falsification test:** Design an attack or unintended-input scenario that would compromise the primitive. Can integrity-checking detect it?
> - **Verdict:** Same.
>
> Specifically: for any primitive involving trust tiers, hash-chains, or authentication, verify the trust model survives the most adversarial realistic scenario for this codebase (e.g., a malformed paste from an external tool).

Launch ALL 5 agents in parallel. Wait for all to complete. Each writes to `<run_workspace>/phase-1/<agent-name>.yaml` with the full per-primitive worksheets in `output.raw_text`.

---

## PHASE 2 — CROSS-CRITIQUE

Use the **default** cross-critic prompt from the agent-dispatch procedure, plus this engine-specific extension:

> **Engine-specific cross-critique focus:**
>
> 1. **Alternative collisions:** Did multiple personas propose the SAME alternative under different names? If so, that alternative is unusually load-bearing — the source doc's failure to consider it is a red flag.
> 2. **Verdict disagreement:** For any primitive where personas split (e.g., architect says HOLDS, failure-engineer says AMEND), surface the disagreement and propose a resolution criterion (what evidence would settle it).
> 3. **Already-rejected alternatives:** Cross-check each persona's proposed alternative against the source doc's "Alternatives considered" section. If the alternative is already there and was rejected for a reason that the persona didn't address, flag the persona's analysis as weak — but ALSO consider whether the rejection rationale itself is sound.
> 4. **Falsification test rigor:** Are the falsification tests actually falsifiable? "Performance is acceptable" is not a test. "P99 < 50ms at 10K events/day" is.
> 5. **Blind-spot coverage:** For each blind-spot topic, verify at least one primitive's worksheet addresses it. Topics that no primitive addresses must be surfaced as unaddressed blind spots.
> 6. **Ceiling realism:** Are stated ceilings realistic for THIS project, or are they generic? "Doesn't scale" is generic. "Breaks for HomeBase at the projected ~50 events/week" is project-specific.

Output to `<run_workspace>/phase-2/cross-critic.yaml`.

---

## PHASE 3 — FACILITATED SYNTHESIS

The facilitator's job: per primitive, consolidate the 5 worksheets + cross-critic notes into a SINGLE worksheet with one verdict.

### Synthesis prompt

> You are synthesizing a design pressure-test. Each of 5 expert personas has filled out a per-primitive worksheet for the same primitive list, and the cross-critic has reviewed them.
>
> **Per-primitive consolidation rules:**
>
> 1. **Load-bearing assumption:** Pick the assumption with the highest dependency cost. If multiple assumptions are independent and load-bearing, list each as a separate AS-N.
> 2. **Ceiling:** Take the LOWEST realistic ceiling across personas. The ceiling is whatever breaks first.
> 3. **Strongest alternative:** Pick the single alternative most likely to outperform the chosen approach for this context, considering all 5 lenses. Cite who proposed it.
> 4. **Rationale:** Why does the chosen approach beat THIS alternative? Address the alternative's strongest argument, not a strawman.
> 5. **Falsification test:** Pick the most measurable, time-boxed test. Specify when it can run.
> 6. **Verdict:** HOLDS | AMEND | INVESTIGATE
>    - If 4+ personas say HOLDS and cross-critic agrees → HOLDS
>    - If 2+ personas say AMEND with the same alternative and cross-critic agrees → AMEND
>    - If split or cross-critic raises material doubts → INVESTIGATE (name the experiment)
>
> **Cross-primitive synthesis:**
>
> 7. **Amendment list:** Aggregate all primitives with verdict AMEND. For each, write the proposed amendment to the source doc as a concrete diff (which line/section changes, to what).
> 8. **Blind-spot coverage report:** For each blind-spot topic, state which primitive(s) address it OR list it as an unaddressed gap requiring a separate work item.
> 9. **New labeled assumptions:** Aggregate all new AS-N entries (those not already in the source doc) into a single table to be appended to the source doc on greenlight.
> 10. **Greenlight decision:**
>    - **GREENLIGHT** if all primitives HOLD or only have INVESTIGATE verdicts whose investigation is tractable in step 1 itself (no amendments needed before downstream work begins)
>    - **AMENDMENTS REQUIRED** if any primitive has verdict AMEND
>    - **HALT** if cross-critic identified a structural issue that invalidates the design's premise

Apply the standard No-Loss Finding Preservation rule: every concern raised by any persona or the cross-critic must appear in the structured findings list with a disposition.

Write to `<run_workspace>/phase-3/facilitator.yaml`.

---

## PHASE 4 — BACKLOG INTEGRATION + ARTIFACT WRITE

### 4a. Write the review artifact

Write a single Markdown file to the output path (`--out` flag or default `docs/design-reviews/<doc-stem>-pressure-test.md`). Use this template:

```markdown
# <Source Doc Title> — Design Pressure-Test

**Source design:** <doc-path>
**Run ID:** run-NNN
**Date:** YYYY-MM-DD
**Decision:** GREENLIGHT | AMENDMENTS REQUIRED (N items) | HALT
**Engine:** design-critique
**Personas consulted:** architect, failure-engineer, senior-engineer, performance-engineer, security-engineer, cross-critic, facilitator

## Summary

[3-5 sentences. What did the pressure test find? What is the founder being asked to decide? If amendments: name them in priority order. If greenlight: state explicitly that downstream work is unblocked.]

## Per-primitive analysis

### Primitive: <primitive-id> (depth: full | tight)

**Load-bearing assumption (AS-N):** <statement>
**Ceiling of effectiveness:** <when this approach breaks down — be quantitative if possible>
**Strongest alternative:** <approach + brief description + who proposed it>
[For full-depth: list ≥2 alternatives]
**Rationale for chosen over alternative:** <why chosen wins for THIS project context>
**Falsification test:** <observation that proves AS-N false + when measurable>
**Personas: verdicts** — architect: H/A/I, failure-engineer: H/A/I, senior-engineer: H/A/I, performance-engineer: H/A/I, security-engineer: H/A/I, cross-critic: <note>
**Final verdict:** HOLDS | AMEND | INVESTIGATE
[If AMEND: state the proposed amendment]
[If INVESTIGATE: state the experiment + when it can run]

[repeat per primitive]

## Blind-spot coverage

| Topic | Status | Addressed by | Note |
|-------|--------|--------------|------|
| <topic-1> | covered | <primitive-id> | ... |
| <topic-2> | unaddressed | — | requires separate work item |

## Recommended amendments to source doc

[If GREENLIGHT: "None — design proceeds as-written."]
[If AMENDMENTS REQUIRED: numbered list of amendments, each with the source-doc section/line + proposed change + which primitive's verdict triggered it.]

## New labeled assumptions to add to source doc

| ID | Claim | Falsification test | Resolves at |
|----|-------|--------------------|-------------|
| AS-N | ... | ... | step N |

[Append to source doc's `## Labeled assumptions` table on greenlight or after amendments are made.]

## Findings created

[List FND-NNN IDs created in `.claude/workstream/findings/`, with disposition.]

## Decision statement

[If GREENLIGHT: explicit text the founder can cite to unblock downstream work, e.g., "ADR-018 is greenlit for step-1 implementation. WS-170 through WS-174 are unblocked."]
[If AMENDMENTS REQUIRED: "Downstream work remains blocked until amendments 1-N are applied to <doc-path>. Re-run /engine design-critique <doc-path> after amendments to confirm greenlight."]
[If HALT: "Design has a structural issue requiring a new round of architecture work before any implementation."]
```

### 4b. Create findings (no-loss)

For every concern surfaced by any persona, the cross-critic, or the facilitator: create `FND-NNN.yaml` in `.claude/workstream/findings/`. Use the severity map from the manifest (CRITICAL = superior alternative, HIGH = AMEND verdict, MEDIUM = lowered ceiling, LOW = unaddressed blind spot, INFO = HOLDS-with-AS-N).

### 4c. Create work items

For each finding with `disposition: work_item_now`:

- If verdict was AMEND: create a WS item titled `Apply design-critique amendment to <doc-stem>: <one-line summary>` with `blocks: [the source ADR's downstream WS items]` so they stay blocked until the amendment ships.
- If unaddressed blind spot: create a WS item titled `Cover blind spot in <doc-stem>: <topic>` with appropriate program assignment.
- If INVESTIGATE: create a WS item titled `Run falsification experiment for <primitive>` with the experiment design from the worksheet.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

### 4d. Update source doc's labeled-assumptions table (with founder approval)

If GREENLIGHT and there are new AS-N entries: surface the proposed table additions to the founder. **Do NOT mutate the source doc unprompted** — present the diff and ask for approval before writing.

If AMENDMENTS REQUIRED: do NOT mutate the source doc; the amendments are the founder's decision to apply.

---

## PHASE 5 — BRIEFING

```
## Design Pressure-Test Complete: <source-doc-title>

### Run: run-NNN | Source: <doc-path> | Date: YYYY-MM-DD

### Decision: GREENLIGHT | AMENDMENTS REQUIRED (N) | HALT

### Per-primitive verdicts
| Primitive | Depth | Verdict | If AMEND: alternative |
|-----------|-------|---------|----------------------|
| <id> | full | HOLDS | — |
| <id> | full | AMEND | <alternative summary> |
| <id> | tight | INVESTIGATE | <experiment summary> |

### Blind-spot coverage
| Topic | Status |
|-------|--------|
| <topic> | covered by <primitive> |
| <topic> | UNADDRESSED — work item created |

### Amendments recommended
[If any: numbered list with one-line diff per amendment.]
[If none: "Design proceeds as-written."]

### Artifact
**Full review:** <out-path>

### Findings created
[N findings, M auto-promoted to work items]

### What needs your decision
1. [Greenlight or amend? — point to the artifact for the full reasoning]
2. [If new AS-N proposed: approve appending to source doc?]

### Recommended next action
[Single highest-value action — usually one of: "Greenlight: I will mark <blocking WS> as unblocked", "Amend <doc-path>: I can prepare the diff", or "Run experiment for <primitive>: ~N hours of work"]
```

---

## Worksheet template (for reference)

This is the per-primitive structure every persona produces and the facilitator consolidates:

```yaml
primitive_id: <kebab-case>
primitive_name: <human-readable>
depth: full | tight
load_bearing_assumption:
  id: AS-N
  claim: "<falsifiable statement>"
ceiling_of_effectiveness:
  scale_or_context: "<quantitative when possible>"
  what_breaks: "<specific failure mode at the ceiling>"
strongest_alternative:
  name: "<approach>"
  description: "<brief>"
  proposed_by: <persona-name>
  source_doc_already_considered: true | false
  if_already_considered_rejection_reason: "<verbatim from source doc>"
[for full-depth: additional_alternatives: [{...}, {...}]]
rationale_chosen_over_alternative:
  argument: "<why chosen wins for THIS context>"
  weakest_link: "<what would change this rationale>"
falsification_test:
  observation: "<what to measure>"
  pass_fail_criterion: "<concrete threshold>"
  when_measurable: "<step 1 / step 3 / etc.>"
  estimated_effort: "<hours/days>"
verdict: HOLDS | AMEND | INVESTIGATE
verdict_reasoning: "<why this verdict>"
[if AMEND] proposed_amendment:
  doc_section: "<which section/line in source doc>"
  change: "<concrete diff description>"
[if INVESTIGATE] experiment:
  design: "<what to run>"
  duration: "<hours/days>"
  decision_criterion: "<what result triggers AMEND vs HOLDS>"
```

---

## Reusability notes

This engine works on any architectural design document. Tested input shapes:

- **ADRs** with explicit "Decision" + "Scope" + "Alternatives considered" sections
- **System specs** with "Architecture" or "Components" sections
- **Plan-mode outputs** with "Steps" or "Build order" sections

For documents that don't have an enumerable primitive list, Phase 0c will surface the issue and ask the user to either point at a different doc or approve a primitive list before agents are dispatched.

The engine is **idempotent on greenlight**: re-running on the same doc after no changes produces the same verdict. After amendments are applied, re-running is the gate to unblock downstream work — the founder should not unblock by hand without a re-run confirming the amendments resolved the AMEND verdicts.

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
