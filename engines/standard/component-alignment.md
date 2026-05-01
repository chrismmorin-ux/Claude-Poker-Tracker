---
name: component-alignment
description: "Scores installed/planned components against repo_goal — surfaces low-relevance prune candidates (enforces P3, prevents tool-shaped hammer)"
user-invocable: true
argument-hint: "[--scope planned|installed] [--exclude <unit-id>,...]"
---

# Component-Alignment Engine

Enforces constitutional principle **P3 — progressive over prescriptive** and defuses failed state #2 (tool-shaped hammer). Given a candidate list of installed or planned components, classify each as `keep`, `review`, or `skip` based on how much it serves the repo's captured `repo_goal`. Founder decides whether to prune — the engine never auto-prunes.

This is a `briefing`-category engine. Output is inline and ephemeral. It does NOT produce findings, does NOT mutate state, does NOT persist a run manifest. The caller (`/adopt` Step 4 or `/pulse` overview) reads the scorings and acts on them in the same conversation.

---

## Input

The input artifact is a **candidate unit list** resolved from the invocation context:

- `--scope planned` (invoked by `/adopt`) → candidate units are the install set about to be written. Caller builds the list from `filterByCapabilities()` output in `kit/scripts/cwos-adopt-install.js` and passes it in.
- `--scope installed` (invoked by `/pulse`) → candidate units are already on disk. Caller scans `.claude/workstream/programs/prog-*.yaml`, `engines/registry.yaml`, and the capability flags in `.cwos-onboarding.yaml`.
- default → equivalent to `--scope installed`.

