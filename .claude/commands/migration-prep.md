---
name: migration-prep
description: "Map queries, callers, and rollback paths before a database or data migration — zero impact guaranteed"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: migration-prep` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Migration Preparation Protocol

**SAFETY: This engine is READ-ONLY. It makes NO code changes, NO database changes, NO state changes, and NO file modifications. It only reads and documents.**

You are preparing the user for a safe, well-informed data migration. Your job is to map everything that touches the affected data so there are no surprises during the actual migration.

## Focus Area

$ARGUMENTS — should describe the migration (e.g., "add email_verified column to users table", "migrate from MongoDB to PostgreSQL", "rename payment_status enum values").

If no argument given, ask: "What migration are you planning?"

---

## PHASE 0 — GATHER CONTEXT

Read these to understand the data landscape:

1. `CLAUDE.md` — project patterns, database conventions
2. `system/invariants.md` — data integrity rules that must hold during migration
3. `system/constraints.md` — hard constraints (uptime requirements, data retention rules)
4. `system/decisions.md` — prior decisions about data architecture
5. Identify schema files, ORM models, migration history:
   - Glob for `**/migrations/**`, `**/schema.*`, `**/models/**`, `**/*.prisma`, `**/knexfile.*`, `**/alembic/**`
   - Read recent migration files to understand conventions
6. `git log --oneline -10 -- <schema/migration paths>` — recent schema change history

---

## PHASE 1 — PARALLEL MAPPING

Launch 3 agents in parallel using the Agent tool. Each agent MUST be read-only.

### Agent 1: Query & Access Mapper (architect persona)

> **Task:** Map all code that reads from or writes to the affected data.
>
> 1. Identify the affected tables/collections/fields from the migration description
> 2. Search the ENTIRE codebase for:
>    - Direct SQL/query references to affected tables/fields
>    - ORM model references (find the model, then find all usages)
>    - Raw database access (connection pools, query builders)
>    - API endpoints that return or accept this data
> 3. For each reference found:
>    - Is it a READ or WRITE?
>    - What code path triggers it?
>    - Would it break if the schema changes? How?
>
> Output:
> - All query locations (file:line) grouped by read/write
> - All API endpoints that expose this data
> - All background jobs/cron tasks that process this data
> - Which references would break vs survive the migration

### Agent 2: Data Dependency Mapper (failure-engineer persona)

> **Task:** Map data dependencies and failure modes for this migration.
>
> 1. Find FOREIGN KEYS and RELATIONS — what other tables reference this one?
> 2. Find DENORMALIZED DATA — is this data copied/cached elsewhere? (Redis, Elasticsearch, materialized views, in-memory caches)
> 3. Find DATA PIPELINES — ETL jobs, analytics queries, export scripts, reporting dashboards
> 4. Find EXTERNAL CONSUMERS — webhooks, API integrations, third-party services that receive this data
> 5. Assess DATA VOLUME — estimate row count or data size (from schema, from recent queries, from code comments)
>
> For each dependency, assess:
> - What happens if the migration runs while this dependency is active?
> - What happens if the migration fails halfway?
> - What data would be inconsistent if the migration is rolled back after new data is written?
>
> Output:
> - Relational dependencies (FK map)
> - Cache/denormalization locations
> - Pipeline and external consumer list
> - Failure mode analysis for each dependency

### Agent 3: Rollback Path Analyzer (senior-engineer persona)

> **Task:** Map the rollback strategy for this migration.
>
> 1. Does a REVERSE MIGRATION exist? If not, what would one look like?
> 2. Is this migration REVERSIBLE?
>    - Adding a column: yes (drop it)
>    - Renaming a column: yes (rename back)
>    - Changing data types: maybe (depends on data loss)
>    - Deleting data: NO (point of no return)
> 3. What is the POINT OF NO RETURN? — the moment after which rollback loses data
> 4. What happens to DATA WRITTEN BETWEEN migration and rollback?
>    - New rows using new schema: lost on rollback?
>    - Modified rows: can they be reverted?
> 5. What is the ESTIMATED DOWNTIME or LOCK TIME?
>    - Small table: instant
>    - Large table: may lock for minutes
>    - Online migration: no lock but takes longer
>
> Output:
> - Rollback procedure (step by step)
> - Point of no return (if any)
> - Data-at-risk analysis
> - Estimated migration time and lock impact

Wait for all 3 agents to complete. Collect their outputs.

---

## PHASE 2 — VERIFICATION

With all mapping data collected, verify preconditions for safe migration:

### Precondition Checklist
For each, determine pass/fail/unknown:

1. **Reverse migration exists** — a rollback path is documented or can be created
2. **All consumers identified** — every piece of code that touches this data is mapped
3. **Cache invalidation planned** — all caches holding this data will be refreshed
4. **No active writes during migration** — or the migration handles concurrent writes safely
5. **Backup exists or can be created** — the affected data can be restored if needed
6. **Test data available** — the migration can be tested on a non-production dataset first
7. **External consumers notified** — API consumers or integrations are prepared for the change

---

## PHASE 3 — MIGRATION PLANNING

Produce a step-by-step migration procedure:

### Migration Steps
For each step, include:
- Description of what happens
- Risk level (low/medium/high)
- Verification command (how to confirm it worked)
- Estimated duration

### Pre-Migration Checklist
- [ ] Backup taken
- [ ] Monitoring in place
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback procedure tested (if possible)

### Post-Migration Verification
- [ ] Application health check passes
- [ ] Data integrity verification (count, checksum, or sample)
- [ ] All consumers responding correctly
- [ ] Caches refreshed

---

## PHASE 4 — READINESS REPORT

Compile the readiness report in the standard format (processed by `/engine` Step 5f):

- `target`: the migration description from arguments
- `status`: `ready` if all critical preconditions pass, `blocked` if any fail, `needs-review` if unknowns exist
- `preconditions`: the checklist from Phase 2
- `blast_radius`: files affected, queries affected, data stores involved
- `rollback_plan`: from Agent 3's analysis
- `migration_steps`: the sequenced procedure from Phase 3
- `safe_stop_points`: points where migration can be paused safely
- `estimated_effort`: S (< 30 min), M (30 min - 2 hours), L (2+ hours)

---

## PHASE 5 — BRIEFING

Present to the user in plain language:

1. **Scope:** "This migration touches [N] files, [N] queries, and [N] data stores"
2. **Risk:** "The highest risk is [X] because [Y]" (top concern)
3. **Rollback:** "If something goes wrong, [specific rollback path]" or "WARNING: this migration has a point of no return at [step]"
4. **Sequence:** "The recommended procedure is [N] steps, estimated at [time]"
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
