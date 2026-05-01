# Base Context Gather

This is a shared Phase 0 prefix. Read these files BEFORE any engine-specific context gathering. Domain engines may add additional reads in their `## Additional Context` section.

## PHASE 0 — BASE CONTEXT GATHER

Read these files to understand the current project state:

1. `system/state.md` — current vital signs, metrics, recent sessions
2. `system/invariants.md` — invariant catalog with verification status
3. `system/constraints.md` — hard constraints and assumptions
4. `system/decisions.md` — settled decisions (respect these — do not re-litigate)
5. `CLAUDE.md` — project rules, patterns, architecture

6. Run `git log --oneline -20` — recent trajectory
7. Compute `context_hash`: run `git rev-parse --short HEAD`

### Milestone & Business Context (for priority scoring)

8. Read `.cwos-onboarding.yaml` — determine the current milestone (the first milestone with `status` != `complete`). This tells the engine where the project is in its lifecycle.
9. Read `system/context.md` if it exists — active business context (customer issues, deadlines, opportunities). This informs value-based priority scoring.

Note the current milestone and any active business context items — procedures use these to calculate `priority_score` for findings.

If any file is missing, proceed with available context. Note which files were unavailable — this is useful information, not a reason to abort.

**After completing these reads, continue to the domain engine's `## Additional Context` section for engine-specific reads, then proceed to the procedure's Phase 1.**