`--exclude <unit-id>,...` drops specific units from scoring (used by `/adopt` when the founder has just said "skip X, Y" so we don't re-score them on a re-run).

### Scoring units (granularity)

Score **semantic units**, not per-MANIFEST-file. This keeps agent dispatch tractable (~40 units max per repo vs. 186 raw files) and matches how founders actually reason about components.

| Unit type | ID form | Name source | Description source |
|---|---|---|---|
| Program | `prog-<id>` | `prog-<id>.yaml` `name` | `capability_brief.value` if present, else `contract` first sentence, else `description` |
| Engine | `eng-<name>` (or just `<name>`) | engine registry entry or skill frontmatter `name` | registry `description` field |
| Capability command group | `cap-<name>` (one of: `workstream`, `engines`, `governance`, `autonomous`) | capability name, Title-Case | hardcoded one-liner (see Table below) |

**Capability group descriptions (hardcoded, stable across repos):**
- `workstream` — Sprint-based work composition, queue management, program coordination
- `engines` — Multi-persona structured analysis (runs named engines against your code)
- `governance` — Program health dashboards, protocol scheduling, drift audits
- `autonomous` — Plan-mode deliberation, self-verification, overnight auto-execution

**Skip these unit types entirely** (always needed, never surfaced as prune candidates):
- Personas (dependency of engines — they follow the engine)
- Scripts (infrastructure)
- Rules (always needed)
- Config files, preamble, docs

### Goal context

Also read the goal context from `.cwos-onboarding.yaml`:
- `repo_goal` (the captured single-string outcome sentence)
- `goal_is_placeholder` (bool, defaults false if missing)

**If `goal_is_placeholder: true` OR `repo_goal` is empty/missing:** skip classification entirely and render the placeholder fallback briefing (see `## Briefing Template` below). Do NOT dispatch the agent, do NOT fabricate scorings.

**If the candidate unit list is empty:** output "No components to score for <scope>" and exit. Do NOT dispatch the agent.

---

## Refinement Rules

Dispatch **one agent** using the `product-ux` persona (already defined in `.claude/agents/product-ux.md`, same persona `goal-progress` uses). The agent receives:

- The `repo_goal` verbatim
- The full candidate unit list (each unit's `unit_id`, `unit_type`, `name`, `description`)
- This scoring rubric:

```
For each candidate component, score goal-alignment on a 0-10 scale:

  9-10 — Core to the goal. Closing the goal gap requires this component
         regularly. Obvious keeper.
   6-8 — Useful for the goal. Not always on the critical path, but earns
         its keep.
   3-5 — Marginal. The goal could be reached without it; there might be
         a scenario where it matters but it's not obvious.
   0-2 — Off-goal. Closing the goal gap never exercises this component.
         It's installed because an archetype suggested it, not because
         the goal needs it.

Apply this test to borderline cases: "Holding the goal sentence in mind,
can I construct a realistic session where a founder would reach for this
component to make progress?"
  Yes, often → 7-10
  Yes, occasionally → 4-6
  Only in a stretch → 1-3
  No → 0

Every score must be accompanied by a one-sentence reasoning that quotes
a fragment of the repo_goal verbatim. This is how the classification
stays defensible against the captured goal, not the agent's interpretation.

DO NOT recommend removal. The engine's job is to score; the founder
decides whether to prune.
```

Output schema for the agent (one entry per candidate):

```yaml
scorings:
  - unit_id: "<id>"
    unit_type: "<program|engine|capability>"
    unit_name: "<human-readable name>"
    score: <0-10 integer>
    reasoning: "<one sentence quoting a fragment of repo_goal verbatim>"
```

The engine derives the `recommendation` from the score after the agent returns — the agent does NOT decide the band.

---

## Output

After the agent returns, derive `recommendation` per unit:

```
score <= 2  → recommendation: skip
score 3-5   → recommendation: review
score >= 6  → recommendation: keep
```

Then aggregate:

```yaml
component_alignment:
  scope: "planned" | "installed"
  repo_goal: "<verbatim quote>"
  unit_count: <N>
  skip_count: <N_skip>
  review_count: <N_review>
  keep_count: <N_keep>
  scorings: [...]              # full list, sorted by score ascending (lowest first)
```

**No files written.** This is a briefing-category engine — the aggregated result is passed directly to the Briefing Template for inline rendering.

---

## Briefing Template

The template branches on scope because `/adopt` and `/pulse` need different surfaces. The caller passes `--scope` so the engine knows which to render.

### Case A — `--scope planned` (called from `/adopt` Step 4)

```
## Goal-Alignment Check

**Your goal:** <repo_goal verbatim, quoted>

[If skip_count > 0:]
**Consider skipping** (score ≤ 2 — off-goal):
- **<unit_name>** (<score>/10) — <reasoning>
- **<unit_name>** (<score>/10) — <reasoning>

[If review_count > 0:]
**Worth a second look** (score 3-5 — marginal):
- **<unit_name>** (<score>/10) — <reasoning>

**Strong fit** (score ≥ 6): <comma-separated unit_names with scores>

To drop any of the flagged components, say: "skip <name>, <name>".
Otherwise answer "yes" to proceed with the full install.
```

### Case B — `--scope installed` (called from `/pulse` overview)

```
## Prune Candidates

[Only render this block if skip_count > 0. If skip_count == 0 and review_count > 0,
render only the one-line review hint. If both zero, render nothing — caller
suppresses the section.]

These installed components look like a weak fit for your goal. They're still
running silently — consider whether they're earning their keep.

| Component | Relevance | Reason |
|-----------|-----------|--------|
| <unit_name> | <score>/10 | <reasoning truncated to 80 chars> |
| <unit_name> | <score>/10 | <reasoning truncated to 80 chars> |

Nothing is auto-removed. Ignore this section if the reasoning isn't convincing.

[If review_count > 0:]
_<review_count> more components scored 3-5 (marginal fit). Say "show review candidates" to see them._
```

### Placeholder-goal case (goal_is_placeholder OR empty)

Render under either scope:

```
## Goal-Alignment Check

Repo goal not yet captured — I can't score components without one. Your
.cwos-onboarding.yaml has the placeholder fallback, not a real outcome sentence.

To set a goal: re-run /adopt (or manually edit system/intention.md's
"Imagined Outcome" section to a single outcome sentence like
"Ship X that does Y for Z users by Q3"). This check will run cleanly
once a real goal is captured.
```

### Empty-unit-list case

```
## Goal-Alignment Check

No components to score for <scope>. [For --scope planned: "Nothing is being
installed — the adoption plan is empty." For --scope installed: "No
programs, engines, or capability groups are active in this repo yet."]
```

---

## Notes for the engine runner

- This engine uses `procedure: single-pass`, `size: light` (per the single-pass sizing table at `engines/procedures/single-pass.md`). One agent, ~30 sec.
- **Never auto-chained.** Only `/adopt` Step 4 and `/pulse` overview invoke it; chains.on_complete is empty on purpose.
- Because `category: briefing`, `/engine` Step 9b (Finding Feedback Prompt) is skipped — no findings means no per-finding feedback prompt.
- Because `impact: informational`, `/engine` Step 3b displays the safety guarantee: "This engine is read-only. It will not modify any files."
- The threshold bands (≤2 skip, 3-5 review, ≥6 keep) are **fixed constants in the engine**, not configurable. If/when calibration data says they should shift, amend this file.
