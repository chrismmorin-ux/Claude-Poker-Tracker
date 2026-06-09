---
name: intend
description: "Declare intention and ignite a dormant repo (M0 → M1) — proposes archetype, programs, invariants, and a first sprint based on captured signal"
user-invocable: true
argument-hint: "[--archetype A?] [approve|cancel <proposal-id>]"
---

# /intend — Ignite a Dormant Repo

The primary trigger that ends dormant mode (M0). Reads the capture buffer + intention.md, generates a full bundle proposal (archetype, stage, programs, invariants, constraints, seed work items), gates on a single founder approval, then applies the bundle to flip `adoption_phase: M0 → M1`.

## When to use

- Repo is in dormant mode (`adoption_phase: M0`, scaffolded via `/genesis`)
- Founder has shaped enough material — written into `system/intention.md`, dropped notes in `notes/`, or had session conversations — that a meaningful proposal can be generated
- Founder is ready to commit to an archetype + stage and let CWOS spawn the corresponding programs

## When NOT to use

- Repo is already ignited (`adoption_phase: M1`–`M5`) — refused. Use `/checkpoint` or `/archetype re` to revise direction.
- `system/intention.md` is still a placeholder template AND the capture buffer is empty — refused with the message *"write at least one paragraph in intention.md or drop one file in system/."*

Generative, not interrogative — `/intend` does NOT ask 17 questions. It proposes a full bundle drawn from your captured signal + archetype defaults; you approve, edit the JSON, or cancel.

## Steps

### Step 1: Validate preconditions

```
node kit/scripts/cwos-genesis-ignite.js validate --target-dir .
```

The validator checks (WS-377):
1. `adoption_phase == M0`
2. No prior `genesis_ignition_consumed` event
3. intention.md has non-placeholder content OR capture buffer has events
4. **Temporal/content gate:** if intention.md's content hash is unchanged from the /genesis placeholder AND less than 12 hours have elapsed since /genesis scaffold, ignition is REFUSED. Founder must either edit intention.md (preferred) or pass `--force` (testing override).

If any precondition fails, surface the validator's `errors` array verbatim. Two common failure messages:

> "write at least one paragraph in intention.md or drop one file in system/ — capture buffer is empty and intention.md is still placeholder."

> "Genesis ran Xh ago and intention.md is still the placeholder template (content hash unchanged from scaffold). Edit system/intention.md with your declared goal, anti-goals, and constraints, then re-run /intend. (Use --force to override for testing.)"

If either fires, do NOT proceed. Tell the founder to write content first, then re-run `/intend`. **Do NOT use `--force` unless the founder explicitly asks for it** — the gate exists because Nutrition went red-on-day-1 when ignition ran against placeholder intention.

The validator also surfaces a `warnings` array. If `intention_hash_unchanged` and the founder is past the 12h window, a warning is added (non-blocking) noting that intention.md was never edited. Surface warnings to the founder before proceeding to Step 2.

### Step 2: Generate the proposal

```
node kit/scripts/cwos-genesis-ignite.js propose --target-dir . [--archetype-hint A?] > .claude/workstream/.proposals/genesis-<timestamp>.json
node kit/scripts/cwos-genesis-ignite.js propose --target-dir . [--archetype-hint A?] --out markdown
```

Two invocations: the first saves the canonical JSON proposal (the founder will edit this if option 2 is chosen); the second renders the markdown approval doc. Use the same flags for both so the markdown matches the JSON.

`--archetype-hint A?` is optional. If the founder provides it (e.g., `/intend --archetype A4`), the inference step is skipped and the bundle is computed directly. Without the hint, archetype is inferred from intention.md Principles + capture buffer summaries (see ADR-046).

