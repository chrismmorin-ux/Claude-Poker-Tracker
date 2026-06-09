---
name: corrective-plan
description: "Corrective pass over an implementation plan / feature spec / sprint composition. Five-persona parallel redundancy applying T-6 pattern-match, T-3 inversion, T-5 elevation; cross-critic surfaces T-1 redundancy effect on ambiguous passages; facilitator produces ship | amend | reframe | reject verdict with a forced Strongest Objection callout."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: corrective-plan` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (verdict + amendments with tradeoffs), `build-best` (commit to one amendment direction; concrete diff list; sequencing-ranked), `mockup` (low-fidelity finding sketch; skip work-item creation), `explore` (surface adjacent reframings the plan didn't consider).
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where the plan is leaning on inertial state. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Plan Corrective Engine

You are running a corrective pass over an implementation plan **before any code is written against it**. AI-generated plans are fluent and internally consistent — that fluency is exactly what hides the buried assumption, the absent rollback, the missed adjacent scope, the optimistic timing. The job of this engine is to expose those gaps surface-by-surface, through five independent expert lenses, with a cross-critic that surfaces convergence (the highest-signal findings) and disagreement (the load-bearing ambiguities), and a facilitator that consolidates into a verdict the founder can act on.

This is **not** the same as design-critique (which pressure-tests architectural primitives), plan-enhance (which enriches a plan with annotations), or item-enhance (which sharpens a single work item). This engine targets *implementation plans, feature specs, sprint compositions, and plan-mode outputs* — documents that propose a sequence of changes the codebase will execute on.

The methodology operationalizes prog-corrective's L-1..L-6 taxonomy on the plan artifact type (UC-002 per `research/corrective/phase-4-use-case-register.md`). Each technique is bound to a persona-as-lens rather than executed as a sequential prose phase:

| Technique | Persona | Limitation addressed |
|---|---|---|
| T-6 Pattern-match (plan-failure template library) | senior-engineer | L-6 missed observation |
| T-3 Inversion / pre-mortem | failure-engineer | L-4 coherence illusion |
| T-5 Elevation / scope questioning | architect | L-3 frame lock-in, L-5 scope acceptance |
| T-6 Pattern-match (user-observability subset) | product-ux | L-6 missed observation, L-4 coherence illusion |
| T-6 Pattern-match (timing/scaling subset) | performance-engineer | L-6 missed observation, L-1 mode collapse on scaling assumptions |
| T-1 Redundancy effect (via convergence detection) | cross-critic | L-1 mode collapse |

The engine inherits prog-corrective's measurement infrastructure (see `MANIFEST.yaml#measurement_record`) and is gated by the program's phase-5 framework.

## Input

`$ARGUMENTS` — a path to the plan document, plus optional flags:

- **`<plan-path>`** (required when not using `--recent`): absolute or repo-relative path. Examples:
  - `docs/plans/PLAN-NNN.md`
  - `.claude/workstream/runs/run-NNN/artifacts/phase-3/facilitator.yaml` (plan-mode output)
  - `docs/specs/feature-X.md`
  - A path to an ADR in plan-shape (`Context + Steps + Sequencing` sections)
- **`--recent`** (alternative to `<plan-path>`): find the most recently modified plan-shaped file in `docs/plans/`, `.claude/workstream/runs/*/artifacts/phase-3/`, or `docs/specs/`.
- **`--paste`**: prompt the founder to paste the plan inline (used when the plan lives outside the repo or is mid-draft).
- **`--depth=tiered|full|sample`** (default: `tiered`)
  - `tiered`: full depth on the plan's first-cut / step-1 elements; tight on later elements.
  - `full`: full depth on every plan element.
  - `sample`: top 4 most load-bearing plan elements only.
- **`--blind-spots="topic1,topic2,..."`** (optional): topics that MUST be covered.
- **`--out=<path>`** (optional): override output artifact location. Default: `docs/plan-reviews/<plan-stem>-corrective.md`.

If no argument given, ask: "Which plan should I run corrective against? Paths, `--recent`, or `--paste`?"

---

## PHASE 0 — GATHER CONTEXT

### 0a. Read the source plan

