# Failure Library

Known failure modes, their root causes, fixes, and prevention measures. This file prevents repeating past mistakes and enables pattern detection across failures.

---

## How to Use This File

Each failure entry has:
- **ID**: `FAIL-NNN` for reference
- **Category**: Root cause category (enables pattern detection)
- **Description**: What happened
- **Root Cause**: Why it happened
- **Fix**: How it was fixed
- **Prevention**: What prevents recurrence
- **Related**: Links to work items, decisions, or other failures

The `/audit` command checks for recurring failure patterns (3+ failures in same category → systemic issue).

---

## Failure Categories

Common root cause categories:
- `data-integrity` — data corruption, inconsistency, loss
- `auth-access` — authentication or authorization failures
- `concurrency` — race conditions, deadlocks, ordering issues
- `validation` — missing or incorrect input validation
- `dependency` — external service or library failures
- `configuration` — wrong settings, missing env vars
- `logic` — incorrect business logic or calculations
- `performance` — timeouts, resource exhaustion, slow queries
- `deployment` — build, migration, or release failures

---

## Failures

<!-- Failures are recorded as they're discovered. Format:

### FAIL-NNN: [Short title]
**Date:** YYYY-MM-DD
**Category:** [category from above]
**Severity:** critical | high | medium | low
**Description:** [What happened — symptoms observed]
**Root Cause:** [Why it happened — the actual bug or gap]
**Fix:** [How it was resolved — link to commit if applicable]
**Prevention:** [What prevents recurrence — invariant, test, validation, etc.]
**Related:** [WS-NNN, DEC-NNN, FAIL-NNN if related to other items]

-->
