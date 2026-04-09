# Program: Security

Status: YELLOW
Owner: eng-engine (security-engineer persona)
Last assessed: 2026-04-09
Last verified against code: 2026-04-09

---

## Health Criteria

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| Unescaped `innerHTML` in extension | 0 instances | 1-2 instances | 3+ instances | 0 (RT-15 resolved) |
| `chrome.storage.session` trust level | TRUSTED only | — | UNTRUSTED access | TRUSTED only (RT-11 resolved) |
| Secrets in git history | 0 | — | Any | 0 (secrets-scan hook active) |
| Extension message sender validation | All validated | Partial | None | All validated (RT-21 resolved 2026-04-07) |
| `npm audit` critical vulnerabilities | 0 | 1-2 moderate | Any critical | 0 |
| Input validation at system boundaries | All entry points covered | Gaps in extension | Gaps in app | Covered (RT-25 resolved 2026-04-07) |

## Active Backlog Items

- RT-46 (P1): escapeHtml for PID values in innerHTML (XSS in side panel)

## Milestone Gates

| Gate | Status | Criteria |
|------|--------|---------|
| Extension XSS closure | PASSED | All innerHTML wrapped in escapeHtml (RT-15) |
| Storage trust downgrade | PASSED | chrome.storage.session TRUSTED only (RT-11) |
| Firebase auth review | OPEN | Security review before Firebase Cloud Sync resumes (backlog item 6) |
| Supply chain audit | OPEN | npm audit clean, Vite plugin trust verified |

## Auto-Backlog Triggers

| Condition | Backlog Template | Priority |
|-----------|-----------------|----------|
| `innerHTML` without `escapeHtml` in extension code | "Unescaped innerHTML in [file] — XSS vector" | P0 |
| `TRUSTED_AND_UNTRUSTED_CONTEXTS` in any file | "chrome.storage.session trust regression" | P0 |
| `npm audit` reports critical vulnerability | "Critical npm vulnerability: [package]" | P1 |
| New file in `ignition-poker-tracker/` without message sender validation | "Extension message handler missing sender validation in [file]" | P1 |

## History

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-06 | GREEN | Initial assessment. RT-4, RT-11, RT-15 all resolved. No open security items. |
| 2026-04-06 | YELLOW | R3 roundtable: sender.id validation missing in service-worker.js onMessage/onConnect (RT-21); validateTournament accepts any object shape (RT-25). |
| 2026-04-07 | GREEN | RT-21 (sender.id guard) and RT-25 (tournament schema enforcement) both resolved. All metrics GREEN. |
| 2026-04-07 | GREEN | R4 roundtable. No new security findings requiring action. SYSTEM_MODEL.md stale RT-21 text corrected. `loadHandById` userId gap noted but acceptable in single-user context; becomes relevant only if Firebase multi-user activates. |
| 2026-04-07 | GREEN | R5 roundtable. Extension postMessage uses '*' targetOrigin in MAIN world probe (RT-42). ignition-capture.js lacks origin gate on inbound postMessage. Capture port messages not validated in SW. All low-severity in current single-user local context. |
| 2026-04-09 | YELLOW | R6 roundtable. Unescaped PID values in innerHTML at side-panel.js lines 839, 1908-1910 (RT-46). PID originates from WebSocket parser — XSS if crafted frame. Fix is trivial (escapeHtml wrapper). |
