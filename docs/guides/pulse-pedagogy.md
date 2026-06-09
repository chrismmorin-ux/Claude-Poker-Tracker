# /pulse — Pedagogy & Rationale Companion

This doc explains the **why** behind the `/pulse` command's program-health
formulas, tier-escalation triggers, and protocol cadences. It exists
because `kit/commands/pulse.md` is now a ~120-line skeleton that calls
`kit/scripts/cwos-pulse.js` (per ADR-037 Phase 2 / SPR-106). The
skeleton stays under its line cap by omitting WHY-text; this doc is
where that prose lives.

Read this between sessions when you want to understand a value, change
a threshold, or extend the formulas. Cross-references to
`next-command-pedagogy.md` for shared formulas (health-score, etc.).

---

## 1. Programs as permanent accountability structures

A **program** is a domain the founder has permanently delegated to the
AI to monitor. Each program lives at
`.claude/workstream/programs/prog-<id>.yaml` and ships with:

- A `tier` (dormant / watch / active / critical) — see § 2
- A set of `protocols` (baseline / sweep / delta / challenge / blind_spot)
  with cadence_days each — see § 3
- An `accountability` block (`on_finding`, `on_stale`) declaring what
  happens when findings accumulate or protocols go stale
- A `health_score` (0–10) computed via the canonical formula in
  `core/health-scoring.js` — see § 4

Programs are NOT the same as engines. An engine *runs* a protocol; a
program *owns* the accountability for a domain. One program can run
multiple engines (e.g., kit-quality runs eng-engine for sweep,
quality-judge for challenge, meta-engine for blind_spot).

The complete program lifecycle:
- **Created:** `prog-template.yaml` is copied + customized during /adopt
  or /pulse escalate
- **Monitored:** /pulse periodically reports health; /audit surfaces
  drift; /next composes work items from program-driven auto-recs
- **Escalated:** `/pulse escalate <id> <tier>` raises tier when domain
  importance grows (e.g., dormant → watch when a customer issue surfaces)
- **Archived:** programs that drop to dormant for ≥90 days are GC'd by
  /audit's GC report

---

## 2. Tier semantics + escalation triggers

The four tiers map to **target_ceiling** values in the health formula:

| Tier | target_ceiling | Meaning |
|------|----------------|---------|
| dormant | 0 | Not currently monitored. Health = 0 always. |
| watch | 4 | Light monitoring. Sweep + delta protocols expected. |
| active | 8 | Real accountability. Sweep + challenge expected. Findings auto-promote. |
| critical | 10 | High-stakes domain. Full protocol coverage required. block_sprint may fire. |

**Escalation triggers** live in each program's YAML under `tier_triggers:`.
Examples:
- `financial-accuracy.tier_triggers.active: "Application processes real money"`
- `compliance.tier_triggers.active: "App is publicly accessible"`

`/pulse` overview surfaces "Tier Escalation Alerts" when a trigger condition
is met but the current tier is below the trigger's target. Founder runs
`/pulse escalate <id> <tier>` to apply.

**De-escalation** is rare and intentional. /pulse's `accountability.auto_deescalate: false` (default) means tier never drops automatically — only the founder can lower it via explicit escalate command. This prevents accountability evaporation.

---

## 3. Protocol cadences + rigor levels

Each program ships with up to 5 protocols. They're ordered by rigor
(complexity + signal value):

| Protocol | Rigor | Default cadence | What it does |
|----------|-------|----------------:|--------------|
| baseline | 5 | first run only | Initial state capture; defines the "from where" for delta |
| delta | 2 | 3-7 days | Quick what-changed scan |
| sweep | 5 | 7-30 days | Full scope coverage; finds new issues |
| challenge | 6 | 14-60 days | Adversarial review; tries to falsify program assumptions |
| blind_spot | 8 | 30-90 days | Meta-question: what are we systematically missing? |

