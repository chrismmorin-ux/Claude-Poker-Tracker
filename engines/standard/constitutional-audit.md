---
name: constitutional-audit
description: "Audit the repo against its own constitution (intention.md) — score principles, founder invariants, and failed states for coverage and compliance. Trend-tracked in docs/evolution/compliance-trends.yaml."
procedure: suite-check
extends: context-gather
user-invocable: false
---

# Constitutional Audit Engine

Checks the repo against the constitution at `system/intention.md`: 3 principles (P1-P3), 1 founder invariant (INV-F1), 10 failed states (#1-#10), plus the 21 system invariants INV-001..INV-021 already covered by `cwos-verify.js`. Produces three scores (compliance / coverage / pass-rate), creates findings for failures and uncovered items, and appends to a long-running trend file.

Sub-60-second target. Deterministic where possible; AI-judged detectors deferred to follow-up sprints.

## Focus Area

`$ARGUMENTS` — optional suite filter: `principles` | `founder-invariants` | `failed-states` | `system-invariants` | `full` (default).

---

## Additional Context

After the base context gather, also read:

1. `system/intention.md` — the constitution (source of the 14 items scored by this engine)
2. `system/invariants.md` — the 21 system invariants (delegated to cwos-verify)
3. `docs/evolution/compliance-trends.yaml` if it exists — previous runs for trend delta

---

## Check Suites

All four suites are executed by `kit/scripts/cwos-constitutional-audit.js`. The engine invokes the script once and interprets the JSON output. Per the suite-check procedure, each item maps to a check with `pass` | `fail` | `infeasible` | `no-detector` status.

### Principles suite (3 items)
Items: P1 (The Repo's Goal Is Supreme), P2 (Non-Technical Founders Not Asked to Be Technical), P3 (Progressive Over Prescriptive).

- **Check command:** `node kit/scripts/cwos-constitutional-audit.js --suite principles --json`
- **Detector logic:** see `kit/scripts/cwos-constitutional-audit.js` — each principle has a dedicated `detectPN()` function.

### Founder-invariants suite (1 item)
Items: INV-F1 (No Unnecessary Burden).

- **Check command:** `node kit/scripts/cwos-constitutional-audit.js --suite founder-invariants --json`

### Failed-states suite (10 items)
Items: FS-1 (Ceremony theater) through FS-10 (Self-aggrandizing complexity).

- **Check command:** `node kit/scripts/cwos-constitutional-audit.js --suite failed-states --json`
- **Note:** FS-2 reuses INV-F1's detector; FS-9 reuses P2's detector.

### System-invariants suite (21 items)
Items: INV-001..INV-021 from `system/invariants.md`.

- **Delegated to:** `kit/scripts/cwos-verify.js` (one detector per invariant, pre-existing).
- **MVP limitation:** `cwos-verify.js` does not yet emit `--json`. This suite reports as `infeasible` with the rationale "run cwos-verify.js directly for now". Extending cwos-verify with `--json` is a follow-up work item.

---

## Severity Map

| Status × context | Severity | Finding created? |
|------------------|----------|------------------|
| Principle/INV-F1 violated (no path to fix) | CRITICAL | yes |
| Failed state detected, confirmed signal | HIGH | yes |
| Invariant breached (confirmed in script) | HIGH | yes |
| Failed state detected, recoverable | MEDIUM | yes |
| Detector infeasible (clear rationale) | LOW | yes (tracks coverage gap) |
| No detector defined | LOW | yes (tracks coverage gap) |
| Pass | INFO | no |

---

## Auto-Remediation Rules

None for MVP. Compliance failures are founder decisions — no auto-fix.

---

## Finding Promotion Rules

For every item with `status ∈ {fail, infeasible, no-detector}`, create a FIND-*.yaml entry with:

- `engine: constitutional-audit`
- `run_id: run-<run_id>`
- `persona: constitutional-audit`
- `severity:` per severity map
- `priority_score:` 70 (CRITICAL), 55 (HIGH), 40 (MEDIUM), 20 (LOW)
- `title:` `<STATUS>: <item-id> — <item-title>` (e.g., `FAIL: FS-7 — Findings noise`)
- `description:` the detector's evidence string
- `recommended_action:`
  - CRITICAL/HIGH fail → "Fix now — run `node kit/scripts/cwos-constitutional-audit.js --only <id>` to re-verify after fix"
  - MEDIUM fail → "Fix or defer to next sprint; schedule the fix"
  - infeasible → "Build detector — see `kit/scripts/cwos-constitutional-audit.js` `detect<ID>()` for the current implementation + rationale"
  - no-detector → "Design detector for <id>"
- `dedup_key:` `constitutional-audit-<item-id>-<status>`
- `program: kit-quality` (constitutional-audit is a kit-quality accountability surface)

Findings dedup against prior runs by `dedup_key` — if the same item fails on consecutive runs, the finding updates in place rather than creating duplicates.

---

## Trend Persistence

After each run, the script writes to `docs/evolution/compliance-scores/score-run-<run_id>.yaml` and appends to `docs/evolution/compliance-trends.yaml` when invoked with `--persist <run_id>`. The /engine dispatcher passes the run_id to the script.

---

## Briefing Template

```
## Constitutional Audit — run-<run_id>

**Compliance score:** XX% (coverage YY%, pass-rate ZZ%)
**Trend vs previous run:** [↑ / → / ↓ / first run]

### By suite
| Suite | Passing | Failing | Infeasible | No detector |
|-------|---------|---------|------------|-------------|
| principles | ... | ... | ... | ... |
| founder-invariants | ... | ... | ... | ... |
| failed-states | ... | ... | ... | ... |
| system-invariants | ... | ... | ... | ... |

### Failures requiring action
| ID | Title | Severity | Evidence | Finding |
|----|-------|----------|----------|---------|
| FS-7 | Findings noise | HIGH | 1 run in last 30d produced ≥15 findings (run-009: 83) | FIND-NNN |
| ... | | | | |

### Coverage gaps (infeasible / no-detector)
| ID | Title | Status | Evidence |
|----|-------|--------|----------|
| FS-2 | Tool-shaped hammer | infeasible | component-alignment engine never ran | |
| ... | | | |

### Headline
[If compliance_score ≥ 0.80 AND coverage_score ≥ 0.70]: "Constitution holds. All critical items pass; residual coverage gaps are on the follow-up backlog."
[If any CRITICAL fails]: "CRITICAL constitutional violation — fix before next sprint. See FIND-NNN."
[If coverage < 0.50]: "Detector coverage below 50% — constitution is declared but not watched. Prioritize building detectors for infeasible items."

### Recommended next action
[Single highest-value action — usually "Fix FS-7 via finding-cap tightening in design-critique engine" or similar concrete step.]
```
