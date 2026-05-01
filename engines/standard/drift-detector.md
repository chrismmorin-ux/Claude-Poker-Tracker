---
name: drift-detector
description: "Staleness and drift detection — checks for divergence between documented state and actual state, stale assumptions, and missing analysis"
user-invocable: false
---

# Drift Detector Engine

Detects drift between what's documented and what's true, identifies stale assumptions, and generates new work through introspective questioning.

## Focus Area

$ARGUMENTS (or "full" if not provided)

---

## PHASE 0 — GATHER CONTEXT

Read all system state files:
1. `system/state.md` — documented vital signs and metrics
2. `system/invariants.md` — rules that must hold
3. `system/constraints.md` — assumptions and boundaries
4. `system/decisions.md` — past decisions with dates
5. `system/failures.md` — known failure modes
6. `CLAUDE.md` — project spec
7. `.claude/workstream/programs/` — all program definitions
8. `.claude/workstream/queue/` — current work items
9. `.claude/workstream/engines/registry.yaml` — available engines

---

## PHASE 1 — DRIFT DETECTION

### 1a. State Drift
Compare `system/state.md` to actual state:
- Run vital sign check commands — do results match documented status?
- Check `Last updated` timestamp — flag if > 48h old
- Compare documented queue counts to actual file counts
- Flag any discrepancies as findings

### 1b. Invariant Drift
For each invariant in `system/invariants.md`:
- If it has a check command: run it
- If it has a check pattern: grep for it
- Compare result to documented status
- Flag violations

### 1c. Decision Drift
Scan `system/decisions.md`:
- Decisions older than 90 days → flag for re-evaluation
- Decisions referencing files that no longer exist → flag
- Decisions with consequences that haven't been addressed → flag

### 1d. Documentation Drift
- Files referenced in CLAUDE.md that don't exist
- Commands listed that don't have skill files
- Architecture descriptions that don't match file structure

---

## PHASE 2 — STALENESS DETECTION

### 2a. Program Staleness
For each program in `.claude/workstream/programs/`:
- Check `last_reviewed` against `staleness_threshold_days`
- Check `scope_paths` for changes since last review: `git log --oneline --since="<date>" -- <paths>`
- Mark stale if threshold exceeded OR unreviewed changes exist

### 2b. Assumption Staleness
For each assumption in `system/constraints.md`:
- Check `last_verified` date
- If > 30 days: flag for re-verification
- If assumption references external systems: flag for freshness check

### 2c. Failure Library Staleness
For each entry in `system/failures.md`:
- Are the prevention measures still in place?
- Has the same root cause appeared again?
- Has the codebase changed around the failure point?

---

## PHASE 3 — INTROSPECTIVE QUESTIONING (AGENT DISPATCH)

Generate new work by dispatching 3 agents in parallel, each tackling 2 introspective questions through their expert lens.

### Agent 1: Failure Engineer (dispatch using `failure-engineer` persona)

> Analyze this project through two failure-focused lenses:
>
> **Question 1: "What breaks at 100x scale?"**
> For each major system component:
> - Database: what if data volume is 100x? Missing indexes? Unbounded queries?
> - API: what if request rate is 100x? Rate limiting? Connection pools?
> - Storage: what if file/blob count is 100x?
> - Processing: what if computation load is 100x?
>
> **Question 2: "What would a hostile user do?"**
> Walk through each user-facing endpoint/feature:
> - Identify: injection points, authorization gaps, abuse potential
> - Flag anything not covered by security invariants
>
> Read the codebase, system/constraints.md, and system/invariants.md. Produce specific findings with file paths.

### Agent 2: Systems Architect (dispatch using `architect` persona)

> Analyze this project through two architecture-focused lenses:
>
> **Question 1: "What assumptions haven't been tested?"**
> - Read system/constraints.md — list all assumptions
> - Cross-reference with test suite — which assumptions have test coverage?
> - Flag untested assumptions as potential blind spots
>
> **Question 2: "What patterns keep recurring?"**
> - Read system/failures.md — group failures by root_cause_category
> - If 3+ failures share a category: the class of bug needs elimination
> - Propose structural fixes for recurring categories
>
> Read the codebase and system state files. Produce specific findings.

### Agent 3: Senior Engineer (dispatch using `senior-engineer` persona)

> Analyze this project through two quality-focused lenses:
>
> **Question 1: "What engines should exist but don't?"**
> - Read .claude/workstream/engines/registry.yaml for installed engines
> - Based on the project type and codebase, what analysis domains have no engine coverage?
> - What types of problems keep appearing that an engine could catch?
> - Suggest new engines to build via `/build-engine`
>
> **Question 2: "What would embarrass us in a code review?"**
> - Scan for: TODO/FIXME/HACK comments older than 30 days
> - Check for: commented-out code, dead code paths, unused exports
> - Look for: inconsistent error handling, missing input validation
>
> Read the codebase. Produce specific findings with file paths.

Wait for all 3 agents to return. Merge their findings.

**Error Handling:**
- If an agent returns empty output: note which agent failed, proceed with remaining agents
- If fewer than 2 agents return usable output: warn user, introspective analysis is incomplete
- If no agents return: skip Phase 3 entirely, proceed to Phase 4 with only drift/staleness findings from Phases 1-2

### Infrastructure Drift Check (automated, not agent)

Additionally, check for CWOS infrastructure drift:
- Read `.cwos-version` if it exists — compare against current HomeBase version
- Read engine registry — check against HomeBase engine INDEX for new engines available
- Flag any "CWOS update available" as a MEDIUM finding

---

## PHASE 4 — GENERATE FINDINGS

For all drift, staleness, and introspective issues found:
- Create findings with appropriate severity
- Group findings by category for clarity
- Create work items for actionable findings

---

## PHASE 5 — REPORT

```
## Drift Detection Report

### Drift Found
| Area | Type | Severity | Detail |
|------|------|----------|--------|
| state.md | State drift | medium | Tests documented GREEN but 3 failing |
| invariants | Violation | high | Org-scope invariant broken in new endpoint |
| decisions | Stale | low | DEC-003 is 120 days old, references removed file |

### Staleness
| Item | Days Since Review | Changes Pending |
|------|-------------------|-----------------|
| prog-security | 45 | 12 commits |
| Assumption A3 | 60 | Not verified |

### Introspective Findings
| Question | Findings | Items Created |
|----------|----------|---------------|
| 100x scale | 3 issues | WS-NNN, WS-NNN |
| Untested assumptions | 2 gaps | WS-NNN |
| Missing engines | 1 suggestion | — |

### Recommendations
1. [Top recommendation]
2. [Second recommendation]
3. [Third recommendation]
```
