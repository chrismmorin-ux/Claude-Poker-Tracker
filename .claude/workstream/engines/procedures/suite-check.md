# Procedure: Suite Check

A phase flow for engines that run verification suites, analyze failures, and optionally auto-remediate. This procedure defines the STRUCTURE — the domain engine defines the CONTENT (which suites, what checks, what's safe to auto-fix).

This procedure expects the domain engine to define these named sections:

| Section | Required | Purpose |
|---------|----------|---------|
| `## Check Suites` | **REQUIRED** | List of named suites with their checks |
| `## Severity Map` | **REQUIRED** | Domain-specific severity vocabulary (used in failure analysis) |
| `## Briefing Template` | **REQUIRED** | How to present results to the user |
| `## Auto-Remediation Rules` | OPTIONAL | What's safe vs unsafe to auto-fix; if absent, no auto-fix |

---

## PHASE 1 — RUN CHECK SUITES

Read the domain engine's `## Check Suites` section. For each suite listed:

1. Run the checks as described in the suite definition
2. Record each check result: PASS, FAIL, WARN, or CHECK_ERROR
3. Capture error output, duration, and relevant details for each check
4. If a check command fails to execute (not "fails the check" but the command itself errors): record as CHECK_ERROR with the error message

### Error Handling

- If a check suite errors internally: skip that suite, note in report, continue to next suite
- If no check commands are configured for a suite: note "No checks configured for [suite]" and skip
- If external commands fail (git, build tools, etc.): proceed without that data, note in report

---

## PHASE 2 — ANALYSIS

For each check that returned FAIL, WARN, or CHECK_ERROR:

1. **Root Cause Analysis** — Why is this failing? What's the underlying issue?
2. **Impact Assessment** — What does this affect? How severe is it?
3. **Auto-Fix Assessment** — Can this be fixed automatically?

Check the domain engine for an `## Auto-Remediation Rules` section. If present, use it to classify each issue as safe or unsafe to auto-fix. If absent, treat all issues as NOT safe to auto-fix (findings only, no remediation).

---

## PHASE 3 — AUTO-REMEDIATION (if applicable)

Skip this phase entirely if the domain engine has no `## Auto-Remediation Rules` section.

For issues classified as safe to auto-fix:
1. Apply the fix
2. Re-run the specific check
3. Record: what was attempted, what the result was

For issues NOT safe to auto-fix:
1. Create a finding with detailed diagnosis
2. Include specific error messages and file paths

---

## PHASE 4 — CREATE FINDINGS

Create findings for all issues (both auto-fixed and remaining):

1. Map each issue to a severity using the domain engine's `## Severity Map`
2. Calculate `priority_score` (0-100) for each finding based on business value:
   - Launch relevance (+30): Is this needed before launch?
   - User impact (+20): Does this directly affect end users?
   - Revenue impact (+20): Does this affect money flow?
   - Milestone alignment (+15): Is this appropriate for the current milestone? (from Phase 0 context)
   - Dependency (+15): Does fixing this unblock other work?
3. Set `milestone_context` if the finding is premature for the current milestone (do NOT suppress it)
4. Set `recommended_action` for each finding (fix now, defer, run another engine, etc.)
5. Write findings to `.claude/workstream/findings/`
6. Generate dedup_key, check dedup window
7. Auto-fixed issues get `status: resolved` with a note; remaining issues get `status: open`

---

## PHASE 5 — STATE UPDATE

Update `system/state.md` with current check results. This keeps vital signs current for the next engine run or session start.

---

## PHASE 6 — BRIEFING

Read the domain engine's `## Briefing Template` section. Present results using that template.

**Important:** Sort findings by `priority_score` descending (highest business value first), NOT by severity. Show `milestone_context` where relevant. End with a recommended next action.

If the domain engine has no `## Briefing Template`, use this default:

```
## Check Results: <engine-name>

### Summary
| Suite | Status | Detail | Auto-Fixed? |
|-------|--------|--------|-------------|

### Issues Found: N (sorted by business value)
| # | Issue | Priority | Severity | Action |
|---|-------|----------|----------|--------|
| 1 | [title] | [score]/100 | [sev] | [recommended_action] |

- Auto-fixed: Y
- Needs attention: Z

### Recommended Next Action
[Single highest-value action]
```

---

## PHASE 7 — OPTIMIZATION EPILOGUE

**Reference:** `engines/standard/optimization-feedback.md` for signal types and schema.

After the briefing, evaluate whether this run produced optimization signals.

### Signal Triggers for Suite-Check

| Condition | Signal Type | Target |
|-----------|------------|--------|
| A check suite consistently returns CHECK_ERROR (same check failed in 2+ runs) | `process_friction` | The check suite configuration |
| Auto-remediation attempted and failed | `coverage_gap` | This engine's auto-remediation rules |
| All checks PASS but program health hasn't improved | `plateau` | The protocol driving this run |
| 50%+ of checks are CHECK_ERROR (misconfigured) | `waste` | This engine's check suite |
| A finding duplicates one from a recent run | `waste` | This engine's dedup logic |

### Signal Generation

For each triggered condition:
1. Write signal to `.claude/workstream/optimization-index.yaml`
2. Assign next `OPT-NNN` ID, set `confidence: low`, `status: pending`
3. Update summary counters
4. Check for pattern emergence (2+ signals with same target + type from different runs → promote to `confirmed`)