1. Resolve the plan source from the invocation argument.
2. Read the plan in full. Do not skim.
3. Detect the document shape:
   - **Implementation plan**: numbered steps, sequencing, file lists, success criteria
   - **Feature spec**: behavior description, scope boundary, acceptance criteria
   - **Sprint composition**: WS items grouped, ordering rationale
   - **Plan-mode output**: phased synthesis with structured findings
   - **ADR in plan-shape**: Decision + Steps + Build Order
   - **Other**: surface to founder — ask whether to proceed and how to enumerate plan elements

### 0b. Read project context

1. Read `CLAUDE.md` — project purpose, constraints, tech stack
2. Read `system/state.md` — current state, milestone, vital signs
3. Read `system/invariants.md` — rules any plan must satisfy
4. Read `system/constraints.md` — boundaries the plan operates within
5. Read `system/decisions.md` — prior decisions this plan must respect
6. Read `system/failures.md` — known failure modes the plan should account for

### 0c. Enumerate plan elements

A **plan element** is an atomic unit the plan proposes — a step, a phase, a subtask, a deliverable, or a decision the plan is asking the founder to approve. Examples: "create migration script", "add field X to schema Y", "wire up endpoint Z", "verify with test T", "deploy to staging", "decide between option A and option B".

Extract the element list from the source plan:

1. **Explicit list:** Look for numbered "Steps", "Phases", "Build order", "Sequence" sections.
2. **Implicit list:** If no explicit list, scan numbered bullets in "Decision", "Plan", "Approach" sections for noun-verb phrases that are introduced as concrete actions.
3. **Goal + Scope:** Identify the plan's stated goal and explicit scope boundary. These are NOT elements but they are the frame everything else lives inside — Phase 1 personas will check this frame.

Each plan element MUST have a stable identifier (kebab-case, e.g., `add-migration-0042`, `wire-corrective-endpoint`, `verify-rollback-path`). Use the plan's own numbering where possible.

### 0d. Tier the elements

Based on `--depth` flag:

- **tiered (default):** An element is `full-depth` if any of these are true:
  - Listed in the source plan's step-1 / first-cut scope
  - Touches a one-way door (migration, deletion, public API change, external dependency commitment)
  - Has zero stated rollback path in the source plan
  - Tagged for full-depth via `--full-depth`
  - Otherwise: `tight-depth`
- **full:** all elements are `full-depth`
- **sample:** rank by `dependents_in_plan × reversibility_cost`, take top 4 as `full-depth`, drop the rest

### 0e. Resolve blind-spot topics

Combine three sources into a single blind-spots checklist:

1. Topics passed via `--blind-spots` flag
2. Topics named in the source plan's own "Risks", "Open questions", or "Known unknowns" sections as flagged but unresolved
3. Topics from the source plan's "Out of scope" section IF those topics could plausibly invalidate an element (e.g., "rollback strategy out of scope" → must verify each one-way-door element has SOME rollback consideration)

### 0f. Confirm the plan with the founder

Before launching agents, present a one-screen confirmation:

```
## Plan Corrective Plan

**Source:** <plan-path>
**Document shape:** <implementation plan | feature spec | sprint composition | plan-mode output | ADR>
**Stated goal:** <one sentence quote-or-paraphrase from source>
**Scope boundary:** <explicit boundary or "absent — flagged">
**Elements enumerated (N):**
  Full depth (N):
    - <element-1>
    - <element-2>
  Tight depth (N):
    - <element-3>
    - ...

**Blind-spot topics to cover (N):**
  - <topic-1>
  - <topic-2>

**Output artifact:** <out-path>
**Personas to dispatch:** architect, failure-engineer, senior-engineer, product-ux, performance-engineer (then cross-critic, then facilitator)
**Estimated time:** ~10-15 min for ≤6 full-depth elements

Proceed?
```

If the founder changes the element list, depth tiering, or blind-spot list, regenerate and re-confirm. **Do not skip this confirmation** — the element list is the contract for everything downstream.

---

## PHASE 1 — DISPATCH EXPERT AGENTS (PARALLEL)

Each persona receives the full element list, the source plan path, the blind-spot topics, the project context, and the per-element worksheet template. Each persona's *technique* is fixed by this engine; the persona is the lens through which the technique is executed.

### Agents

#### Agent 1: Frame Elevation (architect persona — T-5)

