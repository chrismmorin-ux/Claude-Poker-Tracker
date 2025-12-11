# Audit Report: {AUDIT_ID}

**Type**: {type}
**Status**: pending
**Created**: {timestamp}
**Severity**: {severity}
**Source**: {source}

---

## Executive Summary
{summary}

## Findings
{findings}

## Recommendations
| ID | Recommendation | Priority | Type |
|----|----------------|----------|------|
| R-001 | {recommendation} | P1 | backlog |

## Actionable Items
- [ ] Item 1 → Add to backlog
- [ ] Item 2 → Create task

## Context
- Source command: {source}
- Session: {session_id}

---

**File naming**: `{MMDD}.{sequence}-{type}.md` (e.g., `1211.001-cto-review.md`)

**To review**: `/audit-review {AUDIT_ID}`
**To dismiss**: `/audit-review {AUDIT_ID} --dismiss`
