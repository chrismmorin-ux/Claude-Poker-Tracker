---
name: refactor-prep
description: "Map dependency graph, test coverage gaps, and shared interfaces before refactoring — zero impact guaranteed"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: refactor-prep` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Refactor Preparation Protocol

**SAFETY: This engine is READ-ONLY. It makes NO code changes, NO state changes, and NO file modifications. It only reads and documents.**

You are preparing the user for a safe, well-informed refactoring. Your job is to map everything connected to the target code so there are no surprises during the actual change.

## Focus Area

$ARGUMENTS — should describe what is being refactored (e.g., "src/auth module", "the payment processing pipeline", "UserService class").

If no argument given, ask: "What are you planning to refactor?"

---

## PHASE 0 — GATHER CONTEXT

Read these to understand the target:

1. `CLAUDE.md` — project patterns, architecture
2. `system/invariants.md` — rules that must hold during refactoring
3. `system/constraints.md` — hard constraints that limit options
4. `system/decisions.md` — settled decisions about this area (don't re-litigate)
5. Identify the target files/modules from the focus area argument
6. Run `git log --oneline -20 -- <target paths>` — recent change history for these files

---

## PHASE 1 — PARALLEL MAPPING

Launch 3 agents in parallel using the Agent tool. Each agent MUST be read-only — no Write, Edit, or destructive Bash commands.

### Agent 1: Dependency Tracer (architect persona)

> **Task:** Map all dependencies of the refactoring target.
>
> For each file in the target area:
> 1. Trace all IMPORTS — what does this code depend on?
> 2. Trace all CONSUMERS — what depends on this code? (grep for imports of these modules)
> 3. Identify SHARED INTERFACES — types, function signatures, API contracts that cross module boundaries
> 4. Note TRANSITIVE DEPENDENCIES — things that depend on things that depend on this code
>
> Output as a structured dependency map:
> - Direct dependencies (this code → other modules)
> - Direct consumers (other modules → this code)
> - Shared interfaces (types/contracts that bridge modules)
> - Transitive impact (second-order effects)
>
> Reference specific file paths and line numbers. Be exhaustive — a missed dependency during refactoring causes production bugs.

### Agent 2: Test Coverage Mapper (senior-engineer persona)

> **Task:** Map test coverage for the refactoring target.
>
> 1. Find ALL test files that test the target code (by import, by naming convention, by file proximity)
> 2. For each target file, assess: is it directly tested? Indirectly tested? Not tested at all?
> 3. Identify COVERAGE GAPS — code paths with no test coverage that would be at risk during refactoring
> 4. Identify FRAGILE TESTS — tests that test implementation details (mock-heavy, tightly coupled) vs behavior (input→output)
> 5. Note any integration tests that would catch cross-module breakage
>
> Output:
> - Files with direct test coverage (and which test files)
> - Files with indirect coverage only
> - Files with NO coverage (highest risk during refactoring)
> - Fragile tests that will likely break even with correct refactoring
> - Missing integration tests that should exist

### Agent 3: Interface Contract Analyzer (failure-engineer persona)

> **Task:** Identify everything that could break if the shape of this code changes.
>
> 1. Find all PUBLIC interfaces — exported functions, classes, types, API endpoints
> 2. For each interface, determine: is it used only internally, or does it cross a boundary?
> 3. Identify IMPLICIT CONTRACTS — things that aren't typed but are assumed (ordering, side effects, return shape)
> 4. Find CONFIGURATION DEPENDENCIES — env vars, config files, feature flags that affect this code
> 5. Look for RUNTIME DEPENDENCIES — database queries, API calls, file system operations tied to this code
>
> Output:
> - Public interfaces with consumer count
> - Cross-boundary interfaces (HIGHEST RISK — changing these affects other modules)
> - Implicit contracts (undocumented assumptions)
> - Configuration and runtime dependencies

Wait for all 3 agents to complete. Collect their outputs.

---

## PHASE 2 — VERIFICATION

With all mapping data collected, verify preconditions for safe refactoring:

### Precondition Checklist
For each, determine pass/fail/unknown:

1. **Test coverage exists** — at least the core paths of the target code are tested
2. **No circular dependencies** — the dependency graph doesn't create cycles with the target
3. **Interfaces are documented** — shared interfaces have type definitions or clear contracts
4. **Recent changes are stable** — no active PRs or in-progress work touching these files
5. **Invariants are clear** — system invariants relevant to this code are documented
6. **Rollback is possible** — the refactoring can be done incrementally with git checkpoints

### Risk Assessment
For each risk found, classify:
- **High:** Would cause production breakage or data loss if missed
- **Medium:** Would cause test failures or functionality regression
- **Low:** Would cause code quality issues or developer confusion

---

## PHASE 3 — SEQUENCING

Based on the dependency map and coverage analysis, produce:

### Recommended Refactoring Order
1. Start with **leaf dependencies** (files nothing depends on) — safest to change first
2. Then **internal modules** with good test coverage
3. Then **shared interfaces** — change the contract, update all consumers
4. Last: **cross-boundary interfaces** — highest risk, do only after everything else is stable

### Safe Stop Points
Identify points where the refactoring can be PAUSED and the codebase still works:
- "After renaming internal functions but before changing the public API"
- "After updating module A's consumers but before touching module B"
- Each stop point should be a valid commit point

### Parallel Tracks
If parts of the refactoring are independent, identify them:
- "src/auth/login.ts and src/auth/signup.ts can be refactored in any order"
- "But src/auth/middleware.ts must wait until both are done"

---

## PHASE 4 — READINESS REPORT

Compile the readiness report in the standard format (processed by `/engine` Step 5f):

- `target`: the refactoring description from arguments
- `status`: `ready` if all high-risk preconditions pass, `blocked` if any fail, `needs-review` if unknowns exist
- `preconditions`: the checklist from Phase 2
- `blast_radius`: files, interfaces, and data affected
- `rollback_plan`: git-based rollback steps
- `migration_steps`: the sequenced refactoring order from Phase 3
- `safe_stop_points`: from Phase 3
- `estimated_effort`: S (< 1 hour), M (1-4 hours), L (4+ hours)

---

## PHASE 5 — BRIEFING

Present to the user in plain language:

1. **Scope:** "Here's everything connected to what you're refactoring" (summary counts)
2. **Risk:** "The highest-risk area is [X] because [Y]" (top 1-2 risks)
3. **Coverage:** "You have good test coverage for [X] but none for [Y]" (biggest gap)
4. **Sequence:** "The safest order is: [1, 2, 3]" (top-level steps)
5. **Readiness:** "Overall: [ready/blocked/needs-review]" with specific blockers if any

End with the safety confirmation: "No files were modified by this analysis."

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
