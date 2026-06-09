---
name: engine
description: "Run a named engine — unified dispatch with intent-contract pre-flight per ADR-038"
user-invocable: true
argument-hint: "<engine-id-or-alias> [target] [--just-run | /engine!!] [--mode <mode>] [--success-shape <shape>] [--stretch] [--retry run-<id>]"
---

# /engine — Unified Engine Dispatch

Routes engine invocations through an intent-contract pre-flight (ADR-038 Layer 3), then a token-budget gate (ADR-037 Decision #5 / WS-272), then the specialized engine's own multi-phase execution prose. Aliases (e.g., `/eng`, `/design`) are routed via `engines/registry.yaml`. Pedagogy: see `docs/adrs/ADR-038.md` (a dedicated engine-pedagogy guide is planned — WS-278).

## Output Shape

**Engine-run arc:** `<frame-pre-flight | gate-checked | dispatching | researching | synthesizing | findings-filed>` — `<one-clause status>` (e.g., "design-audit run-002, contract-cnt-1234, phase 4 of 6, 3 findings drafted").

`<Delta line: what this invocation did — frame outcome (recorded/bypassed/abandoned), gate status, phases N–M completed, F findings filed, W work items.>`

`<Remainder: per-phase progress + findings table — Severity / Title / Linked WS — sorted severity-first. Cite run_id AND contract_id explicitly.>`

### Why this engine ran
`<Value-rationale: cite the program the engine serves, the contract's mode + scope_ceiling + stretch values, the cadence/protocol that triggered it, or the captured concern that prompted it. If --just-run was used, cite the bypass_reason.>`

**Do next:** Single-line action — `Run /next to compose a sprint covering the new findings` (or `Continue engine run` mid-phase).

## Step 1: Parse + alias resolution

Parse `$ARGUMENTS` for `<engine-id-or-alias> [target] [--just-run | /engine!!] [--mode X] [--success-shape Y] [--stretch] [--retry run-<id>]`. Read `engines/registry.yaml` `aliases:` map; if `<engine-id-or-alias>` matches an alias key, resolve to the canonical id. If no match in aliases, treat as canonical id; if absent from `engines:` map, list available + exit.

## Step 2: Intent-contract pre-flight (ADR-038 Layer 3)

If `--just-run` (or `/engine!!`) is present, **skip** to Step 4 after emitting:

```bash
node kit/scripts/cwos-event.js append engine_intent_bypassed --track T7:engines --tag /engine --payload '{"type":"engine_intent_bypassed","engine":"<id>","target":"<target>","bypass_reason":"founder-explicit","composed_by":"cli-deterministic"}'
```

Otherwise, run pre-flight:

```bash
node kit/scripts/cwos-frame.js compose --engine <id> --target <target> [--stretch]
```

Output is JSON with `contract`, `confidences`, `prompts_needed`, and (when readiness=defer) `readiness_human`. Render to founder:
- If `prompts_needed` is empty AND `readiness === 'ready'`: one-screen confirm summary.
- If `prompts_needed` is non-empty: targeted prompt for ONLY those fields (one at a time; never a 4-question form).
- If `readiness === 'defer'`: render the `readiness_human` block as-is — DO NOT surface the raw `readiness_reason` string (per FIND-127 / WS-291; raw machine strings violate P2 at the moment of decision). Format:
  ```
  Engine deferred. Reasons:
    - <readiness_human.bullets[0]>
    - <readiness_human.bullets[1]>
    ...

  Options:
    1. <readiness_human.options[0].label> — <options[0].outcome>
    2. <readiness_human.options[1].label> — <options[1].outcome>
       <if options[1].override_cost === 'high': also print options[1].override_warning>
    3. <readiness_human.options[2].label> — <options[2].outcome>
  ```
  Bullets carry their own suggested next action (after `→`); print verbatim. Founder picks an option; option 2 routes to `--just-run` re-invocation.

On founder confirmation, write the (possibly-edited) contract to a temp file, then:

```bash
node kit/scripts/cwos-frame.js confirm --contract-file <tmp>
```

This emits `engine_intent_recorded` with the final contract + revisions array. If founder cancels mid-prompt, emit `engine_intent_abandoned` with `fields_touched` + `elapsed_ms` (friction signal).

## Step 3: Token-budget gate (ADR-037 Decision #5 / WS-272)

```bash
node kit/scripts/cwos-token-budget.js --check
```

Exits 0 (clean) or 1 (regression detected — block). Escape valves don't compose: `--just-run` bypasses Step 2 but still goes through this gate. Founder unblocks via `--override-token-budget "<rationale ≥20 chars>"` (per WS-272).

## Step 4: Load specialized engine

Read the engine's `skill_path` from `engines/registry.yaml`. Load the engine MD file at that path. The contract is in the **confirm envelope produced in Step 3** (`cwos-frame.js confirm` output: `contract_id`, `event_id`, and the full `contract`) — the specialized engine's Setup phase reads those fields directly from that envelope. It MUST NOT reverse-scan `.claude/workstream/events/*.jsonl` to re-derive the contract (that re-reads data already handed to it and is the run's largest avoidable token cost); the raw-log scan is a bounded fallback only, used when the confirm envelope is absent (e.g. `--retry` resume or a pre-ADR-038 kit).

Specialized engines own their own multi-phase execution prose (Setup → Parallel Research → Cross-Critique → Synthesis → Backlog → Briefing). Find the engine MD file and follow its instructions. Apply contract fields:
- `mode` shapes the output type (decide → comparison; build-best → committed implementation; mockup → low-fi sketch; explore → adjacent possibilities)
- `stretch=true` invites the engine to question loaded AS-N tags + constraints (NEVER re-read `system/` files — question what's already in the envelope)
- `scope_ceiling` is the out-of-bounds bound the engine must respect
- `success_shape` is the structured target the briefing phase MUST honor
- `readiness_reason` (if defer was overridden) is logged in the run manifest

## Step 4.5: Initialize manifest (WS-305)

Before per-phase execution, write the canonical pre-artifact:

```bash
node kit/scripts/cwos-engine-manifest.js init \
  --run-id run-<NNN> --engine <engine-id> --target <program-or-focus> \
  --contract-id <cnt-id> --contract-event-id <ev-id> \
  --mode <mode> --stretch <true|false> --readiness <ready|defer> \
  --success-shape "<from contract>" --scope-ceiling "<from contract>" \
  --founder <handle> \
  --declared-phases "phase_0,phase_1,phase_2,phase_3,phase_4,phase_5,phase_6" \
  --declared-agents "<comma-separated persona names from engine's ## Agents section>"
```

The manifest is the engine-run twin of WS-304's protocol-run provenance: `agent-dispatch.md` updates the live punchlist via `cwos-engine-manifest update` after every agent return, and Step 6 closes it with `complete` + `validate`. Schema: `kit/templates/workstream/runs/MANIFEST.md`.

## Step 5: Per-phase execution

Follow the loaded specialized engine's phase prose. Engine briefing phase MUST include a `contract_alignment` block stating which contract fields were honored vs. departed from (with reason for each departure). Per Decision #6, contract is **immutable post-confirm** — engines do not revise mid-run.

## Step 6: Finalize + reconcile

After all phases complete:

```bash
node kit/scripts/cwos-engine-manifest.js complete --run-id run-<NNN> \
  --findings-raw <N> --findings-after <N> --work-items <N> \
  --mode-status <honored|departed|violated> --mode-note "<one-liner>" \
  --stretch-status <…> --stretch-note "<…>" \
  --success-status <…> --success-note "<…>" \
  --scope-status <…> --scope-note "<…>"

node kit/scripts/cwos-reconcile.js --quiet
node kit/scripts/cwos-engine-complete.js --run-id run-<NNN>
```

`cwos-engine-manifest complete` writes the post-artifact (contract_alignment block + counts) to `manifest.yaml`. `cwos-reconcile` then rebuilds queue/findings/sprint indexes after the engine wrote its outputs. `cwos-engine-complete` calls `cwos-engine-manifest validate` first (WS-305 gate); if validation fails, no `engine_run_completed` event is emitted and a `FIND-MFST-*` finding is written under `prog-engine-reliability`. On clean validation it emits the `engine_run_completed` event (WS-263 / WS-302) tying `run_id` back to the contract_id — required so the verifier (`cwos-engine-contract-verify`) binds via the canonical event rather than falling through to all-time heuristic lookup. The emit step is idempotent (skips if a `run_id` event already exists) and derives `engine_id` + `program_id` from the most recent `engine_intent_recorded` event when not passed explicitly.

## Step 7: Edge cases

| Situation | What to do |
|-----------|------------|
| Founder runs `/eng-engine` (legacy direct invocation) | Treat the engine name as both id-and-alias-of-itself; route through Steps 2-6 normally |
| `--retry run-<id>` flag | Skip Steps 2-3 (contract + budget already recorded for original run); resume Step 4-6 from the retry point per the original engine's prose |
| Engine MD file missing | Surface "engine MD not found at <path> — registry may be stale" + exit |
| Pre-flight `prompts_needed` includes ≥3 fields | Suggest `--just-run` if founder explicitly wants to bypass framing this once (per Decision #3 discoverability) |
| Defer outcome with no override | Engine DOES NOT run; report defer reason + suggested action; no token cost |

## Prohibited Reads

After Step 4 loads the specialized engine MD + contract envelope, the AI MUST NOT re-read these (the CLI envelope captured them): `engines/registry.yaml`, the contract artifact, `engines/standard/*.md` (except the loaded one), `engines/library/*/*.md` (except the loaded one), `kit/scripts/core/engine-readiness-registry.yaml`. Re-reads defeat ADR-037's token-savings goal AND ADR-038's contract-binding intent. INV-cli-envelope-consumed-completely (WS-271, scope-expanded by WS-277) routes excess Read tool calls to prog-kit-quality.

## CLI-absent fallback

If `kit/scripts/cwos-frame.js` is missing (older kit): "cwos-frame.js not found — run `/fleet-update` to install ADR-038 Layer 3 contract pre-flight. Without it, engines run with default mode=explore, readiness=ready, stretch=false (no contract event emitted)."

## Pedagogy

Why the contract? Why these 5 fields? See `docs/adrs/ADR-038.md` (a dedicated engine-pedagogy guide is planned — WS-278).

## Shadow-event envelope

`node kit/scripts/cwos-event.js append command_completed --track T7:engines --tag /engine --payload '{"command":"/engine"}'` — non-fatal; never gate output on it.