> **Task:** For each plan element, complete the worksheet through the lens of T-5 elevation (scope questioning).
>
> Source plan: `<plan-path>` (read in full before starting)
> Stated goal: `<from Phase 0>`
> Elements (full-depth): [...]
> Elements (tight-depth): [...]
> Blind-spot topics: [...]
>
> For EACH element:
>
> - **What this element treats as fixed:** What is this element assuming will not change during or after execution? (Schema state, dependency versions, founder availability, system capacity, sibling-plan completion.)
> - **One-level-up reframe:** If you elevated the frame one level — looking at *why* this element exists, not just what it does — is there an upstream change that makes this element unnecessary? An adjacent change that should be coupled with it? A constraint it's optimizing for that no longer applies?
> - **Element-level alternative:** Propose one element-shape that would meet the same goal with a different framing. Not a different implementation — a different *framing*.
> - **Rationale for chosen over alternative:** Why does the plan's chosen element-shape beat the reframed one FOR THIS PROJECT CONTEXT?
> - **Falsification test:** What concrete observation, when, would prove this element's framing assumption is wrong?
> - **Verdict:** HOLDS | AMEND | REFRAME | INVESTIGATE
>   - HOLDS: framing is sound for context
>   - AMEND: framing needs adjustment but the goal stays
>   - REFRAME: this element should be replaced with a different shape entirely (blocks downstream until founder decides)
>   - INVESTIGATE: cannot decide without more data — name the experiment
>
> Cross-cutting: for the *whole plan*, ask: is the plan's stated goal the right goal to be solving now? If "no", emit a top-level REFRAME finding tagged `plan_level: true`.

#### Agent 2: Inversion / Pre-mortem (failure-engineer persona — T-3)

> **Task:** Same worksheet, same elements, lens is inversion.
>
> For each element:
>
> - **What this element treats as fixed:** What state, sequencing, or behavior does this element assume?
> - **Quietest failure mode:** Assume this element fails. What's the most-likely *quiet* failure mode — the one that proceeds halfway, doesn't raise an alarm, but produces wrong state?
> - **Element-level alternative:** Propose an alternative element that has a LOUDER, EARLIER failure mode (even if costlier in the happy path). For one-way-door elements, this trade is almost always correct.
> - **Rationale for chosen over alternative:** Is the chosen element's silent-failure cost actually beaten? Where's the gap between failure and detection?
> - **Falsification test:** Design a failure-injection or chaos-test that would force this element's quietest failure mode to surface. What's the minimum harness?
> - **Verdict:** Same as architect.
>
> Cross-cutting (whole plan):
> 1. **Assume the plan, executed exactly as written, fails. What's the most-likely failure mode?** Force a top-3 ranked list, each tagged with which element should have caught it (calibration check).
> 2. **Rollback completeness:** does every one-way-door element have a documented rollback path? If not, list each missing rollback as a HIGH finding.

#### Agent 3: Plan-Failure Template Library (senior-engineer persona — T-6)

> **Task:** Same worksheet, same elements, lens is the plan-failure template library.
>
> The template library — apply each template to each element:
>
> 1. **Goal & Success Criteria** — Is the success criterion stated as a verifiable fact ("done when X")? Or aspirational ("better Y")? Could two people execute and disagree on success?
> 2. **Stated vs. Implicit Assumptions** — What state does the element assume before execution? Is each state assertion verifiable now? What does it assume about other actors / systems / data?
> 3. **Dependencies & Sequencing** — Does the element name every system / file / module it touches? Is sequencing implicit ("then we…") or explicit (with named outputs)?
> 4. **Rollback & Reversibility** — If this element executes badly halfway, what's the recovery? Is it reversible, or is it a one-way door? If one-way, is it flagged as such?
> 5. **Hidden State** — Does the element assume a feature flag, env var, config value, migration status, fixture state, or piece of data exists in a state — without verifying?
> 6. **Test / Verification Plan** — Is verification stated, or implied ("test it")? Are cases enumerated?
> 7. **Anti-Goals** — Does the plan say what this element will NOT do? Is there scope-creep evidence within the element?
> 8. **Coordination Assumptions** — Does the element assume the founder / another actor / external service will do something that isn't acknowledged?
>
> For each template that fires on an element, record: what's missing, why it matters (downstream cost), severity (HIGH/MEDIUM/LOW), suggested fix (inline edit vs new work item).
>
> For full-depth elements: run ALL 8 templates. For tight-depth: prioritize 1, 2, 4, 5 (the highest-miss-cost templates).
>
> - **Verdict per element:** Same.

#### Agent 4: User-Observability (product-ux persona — T-6 subset)

