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
| RT-43 | P1 | REVIEW | Sidebar: unified render scheduler + single-owner state store | All DOM writes flow through single scheduleRender(); module-level state vars eliminated — RenderCoordinator._state is sole authority; syncStateToCoordinator() deleted or reduced to no-op; visual harness shows no partial-state flicker during rapid push simulation | — |
| RT-44 | P1 | REVIEW | Sidebar: fix renderKey fingerprint (appSeatData hash, exploit content hash, focusedVillainSeat ordering) | renderKey includes appSeatData hash + exploits content hash (not boolean) + focusedVillainSeat computed before inclusion; test proves exploit data change triggers re-render | — |
| RT-45 | P1 | REVIEW | Sidebar: fix STREET_RANK guard + hand-number binding on advice | When currentLiveContext is null, advice is held (not rendered) until live context arrives; STREET_RANK includes DEALING/IDLE/COMPLETE mappings; advice guard includes hand-number/hand-id binding — advice from previous hand rejected regardless of street rank; test covers SW restart sequence + cross-hand contamination | — |
| RT-46 | P1 | REVIEW | Sidebar: escapeHtml for PID values in innerHTML (XSS) | All PID string insertions in renderPidSummary (line 839) and tournament protocol log (lines 1908-1910) use escapeHtml(); test with HTML metacharacters in PID | — |
| RT-47 | P2 | REVIEW | Sidebar: eliminate async/sync handler interleave in handlePipelineStatus | handlePipelineStatus either snapshots all state before await or re-reads after; test simulates concurrent push during await | — |
| RT-48 | P2 | REVIEW | Sidebar: stale advice visual indicator | When advice age > 10s or liveContext is null, advice card shows "From previous hand" or age badge; shimmer/loading distinguishable from stale state | — |
| RT-49 | P2 | REVIEW | Sidebar: preserve section collapse state across innerHTML rebuilds | User-expanded/collapsed sections survive exploit/tournament pushes; collapse state stored in variable and restored after DOM write | — |
| RT-50 | P3 | REVIEW | Sidebar: cancel _transitionTimer on rapid street-card updates | render-street-card.js clears pending transition timer before new transition; cross-fade cannot leave card at opacity:0 | — |

---

## REVIEW — R7 Roundtable Findings (2026-04-11)

_From eng-engine R7 audit focused on sidebar self-verification overhaul. All REVIEW — pending owner approval._

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-51 | P1 | REVIEW | Sidebar: message-level integration test harness | Feed raw push_* message sequences into handler dispatch; assert coordinator state AND DOM output for ≥5 scenarios (SW restart, rapid table switch, advice-before-context, concurrent async handlers, diagnostics burst); tests exercise handlePipelineStatus, handleAdvicePush, syncStateToCoordinator | — |
| RT-52 | P2 | REVIEW | Sidebar: tournament timer writes to detached DOM node | Tournament countdown timer references stable DOM element (not innerHTML-replaced); timer cleared on table switch and before innerHTML rewrite; no frozen countdown after renderAll | — |
| RT-53 | P2 | REVIEW | Sidebar: render _contextStale visual indicator | When _contextStale is true, sidebar displays visible stale-context indicator (dimmed header, timestamp, or banner); verified in visual harness with temporal scenario | — |
| RT-54 | P2 | REVIEW | Sidebar: community cards and villain profile in renderKey | buildRenderKey includes community card content hash and villain profile headline; test proves turn card arrival triggers re-render even when no other tracked field changes | — |
| RT-55 | P3 | REVIEW | Sidebar: audit and remove dead panel render functions | Confirm whether renderExploitPanel/renderWeaknessPanel/renderBriefingPanel/renderObservationPanel are called; if dead code, remove; if called outside renderAll, fold into unified render path | — |
| RT-56 | P3 | REVIEW | Sidebar: _receivedAt missing on push_pipeline_status path | push_pipeline_status handler sets _receivedAt on currentLiveContext; stale timeout math never produces NaN; test covers pipeline-status-only reconnect path | — |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |

---

## Recommended Execution Order

**Phase A — Quick wins, parallel (1 session):**
1. RT-46 (escapeHtml PIDs) — trivial XSS fix
2. RT-45 (STREET_RANK guard + hand-number binding) — focused, high impact
3. RT-56 (_receivedAt on pipeline status path) — small, prevents NaN stale timeout

**Phase B — Structural foundation (1-2 sessions):**
4. RT-43 (unified scheduler + single-owner state store) — highest-leverage change; eliminates dual-state root cause; subsumes RT-44/RT-47
5. RT-55 (audit dead panel functions) — prerequisite for RT-43 to know which functions to fold in

**Phase C — Test infrastructure (1 dedicated session, after RT-43):**
6. RT-51 (message-level integration harness) — enables verification of all subsequent changes against real message sequences

**Phase D — UX polish + correctness (after RT-43 + RT-51):**
7. RT-52 (tournament timer detached DOM) — independent
8. RT-53 (render _contextStale indicator) — depends on stable render path
9. RT-54 (community cards + villain in renderKey) — depends on single-owner state
10. RT-49 (collapse state preservation) — independent
11. RT-50 (transition timer fix) — independent
12. RT-48 (stale advice indicator) — depends on RT-53
