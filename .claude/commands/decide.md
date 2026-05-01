---
name: decide
description: "Record an architectural or project decision in ADR format"
user-invocable: true
argument-hint: "<decision title>"
---

# /decide — Record a Decision

Record an architectural or project decision in the decision log. Decisions are recorded so future sessions don't re-litigate settled questions.

## Output Shape

**Decision arc:** `<gathering | drafting | recorded>` — `<one-clause status>` (e.g., "ADR-NNN drafted, awaiting confirmation").

`<Delta line: what this invocation did — captured context, drafted ADR-NNN, recorded to decisions.md.>`

`<Remainder: ADR draft — Context / Options / Decision / Reasoning / Consequences sections. Each section a short block, not prose-only.>`

### Why this decision now?
`<Value-rationale: cite the invariant being adjusted, the work item that surfaced the question, or the repo_goal the decision protects. If no repo-specific token applies, declare it.>`

**Do next:** Numbered options — `1. Confirm and record` / `2. Revise reasoning` / `3. Defer (decision not ripe)`.

## Steps

### 1. Gather Decision Context

If `$ARGUMENTS` contains only a title, ask for:
- **Context:** What prompted this decision? What problem are we solving?
- **Options considered:** What alternatives were evaluated?
- **Decision:** What did we decide?
- **Reasoning:** Why this option over others?
- **Consequences:** What trade-offs does this create? What follow-up work is needed?

If `$ARGUMENTS` contains a full description, extract these elements.

### Enhancement Available

If the decision involves multiple viable options or spans 3+ files:

> Want deeper analysis? Run `/engine decision-enhance` for tradeoff matrices, reversibility assessment, and confidence-weighted recommendations. (Skip to record now.)

### 1.5. Load-Bearing Assumption + Market Dynamics Gate (G1)

Before recording, classify the decision's impact. This gate closes the A-1 failure class where strategic claims ship without falsification tests.

**Infer impact from decision context:**

- `impact: high` if the decision creates/retires a program, adds/removes a kit command, changes a schema field, extends a template, ships a new engine, registers a new persona, or makes a strategic bet on an external actor (Anthropic / competitor / model capability).
- `impact: medium` if it modifies a validator, adjusts a protocol, changes a tier trigger, or fine-tunes finding pipelines.
- `impact: low` otherwise (cosmetic edits, doc-only changes, single-file refactors within one program).

Display the inference and confirm or override with the founder.

**If `impact: high`:**

1. Draft an AS-N block for the decision. At least one entry MUST be `type: strategic` when the decision involves an external actor's behavior (Anthropic's roadmap, a competitor's capability, a model improvement closing a gap).

2. Draft a Market Dynamics block. Be honest about `insufficient-data` — pair it with concrete `watch_surfaces[]` and a `trigger_event` rather than inventing a false certainty.

3. Present both drafts to the founder for refinement.

4. Run the structural validator:
   ```
   node kit/scripts/cwos-asn-validate.js --stdin < drafts.yaml
   ```

5. If exit 0: the blocks are structurally sound. Proceed to step 2.
6. If exit 1 (structural) or 2 (type-specific): display the specific finding, regenerate the block, retry.
7. If exit 3 (MDA): the Market Dynamics block is malformed or `insufficient-data` is missing its required coupling — regenerate.
8. Maximum 3 retries. If still failing, halt. Preserve the founder's work in a draft file and surface the specific validator messages.

When the blocks pass, carry them forward — they'll be written inline in the ADR at step 4 under `## Load-Bearing Assumptions (AS-N)` and `## Market Dynamics`.

**If `impact: medium`:**

Draft an AS-N block only (no MDA required). Validate structurally. Record as advisory — pre-commit hook will warn but not block.

**If `impact: low`:**

Skip this gate entirely. No AS-N, no MDA.

**Log the decide duration** to `.claude/workstream/meta/mda-metrics.yaml` under `decide_durations:` — measures AS-SYN-7 (can the founder confirm drafts in ≤60 seconds without external research).

### 1.6. AS-N Lifecycle Modes (optional)

If `$ARGUMENTS` is one of the lifecycle flags, handle it here and skip the rest of this command:

- `/decide --approve AS-NN` — transition `proposed → active`. Validator must pass.
- `/decide --refresh AS-NN` — transition `at_risk → active`. Require a new `revisit` date and a one-sentence note on what evidence cleared the signal.
- `/decide --validate AS-NN` — transition `active → validated` (terminal). Require confirmation that the revisit window passed without trigger.
- `/decide --falsify AS-NN --reason "<text>"` — transition `active`/`at_risk → contradicted`. Append a new ADR recording what the trigger event actually was.
- `/decide --retire AS-NN --reason "<text>"` — transition non-terminal → retired. Used when the referring artifact is archived or risk is explicitly accepted.

Each transition updates the AS-N's `status:` field in-place in the referring artifact AND appends one line to `.claude/workstream/meta/mda-metrics.yaml` under `asn_transitions:`.

### 2. Check for Existing Decisions

Read `system/decisions.md` and check if a similar decision already exists:
- If yes: ask "A similar decision exists: [title]. Update it, or create a new one?"

### 3. Assign Decision ID

Count existing decisions in `system/decisions.md` to determine next ID: `DEC-NNN`

### 4. Write Decision Entry

Append to `system/decisions.md`:

```markdown
### DEC-NNN: [Title]
**Date:** YYYY-MM-DD
**Status:** Accepted
**Context:** [What prompted this decision]
**Options Considered:**
1. [Option A] — [pros/cons]
2. [Option B] — [pros/cons]
3. [Option C] — [pros/cons]
**Decision:** [What we decided]
**Reasoning:** [Why this option]
**Consequences:**
- [Trade-off or follow-up 1]
- [Trade-off or follow-up 2]
```

### 4a. Write ADR (when impact: high or medium)

For `impact: high`, the decision also produces a full ADR at `docs/adrs/ADR-NNN.md` (use `kit/templates/adrs/ADR-template.md` as the skeleton). Inline the AS-N and Market Dynamics blocks from step 1.5 under their required sections. Re-run the validator on the finished ADR:

```
node kit/scripts/cwos-asn-validate.js --adr docs/adrs/ADR-NNN.md
```

Must exit 0 before committing.

### 5. Create Follow-Up Work Items

If the decision creates follow-up work:
- Create work items in `.claude/workstream/queue/` for each follow-up
- Link them to the decision: `source.decision: DEC-NNN`

### 6. Output Confirmation

```
## Decision Recorded: DEC-NNN

**[Title]**
Decision: [summary]
Follow-up items created: [list if any]

This decision is now part of the project record. Future sessions will respect it.
```


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T3:record-decision --tag /decide --payload '{"command":"/decide"}'`

Non-fatal. Do not gate any output on the exit status.
