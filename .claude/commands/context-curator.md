---
name: context-curator
description: "Audit and optimize the context repository for a specific persona, making future engine runs more effective"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: context-curator` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Context Curator Engine

You are optimizing a persona's effectiveness by curating the context it has access to. Every persona reads certain files before analyzing — if those files are incomplete, outdated, or missing key information, the persona's analysis suffers. Your job is to find the gaps and recommend how to fill them.

The user doesn't manage context files directly — Claude does, through personas. Improving context at the persona level means the improvement automatically flows into every engine that uses that persona.

## Input

$ARGUMENTS — the persona to curate context for (e.g., "architect", "security-engineer", "financial-auditor").

If no argument given, ask: "Which persona should I optimize context for?" and list available personas from `.claude/agents/`.

---

## PHASE 0 — GATHER CONTEXT

1. Read the target persona's definition from `.claude/agents/<persona-name>.md`
2. Parse the persona's CORE CONTEXT section — what files does it currently read?
3. Read `CLAUDE.md` — project architecture and patterns
4. Read `system/state.md` — current vital signs
5. Scan `.claude/workstream/findings/` — look for findings produced by engines that USE this persona. Note patterns of "insufficient context" or "unable to determine" in finding descriptions
6. Scan `.claude/workstream/runs/` — check recent engine runs that used this persona for quality signals

Identify:
- **What the persona is supposed to evaluate** (from its "YOUR LENS" and "What You Look For" sections)
- **What context it currently reads** (from CORE CONTEXT)
- **Where its analysis has been weak** (from findings/runs)

---

## PHASE 1 — PARALLEL AUDIT

Launch 2 agents in parallel using the Agent tool.

### Agent 1: Context Coverage Analyzer (architect persona)

> **Task:** Audit whether the target persona has access to all the information it needs.
>
> The target persona is: [name]
> It evaluates: [lens categories from persona definition]
> It currently reads: [list of CORE CONTEXT files]
>
> 1. For EACH evaluation category in the persona's "What You Look For" section:
>    - What information does this category need?
>    - Is that information available in the persona's current CORE CONTEXT files?
>    - If not, WHERE in the repo does that information live? (grep for relevant patterns)
>    - If nowhere, what system file SHOULD contain it?
>
> 2. Scan the repo for information RELEVANT to this persona that isn't in any system file:
>    - Architecture decisions in code comments that should be in decisions.md
>    - Implicit constraints in code that should be in constraints.md
>    - Patterns documented in README but not in CLAUDE.md
>    - Domain knowledge in comments that has no system-level documentation
>
> 3. Check for STALE CONTEXT — files the persona reads that have become outdated:
>    - Does state.md reflect current reality?
>    - Are invariants still valid?
>    - Have constraints changed since they were documented?
>
> Output:
> - Coverage map: each evaluation category → available context (complete/partial/missing)
> - Information found in code but not in system files
> - Stale context references

### Agent 2: Effectiveness Analyzer (senior-engineer persona)

> **Task:** Analyze how effective this persona has been and what would make it better.
>
> The target persona is: [name]
>
> 1. Read the last 5-10 findings from engines that used this persona:
>    - Were findings specific and actionable? Or vague and generic?
>    - Did findings reference real file paths and line numbers? Or make broad claims?
>    - Were any findings later closed as "not applicable" or "false positive"?
>
> 2. Look for PATTERNS in the persona's output quality:
>    - Areas where it consistently finds real issues (strength)
>    - Areas where it consistently misses things or makes wrong claims (weakness)
>    - Areas where it says "I don't have enough context to assess" (explicit gap)
>
> 3. Compare the persona's CHECK LIST to the actual codebase:
>    - Are any checks irrelevant to this project? (e.g., checking for SQL injection in a project with no database)
>    - Are there project-specific concerns the checks don't cover?
>
> Output:
> - Effectiveness assessment per evaluation category
> - Patterns of strength and weakness
> - Checks that should be added, removed, or modified
> - Specific context additions that would address weaknesses

Wait for both agents to complete. Collect their outputs.

---

## PHASE 2 — SYNTHESIS

Combine the coverage audit and effectiveness analysis into actionable recommendations.

For each gap identified, produce one of three recommendation types:

### Type 1: Context File Additions
Information that should be added to existing system files so the persona can read it:
- Which file to update (e.g., `system/invariants.md`, `system/constraints.md`, `CLAUDE.md`)
- What content to add
- Why it helps this persona

### Type 2: New System Documentation
Information that lives in code but should have a system-level document:
- What document to create
- What content it should contain (sourced from code comments, READMEs, etc.)
- Which personas beyond the target would benefit

### Type 3: Persona Definition Updates
Changes to the persona file itself:
- New evaluation categories to add
- Existing checks to modify or remove
- New CORE CONTEXT files to read
- Blind spots to document

---

## PHASE 3 — ENHANCEMENT OUTPUT

Produce the enhancement artifact in the standard format (processed by `/engine` Step 5e):

- `type`: `enriched-context`
- `target`: "Context optimization for [persona-name] persona"
- `summary`: what was found and the top recommendations
- `enrichments`: categorized as context-file-additions, new-documentation, persona-definition-updates
- `personas_consulted`: [architect, senior-engineer]

---

## PHASE 4 — BRIEFING

Present the recommendations to the user:

1. **Current state:** "The [persona] currently reads [N] files and evaluates [N] categories"
2. **Gaps found:** "I found [N] areas where the persona lacks context it needs" (top 2-3 specific gaps)
3. **Impact:** "Filling these gaps would improve [specific analysis areas] — meaning engines like [X] would catch issues they currently miss"
4. **Recommendations:** Prioritized list (most impactful first) with effort level
5. **Next steps:** "Want me to apply these recommendations?" (the actual updates require a separate action — this engine only recommends)

Keep it practical. The user cares about "will my engines work better?" not "the persona's coverage matrix has gaps in quadrant 3."

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
