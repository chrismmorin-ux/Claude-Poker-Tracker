# Project Backlog

Active work items only. Completed items archived in `BACKLOG_ARCHIVE.md`.

**Last updated:** 2026-04-07 | **Current version:** v122

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

_Prioritized items. Claim with `/backlog claim <id>` before starting._

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| — | — | — | _No items ready. Approve REVIEW items below with `/backlog approve <id>`._ | — | — |

---

## REVIEW — R6 Roundtable Findings (2026-04-09)

_From eng-engine R6 audit focused on extension sidebar display-thrashing. All REVIEW — pending owner approval._

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-43 | P1 | REVIEW | Sidebar: unified render scheduler replacing 4+ independent render paths | All DOM writes flow through single scheduleRender(); no direct renderPipelineHealth/renderTournamentPanel/renderRawTournamentInfo calls; visual harness shows no partial-state flicker during rapid push simulation | — |
| RT-44 | P1 | REVIEW | Sidebar: fix renderKey fingerprint (appSeatData hash, exploit content hash, focusedVillainSeat ordering) | renderKey includes appSeatData hash + exploits content hash (not boolean) + focusedVillainSeat computed before inclusion; test proves exploit data change triggers re-render | — |
| RT-45 | P1 | REVIEW | Sidebar: fix STREET_RANK guard to reject advice when liveContext is null | When currentLiveContext is null, advice is held (not rendered) until live context arrives; STREET_RANK includes DEALING/IDLE/COMPLETE mappings; test covers SW restart sequence | — |
| RT-46 | P1 | REVIEW | Sidebar: escapeHtml for PID values in innerHTML (XSS) | All PID string insertions in renderPidSummary (line 839) and tournament protocol log (lines 1908-1910) use escapeHtml(); test with HTML metacharacters in PID | — |
| RT-47 | P2 | REVIEW | Sidebar: eliminate async/sync handler interleave in handlePipelineStatus | handlePipelineStatus either snapshots all state before await or re-reads after; test simulates concurrent push during await | — |
| RT-48 | P2 | REVIEW | Sidebar: stale advice visual indicator | When advice age > 10s or liveContext is null, advice card shows "From previous hand" or age badge; shimmer/loading distinguishable from stale state | — |
| RT-49 | P2 | REVIEW | Sidebar: preserve section collapse state across innerHTML rebuilds | User-expanded/collapsed sections survive exploit/tournament pushes; collapse state stored in variable and restored after DOM write | — |
| RT-50 | P3 | REVIEW | Sidebar: cancel _transitionTimer on rapid street-card updates | render-street-card.js clears pending transition timer before new transition; cross-fade cannot leave card at opacity:0 | — |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |

---

## Recommended Execution Order

**Phase A — Quick wins, parallel (1 session):**
1. RT-46 (escapeHtml PIDs) — trivial XSS fix
2. RT-44 (renderKey fix) — focused, high impact
3. RT-45 (STREET_RANK guard) — focused, high impact

**Phase B — Medium structural, parallel (1-2 sessions):**
4. RT-47 (async handler fix) — prerequisite understanding for RT-43
5. RT-49 (collapse state preservation) — independent
6. RT-50 (transition timer fix) — independent, small

**Phase C — Large structural (1 dedicated session):**
7. RT-43 (unified render scheduler) — highest-leverage single change, subsumes RT-44/RT-47

**Phase D — UX polish (after RT-43):**
8. RT-48 (stale advice indicator) — depends on stable render path
