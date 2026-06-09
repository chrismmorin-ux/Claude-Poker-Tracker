---
name: optimization-feedback
description: "Universal self-improvement protocol — every engine run can produce optimization signals about itself, its personas, its program, or any CWOS component"
procedure: null
extends: null
user-invocable: false
default_mode: explore
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: optimization-feedback` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: explore`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Optimization Feedback Protocol

This is not a standalone engine. It is a shared protocol referenced by all three procedures (agent-dispatch, suite-check, single-pass) as an **optimization epilogue**. Any engine run can produce optimization signals. Not every run will — signals are only generated when the run reveals something about the *process itself*, not just the *target*.

## Core Concept: Optimization Objects

An optimization object is any CWOS component that can self-improve through accumulated feedback:

| Object Type | Examples | What Improves |
|------------|---------|---------------|
| `engine` | eng-engine, health-check, ux-audit | Prompt structure, phases, severity calibration, focus questions |
| `protocol` | baseline, challenge, blind_spot, sweep | Focus questions, cadence, activation conditions, prompt additions |
| `program` | kit-quality, fleet-health | Problem classes, scope patterns, accountability rules, tier triggers |
| `persona` | architect, failure-engineer | Expertise scope, analysis angle, context requirements |
| `procedure` | agent-dispatch, suite-check | Phase structure, agent dispatch patterns, output schemas |
| `template` | state.md, config.yaml | Field structure, defaults, validation rules |
| `preamble` | claude-preamble.md | Section structure, cognitive load, mode definitions |

## Signal Types

Optimization signals are discrete observations. Each has a type that determines how it accumulates:

| Signal Type | What It Observes | Example |
|-------------|-----------------|---------|
| `prompt_gap` | Something the object's prompts didn't catch | "All 6 experts missed rollback/uninstall analysis" |
| `calibration_drift` | Systematic over/under-rating | "Cross-critic elevated 4 findings — experts under-rate silent failures" |
| `coverage_gap` | A dimension not examined | "No expert analyzed deployment environment assumptions" |
| `process_friction` | Something manual that should be standard | "External web research was manually injected — should be a standard step" |
| `effectiveness` | Output that led to useful work | "3 of 5 findings from run-006 became completed work items" |
| `waste` | Output that was noise, not signal | "Calibration: founder rated 4 of 8 findings as 'not relevant'" |
| `plateau` | Diminishing returns from repeated runs | "Program health unchanged after 3 consecutive protocol runs" |
| `convergence` | Multiple objects share the same gap | "3 programs all have the same scope.file_patterns problem" |

## Signal Schema

Every optimization signal follows this structure:

```yaml
signal_id: "OPT-NNN"
timestamp: "YYYY-MM-DD"
source_run: "run-NNN"           # Which run produced this signal
source_engine: "eng-engine"     # Which engine was running
source_protocol: "blind_spot"   # Which protocol was active (null for ad-hoc runs)
source_program: "kit-quality"   # Which program context (null if no program)

target_object:
  type: "engine|protocol|program|persona|procedure|template|preamble"
  id: "eng-engine"              # Specific object being observed
  
signal_type: "prompt_gap|calibration_drift|coverage_gap|process_friction|effectiveness|waste|plateau|convergence"

observation: |
  [What was observed — specific, evidence-based]

proposed_change: |
  [Concrete change to the target object — specific enough to copy-paste.
   Null if the signal is an observation without a clear fix.]

evidence:
  - "[pointer to artifact or finding that supports this]"

confidence: "low|medium|high"   # low = single observation, medium = pattern emerging, high = confirmed across runs
status: "pending|confirmed|applied|rejected|validated"
pattern_id: null                # Set when signal is grouped into a confirmed pattern
applied_at: null                # Timestamp when change was applied
rejection_reason: null          # Why the signal was rejected (required when status = rejected)
validation_run: null            # Run ID that validated the applied change worked
```

## Accumulation Rules

Signals don't auto-apply. They accumulate and mature:

1. **Single signal** → `pending` (noted, low confidence)
2. **Same target_object + same signal_type from 2+ different runs** → `confirmed` (pattern detected, medium confidence)  
3. **Confirmed + reviewed by `/evolve optimize`** → `applied` (change made) or `rejected` (with reason)
4. **Applied + validated in subsequent run** → `validated` (the change actually helped)

