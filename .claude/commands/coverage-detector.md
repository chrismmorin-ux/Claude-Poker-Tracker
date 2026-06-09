---
name: coverage-detector
description: "Detects blind spots in CWOS coverage — flags missing engines, personas, programs, and unmonitored code areas as the project evolves"
procedure: agent-dispatch
extends: context-gather
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: coverage-detector` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Coverage Detector Engine

Analyzes the gap between what the repo IS and what CWOS COVERS. Detects when the project evolves in ways that outgrow current engine, persona, and program coverage. Recommends new infrastructure to patch blind spots.

## Focus Area

$ARGUMENTS (or "full" for complete coverage analysis)

---

## PHASE 0 — GATHER CONTEXT

Read current CWOS infrastructure:
1. `CLAUDE.md` — project purpose, tech stack, architecture
2. `.claude/workstream/engines/registry.yaml` — installed engines
3. `.claude/workstream/programs/` — active programs and their scope_paths
4. `.claude/agents/` — installed personas
5. `.cwos-version` — adoption metadata (if exists)
6. `system/state.md` — current state

Read current repo state:
7. Package files (`package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, etc.)
8. Directory structure (top 3 levels)
9. `git log --oneline -50` — recent trajectory
10. `git log --format='%H' --diff-filter=A -- . | head -20` — recently added files

---

## PHASE 1 — DISPATCH ANALYSIS AGENTS (PARALLEL)

Launch 3 agents in parallel:

### Agent 1: Tech Stack Scanner (use architect persona)

> Analyze the project's technology stack and compare against available CWOS engines.
>
> Read package files and source code to identify:
> - Frameworks in use (React, Django, Express, etc.)
> - Databases (PostgreSQL, MongoDB, Redis, etc.)
> - Third-party services (Stripe, AWS, auth providers, etc.)
> - Programming languages and their relative weight
> - Testing frameworks
> - Build tools and CI/CD
>
> For each technology identified, check: does an engine or persona exist that covers this domain? Flag any technology without specific engine coverage.
>
> Output: List of technologies with coverage status (COVERED / PARTIALLY / UNCOVERED)

### Agent 2: Architecture Drift Scanner (use senior-engineer persona)

> Compare the project's current structure to what was documented at adoption time.
>
> Read the directory structure and recent git history. Identify:
> - New directories created since last coverage check
> - New file patterns emerging (new file types, new naming conventions)
> - New domain areas appearing (new models, new API endpoints, new features)
> - Significant structural changes (moved files, renamed modules, new layers)
> - Dependencies added recently
>
> For each change, assess: does existing CWOS infrastructure (engines, personas, programs) cover this new area?
>
> Output: List of structural changes with coverage impact assessment

### Agent 3: Growth Pattern Scanner (use failure-engineer persona)

> Analyze git commit patterns to identify where the project is growing and changing most.
>
> Run:
> - `git log --format='%H' --since='30 days ago' -- <directory>` for each top-level directory to measure change velocity
> - `git diff --stat HEAD~50` to see cumulative change surface area
> - Identify: which areas are hot (high change rate)? Which are cold (no changes)?
>
> For each hot area: is it covered by a CWOS program with appropriate staleness_threshold? Is it covered by engine analysis?
> For each cold area: is it being neglected or is it simply stable?
>
> Flag areas with high change velocity but no program monitoring.
> Flag areas where the TYPE of changes has shifted (e.g., was config changes, now business logic changes).
>
> Output: Change velocity map with monitoring coverage assessment

**Error Handling:**
- If an agent returns empty output: note which agent failed, proceed with remaining agents
- If fewer than 2 agents return usable output: warn user, coverage analysis is incomplete — some blind spots may be missed
- If no agents return: skip to CWOS Version Check only, note "Agent-based analysis unavailable" in report

---

## PHASE 2 — COVERAGE GAP ANALYSIS

With all 3 agent outputs (or however many returned), cross-reference against:

