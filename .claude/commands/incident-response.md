---
name: incident-response
description: "Incident response engine — production issue diagnosis, auto-recovery, escalation paths, and post-incident learning"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: incident-response` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Incident Response Engine

Structured diagnosis and recovery for production issues. Follows a recovery tree from infrastructure checks through application health to business logic verification, with auto-remediation for known failure patterns.

## Trigger

$ARGUMENTS (symptom description, or "diagnose" for general health sweep)

---

## PHASE 0 — TRIAGE

### Severity Assessment
Based on the reported symptom, classify:

| Severity | Criteria | Response Time |
|----------|----------|--------------|
| **SEV-1** | System completely down, data loss risk, all users affected | Immediate — stop all other work |
| **SEV-2** | Major feature broken, significant user impact, degraded performance | Within 1 hour — current work can finish |
| **SEV-3** | Minor feature broken, workaround exists, limited user impact | Within 1 session — queue it |
| **SEV-4** | Cosmetic issue, edge case, no user reports | Normal backlog priority |

For SEV-1 and SEV-2: skip to Phase 1 immediately. For SEV-3/4: create a finding and work item, return to normal flow.

---

## PHASE 1 — INFRASTRUCTURE CHECK (Layer 1)

Check bottom-up, fastest checks first:

### 1a. Process Health
- Is the application process running?
- Memory usage, CPU usage
- Disk space available
- Open file descriptors / connection count

### 1b. Network/Port Health
- Is the application port listening?
- Can we reach the health endpoint?
- DNS resolution working?
- SSL certificate valid?

### 1c. Database Health
- Is the database reachable?
- Are migrations current?
- Connection pool status
- Slow query detection

### 1d. Dependency Health
- External API reachability (payment provider, auth service, etc.)
- Cache service (Redis, Memcached) health
- Queue service (Celery, RabbitMQ, SQS) health
- File storage accessibility

### Auto-Recovery (Layer 1)

**Safe actions (no approval needed):**
- Read-only checks (process status, disk usage, connection counts)
- Restarting a connection pool (non-destructive, no data loss)
- Clearing application-managed temp files under a known temp directory

**Destructive actions (require user approval before executing):**
- Process restart → "Restart [process]? This will interrupt any in-flight requests."
- Cache restart → "Restart [cache service]? Cached data will be lost and must rebuild."
- Disk cleanup → "Delete these files to free space: [list files and sizes]. Confirm?"
- Database migration → "Run migration [name]? This modifies the database schema."

**Before any destructive action:**
1. Record the pre-recovery state (what's running, current metrics, recent logs)
2. Present the action and its consequences to the user
3. Wait for explicit user approval
4. Execute the action
5. Record: what was attempted, result, rollback path if it fails

**Rollback recording format:**
```
Recovery Action: [what was done]
Pre-State: [state before action]
Post-State: [state after action]
Rollback: [how to undo if needed]
```

---

## PHASE 2 — APPLICATION CHECK (Layer 2)

If infrastructure is healthy, check application layer:

### 2a. Application Vitals
- Run the test suite (or a fast subset)
- Check for recent deployment or config changes: `git log --oneline -5`
- Check environment variables (all required vars present?)
- Check for migration state mismatch

### 2b. Error Analysis
- Recent error logs (last 100 lines or last 30 minutes)
- Error rate trend (increasing, stable, spike?)
- Stack traces → identify root cause file and line
- New errors vs recurring errors

### 2c. Performance Analysis (if performance-related)
- Response time percentiles (p50, p95, p99)
- Throughput vs normal baseline
- Database query times
- External API response times
- Memory leak indicators

### Auto-Recovery (Layer 2)

**Safe actions (no approval needed):**
- Reading logs, error rates, stack traces
- Identifying the change that caused the issue
- Running the test suite

**Destructive actions (require user approval before executing):**
- Missing migration → "Run migration [name]? This modifies the database schema. Rollback: [reverse migration if available]."
- Config revert → "Revert config change from commit [hash]? This rolls back: [list changes]."
- Process restart for memory leak → "Restart [process] to clear memory leak? In-flight requests will be dropped."

**Before any destructive action:** Follow the same approval and rollback recording protocol as Layer 1 above.

---

## PHASE 3 — BUSINESS LOGIC CHECK (Layer 3)

If infrastructure and application are healthy, check business logic:

### 3a. Data Integrity
- Run reconciliation checks (if financial)
- Check for data consistency across related tables
- Verify recent writes are correct
- Check for orphaned or corrupted records

### 3b. Feature Verification
- Test the specific failing feature end-to-end
- Check for recent code changes to the affected area
- Check for race conditions or timing-dependent behavior
- Verify feature flags and configuration

### 3c. External Integration
- Verify webhook processing
- Check API response format changes
- Verify authentication token freshness
- Check rate limiting status

---

## PHASE 4 — ROOT CAUSE ANALYSIS

Once the issue is found:

1. **What broke?** (specific file, function, config, or external cause)
2. **Why did it break?** (code bug, config change, external failure, data issue)
3. **When did it start?** (correlate with recent changes: `git log --since="<suspected_time>"`)
4. **What's the blast radius?** (what else is affected)
5. **Is this a known failure pattern?** (check `system/failures.md`)

### Operational Assessment

Launch the **operations-engineer** persona as an agent to review the root cause analysis:

> Given the identified root cause and diagnosis path, evaluate the operational posture:
>
> 1. **Detection gap:** Why wasn't this caught before user impact? What monitoring, alerting, or health check would have caught it?
> 2. **Blast radius containment:** Could the blast radius have been smaller? (circuit breakers, feature flags, graceful degradation)
> 3. **Recovery speed:** What would make recovery faster next time? (runbooks, automated recovery, better error messages)
> 4. **Recurrence prevention:** Beyond fixing the immediate cause, what systemic change prevents this CLASS of incident?
> 5. **Check against `system/failures.md`:** Is this a recurrence of a known pattern? If so, the previous prevention measures failed and need strengthening.
>
> Produce: An operational assessment with specific monitoring/alerting additions, deployment safeguards, and runbook entries. Each recommendation should be actionable as a work item.

Feed the operations-engineer's assessment into Phase 6 (Post-Incident) to enrich the Prevention section of the failure library entry and generate more targeted prevention work items.

---

## PHASE 5 — FIX & VERIFY

### Apply Fix
- If the fix is obvious and safe: apply it
- If the fix requires code changes: implement and test
- If the fix is risky or unclear: describe the fix, ask for user approval

### Verify Recovery
- Compare post-recovery state to pre-recovery baseline recorded during auto-recovery
- Re-run the failing check
- Run the full vital signs check
- Verify no new issues introduced
- Verify no collateral damage from recovery actions (check related services)
- Monitor for recurrence (check again after 5 minutes if possible)

---

## PHASE 6 — POST-INCIDENT

### Record in Failure Library
Add entry to `system/failures.md`:
```
### FAIL-NNN: [Short title]
Date: YYYY-MM-DD
Category: [infrastructure|application|data|external|logic]
Severity: [SEV-1/2/3/4]
Description: [What happened]
Root Cause: [Why it happened]
Fix: [How it was resolved]
Prevention: [What prevents recurrence]
Detection: [How we'll know faster next time]
```

### Create Prevention Work Items
- Add monitoring/alerting for this failure mode
- Add automated check to health-check engine
- Add invariant if applicable
- Add test to prevent regression

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

### Report

```
## Incident Report

### Summary
- **Severity:** SEV-N
- **Duration:** Xm (detected → resolved)
- **Impact:** [what was affected]
- **Root Cause:** [one-line summary]

### Timeline
| Time | Event |
|------|-------|
| HH:MM | Symptom reported/detected |
| HH:MM | Diagnosis started |
| HH:MM | Root cause identified |
| HH:MM | Fix applied |
| HH:MM | Recovery verified |

### Diagnosis Path
| Layer | Check | Result |
|-------|-------|--------|
| Infrastructure | Process | OK |
| Infrastructure | Database | OK |
| Application | Error logs | FOUND: [error] |
| ... | ... | ... |

### Root Cause
[Detailed explanation]

### Fix Applied
[What was changed]

### Prevention
- [Work items created to prevent recurrence]
- [Monitoring improvements]
- [Tests added]

### Lessons Learned
[What should we do differently next time?]
```

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
