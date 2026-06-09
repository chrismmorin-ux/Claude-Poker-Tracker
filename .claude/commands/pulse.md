---
name: pulse
description: "Program health overview — accountability status, protocol history, tier management for all programs"
user-invocable: true
argument-hint: "[program-id | 'run' <program-id> [protocol] | 'escalate' <program-id> <tier>]"
---

# /pulse — Program Accountability Dashboard

Programs are permanent accountability structures — domains the founder has delegated to the AI to monitor. This command shows their status, runs their protocols, manages tiers, and recomputes health via `kit/scripts/cwos-pulse.js` (5 subcommands per ADR-037 Decision #3). Pedagogy: `docs/guides/pulse-pedagogy.md`.

## Output Shape

**Pulse arc:** `<overview | detail | run | escalate | refresh>` — `<one-clause status>` (e.g., "5 critical / 4 active / 1 watch programs; 2 escalation alerts").

`<Delta line: what this invocation surfaced — programs at target / programs below target / tier-escalation alerts / stale findings.>`

`<Remainder: program table — Program / Tier / Status / Health / Ceiling / Overdue / Open / Next Action — sorted critical-first within tier.>`

### Why this view?
`<Value-rationale: cite which programs need attention and why (recent finding, overdue protocol, tier-escalation trigger met). If clean: "All programs at target ceiling — system self-optimized.">`

**Do next:** `1. Run a stale protocol` / `2. Escalate a watch-tier program` / `3. Drill into one program for detail`.

## Subcommand: Overview (no args)

```bash
node kit/scripts/cwos-pulse.js overview --human
```

Renders the program table with health/ceiling/caps + Decision #8 footer verbatim. The `--human` output IS the dashboard — render as-is. JSON shape (no `--human`) for downstream automation. `--program <id>` flag scopes to single-program detail.

## Subcommand: Detail (`pulse <program-id>`)

```bash
node kit/scripts/cwos-pulse.js overview --program <program-id> --human
```

Single-program detail mode — same data shape as overview but scoped. Surfaces tier-escalation triggers, full protocol-history, all health-breakdown fields.

## Subcommand: Run (`pulse run <program-id> [<protocol>]`)

```bash
node kit/scripts/cwos-pulse.js run <program-id> [<protocol>]
```

Records a `protocol_run_intent` event for the program + protocol pair (engine invocation remains in `/engine` prose; cwos-pulse run records the intent). If `<protocol>` is omitted, picks the most-overdue protocol per cadence_days. Returns JSON `{program, protocol, status: "intent_recorded", event_id}`.

## Subcommand: Escalate (`pulse escalate <program-id> <tier>`)

```bash
node kit/scripts/cwos-pulse.js escalate <program-id> <tier>
```

Validates `<tier>` is one of `dormant / watch / active / critical`. If unchanged: returns `{noop: true}` exit 0. If different: emits `program_escalated` event with two-field provenance per ALTERATION-5 + returns `{program, prior_tier, new_tier, event_id}`. Founder must update the program YAML's `tier:` field to materialize state (reducer for `program_escalated` deferred per ADR-037 follow-up).

## Subcommand: Refresh (no args)

```bash
node kit/scripts/cwos-pulse.js refresh --human
```

Read-only bulk recompute across all non-monitor-only programs. Returns delta array `[{program_id, prior_score, new_score, delta}]` showing where stamped scores diverge from canonical computation. No mutations — useful after fleet-wide config changes or to detect drift between stamped + computed health.

## Argument shapes (canonical)

| Invocation | Subcommand routed |
|------------|-------------------|
| `/pulse` (no args) | overview |
| `/pulse <program-id>` | overview --program X |
| `/pulse run <program-id>` | run with auto-pick protocol |
| `/pulse run <program-id> <protocol>` | run with explicit protocol |
| `/pulse escalate <program-id> <tier>` | escalate |
| `/pulse refresh` | refresh |

## Prohibited Reads

After cwos-pulse subcommand output is captured, the AI MUST NOT re-read these (the CLI envelope captured them): `.claude/workstream/programs/prog-*.yaml`, `.claude/workstream/findings-index.yaml`, `.claude/workstream/state/programs.json`, `.cwos-config.yaml`. INV-cli-envelope-consumed-completely (WS-271) routes excess Read tool calls to prog-kit-quality.

## CLI-absent fallback

If `kit/scripts/cwos-pulse.js` is missing (older kit): "cwos-pulse.js not found — run `/fleet-update` to install the CWOS CLI quartet. Pedagogy + manual algorithm: `docs/guides/pulse-pedagogy.md`."

## Pedagogy

Why the formulas? Why the tier semantics? When does each protocol fire? See `docs/guides/pulse-pedagogy.md` (programs as accountability structures, tier-escalation triggers, protocol cadences + rigor levels, conditional output blocks, relationship to /audit + /next).

## Shadow-event envelope

`node kit/scripts/cwos-event.js append command_completed --track T11:vital-signs --tag /pulse --payload '{"command":"/pulse"}'` — non-fatal; never gate output on it.
