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

### R6 findings (sidebar display-thrashing) — remaining

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-48 | P2 | NEXT | Sidebar: stale advice visual indicator | When advice age > 10s or liveContext is null, advice card shows "From previous hand" or age badge; shimmer/loading distinguishable from stale state | — |
| RT-49 | P2 | NEXT | Sidebar: preserve section collapse state across innerHTML rebuilds | User-expanded/collapsed sections survive exploit/tournament pushes; collapse state stored in variable and restored after DOM write | — |
| RT-50 | P3 | NEXT | Sidebar: cancel _transitionTimer on rapid street-card updates | render-street-card.js clears pending transition timer before new transition; cross-fade cannot leave card at opacity:0. **Note:** absorbed into RT-60 timer-registration contract — wire via coordinator.onTableSwitch hook. | — |

### R7 findings (self-verification + root causes)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-51 | P1 | NEXT | Sidebar: message-level integration test harness | Feed raw push_* message sequences into handler dispatch; assert coordinator state AND DOM output for ≥5 scenarios (SW restart, rapid table switch, advice-before-context, concurrent async handlers, diagnostics burst); tests exercise handlePipelineStatus, handleAdvicePush, syncStateToCoordinator | — |
| RT-52 | P2 | NEXT | Sidebar: tournament timer writes to detached DOM node | Tournament countdown timer references stable DOM element (not innerHTML-replaced); timer cleared on table switch and before innerHTML rewrite; no frozen countdown after renderAll | — |
| RT-53 | P2 | NEXT | Sidebar: render _contextStale visual indicator | When _contextStale is true, sidebar displays visible stale-context indicator (dimmed header, timestamp, or banner); verified in visual harness with temporal scenario | — |
| RT-55 | P3 | NEXT | Sidebar: audit and remove dead panel render functions | Confirm whether renderExploitPanel/renderWeaknessPanel/renderBriefingPanel/renderObservationPanel are called; if dead code, remove; if called outside renderAll, fold into unified render path. **Note:** RT-58 supersedes for four specific functions. | — |

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
