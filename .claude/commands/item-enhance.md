---
name: item-enhance
description: "Sharpen a work item — refine scope, enrich acceptance criteria, validate effort estimate, map file impact"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: item-enhance` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Work Item Enhancement Engine

You are refining a single work item. The item exists — it has a title, description, effort estimate, and maybe acceptance criteria. Your job is to make it precise enough that execution is unambiguous: clearer scope, verifiable done-criteria, accurate effort, and a concrete file impact map.

## Input

$ARGUMENTS — either:
- A work item file path (e.g., `.claude/workstream/queue/WS-042.yaml`)
- A work item ID (e.g., "WS-042") — resolve to file path
- Inline work item data passed from a choice point

If no argument given, ask: "Which work item should I refine? Give me an ID or file path."

---

## Refinement Rules

Launch one agent (senior-engineer persona) with the full item context and these rules:

### Rule 1: Scope Precision

Read the item's `description` and `files_involved`.

- If `description` is vague (e.g., "improve the auth system"), rewrite to be specific: what exactly changes, what stays the same, what's explicitly out of scope
- If `files_involved` is empty or incomplete, read the codebase to identify the actual files that need to change
- If the scope spans more than 3 directories, flag: "This item may need to be split"
- Add an `out_of_scope` note if the description could be interpreted broadly

### Rule 2: Acceptance Criteria Enrichment

Read the item's `accept_criteria`.

- If missing: write 2-4 concrete acceptance criteria based on the description and files
- If present but vague (e.g., "it works"): rewrite as verifiable checks — what specifically can be tested, inspected, or measured?
- Each criterion should be binary: it either passes or it doesn't
- Include at least one negative criterion where relevant: "X does NOT break when Y"

### Rule 3: Effort Validation

Read the item's `effort` (S/M/L) and compare against reality:

- Count `files_involved` — S items should touch 1-3 files in 1-2 directories
- Check if the item requires tests — add to effort if not accounted for
- Check if the item requires changes to shared interfaces — this often turns S into M
- If effort seems wrong, recommend a new estimate with justification

### Rule 4: Dependency Check

Read the item's `blocked_by` and `enables` fields.

- Check if any blocking items are still open — flag if so
- Read the code to check for implicit dependencies not captured in the YAML
- If the item touches a shared interface, identify other items that may be affected

### Rule 5: Mode Validation

Check if the item's classification (execute vs plan-first) is correct:

- If mode is `execute` but item touches 3+ directories or has unclear design choices → recommend `plan-first`
- If mode is `plan-first` but item is a straightforward S-effort bug fix → recommend `execute`
- If reclassifying to `plan-first`, suggest `decision_flags`

---

## Output

Produce the refined work item with changes tracked:

```yaml
refinement:
  engine: item-enhance
  size: light
  changes_applied: <count>
  changes:
    - rule: "<rule-name>"
      field: "<field that changed>"
      description: "<what changed>"
  unchanged: "<what was already good>"
```

The refined item replaces the original at the choice point. The user sees the improved version and decides whether to use it.

---

## Briefing Template

```
### Refined: WS-NNN — [title]

**Changes (N):**
- [change — e.g., "Added 3 acceptance criteria (was 'it works', now verifiable checks)"]
- [change — e.g., "Re-estimated S → M (touches shared auth interface, needs 4 files)"]
- [change — e.g., "Added files_involved: api/routes/webhook.ts, lib/retry.ts"]

**Unchanged:** [what was already solid — e.g., "Description scope, dependencies, mode classification"]

Use refined item? (yes / revert to original)
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
