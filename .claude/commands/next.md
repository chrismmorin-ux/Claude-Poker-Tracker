---
name: next
description: "Compose and execute sprint-based work — batches of prioritized items approved as a unit"
user-invocable: true
---

# /next — Sprint-Based Work

Composes a sprint (coherent batch, approved once) and executes it. The ADR-037 Phase 2 CLI quartet (cwos-next + cwos-pulse + cwos-audit + cwos-token-budget) does the deterministic work; this skeleton orchestrates the human-in-the-loop approval. **Why these formulas:** `docs/guides/next-command-pedagogy.md`.

## Output Shape

**Sprint arc:** `<active | proposed | resuming>` — `<one-clause status>`.
`<Delta line: what this invocation did — composed a new sprint, resumed an active one, or executed N items.>`
`<Remainder: the Items table — # / Title / Mode / Effort / Decisions Needed — never prose-only.>`

### Why this sprint?
`<Value-rationale: program_focus, context boost, dependency cluster, fleet-rotation. Reference repo_goal, an invariant, or a finding ID. If no token applies: "(No captured repo goal yet — Value falls back to operational context.)">`

**Do next:** Numbered options — `1. Approve` / `2. Tighten the plan` / `3. Adjust manually`.

## Step 1: Gate

```bash
node kit/scripts/cwos-next.js gate
```

Exits 0 (clean), 1 (blocked), 2 (invalid arg). JSON output. If `result.active_sprint` is non-null, jump to **Step 6** and resume. If `result.blocked` is true, surface `result.sprint_blocks[]` + `result.drift_items[]` + `result.token_budget.note` verbatim and stop. Block entries carry a `reason:` discriminator — `first-run-required` (WS-365: an active/critical block_sprint:true program has never been run; surface the `hint:` and direct the founder to `/pulse run <program> <protocol>`) or no reason field (stale protocol from cadence check). Founder may unblock a token-budget block via `--override-token-budget "<rationale ≥20 chars>"` (Step 7).

If `result.drift_auto_reconciled` is non-empty (advisory; never blocks), surface a one-line summary before continuing — e.g., `Auto-reconciled 1 item: WS-XXX (closed by event ev-...)`. Per ADR-045, drift between the canonical event log and queue YAMLs is healed inline; the founder gets visibility, not a stop.

## Step 2: Candidates

```bash
node kit/scripts/cwos-next.js candidates --limit 30
```

Returns ranked JSON `{saturated_classes, last_anchor_classes, candidates: [...]}`. Source-class damping + soft-block damping applied inline. No AI judgment in the read path.

## Step 3: Compose

```bash
node kit/scripts/cwos-next.js compose --human
```

The `--human` output IS the sprint preview — render as-is, don't rewrite. Includes items table, decisions needed, composition_notes (anchor + damping fires + fleet-rotation override), inline anti-goal cross-check, Decision #8 footer verbatim. Soft-blocked candidates appear as:

```
Deferred (unmet prereq):
  - WS-NNN (was P=X, soft-blocked → Y): <note text>
```

## Step 4: Approval

```
Options:
  1. Approve (yes)
  2. Tighten the plan before starting (~2 min)
  3. Adjust manually or pick a different focus
  [4. Approve with EXEMPTION — only shown when Step 4a found matches]
```

If the anti-goal cross-check (rendered by `compose --human`) surfaced matches, option 4 MUST appear verbatim:

```
4. Approve with EXEMPTION — accept the constitutional risk; founder provides a reason that gets recorded in the sprint YAML
```

If founder picks option 4, prompt for the exemption reason (free text). Persisted in the sprint YAML's `anti_goal_check` block via `cwos-next.js approve --exemption-reason "<text>"`. INV-038 verifies post-WS-227 sprints stay accountable.

If option 2 (tighten): route to `decision-enhance` (if any item has `decision_flags`) or `sprint-enhance`. Re-present the refined sprint here. If option 3 (adjust): ask what to change, recompose.

## Step 5: Approve

```bash
node kit/scripts/cwos-next.js approve --sprint-file <compose-output.json>
```

Writes sprint YAML, updates indexes, claims items, emits `sprint_approved` event with two-field provenance per ALTERATION-5: `{authorized_by: "founder" | "ai-autonomous", composed_by: "cli-deterministic"}`.

