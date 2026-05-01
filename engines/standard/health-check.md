---
name: health-check
description: "System health diagnosis — checks vital signs, runs tests, verifies build, and auto-remediates simple issues"
procedure: suite-check
extends: context-gather
user-invocable: false
---

# Health Check Engine

Comprehensive health diagnosis of the project. Checks all vital signs, runs verification commands, and attempts auto-remediation for simple issues.

## Focus Area

$ARGUMENTS (or "full" if not provided)

---

## Additional Context

After the base context gather, also read:

1. `system/state.md` — previous vital signs and check commands (re-read for check command details)
2. `.claude/workstream/config.yaml` — engine configuration

---

## Check Suites

For each vital sign in `system/state.md`:

### Build Check
- Run the configured build command
- Record: PASS/FAIL, error output if failed, duration

### Test Suite
- Run the configured test command
- Record: PASS/FAIL, pass count, fail count, error details
- Note any tests that have been failing consistently

### Git Health
- `git status --short` — untracked files, modified files, staged changes
- `git stash list` — forgotten stashes
- Check for merge conflicts
- Check if ahead/behind remote

### Dependency Health
- Check for outdated dependencies (if package manager available)
- Check for known vulnerabilities (if audit command available)
- Note any pinned versions that are very old

### Disk/Resource Health (if applicable)
- Check disk space in project directory
- Check for large files that shouldn't be tracked
- Check `.gitignore` coverage

---

## Operational Risk Review

After all check suites complete, launch the **operations-engineer** persona as an agent to review the results:

> You have received the results of all automated health checks (build, tests, git, deps, resources). Review through an operational lens:
>
> 1. **Pattern detection:** Do the check results suggest a systemic issue? (e.g., tests passing but with growing execution time, git ahead of remote by many commits, deps outdated in a cluster)
> 2. **Missing monitoring:** Based on the project's architecture, what health checks are NOT being run that should be? (e.g., no database health check for a DB-backed app, no API latency check for a service)
> 3. **Deployment readiness:** Is this system safe to deploy right now? What would you want verified before pushing to production?
> 4. **Operational debt:** Are there patterns in the results that suggest accumulating operational debt? (stale branches, forgotten stashes, growing dependency lag)
>
> Produce: An operational risk summary with top 3 risks not captured by automated checks, each with severity and recommended action. Flag any risks from `system/failures.md` that the current checks don't cover.

Integrate the operations-engineer's risk summary into the Briefing Template under a new "### Operational Risks" section after the Issues Found table.

---

## Auto-Remediation Rules

**SAFE to auto-fix:**
- Lint errors
- Missing imports
- Outdated lock files

**NOT safe to auto-fix:**
- Test failures
- Build errors
- Merge conflicts

---

## Severity Map

| Internal Level | Founder Label | Criteria |
|----------------|---------------|----------|
| CRITICAL | **Fix before you ship** | Build broken, tests failing, data corruption risk |
| HIGH | **Fix this week** | Security vulnerabilities, significant test gaps |
| MEDIUM | **Worth improving** | Outdated deps, minor warnings, stale branches |
| LOW | **Nice to have** | Style issues, minor cleanup needed |

---

## Briefing Template (Founder-Native Default)

```
## Health Check

### Overall: [Healthy / Needs Attention / Broken]
[One sentence: "Your project is in good shape" or "N things need fixing before you ship"]

### Your Project's Vital Signs
| Check | Result | What This Means |
|-------|--------|-----------------|
| Build | PASS/FAIL | [Your app can/cannot compile and run] |
| Tests | PASS/FAIL | [X of Y automated checks passed — your safety net is working/has gaps] |
| Git | Clean/Dirty | [All changes are committed / You have N uncommitted changes] |
| Dependencies | Current/Outdated | [Your libraries are up to date / N libraries need updating] |

### Issues Found: N
[If issues exist, show top 3 with plain-language descriptions:]
1. **[title]** — [what's wrong and what it means]
   Urgency: [Fix before you ship / Fix this week / Worth improving]
[If more: "Plus N more in your queue."]

### What I Fixed Automatically
[Plain language: "I fixed X by doing Y" — or "Nothing needed auto-fixing" if clean]

### What To Do Next
[Single action, framed as outcome]
```

### Technical Detail (--technical flag)

When the user passes `--technical`, use this expanded format:

```
## Health Check Report

### Vital Signs
| Area | Status | Detail | Auto-Fixed? |
|------|--------|--------|-------------|
| Build | PASS/FAIL | ... | — |
| Tests | PASS/FAIL | X/Y passing | — |
| Git | CLEAN/DIRTY | N modified | — |
| Deps | CURRENT/OUTDATED | N outdated | — |

### All Issues (sorted by severity)
| # | Issue | Priority | Severity | Action |
|---|-------|----------|----------|--------|
| 1 | [title] | [score]/100 | CRITICAL/HIGH/MEDIUM/LOW | [action] |

### Auto-Fixes Applied
[detailed list]
```