Render the markdown output to the founder verbatim. It includes:
- Proposed archetype + rationale
- Proposed stage + rationale
- Imagined Outcome (if intention.md has one)
- Programs to spawn (with tier per program)
- Engines + personas
- Invariants proposed (each preceded by `- [ ]`)
- Constraints proposed
- Implicit decisions detected (if any)
- Seed work items (3-5 from the archetype's ignition template)

### Step 3: Approval gate

After the markdown is rendered, present three options:

```
[1] Approve as-is
[2] Edit JSON  (open .claude/workstream/.proposals/genesis-<timestamp>.json, edit, save, then re-run /intend approve <timestamp>)
[3] Cancel    (no state changed; proposal JSON is deleted)
```

Wait for the founder's choice.

**Option 1 (Approve as-is):** proceed to Step 4 with the saved proposal file.

**Option 2 (Edit JSON):** tell the founder the proposal is at `.claude/workstream/.proposals/genesis-<timestamp>.json`. They edit it (delete bullets they don't want, change archetype, adjust seed_work_items, etc.), save, and re-invoke `/intend approve <timestamp>`. This branch returns control to the founder; do not auto-poll.

**Option 3 (Cancel):** delete the proposal JSON file. Print: *"Cancelled — no state changed. Repo remains dormant. Re-run /intend whenever you're ready."* Stop.

### Step 4: Apply

```
node kit/scripts/cwos-genesis-ignite.js apply \
  --target-dir . \
  --proposal-file .claude/workstream/.proposals/genesis-<timestamp>.json \
  --exit-trigger intend_command
```

The script orchestrates the bundle install:
1. Calls `cwos-adopt-archetype.js apply` to patch archetype + stage + bundle into `.cwos-onboarding.yaml`.
2. Copies the relevant `prog-*.yaml` files from `kit/templates/workstream/programs/` to the target's `.claude/workstream/programs/`.
3. Flips `adoption_phase: M0 → M1`, sets `m0_dormant.exited_at` + `exit_trigger`.
4. Appends accepted invariants to `system/invariants.md`, constraints to `system/constraints.md`, decisions to `system/decisions.md`.
5. Writes seed work items to `.claude/workstream/queue/`.
6. Sets `usage.yaml welcome_completed: true` so `/welcome` doesn't auto-fire post-ignition.
7. Emits a `T0:envelope.genesis_ignition_consumed` event — the read-receipt for the dormant capture buffer.

Surface the script's JSON result to the founder. Each step is reported individually (`archetype_apply: ok`, `programs_copied: [...]`, etc.) so partial failures are visible.

### Step 5: Confirmation

If `apply` returned `ok: true`, print:

```
Ignition complete.

Archetype: <archetype> · Stage: <stage>
Programs spawned: <list>
Seed work items: <N> in .claude/workstream/queue/

Run /next to compose your first sprint. Programs will warm up as you work.
```

If `apply` returned `ok: false`, print the failing step(s) and tell the founder to investigate. Do NOT auto-retry — partial failures during ignition are unusual and warrant inspection.

### Step 6: Shadow-event envelope

```
node kit/scripts/cwos-event.js append command_completed \
  --track T0:envelope --tag /intend \
  --payload '{"command":"/intend","exit_trigger":"intend_command","archetype":"<archetype>","stage":"<stage>"}'
```

Failure is non-fatal — do not gate command output on it.

## Failure modes

| Situation | What to do |
|-----------|------------|
| `adoption_phase != M0` | Refuse with reference to `genesis_ignition_consumed` event. Suggest `/checkpoint` or `/archetype re` instead. |
| Empty buffer + placeholder intention.md | Refuse with the locked message. Tell the founder to write content first. |
| Founder picks option 2 (Edit JSON) | Hand control back; provide the path; do not poll. |
| Founder picks option 3 (Cancel) | Delete the proposal JSON. Confirm to the founder. |
| `apply` step fails partway | Surface the JSON result with failing steps. Do not retry. Phase A's `validate` re-run will report current state. |
| Multi-archetype tied scores | Tie-break to A3 per ADR-047. |
| Buffer has events but none match any prompt keywords | Default to A3 with rationale "no keyword hits; defaulted." Founder can override via `--archetype-hint`. |

## Related

- `/genesis` — sibling for empty-repo scaffolding
- `/checkpoint` — post-ignition direction adjustment
- `/archetype re` — post-ignition archetype migration
- ADR-046 (genesis + dormant), ADR-047 (intention trigger), WS-321 spec
- `kit/data/genesis-sprints/<archetype>.yaml` — per-archetype ignition templates (A3 ships with Phase C; A1/A4/A5 in Phase D)
