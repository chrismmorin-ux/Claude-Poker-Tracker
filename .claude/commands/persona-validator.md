---
name: persona-validator
description: "Audit installed personas against quality checklist — flags missing sections, generic checks, and insufficient coverage"
procedure: suite-check
extends: context-gather
model: sonnet
tools: [Read, Glob, Grep]
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: persona-validator` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Persona Validator Engine

Validates all installed personas against the quality checklist at `kit/templates/persona-quality-checklist.md`.

## When to Run
- After `/build-engine` creates new personas
- During `/audit` as part of coverage detection
- When adopting a repo with existing personas

## Phases

### Phase 1: Run the deterministic quality audit

The structural + quality checklist (section presence, frontmatter keys,
category/check counts, banned generic phrases) is pure parse-and-compare — it
ships as a script, not AI read-work (determinism-first; see the convention in
`engines/base/context-gather.md` and `INV-readpath-determinism`). Run:

```bash
node kit/scripts/cwos-persona-quality.js --human   # table + per-persona findings
node kit/scripts/cwos-persona-quality.js --json    # machine-readable
```

It walks `.claude/agents/*.md` and emits the Persona Quality Audit table
(Persona | Checks | Categories | Generic Phrases | Score) plus a findings list
with severities — **high**: missing required section (CORE CONTEXT / YOUR LENS /
What You Look For / Known Blind Spot / OUTPUT FORMAT) or missing frontmatter key;
**medium**: < 3 categories, < 12 checks, banned generic phrase, or OUTPUT FORMAT
missing severity/affected-files/remediation; **low**: thin CORE CONTEXT. The
checklist source is `kit/templates/persona-quality-checklist.md`.

Use the script output as-is. Do NOT re-glob `.claude/agents/` or re-tick the
checklist by hand — that re-pumps ~20 agent files through the model for work the
script does at zero token cost.

### Phase 2: Add remediation (the AI judgment tail)

This is the only phase that needs the model. For each script finding, add:
- A concrete fix — the exact section to add, or a specific replacement for a
  generic phrase (the script flags *that* a phrase is generic; you supply better).
- Structural exemptions the script can't judge — e.g. a synthesis persona
  (`facilitator`) legitimately has no "What You Look For" lens; note that rather
  than filing it as a defect. `roundtable-*` personas use the portable-skill
  format and are tagged `namespace: roundtable` in the output — judge their
  deviations in that light.

Render the script's table, then the augmented **Issues Found** + **Recommendations**.

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
