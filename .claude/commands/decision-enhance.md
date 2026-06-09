---
name: decision-enhance
description: "Enrich a decision with scenarios, tradeoffs, risk profiles, and reversibility assessment"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: decision-enhance` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Decision Enhancement Engine

You are helping the user make a better decision. Not making the decision FOR them — enriching it so they can decide with full information. The user has a decision to make. Your job is to surface the tradeoffs, model the scenarios, assess the risks, and present a clear recommendation with confidence level.

## Input

$ARGUMENTS — the decision to enhance. Examples:
- "Should we use Stripe or Square for payments?"
- "Monorepo or separate repos for the frontend and backend?"
- "Build the notification system ourselves or use a service?"
- "Refactor the auth module now or after launch?"

If no argument given, ask: "What decision are you trying to make?"

---

## PHASE 0 — GATHER CONTEXT

1. Parse the decision from arguments. Identify the OPTIONS (if explicit) or infer them
2. Read `system/decisions.md` — prior decisions that constrain this one
3. Read `system/constraints.md` — hard constraints that eliminate options
4. Read `system/invariants.md` — rules that any option must satisfy
5. Read `CLAUDE.md` — project patterns, architecture, tech stack
6. Run `git log --oneline -20` — trajectory context (is the project early-stage? Mature? Pivoting?)

Frame the decision:
- **What is being decided?** (clear statement)
- **What are the options?** (2-4 concrete alternatives, including "do nothing" if applicable)
- **What constraints exist?** (from system files — what eliminates options upfront?)
- **What decisions are already settled?** (from decisions.md — respect these)

---

## PHASE 1 — PARALLEL ENRICHMENT

Launch 3 agents in parallel using the Agent tool. Each receives the framed decision with all options.

### Agent 1: Structural Analysis (architect persona)

> **Task:** Analyze each option's impact on the system's architecture and long-term trajectory.
>
> For each option:
> 1. How does it FIT the current architecture? (natural extension vs forcing a pattern change)
> 2. What DEPENDENCIES does it create? (new libraries, services, APIs, data stores)
> 3. What does it CLOSE OFF? (future options eliminated by choosing this)
> 4. What does it ENABLE? (future options opened by choosing this)
> 5. How does it affect COMPLEXITY? (simpler or more complex system after this choice?)
> 6. How does it interact with EXISTING DECISIONS? (alignment or tension with decisions.md)
>
> Output per option: architectural fit score (natural/acceptable/forced), dependency impact, optionality analysis.

### Agent 2: Risk & Failure Analysis (failure-engineer persona)

> **Task:** Analyze what goes wrong with each option.
>
> For each option:
> 1. What are the TOP 3 FAILURE MODES? (specific, not generic)
> 2. What's the WORST CASE SCENARIO? (and how likely is it?)
> 3. Is it REVERSIBLE? How hard is it to switch to a different option later?
>    - Easy: change a config, swap an import
>    - Medium: refactor some code, migrate some data
>    - Hard: rewrite significant portions, lose data or history
>    - Irreversible: can't go back (e.g., public API commitments)
> 4. What's the TIME-TO-PAIN? (how quickly would a bad choice manifest?)
>    - Immediate: breaks during implementation
>    - Weeks: breaks during scaling or edge cases
>    - Months: breaks when requirements change or team grows
>    - Years: technical debt compounds silently
> 5. What MITIGATION exists for each failure mode?
>
> Output per option: risk profile, reversibility score, time-to-pain estimate.

### Agent 3: Value & Effort Analysis (business-strategist persona)

> **Task:** Analyze the business value and practical effort of each option.
>
> For each option:
> 1. What's the IMPLEMENTATION EFFORT? (S/M/L/XL with justification)
> 2. What's the TIME TO FIRST VALUE? (how quickly does this option deliver something useful?)
> 3. What's the ONGOING MAINTENANCE COST? (not just build, but operate)
> 4. What's the USER IMPACT? (does this choice affect the end user? How?)
> 5. What's the LEARNING CURVE? (for Claude Code specifically — is this well-supported?)
> 6. Does this option create VALUE BEYOND THE DECISION? (reusable patterns, transferable knowledge)
>
> Output per option: effort estimate, time-to-value, maintenance burden, strategic value assessment.

Wait for all 3 agents to complete. Collect their outputs.

---

## PHASE 2 — SCENARIO MODELING

For each option, model the 6-month outcome:

- **What does the codebase look like?** (more complex? Simpler? Different shape?)
- **What's the maintenance burden?** (things you'll be doing regularly because of this choice)
- **What opportunities are open?** (what can you do next because of this foundation?)
- **What if requirements change?** (how resilient is this choice to pivots?)

Keep scenarios specific to THIS project and its trajectory, not generic.

---

## PHASE 3 — SYNTHESIS

Produce a decision matrix:

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Architectural fit | ... | ... | ... |
| Risk level | ... | ... | ... |
| Reversibility | ... | ... | ... |
| Implementation effort | ... | ... | ... |
| Time to value | ... | ... | ... |
| Maintenance cost | ... | ... | ... |
| Optionality preserved | ... | ... | ... |

Weight criteria based on the project's current phase:
- **Early/foundation phase:** weight optionality and time-to-value highest
- **Pre-launch:** weight effort and risk highest
- **Growth:** weight scalability and maintenance highest
- **Mature:** weight stability and reversibility highest

Produce a clear **recommendation** with:
- The recommended option
- Confidence level: HIGH (clear winner), MEDIUM (tradeoffs are real), LOW (genuinely uncertain)
- The ONE THING that would change this recommendation
- What we'd need to LEARN to increase confidence

---

## PHASE 4 — ENHANCEMENT OUTPUT

Produce the enhancement artifact in the standard format (processed by `/engine` Step 5e):

- `type`: `enriched-decision`
- `target`: the decision statement
- `summary`: recommendation with confidence level
- `enrichments`: [scenario-modeling, tradeoff-analysis, risk-assessment, reversibility-mapping]
- `personas_consulted`: [architect, failure-engineer, business-strategist]

---

## PHASE 5 — BRIEFING

Present the enhanced decision to the user. Structure:

1. **The decision, framed:** Clear statement of what's being decided and the options
2. **The recommendation:** "Based on [project context], I'd recommend [option] because [reason]."
3. **The key tradeoff:** "The main thing you'd be giving up is [X]. The main thing you'd gain is [Y]."
4. **Reversibility:** "If this turns out wrong, [how hard to change course]."
5. **Confidence:** "I'm [HIGH/MEDIUM/LOW] confidence. The thing that would change my mind is [X]."
6. **Decision matrix:** The full comparison for their review

Keep it conversational. This is a advisor briefing, not a research paper.

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
