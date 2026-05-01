---
name: goal-progress
description: "Scores findings against repo_goal — advances-goal vs maintenance ratio (enforces P1)"
user-invocable: true
argument-hint: "[--run <run-id>] [--sprint <sprint-id>]"
---

# Goal-Progress Engine

Enforces constitutional principle **P1 — the repo's goal is supreme**. Given a finding set (from an engine run or a sprint), classify each finding as advancing the captured `repo_goal`, maintenance/infrastructure work, or mixed — then produce a ratio and a deprioritization recommendation.

This is a `briefing`-category engine. Output is inline and ephemeral. It does NOT produce new findings, does NOT mutate state, does NOT persist a run manifest. The founder reads the report and acts on it immediately (re-rank, defer items).

---

## Input

The input artifact is a **finding set** resolved from the command's arguments:

- `--run <run-id>` → read all `findings/FIND-*.yaml` where `run_id == <run-id>`
- `--sprint <sprint-id>` → read the sprint's `items:` list, then collect `findings/FIND-*.yaml` referenced by each item's `finding_id` field (ignore items without a finding_id — they're non-finding-originated work)
- default (no args) → resolve the most recent run from `.claude/workstream/runs/run-*/manifest.yaml` (highest numeric ID), use its findings

**Parsing rules:**
- If the finding set is empty (zero findings for the resolved run/sprint) → output "No findings to score for <target>" and exit. Do NOT dispatch the agent.
- If arguments resolve nothing (e.g., `--run run-999` doesn't exist) → error with the specific lookup that failed.

Also read the **goal context** from `.cwos-onboarding.yaml`:
- `repo_goal` (the captured single-string outcome sentence)
- `goal_is_placeholder` (bool, defaults false if missing)

**If `goal_is_placeholder: true` OR `repo_goal` is empty/missing:** skip classification entirely and render the placeholder fallback briefing (see `## Briefing Template` below). Do NOT dispatch the agent, do NOT fabricate a ratio.

---

## Refinement Rules

Dispatch **one agent** using the `product-ux` persona (already defined in `.claude/agents/product-ux.md`, used by eng-engine Phase 1). The agent receives:

- The repo_goal verbatim
- The full finding set (each finding's `id`, `title`, `description`, `evidence`, `priority_score`)
- This classification rubric:

```
For each finding, classify one of:

  advances_goal — Closing this finding directly moves the repo toward the
                  stated goal. If the founder deprioritized it, the goal
                  becomes measurably harder to reach.

  tech_debt     — Closing this finding keeps the system healthy but does
                  not, on its own, advance the goal. Maintenance work,
                  infrastructure, safety nets, internal dev ergonomics.

  mixed         — Touches both — goal-adjacent but also has a maintenance
                  component. Rank by goal-advancement within this bucket.

Apply this test to borderline cases: "If I close this finding and nothing
else, can I point to a measurable step toward the goal that just happened?"
Yes → advances_goal. No → tech_debt. "Sort of, depending on what else
happens" → mixed.

DO NOT use the word "tech debt" in user-facing output. The user sees the
label as "maintenance/infrastructure" (see Briefing Template). "tech_debt"
is an internal classification tag only.
```

Output schema for the agent (one entry per finding):

```yaml
classifications:
  - finding_id: "FIND-NNN"
    classification: advances_goal | tech_debt | mixed
    reasoning: "<one sentence tying the classification back to the goal phrase>"
```

The agent MUST quote a fragment of the repo_goal in each `reasoning` line so the classification is defensible against the captured goal, not the agent's interpretation of it.

---

## Output

After the agent returns, aggregate:

```yaml
goal_progress:
  target: "<run-<id> | sprint SPR-NNN>"
  repo_goal: "<verbatim quote>"
  finding_count: <N>
  advances_goal: <X>
  tech_debt: <Y>
  mixed: <Z>
  recommendation: "on_track" | "defer_maintenance" | "reassess_goal"
  advances_goal_findings: ["FIND-NNN", ...]   # for the briefing summary
  tech_debt_findings: ["FIND-NNN", ...]
  mixed_findings: ["FIND-NNN", ...]
```

**Recommendation rule:**
- `X > Y` → `on_track`
- `Y >= X` (and X > 0) → `defer_maintenance`
- `X == 0 AND Y > 0` → `reassess_goal` (goal and findings are totally disjoint — either the goal is mis-captured or the work has drifted)
- `N == 0` (empty set handled earlier, but defensive) → no recommendation, output empty-set message

**No files written.** This is a briefing-category engine — the aggregated result is passed directly to the Briefing Template for inline rendering.

---

## Briefing Template

**Standard case (real goal captured, N > 0):**

```
## Goal-Progress Report

**Your goal:** <repo_goal verbatim, quoted>

Of <N> findings [from <target>]:
- **<X> advance your goal** — <one-line summary listing 2-3 representative FIND-IDs and what they do>
- **<Y> are maintenance/infrastructure** — important, but don't let them crowd out goal-advancing work
[If Z > 0:]
- **<Z> are mixed** — touch both the goal and the foundation; rank by goal-advancement within this group

[If recommendation == "defer_maintenance":]
**Recommendation:** the next sprint should concentrate on the <X> goal-advancing findings. Consider deferring the <Y> maintenance items unless one is an acute risk.

[If recommendation == "on_track":]
**On track.** The current finding mix is weighted toward your goal.

[If recommendation == "reassess_goal":]
**Reassess.** None of the current findings directly advance your captured goal. Either the goal needs refining (re-run /adopt to update) or the current work has drifted from the goal — worth a checkpoint before committing to more sprints here.
```

**Empty-set case (N == 0):**

```
## Goal-Progress Report

No findings to score for <target>. Run an engine first (e.g., `/engine eng-engine`)
and invoke goal-progress against the new run.
```

**Placeholder-goal case (goal_is_placeholder OR empty):**

```
## Goal-Progress Report

Repo goal not yet captured — I can't score findings without one. Your
.cwos-onboarding.yaml has the placeholder fallback, not a real outcome sentence.

To set a goal: re-run /adopt (or manually edit system/intention.md's
"Imagined Outcome" section to a single outcome sentence like
"Ship X that does Y for Z users by Q3"). Goal-progress will run cleanly
once a real goal is captured.
```

---

## Notes for the engine runner

- This engine uses `procedure: single-pass`, `size: light` (per the single-pass procedure's sizing table at `engines/procedures/single-pass.md`). One agent, ~30 sec.
- The engine is **never auto-chained** by default. Any engine's registry entry MAY opt in via `chains.on_complete: [goal-progress]`, but no engine ships that way. Auto-chaining after every analysis engine would reintroduce the ceremony theater that WS-124 eliminated.
- Because this is `category: briefing`, `/engine` Step 9b (Finding Feedback Prompt) is skipped automatically — no findings produced means no per-finding feedback prompt.
- Because `impact: informational`, `/engine` Step 3b displays the safety guarantee: "This engine is read-only. It will not modify any files."