## Step 6: Execute (per item)

For each item in order, announce: `--- Item N of M: <title> [<mode label>] ---`.

**`mode: execute`** — make changes, run verification (tests + lint from vital signs). Pass → continue with one-line completion note. Fail → offer Fix / Skip / Stop.

**`mode: plan-first`** — call `EnterPlanMode`, design with item's `decision_flags` called out, ask founder for decisions on each. On approval, `ExitPlanMode` and execute. Same completion/failure flow.

After all items done:

```bash
node kit/scripts/cwos-next.js done --sprint SPR-NNN
```

Per ADR-045 / DEC-034: writes `status: done` + `completed_at` + `completion_commit` + `closed_by_event` to each non-skipped queue YAML, emits one `item_closed` event per item on track `T6:workstream` (so the workstream + sprints reducers re-materialize state/*.json), then emits `sprint_completed` on `T6:workstream-rebalance`. Idempotent — re-running emits zero new events for already-closed items. Then recomputes program health via the canonical formula and runs `cwos-reconcile.js --quiet`.

WS-310 Phase C: any closing item with a `finding_id: FIND-NNN` field also triggers an inline auto-resolved write — appends a `useful / auto-resolved` entry to the calibration feedback log (`findings-feedback.yaml`), refreshes the content_hash via `cwos-findings-feedback-validate.js --update`, and appends a `was_real` entry to `finding-lifecycle.yaml`. The directory for both is resolved per repo scope by `lib/auto-resolved.js` via `resolveEvolutionDir` (the HomeBase evolution apparatus dir, or `.claude/workstream/` in adopted repos). Failures here are surfaced as warnings only; they never block `item_closed` or `sprint_completed`.

## Step 7: Edge cases

| Situation | What to do |
|-----------|------------|
| Session ends mid-sprint | Sprint stays `active`; gate detects it on next `/next` and resumes Step 6 |
| User says "skip [item]" | Sprint item → `skipped`; queue item → released to `backlog` |
| User says "cancel sprint" | Sprint → `abandoned`; pending items → `backlog` (done items stay done) |
| User says "just one item" | Present top 3 candidates from `candidates` output, user picks one |
| ≥5 execute-only items | Tip: "Run `/autopilot Nh` for unattended execution" |
| Queue empty after gate | "All programs at target health. To push further: `/pulse escalate <prog> critical`, `/engine product-ideation`" |
| No sprint-index.yaml | Create empty file, proceed (backward compat) |
| Token-budget block fires | `node kit/scripts/cwos-next.js gate --override-token-budget "<rationale ≥20 chars>"` (logs `budget_regression_acknowledged` event) |
| `approve: sprint file is stale` error | Re-run `cwos-next.js compose` to atomically refresh `.claude/.tmp-sprint.json`, then retry approve. For recovery cases (approving an older composition deliberately), pass `--force-stale` — emits a `force_stale_approve` event for audit. Default freshness window: 5 min; env-tunable via `CWOS_NEXT_FRESHNESS_MS`. |
| `approve: sprint includes already-done items` error | Recompose to refresh the candidate ranking; `cwos-next.js compose` reads current `state/queue.json` so done items won't reappear. `--force-stale` also bypasses this check (same event marker). |

## Prohibited Reads

After gate + candidates + compose complete, the AI MUST NOT re-read these (the CLI envelope captured them): `.claude/workstream/queue-index.yaml`, `.claude/workstream/sprint-index.yaml`, `.claude/workstream/queue/WS-*.yaml` (except items being executed in Step 6), `.claude/workstream/findings-index.yaml`, `.cwos-config.yaml`, `system/context.md`. Re-reads defeat ADR-037's token-savings goal; future INV-cli-envelope-consumed-completely (WS-271) routes violations to prog-kit-quality.

## CLI-absent fallback

If `kit/scripts/cwos-next.js` is missing (older kit): "cwos-next.js not found — run `/fleet-update` to install the CWOS CLI quartet. Inline algorithm details: `docs/guides/next-command-pedagogy.md`."

## Shadow-event envelope

`node kit/scripts/cwos-event.js append command_completed --track T10:compose-sprint --tag /next --payload '{"command":"/next"}'` — non-fatal; never gate output on it.
