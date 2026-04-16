# SW_REANIMATION_REPLAY

**Status:** RESOLVED 2026-04-15 (SRT-1, RT-68 + RT-69).

## Pattern

Chrome MV3 service workers are evicted after ~30 s of inactivity. On
reanimation, `pushFullStateToSidePanel` replays cached state to the side
panel. If the cache includes `actionAdvice` but no fresh `live_hand_context`,
the advice is replayed without context — the side panel buffers it in
`_pendingAdvice`. The next `push_live_context` from the capture pipeline
may promote this stale advice into `lastGoodAdvice` if the street happens
to match across hands (e.g., both preflop).

## Symptoms

- S2: Preflop advice shows during flop (prior-hand advice promoted).
- S3: Plan panel disappears mid-hand (stale advice accepted then cleared).
- S5: Re-render churn from promotion + immediate hand-boundary clear.

## Root cause

`pushFullStateToSidePanel` (service-worker.js) emitted `push_action_advice`
without checking whether a fresh `push_live_context` was available. The
side panel's `_pendingAdvice` buffer had no hand-boundary clear, so stale
advice could survive across `handNew` transitions.

## Fix

1. **RT-68:** `pushFullStateToSidePanel` reads `live_hand_context` from
   session storage (30 s staleness guard). Fresh context: emit
   `push_live_context` first, then `push_action_advice`. No fresh context:
   drop the advice replay entirely.

2. **RT-69:** `_pendingAdvice` force-cleared at the `handNew` boundary in
   `handleLiveContext` (render-coordinator.js), after the promotion check.

## Generalisation

Any MV3 extension that caches derived state (e.g., advice computed from
context) must either:
- Replay the source data (live context) before derived data (advice), or
- Validate derived data against fresh source before promotion.

Caching the derived state alone is insufficient — the MV3 lifecycle makes
the cache stale without any observable event.

## Related

- `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` (post-closure amendment)
- `SYSTEM_MODEL.md` §4.2 (sidebar SW reanimation failure mode)
- SRT-1 commit `e3fe152`