### Engine Coverage
Read `engines/registry.yaml` (installed engines) and compare against the full HomeBase engine library. For each gap:
- Is there a HomeBase engine that covers this? → Recommend install
- Is there no engine for this domain? → Recommend `/build-engine`

### Persona Coverage
Read `.claude/agents/` (installed personas) and compare against the full HomeBase persona library. For each gap:
- Is there a HomeBase persona that covers this? → Recommend install
- Is there no persona for this domain? → Recommend creating one via `/build-engine`

### Program Coverage
Read `.claude/workstream/programs/` and compare scope_paths against actual active code directories. For each gap:
- Active code directory not covered by any program → Recommend new program
- Program scope_paths that reference directories that no longer exist → Flag stale program
- Program scope_paths too broad (covering everything) → Recommend splitting

### CWOS Version Check
If `.cwos-version` exists:
- Compare version against current HomeBase version
- Flag if HomeBase has new engines, personas, or commands since adoption
- Recommend `re-run /adopt` if significant updates available

---

## PHASE 3 — RECOMMENDATIONS

Categorize recommendations:

### Install from HomeBase Library
Engines and personas that exist in HomeBase but aren't installed in this repo.
```
| Component | Type | Why It's Needed |
|-----------|------|-----------------|
| design-audit | engine | Repo now has frontend components (End-user surface scoring) |
| financial-auditor | persona | Payment processing was added |
```

### Build New (doesn't exist yet)
Domains that need coverage but no HomeBase component exists.
```
| Proposed | Type | What It Would Cover |
|----------|------|-------------------|
| graphql-audit | engine | GraphQL schema and resolver analysis |
| ml-engineer | persona | ML model evaluation and data pipeline review |
```

### Update Existing
Programs, scope_paths, or engine configurations that need adjustment.
```
| Component | Change | Reason |
|-----------|--------|--------|
| prog-engineering | Add src/api/ to scope_paths | New API module not monitored |
| prog-design | Reduce staleness to 7 days | Frontend is changing rapidly (End-user surface) |
```

### Upgrade CWOS
If HomeBase has evolved since adoption.
```
| Available Update | Impact |
|-----------------|--------|
| coverage-detector engine (new) | Enables this analysis going forward |
| cross-critic persona (new) | Improves eng-engine cross-critique quality |
```

---

## PHASE 4 — FINDINGS & WORK ITEMS

Severity mapping:
| Gap Type | Severity |
|----------|----------|
| Active code area with zero coverage | HIGH |
| New technology without engine coverage | HIGH |
| Program scope_paths stale / missing directories | MEDIUM |
| HomeBase update available | MEDIUM |
| Cold code area not monitored (but stable) | LOW |

Create findings and work items per standard pipeline.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

---

## PHASE 5 — REPORT

```
## Coverage Detector Report

### Coverage Score: [N]% of active code covered by programs

### Tech Stack Coverage
| Technology | Engine Coverage | Persona Coverage | Status |
|-----------|---------------|-----------------|--------|
| React | eng-engine, design-audit | product-ux-engineer | ✓ COVERED |
| PostgreSQL | eng-engine | architect | ✓ COVERED |
| Stripe | — | — | ⚠ UNCOVERED |

### Change Velocity vs Monitoring
| Directory | Changes (30d) | Program | Engine Coverage | Status |
|-----------|--------------|---------|----------------|--------|
| src/api/ | 45 commits | — | eng-engine only | ⚠ GAP |
| src/ui/ | 12 commits | prog-design | design-audit | ✓ OK |
| src/models/ | 3 commits | prog-engineering | eng-engine | ✓ OK |

### Recommendations
| Priority | Action | Type |
|----------|--------|------|
| HIGH | Install financial-audit engine | Install from HomeBase |
| HIGH | Create program for src/api/ | Update existing |
| MEDIUM | Build graphql-audit engine | Build new |
| LOW | Update CWOS to latest HomeBase | Upgrade |

### Infrastructure Gaps Patched
[Work items created for each gap]
```

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
