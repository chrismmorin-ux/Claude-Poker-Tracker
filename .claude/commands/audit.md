---
name: audit
description: "System self-audit — detect drift, staleness, invariant violations, and failure patterns"
user-invocable: true
argument-hint: "[focus: drift|invariants|programs|failures|queue|constitutional]"
---

# /audit — System Self-Audit

Comprehensive self-audit across drift, invariants, program accountability, queue health, and constitutional compliance. Generates findings + work items via `kit/scripts/cwos-audit.js` (5 subcommands per ADR-037 Decision #3). Pedagogy: `docs/guides/audit-pedagogy.md`.

## Output Shape

**Audit arc:** `<scanning | findings-rendered | constitutional-checked>` — `<one-clause status>`.
`<Delta line: what this invocation produced — N findings rendered, M would auto-promote, K critical. If clean: "Diagnostic-only — no findings tripped thresholds.">`
`<Remainder: findings table — Severity / Program / Title / proposed_route — sorted severity-first. Truncate to top 10 if longer; cite total.>`

### Why these findings matter
`<Value-rationale: cite the invariant or program each finding maps to, the repo_goal at risk, or the captured failure-mode token. If clean: cite the cleanest signal that confirms health (drift summary, GC report).>`

**Do next:** Single-line action — `Run /next to compose a sprint covering critical findings` (or `No action required — system clean.`).

## Subcommand: Focus (`audit focus <area>`)

```bash
node kit/scripts/cwos-audit.js focus <area>
```

Where `<area>` is one of `drift / invariants / programs / failures / queue`. Returns scoped JSON `{area, computed_at, summary}` for one slice. `--human` flag adds Decision #8 footer. Useful when founder wants to drill into one dimension quickly without the full envelope.

## Subcommand: Compose (full audit envelope)

```bash
node kit/scripts/cwos-audit.js compose
```

Returns JSON envelope with `findings[]` (each carrying computed `proposed_route`), `gc_report`, `queue_health`, `drift_summary`, `programs_summary`, `failures_summary`, `invariants_summary`, and `stage_mismatch` (WS-251). **No mutations** — read-only structured aggregation in 1 round (replaces ~10–15 prose tool rounds). Pipe into `render` for human-readable output.

The `stage_mismatch` field is an *ephemeral finding* (not written as a persistent FIND-NNN.yaml): if `.cwos-onboarding.yaml#stage` is declared and `cwos-stage-detect.js scan` finds signals implying a higher minimum stage, the envelope carries a synthesized finding describing the gap. Founder addresses it by running `/stage re <detected_min>` (declaration moves up) or by noting the exception in `system/context.md` (declaration stays). The next audit run recomputes from scratch — no GC needed.

## Subcommand: Constitutional

```bash
node kit/scripts/cwos-audit.js constitutional [--check-text "<text>"]
```

Wraps `kit/scripts/cwos-constitutional-audit.js`. Default: full corpus run. `--check-text` mode used by /next Step 4a anti-goal cross-check — returns `{pass, matches}` + exit 0/1 per the underlying script's contract. Pass-through; no envelope wrapping.

## Subcommand: Render (`audit render --envelope <path>` or `audit render -`)

```bash
node kit/scripts/cwos-audit.js compose | node kit/scripts/cwos-audit.js render -
```

Reads a compose envelope (file or stdin `-`); emits markdown report — Critical findings first, per-program summary table, queue health, drift summary, GC report, Decision #8 footer verbatim. The `compose | render` pipe IS the founder-facing /audit output.

## Subcommand: Verify-route (`audit verify-route --finding <FIND-NNN>`)

```bash
node kit/scripts/cwos-audit.js verify-route --finding <FIND-NNN>
```

Computes `proposed_route` for one finding, returns JSON `{finding_id, current_program, current_promoted_to, proposed_route, note}`. Dry-run only — no writes. Spot-check individual routing decisions before composing the full envelope.

## Argument shapes (canonical)

| Invocation | Subcommand routed |
|------------|-------------------|
| `/audit` (no args) | compose | render - |
| `/audit drift` (or `invariants` etc.) | focus <area> --human |
| `/audit constitutional` | constitutional |
| `/audit verify-route FIND-NNN` | verify-route --finding |

## Prohibited Reads

After cwos-audit subcommand output is captured, the AI MUST NOT re-read these (the CLI envelope captured them): `.claude/workstream/findings-index.yaml`, `.claude/workstream/queue-index.yaml`, `.claude/workstream/programs/prog-*.yaml`, `system/invariants.md`, `system/failures.md`. INV-cli-envelope-consumed-completely (WS-271) routes excess Read tool calls to prog-kit-quality.

## CLI-absent fallback

If `kit/scripts/cwos-audit.js` is missing (older kit): "cwos-audit.js not found — run `/fleet-update` to install the CWOS CLI quartet. Pedagogy + manual algorithm: `docs/guides/audit-pedagogy.md`."

## Pedagogy

Why these thresholds? How does proposed_route derive? When does the GC report trigger archival? See `docs/guides/audit-pedagogy.md` (drift detection, invariant verification, program accountability sub-checks, GC graduation rules, finding-routing semantics, constitutional check mechanics).

## Shadow-event envelope

`node kit/scripts/cwos-event.js append command_completed --track T11:vital-signs --tag /audit --payload '{"command":"/audit"}'` — non-fatal; never gate output on it.