> **Task:** Same worksheet, same elements, lens is what the user sees / what's observable from outside.
>
> Per the agent-dispatch budget-trio rule: product-ux must be in every panel because it catches a different class of issue than technical-only lenses (user-facing vs server-side). For plans, this lens specifically catches:
>
> For each element:
>
> - **User-observable success:** Is this element's success observable from the user's point of view, or only from the implementer's logs/tests? If only implementer-visible, what user-facing observable would confirm it?
> - **User-touching states:** Does this element transition any state the user can perceive (data they see, action they take, error they receive)? Are those user-touching states defined?
> - **Coordination clarity (founder-as-user):** If the plan requires founder action ("you'll need to approve", "you'll have to decide"), is the moment of decision named with what the founder will be asked? Or is it deferred to a vague "later"?
> - **Element-level alternative:** Propose an element variant that exposes a clearer user-observable signal.
> - **Falsification test:** What would the user (or founder-as-user) report seeing if this element succeeded? If failed? Define both.
> - **Verdict:** Same.
>
> Cross-cutting: is the plan's stated goal observable to a non-implementer? If not, the plan has a *founder-trust* problem regardless of implementation quality. Flag as a plan-level finding.

#### Agent 5: Timing & Scaling Assumptions (performance-engineer persona — T-6 subset)

> **Task:** Same worksheet, same elements, lens is timing/scaling/resource assumptions.
>
> For each element:
>
> - **Linear-time assumption:** Does the plan assume the element runs in proportional time to its inputs? Where might it block on review, decision, external dependency, large data, or rate-limit?
> - **Resource ceiling:** What throughput, memory, or storage assumption is baked in? At what input size does it stop being acceptable?
> - **Parallelism opportunity:** Could this element run in parallel with another, but the plan assumes sequential? Or vice versa — assumes parallel where there's a hidden serialization?
> - **Element-level alternative:** Propose a sequencing or chunking variant that handles a wider input range.
> - **Falsification test:** Synthetic load at 10x the assumed scale or 1/10x of available time. Where does it break?
> - **Verdict:** Same.

Launch ALL 5 agents in parallel. Wait for all to complete. Each writes to `<run_workspace>/phase-1/<agent-name>.yaml` with per-element worksheets in `output.raw_text`.

---

## PHASE 2 — CROSS-CRITIQUE

Use the **default** cross-critic prompt from the agent-dispatch procedure, plus this engine-specific extension:

> **Engine-specific cross-critique focus (T-1 redundancy effect):**
>
> 1. **Convergence detection (the T-1 signal):** For each element, did 3+ personas independently flag the same gap or propose the same alternative? Convergent findings have unusually-high confidence — surface them as `convergence: 3-of-5` (or 4-of-5, 5-of-5) signals. Where convergence is at 4+, the element is almost certainly a real load-bearing issue; the source plan's failure to address it is a red flag.
> 2. **Verdict disagreement (ambiguity signal):** For any element where personas split (e.g., architect HOLDS, failure-engineer AMEND, senior-engineer INVESTIGATE), the disagreement IS the finding. Surface the split and propose what evidence would settle it. These map to T-1's "passages where varied framings produce different readings" — ambiguity findings.
> 3. **Plan-level convergence:** Do any cross-cutting findings (whole-plan reframes, missing rollbacks, founder-trust gaps) converge across multiple personas? If yes, escalate severity.
> 4. **Already-rejected concerns:** For each persona's flagged gap, did the source plan address it in a "Risks", "Open questions", or "Out of scope" section? If yes, check whether the source plan's response is sound or whether the persona's concern still holds.
> 5. **Falsification test rigor:** Are the personas' falsification tests actually falsifiable? "Plan succeeded" is not a test. "Migration completed in <60s on 50-record fixture with zero data-loss assertions firing" is.
> 6. **Blind-spot coverage:** For each blind-spot topic, verify ≥1 element worksheet addresses it. Topics no element addresses = unaddressed blind spot.

Output to `<run_workspace>/phase-2/cross-critic.yaml`.

---

## PHASE 3 — FACILITATED SYNTHESIS

The facilitator's job: per element, consolidate the 5 worksheets + cross-critic notes into a SINGLE worksheet with one verdict. Plus produce the cross-cutting plan-level verdict and the Strongest Objection.

### Synthesis prompt