A `convergence` signal that spans 3+ objects at `confirmed` status becomes a **systemic improvement** — it affects the procedure or base infrastructure, not individual objects.

**Self-referential exception:** If `target_object.type == "program"` AND `target_object.id == "optimization"`, the signal is capped at `pending` regardless of how many runs produce the same observation. Auto-confirmation to `confirmed` requires explicit `/evolve meta` review. This prevents the optimization system from autonomously modifying its own monitor — a self-referential loop that could lead to uncontrolled self-modification. The guard is documented in `prog-optimization.yaml` and enforced here.

## When to Generate Signals

### After Agent-Dispatch Runs (eng-engine, etc.)

Generate signals when ANY of these are true:
- Cross-critic recalibrated 2+ findings in the same direction → `calibration_drift`
- Cross-critic identified shared blind spots → `coverage_gap` for each persona + `prompt_gap` for the engine
- External context was manually injected → `process_friction`
- The run re-discovered a finding from a previous run → `waste` (dedup failure) or `plateau`

### After Suite-Check Runs (health-check, preflight, etc.)

Generate signals when:
- A check suite consistently returns CHECK_ERROR → `process_friction` (the check is misconfigured)
- Auto-remediation attempted but failed → `coverage_gap` for remediation rules
- Vital signs haven't changed despite multiple runs → `plateau`

### After Single-Pass Runs (item-enhance, etc.)

Generate signals when:
- The refinement produced no changes → `plateau` or `waste`
- The refinement added information that should have been in the original → `prompt_gap` for the source engine

### From Calibration (/evolve calibrate)

Generate signals when:
- Founder rates findings as "not relevant" → `waste` signal for source engine
- Founder rates findings as "exactly right" → `effectiveness` signal
- Founder adjusts severity → `calibration_drift` signal

### From Work Item Lifecycle

Generate signals when:
- Work items from a specific engine are consistently skipped/abandoned → `waste`
- Work items from a specific engine are consistently completed → `effectiveness`
- Work items are completed but the accept_criteria was wrong → `prompt_gap` for the engine

### From Program Health

Generate signals when:
- Health score plateaus for 3+ protocol runs → `plateau` for the protocol
- Health score drops after a protocol run → possible `calibration_drift`
- A problem class has zero findings across 3+ runs → `coverage_gap` or successful resolution

### From Work Item Lifecycle

Generate signals when:
- 3+ work items from the same engine are completed within 2 sprints → `effectiveness` signal for that engine
- Work items from a specific engine are consistently skipped (3+ skipped, 0 completed) → `waste` signal
- A work item's accept_criteria was wrong (item completed but problem persists) → `prompt_gap` for the source engine

These signals are generated during `/session-end` or `/next` when items transition status.

### Validation of Applied Changes

When `/evolve optimize` applies a change:
1. Record a `validation_plan` in `change-impacts.yaml`, located in the calibration dir resolved per repo scope (`resolveEvolutionDir`: the HomeBase evolution apparatus dir, or `.claude/workstream/` in adopted repos) — what to check, which engine, expected improvement
2. On the NEXT run of the affected engine, the optimization epilogue checks:
   - Did the change-targeted dimension improve? → Generate `effectiveness` signal, update original signal to `validated`
   - Did it get worse? → Generate `calibration_drift` signal, flag the applied change for review
   - No measurable difference? → No signal yet (may need more runs)

This closes the loop: observe → accumulate → apply → validate.

## Output Location

All signals are written to `.claude/workstream/optimization-index.yaml` (see index schema).

Deep runs (blind_spot, challenge, meta-engine) also produce a detailed `protocol-feedback.yaml` artifact in the run workspace — this is the verbose version that feeds into the index as individual signals.

## Integration Points

| Component | How It Uses Optimization Signals |
|-----------|-------------------------------|
| `/evolve optimize` | Reviews confirmed signals, proposes/applies changes |
| `/evolve meta` | Reads all signals as context for meta-engine analysis |
| `/evolve report` | Shows optimization health: pending/confirmed/applied signal counts |
| `/pulse` | When running a protocol, checks for `confirmed` signals against that protocol and applies them |
| `/next` | When composing sprints, boosts priority for work items that address `confirmed` optimization signals |
| `/audit` | Checks for `plateau` signals — programs stuck despite runs indicate a systemic issue |

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
