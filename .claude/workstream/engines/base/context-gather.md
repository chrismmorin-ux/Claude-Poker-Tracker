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

---

## Subagent Briefing Convention (R1 / R2 / R3)

Phase 0 above runs **once, in the parent**. Every expert subagent an engine
dispatches is a **separate API call** — the parent's cached context prefix is
NOT shared across forks. So every byte a fork reads or is told is paid again, in
full, per fork. With 6 experts, re-reading the `system/` set above (~33K tokens)
costs ~200K uncached tokens per run. This is the single largest token leak in
agent-dispatch engines. The same principle behind `INV-cli-envelope-consumed-completely`
(the parent loads `system/` once and must not re-read it) extends across the
fork boundary: **subagents must not independently re-pump `system/` either.**

When authoring a subagent dispatch prompt (or an agent definition's context-read
block), follow these three rules:

- **R1 — Dispatch prompts are paths + a tight question + an output shape.**
  State (a) the exact files and line ranges to look at, (b) one tight, falsifiable
  question or task, (c) the required output shape. Cut conversational
  re-orientation — "what the parent was doing", "the user said", "we've been
  working on…". The fork does not need the conversation; it needs its job.

- **R2 — A fork reads only what its lens needs.** Name the specific files (and,
  where they are large, the sections or line ranges) the lens actually requires —
  never the whole `system/` set "just in case". `invariants.md` and `decisions.md`
  are the giants; a lens that doesn't need them must not open them. Where the
  parent already holds the relevant slice from Phase 0, pass IDs (invariant IDs,
  decision IDs, AS-N tags) in the briefing rather than telling the fork to
  re-open and re-scan the file.

- **R3 — Load-bearing scaffolding is exempt (the FAIL-014 carve-out).**
  Adversarial scaffolding that is *intentionally* structured and verbose — the
  cross-critic mandatory checklist, the blind-context seed, required output
  schemas — is task-essential, not narrative. Keep it verbatim. The convention
  strips *re-orientation*, never *structure*. (FAIL-014: generic cross-critic
  prompts flatline into boilerplate; AS-62: the 6-phase structure must hold.)

New agent-dispatch engines inherit this section via `extends: context-gather`.
See `docs/EXTENDING.md` for the authoring checklist.
