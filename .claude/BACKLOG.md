# Project Backlog

Active work items only. Completed items archived in `BACKLOG_ARCHIVE.md`.

**Last updated:** 2026-04-12 | **Current version:** v122

---

## Status Key

| Status | Meaning |
|--------|---------|
| IN_PROGRESS | Actively being worked by a session (see Claimed By) |
| NEXT | Ready to start, not yet claimed |
| LATER | Planned but not prioritized |
| BLOCKED | Waiting on a prerequisite |
| PAUSED | Started but on hold |
| REVIEW | From eng-engine audit, needs owner approval |

---

## NEXT — Ready to Start

_17 items active. Claim with `/backlog claim <id>` before starting._

### Remaining items (Phase C + D)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-48 | P2 | NEXT | Sidebar: stale advice visual indicator | When advice age > 10s or liveContext is null, advice card shows age badge + border tint; shimmer/loading distinguishable from stale state | — |

### R8 findings (post-RT-43 residue) — remaining

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-61 | P2 | NEXT | Sidebar: planPanel auto-expand routes through scheduleRender | Remove direct `coordinator.set('planPanelOpen', true)` + DOM class write in setTimeout callback at side-panel.js:~983; callback dispatches via scheduler only; test asserts no DOM mutation outside renderAll during 8s window. | — |
| RT-66 | P2 | NEXT | Sidebar: surface state-invariant violations + fix Rule 10 dead path | `pipelineEvents` included in `buildSnapshot` OR Rule 10 rewritten to read coordinator directly; violations above threshold render visible diagnostics badge; test asserts Rule 10 fires when pipelineEvents exceeds cap. | — |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |

---

## Recommended Execution Order

**Phase A — COMPLETE (2026-04-12).** RT-46, RT-56, RT-57, RT-62, RT-63, RT-64, RT-65, RT-67 closed.
**Phase B — COMPLETE (2026-04-12).** RT-43, RT-44, RT-45, RT-47, RT-54, RT-58, RT-59, RT-60 closed. See BACKLOG_ARCHIVE.md.

**Phase C — Test infrastructure (next):**
1. RT-51 (message-level integration harness — partially built; formalize)
2. RT-66 (surface invariant violations, Rule 10)

**Phase D — UX polish + stale/collapse handling:**
3. RT-61 (planPanel via scheduler) — depends on RT-60 ✓
4. RT-53 (render _contextStale indicator)
5. RT-48 (stale advice indicator) — depends on RT-53
6. RT-52 (tournament timer detached DOM — largely mooted by RT-60; verify)
7. RT-49 (collapse state preservation)
8. RT-50 (transition timer) — wire via coordinator.onTableSwitch hook
9. RT-55 (audit remaining dead panels) — mooted by RT-58; confirm