> You are synthesizing a plan corrective review. Five expert personas have filled per-element worksheets and a cross-critic has reviewed them.
>
> **Per-element consolidation rules:**
>
> 1. **What this element treats as fixed:** Take the union of all personas' claims, deduplicated.
> 2. **Quiet failure / weakest link:** Pick the LOWEST-detection-cost failure across personas. The plan's weakest link is whatever breaks first AND hardest to notice.
> 3. **Strongest alternative:** Pick the single alternative most likely to outperform for this context. Cite who proposed it. If 3+ personas proposed the same alternative, mark it as CONVERGENT and weight accordingly.
> 4. **Rationale:** Why does the chosen element beat THIS alternative? Address its strongest argument, not a strawman.
> 5. **Falsification test:** Pick the most measurable, time-boxed test. Specify when it can run.
> 6. **Per-element verdict:** HOLDS | AMEND | REFRAME | INVESTIGATE
>    - HOLDS: 4+ personas HOLDS, cross-critic agrees
>    - AMEND: 2+ personas AMEND with the same alternative, cross-critic agrees
>    - REFRAME: any persona's verdict was REFRAME and cross-critic confirms (blocks downstream)
>    - INVESTIGATE: split or cross-critic raises material doubt — name the experiment
>
> **Cross-plan synthesis:**
>
> 7. **Amendment list:** Aggregate all AMEND-verdict elements. For each, write the proposed amendment to the source plan as a concrete diff (which line/section, to what).
> 8. **Reframe list:** Aggregate all REFRAME-verdict items (per-element + plan-level). Each REFRAME blocks downstream execution until the founder decides.
> 9. **Blind-spot coverage:** For each blind-spot topic, state which element(s) address it OR list it as an unaddressed gap requiring a separate work item.
> 10. **Strongest Objection (REQUIRED, even on ship):** Name the single highest-leverage thing the founder should address before execution. If verdict is ship, state explicitly *why* nothing rises to the bar. This prevents the "review found 12 small things, missed the one big thing" failure mode that prog-corrective C-1 rigor compression watches for.
> 11. **Plan-level verdict:**
>    - **SHIP** — no REFRAME findings, ≤3 AMEND findings, ≤3 MEDIUM findings.
>    - **AMEND** — HIGH or AMEND findings exist; all addressable inline or via small work items.
>    - **REFRAME** — any REFRAME finding (per-element or plan-level). Source plan needs upstream amendment before re-running corrective.
>    - **REJECT** — multiple REFRAME findings OR plan's stated goal is not verifiable. Plan should be redrafted.

Apply the standard No-Loss Finding Preservation rule per agent-dispatch procedure.

Write to `<run_workspace>/phase-3/facilitator.yaml`.

---

## PHASE 4 — BACKLOG INTEGRATION + ARTIFACT WRITE

### 4a. Write the review artifact

Write a single Markdown file to the output path (`--out` flag or default `docs/plan-reviews/<plan-stem>-corrective.md`).

**Before writing this artifact**, prepend the v1-status header by running:

```
node engines/library/corrective-plan/v1-header-check.js
```

The script writes the header block to stdout when the engine's `measurement_record` scorecard has `ship_gate.overall != "ready"`, and writes nothing when ready (the header is then suppressed automatically — no further edit needed once WS-408 path A completes). Place the script output verbatim at the very top of the artifact, above the `# <Plan Title>` heading. If the script fails to read state, it fails CLOSED (emits a degraded header) — never strip stdout, even if you suspect an error.

Template:

```markdown
# <Plan Title> — Plan Corrective Review

**Source plan:** <plan-path>
**Run ID:** run-NNN
**Date:** YYYY-MM-DD
**Verdict:** SHIP | AMEND | REFRAME | REJECT
**Engine:** corrective-plan
**Personas consulted:** architect (T-5 elevation), failure-engineer (T-3 inversion), senior-engineer (T-6 pattern-match), product-ux (T-6 user-observability), performance-engineer (T-6 timing/scaling), cross-critic (T-1 convergence/disagreement), facilitator

## Strongest Objection

[ONE callout. The single most-important thing the founder should address. Required even when verdict is SHIP — state why no objection rises to that bar.]

## Summary

[3-5 sentences. What did corrective find? What does the founder need to decide? If amendments: name them in priority order. If reframe: state explicitly that downstream work is blocked until the reframe is resolved.]

## Per-element analysis

### Element: <element-id> (depth: full | tight)

**What this element treats as fixed:** <claims>
**Quiet failure / weakest link:** <failure mode + detection gap>
**Strongest alternative:** <approach + brief + who proposed it + CONVERGENT flag if 3+>
[For full-depth: list ≥2 alternatives]
**Rationale for chosen over alternative:** <why chosen wins for THIS context>
**Falsification test:** <observation + when measurable>
**Personas: verdicts** — architect: H/A/R/I, failure-engineer: H/A/R/I, senior-engineer: H/A/R/I, product-ux: H/A/R/I, performance-engineer: H/A/R/I, cross-critic: <convergence/disagreement note>
**Final verdict:** HOLDS | AMEND | REFRAME | INVESTIGATE
[If AMEND: proposed amendment diff]
[If REFRAME: what needs to change before re-run]
[If INVESTIGATE: experiment + when runnable]

[repeat per element]

## Plan-level findings

[Cross-cutting findings: missing rollbacks, founder-trust gaps, scope/goal reframes, blind-spot misses.]

## Blind-spot coverage

| Topic | Status | Addressed by | Note |
|-------|--------|--------------|------|

## Recommended amendments to source plan

[If SHIP: "None — plan proceeds as-written."]
[If AMEND: numbered list of amendments, each with source-plan section + proposed change + which element's verdict triggered it.]
[If REFRAME: numbered list of reframes, each with the upstream decision the founder must make.]

## Findings created

[List FND-NNN IDs created in `.claude/workstream/findings/`, with disposition.]

## Decision statement

[If SHIP: explicit text the founder can cite to unblock execution.]
[If AMEND: "Execution remains blocked until amendments 1-N are applied. Re-run /engine corrective-plan after amendments to confirm SHIP."]
[If REFRAME: "Plan requires upstream amendment before re-running corrective. Resolve reframe(s) 1-N via /decide or /plan."]
[If REJECT: "Plan should be redrafted from scratch. Stated goal cannot be made verifiable as-written."]
```

### 4b. Create findings (no-loss)

For every concern surfaced by any persona, cross-critic, or facilitator: create `FND-NNN.yaml` in `.claude/workstream/findings/`. Use the severity map from the manifest.

### 4c. Create work items

For each finding with `disposition: work_item_now`:

- If verdict was AMEND: create a WS item titled `Apply corrective-plan amendment to <plan-stem>: <one-line>` with `blocks: [downstream WS items the plan was going to spawn]` so they stay blocked until amendment ships.
- If REFRAME: create a WS item titled `Resolve reframe on <plan-stem>: <topic>` with priority floor matching prog-corrective accountability.
- If unaddressed blind spot: create a WS item titled `Cover blind spot in <plan-stem>: <topic>`.
- If INVESTIGATE: create a WS item titled `Run falsification experiment for <element>` with the experiment design.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

### 4d. Do NOT mutate the source plan

Unlike design-critique's labeled-assumptions table append, corrective-plan does NOT mutate the source plan. The founder applies amendments deliberately. Surface the proposed diffs in the artifact; do not write to the source plan unprompted.

### 4e. Telemetry append (AS-29 / AS-33 surface)

**Telemetry is appended automatically** by `cwos-engine-complete.js` after event emission — see `kit/scripts/lib/cwos-skill-telemetry.js` (WS-414, FIND-273). No prose-driven append required. Per-engine fields (convergent_findings, cross_critic_disagreements) are extracted by `engines/library/corrective-plan/telemetry-extract.js` from the per-element verdicts table in `artifacts/phase-3/briefing.md`.

Verify in the run-completion output:

```
result.telemetry.ok === true
result.telemetry.path = ".claude/workstream/meta/skill-telemetry.yaml"
```

This satisfies AS-29 (founder invocation rate) and AS-33 (HomeBase invocation within 14 days of v1 ship) observability requirements from ADR-050. The append is deterministic (DEC-029 — airtight via hooks + reconcilers, not ritual-dependent).

---

## PHASE 5 — BRIEFING

**Before emitting the briefing**, prepend the v1-status header by running:

```
node engines/library/corrective-plan/v1-header-check.js
```

Same conditional as Phase 4a: emits a header block when `ship_gate.overall != "ready"`, suppresses when ready. Place at the very top of the briefing, above the `## Plan Corrective Complete:` heading. Fails CLOSED — degraded header emitted on read error; preserve stdout verbatim.