The **rigor ceiling** caps `health_score`:
- Only baseline run → ceiling = 5
- + delta → ceiling = 5 (delta doesn't lift; it maintains)
- + sweep → ceiling = 7
- + challenge → ceiling = 8
- + blind_spot → ceiling = 9
- + quality-judge engine ever runs → ceiling = 9
- + meta-engine ever runs → ceiling = 10

This prevents a "high-score with no rigor" state — a program can't claim
health 10 without ever having been adversarially challenged.

**`/pulse run <program> [<protocol>]`** triggers a protocol invocation.
If `<protocol>` is omitted, picks the next-due one (most-overdue by
cadence). The actual engine invocation is delegated to the `/engine`
command in current implementation; cwos-pulse.js `run` records a
`protocol_run_intent` event for the audit trail.

---

## 4. Health-score formula

The canonical formula lives in `kit/scripts/core/health-scoring.js`
`computeHealthScore()`. /next Step 6b, /pulse, and /audit all call this
single source. The full formula breakdown is in
[`next-command-pedagogy.md` § 8](./next-command-pedagogy.md#8-token-budget-gate-ws-272)
— briefly:

```
finding_health    = max(0, 1.0 - (open_critical * 0.4) - (open_high * 0.2) - (open_medium * 0.1))
protocol_currency = average of (min(1.0, cadence / days_since_run)) for each active protocol
problem_class_coverage = checked_classes / total_classes
maturity_progress = maturity.level / 4
raw   = (finding_health * 0.35) + (protocol_currency * 0.25) + (coverage * 0.25) + (maturity_progress * 0.15)
score = round(raw * ceiling)
```

Plus hard caps:
- 1+ critical finding → score capped at 4
- 3+ high findings → score capped at 6
- block_sprint + stale → score capped at 2
- Staleness decay: every cadence-period over 2× cadence subtracts 1

`cwos-pulse refresh` recomputes for ALL programs at once and shows the
delta vs the stamped score on each program YAML. Surfaces drift between
canonical computation and last-stamped value.

---

## 5. Tier-trigger evaluation logic

A trigger is met when its condition string is true (today: AI judgment
based on captured project context; future: machine-readable predicates).

When `/pulse` overview detects a met trigger above the current tier, it
emits a "Tier Escalation Alerts" section. The founder is shown the
trigger condition + the suggested escalate command. They decide whether
to run it.

Triggers are documented in each `prog-*.yaml` under `tier_triggers:`. The
template at `kit/templates/workstream/programs/prog-template.yaml`
suggests common trigger language. Founders customize per their domain.

---

## 6. Conditional output blocks (when each fires)

`/pulse` overview includes optional sections that fire on specific
conditions:

- **Prune Candidates (WS-130):** programs at dormant tier for ≥90 days
  with no findings, no recent runs, no escalation alerts.
- **Scope check (WS-126):** programs whose `scope_files` glob matches
  fewer than 50% of the patterns documented in their YAML.
- **Domain correctness:** any /audit finding tagged `domain-correctness`
  with status open.
- **Uncustomized-contract check (WS-152):** programs whose YAML still
  contains `[CUSTOMIZE: ...]` placeholders from the template.
- **Program customization:** programs whose `health_breakdown` includes
  `coverage < 0.5` (problem_class coverage gap).

Each conditional block is a UX-driven nudge — surfaces problems early
without overwhelming the default view.

---

## 7. Relationship to /audit + /next

The workflow loop:

1. `/pulse` shows program health; identifies problems
2. Problems become **findings** (via engine runs or /audit)
3. Findings → **work items** in the queue (auto-promoted by RICE score
   threshold from `.cwos-config.yaml priority.auto_promote.rice_threshold`)
4. `/next` composes work items into sprints; founder approves
5. Sprint completion recomputes program health → loop closes

Programs are the **accountability** layer. Engines are the **detection**
layer. Findings are the **signal** layer. Work items are the **action**
layer. Each layer has dedicated commands (/pulse, /engine, /audit, /next)
and dedicated CLIs (cwos-pulse, cwos-audit, cwos-next).

---

## See also

- `kit/commands/pulse.md` — the ≤120-line skeleton that calls
  cwos-pulse.js
- `kit/scripts/cwos-pulse.js` — 5 subcommands (overview / compute-health
  / run / escalate / refresh)
- `kit/scripts/core/health-scoring.js` — canonical formula source
- `next-command-pedagogy.md` — shared formula explanations
- `audit-pedagogy.md` — companion for /audit's drift detection +
  finding-routing semantics
- `system/invariants.md` — INV-018 (hardlinks), INV-cli-subcommand-cap
  (5-cap on cwos-pulse), INV-037 (fleet-rotation)
