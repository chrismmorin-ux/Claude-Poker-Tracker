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

### R6 findings (sidebar display-thrashing)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-43 | P1 | NEXT | Sidebar: unified render scheduler + single-owner state store | All DOM writes flow through single scheduleRender(); module-level state vars eliminated — RenderCoordinator._state is sole authority; syncStateToCoordinator() deleted or reduced to no-op; visual harness shows no partial-state flicker during rapid push simulation | — |
| RT-44 | P1 | NEXT | Sidebar: fix renderKey fingerprint (appSeatData hash, exploit content hash, focusedVillainSeat ordering) | renderKey includes appSeatData hash + exploits content hash (not boolean) + focusedVillainSeat computed before inclusion; test proves exploit data change triggers re-render | — |
| RT-45 | P1 | NEXT | Sidebar: fix STREET_RANK guard + hand-number binding on advice | When currentLiveContext is null, advice is held (not rendered) until live context arrives; STREET_RANK includes DEALING/IDLE/COMPLETE mappings; advice guard includes hand-number/hand-id binding — advice from previous hand rejected regardless of street rank; test covers SW restart sequence + cross-hand contamination | — |
| RT-48 | P2 | NEXT | Sidebar: stale advice visual indicator | When advice age > 10s or liveContext is null, advice card shows "From previous hand" or age badge; shimmer/loading distinguishable from stale state | — |
| RT-49 | P2 | NEXT | Sidebar: preserve section collapse state across innerHTML rebuilds | User-expanded/collapsed sections survive exploit/tournament pushes; collapse state stored in variable and restored after DOM write | — |
| RT-50 | P3 | NEXT | Sidebar: cancel _transitionTimer on rapid street-card updates | render-street-card.js clears pending transition timer before new transition; cross-fade cannot leave card at opacity:0. **Note:** absorbed into RT-60 timer-registration contract if RT-60 lands first. | — |

### R7 findings (self-verification + root causes)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-51 | P1 | NEXT | Sidebar: message-level integration test harness | Feed raw push_* message sequences into handler dispatch; assert coordinator state AND DOM output for ≥5 scenarios (SW restart, rapid table switch, advice-before-context, concurrent async handlers, diagnostics burst); tests exercise handlePipelineStatus, handleAdvicePush, syncStateToCoordinator | — |
| RT-52 | P2 | NEXT | Sidebar: tournament timer writes to detached DOM node | Tournament countdown timer references stable DOM element (not innerHTML-replaced); timer cleared on table switch and before innerHTML rewrite; no frozen countdown after renderAll | — |
| RT-53 | P2 | NEXT | Sidebar: render _contextStale visual indicator | When _contextStale is true, sidebar displays visible stale-context indicator (dimmed header, timestamp, or banner); verified in visual harness with temporal scenario | — |
| RT-54 | P2 | NEXT | Sidebar: community cards and villain profile in renderKey | buildRenderKey includes community card content hash and villain profile headline; test proves turn card arrival triggers re-render even when no other tracked field changes | — |
| RT-55 | P3 | NEXT | Sidebar: audit and remove dead panel render functions | Confirm whether renderExploitPanel/renderWeaknessPanel/renderBriefingPanel/renderObservationPanel are called; if dead code, remove; if called outside renderAll, fold into unified render path. **Note:** RT-58 supersedes for four specific functions. | — |

### R8 findings (post-RT-43 residue)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-58 | P1 | NEXT | Sidebar: delete dead render functions with bare-var ReferenceError traps | Remove `renderBriefingPanel` (side-panel.js:1671-1788), `renderObservationPanel` (:1822-1837), `computeFocusedVillain` wrapper (:899-902); fix diagnostic-dump block (:2400-2421) to read from `coordinator.get()`; remove `.briefing-item` click handler wiring if no live consumer; grep confirms zero references. Supersedes RT-55 for these four sites. | — |
| RT-59 | P1 | NEXT | Sidebar: route handlePipelineStatus liveContext through handleLiveContext | side-panel.js:244 calls `coordinator.handleLiveContext(ctx)` instead of `coordinator.set('currentLiveContext', ...)`; position lock + `_receivedAt` + pending-advice promotion apply identically on both push paths; test asserts position lock preserved when liveContext arrives via pipeline-status-only reconnect. | — |
| RT-60 | P1 | NEXT | Sidebar: coordinator timer registration contract | `RenderCoordinator` exposes `registerTimer(key, handle)` / `clearTimer(key)` / `clearAllTimers()`; `_planPanelAutoExpandTimer`, `tourneyTimerInterval`, staleContext interval, and cross-fade `_transitionTimer` register via this API; `clearForTableSwitch()` + `destroy()` call `clearAllTimers()`; test asserts planPanel 8s timer does not fire after table switch. Absorbs RT-50. | — |
| RT-61 | P2 | NEXT | Sidebar: planPanel auto-expand routes through scheduleRender | Remove direct `coordinator.set('planPanelOpen', true)` + DOM class write in setTimeout callback at side-panel.js:~983; callback dispatches via scheduler only; test asserts no DOM mutation outside renderAll during 8s window. | — |
| RT-66 | P2 | NEXT | Sidebar: surface state-invariant violations + fix Rule 10 dead path | `pipelineEvents` included in `buildSnapshot` OR Rule 10 rewritten to read coordinator directly; violations above threshold render visible diagnostics badge; test asserts Rule 10 fires when pipelineEvents exceeds cap. | — |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |

---

## Recommended Execution Order

**Phase A — COMPLETE (2026-04-12).** RT-46, RT-56, RT-57, RT-62, RT-63, RT-64, RT-65, RT-67 closed. See BACKLOG_ARCHIVE.md.

**Phase B — Structural foundation (next, 1-2 sessions):**
1. RT-43 (unified scheduler + single-owner state store) — highest leverage; subsumes RT-44 behavior
2. RT-58 (delete dead fns + fix diag dump) — supersedes RT-55 scope for 4 sites
3. RT-45 (STREET_RANK guard + hand-number binding)
4. RT-59 (single handleLiveContext entry point) — extends RT-47
5. RT-47 (async/sync interleave in handlePipelineStatus)
6. RT-60 (coordinator timer registration) — absorbs RT-50

**Phase C — Test infrastructure (1 dedicated session, after Phase B):**
7. RT-51 (message-level integration harness)
8. RT-66 (surface invariant violations, Rule 10)

**Phase D — UX polish + renderKey completeness (after Phase B+C):**
9. RT-61 (planPanel via scheduler) — depends on RT-60
10. RT-44 (renderKey fingerprint)
11. RT-54 (renderKey: community cards + villain profile)
12. RT-53 (render _contextStale indicator)
13. RT-48 (stale advice indicator) — depends on RT-53
14. RT-52 (tournament timer detached DOM)
15. RT-49 (collapse state preservation)
16. RT-50 (transition timer) — moot if RT-60 lands first
17. RT-55 (audit remaining dead panels) — moot if RT-58 covers everything