```
## Plan Corrective Complete: <plan-title>

### Run: run-NNN | Source: <plan-path> | Date: YYYY-MM-DD

### Verdict: SHIP | AMEND (N) | REFRAME (N) | REJECT

### Strongest Objection
[Single-callout, mandatory.]

### Per-element verdicts
| Element | Depth | Verdict | If AMEND: alternative | Convergence |
|---------|-------|---------|----------------------|-------------|
| <id> | full | HOLDS | — | 5-of-5 HOLDS |
| <id> | full | AMEND | <alternative summary> | 4-of-5 AMEND |
| <id> | tight | INVESTIGATE | <experiment summary> | split |

### Plan-level findings
[Cross-cutting items.]

### Blind-spot coverage
| Topic | Status |
|-------|--------|

### Amendments recommended
[If any: numbered list with one-line diff per amendment.]
[If none: "Plan proceeds as-written."]

### Reframes blocking execution
[If REFRAME verdict: founder must resolve each before re-run.]

### Artifact
**Full review:** <out-path>

### Findings created
[N findings, M auto-promoted to work items]

### What needs your decision
1. [Resolve the Strongest Objection — pointer to artifact]
2. [Each REFRAME, in order]
3. [Top 3 AMEND items if applicable]

### Recommended next action
[Single highest-value action — usually: "Apply amendment N: I can prepare the diff" or "Resolve reframe via /decide on <topic>" or "Ship: unblock WS-NNN through WS-NNN"]
```

---

## Worksheet template (for reference)

This is the per-element structure every persona produces and the facilitator consolidates:

```yaml
element_id: <kebab-case>
element_name: <human-readable>
depth: full | tight
what_treated_as_fixed:
  claims: ["<claim 1>", "<claim 2>"]
quiet_failure_mode:
  description: "<what fails silently>"
  detection_gap: "<why it wouldn't be noticed>"
strongest_alternative:
  name: "<approach>"
  description: "<brief>"
  proposed_by: <persona-name>
  source_plan_already_considered: true | false
  convergent: false | "3-of-5" | "4-of-5" | "5-of-5"
[for full-depth: additional_alternatives: [{...}, {...}]]
rationale_chosen_over_alternative:
  argument: "<why chosen wins for THIS context>"
  weakest_link: "<what would change this rationale>"
falsification_test:
  observation: "<what to measure>"
  pass_fail_criterion: "<concrete threshold>"
  when_measurable: "<step 1 / step 3 / etc.>"
  estimated_effort: "<hours/days>"
verdict: HOLDS | AMEND | REFRAME | INVESTIGATE
verdict_reasoning: "<why this verdict>"
[if AMEND] proposed_amendment:
  plan_section: "<which section/line>"
  change: "<concrete diff description>"
[if REFRAME] reframe:
  upstream_decision_needed: "<what founder must decide>"
  downstream_impact: "<what blocks until decided>"
[if INVESTIGATE] experiment:
  design: "<what to run>"
  duration: "<hours/days>"
  decision_criterion: "<what result triggers AMEND vs HOLDS>"
```

---

## Reusability notes

This engine works on any plan-shaped document. Tested input shapes:

- **Implementation plans** with numbered steps, sequencing, file lists
- **Feature specs** with behavior + scope + acceptance criteria
- **Sprint compositions** with WS items grouped by program
- **Plan-mode outputs** from `/plan` with phased facilitator synthesis
- **ADRs in plan-shape** with Decision + Build Order + Sequencing

For documents that don't have an enumerable element list, Phase 0c will surface the issue and ask the founder to either point at a different doc or approve an element list before agents are dispatched.

The engine is **idempotent on SHIP**: re-running on the same plan after no changes produces the same verdict. After amendments are applied, re-running is the gate to unblock execution — the founder should not unblock by hand without a re-run confirming the amendments resolved the AMEND verdicts.

---

## Measurement record

This engine is measured per the standardized corrective-engine scorecard at `docs/evolution/corrective-scorecards/corrective-plan.yaml`. The scorecard tracks M-1 (A/B finding diff), M-2 (counterfactual audit), M-3 (structural coverage), and M-4 (cost-per-surviving-finding) per `research/corrective/phase-5-measurement-framework.md`.

**v1 ship status:** the scorecard exists as a stub with all four gates in `status: missing`. Per ADR-050 the v1 ships under a labeled, dated, sunset-bearing exception to the "no skill ships without measurement record" anti-invariant. Sunset 2026-06-13. WS-408 tracks resolution.

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
