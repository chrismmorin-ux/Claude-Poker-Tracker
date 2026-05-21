# Cache Staleness Contracts

**Authored:** 2026-05-14 (SPR-080, Refactor Sprint Item 7 / WS-188 Phase 2)
**Owner:** engineering program
**Scope:** every cache surface that holds derived state — context providers, persistence hooks, engine memoization. Each surface has a staleness contract.

This is the canonical cache-staleness register. New cache surfaces land in §1 with a row; load-bearing ones grow §2 prose entries. The point: every cache MUST have a documented invalidation trigger, staleness window, and consistency guarantee. Undocumented caches accumulate silently — Phase 4 (`CACHE_SWEEP_2026-05-14.md`) catches residual gaps.

Companion docs:
- `docs/persistence/FAILURE_MODES.md` — persistence failure register (12 modes).
- `docs/persistence/CACHE_SWEEP_2026-05-14.md` — residual surfaces not covered here.
- `.claude/decisions/2026-05-14-*.md` — 4 persistence ADRs.

---

## §1 — Inventory Table

| File | Cache | Caches what | IDB source-of-truth | Write trigger | Invalidation | Staleness window | Consistency | Multi-tab |
|------|-------|-------------|---------------------|---------------|--------------|------------------|-------------|-----------|
| `src/contexts/TendencyContext.jsx` | `tendencyMap` | `{ [playerId]: { vpip, pfr, af, style, exploits, briefings, rangeProfile } }` | `rangeProfiles`, `players.exploitBriefings` | Hand-count delta | Mount hydration + manual `refresh()` + player list delta | Per-hand (recomputes on new hand) | Read-after-write within tab; eventual across tabs | Single-writer assumption |
| `src/contexts/OnlineAnalysisContext.jsx` | `tendencyMap` (ephemeral) | `{ [seatStr]: { playerId, style, exploits, briefings, weaknesses } }` | None — computed from session hands | 5s auto-interval poll + manual `refresh()` | Session change, hand arrival, `refresh()` | 5 seconds (fixed interval) | Polled; not real-time | N/A (in-memory only) |
| `src/contexts/AnchorLibraryContext.jsx` | `{ anchors, observations, drafts, primitives }` | Active anchor definitions, hand-linked observations, drafts, calibration primitives | 4 stores (exploitAnchors / anchorObservations / anchorObservationDrafts / perceptionPrimitives) | 400ms debounce on state change (per-slice diff-write) | Mount hydration via `useAnchorLibraryPersistence` | 400ms (debounce window) | Read-after-write within tab; **stale cross-tab** | Single-writer assumption; no versionchange listener |
| `src/contexts/PlayerContext.jsx` | `{ allPlayers, seatPlayers }` | Player records + ephemeral seat assignments | `players` | Mount init only; seat assignment ephemeral | Mount load all + manual `loadAllPlayers()` | Persistent (one-time hydration) | Read-after-write within tab | Single-writer |
| `src/contexts/SettingsContext.jsx` | Settings singleton | `{ betSizes, timerOffset, colorScheme, ... }` | `settings` | Immediate on change (no debounce) | Mount init | Real-time (immediate save) | Read-after-write | Single-writer |
| `src/contexts/AssumptionContext.jsx` | `assumptions` | `{ [assumptionId]: { name, value, ... } }` | `villainAssumptions` | 400ms debounce on state change | Mount hydration | 400ms (debounce window) | Read-after-write within tab | Single-writer |
| `src/contexts/EntitlementContext.jsx` | `{ subscriptions, features }` | User tier + feature entitlements | `subscription` | 400ms debounce on state change | Mount hydration | 400ms | Read-after-write within tab | Single-writer |
| `src/contexts/TelemetryConsentContext.jsx` | Consent flags | `{ isConsentGiven, consentTimestamp }` | `settings.telemetry` | 400ms debounce on change | Mount hydration from settings | 400ms | Read-after-write within tab | Single-writer |
| `src/hooks/usePlayerTendencies.js` | `lastHandCountRef`, `lastPlayerHandCountsRef`, `lastResultsRef` | (1) total hand count, (2) per-player hand counts, (3) cached tendency results | `rangeProfiles` (read), `players.exploitBriefings` (write) | Hand-count delta (O(1) check) | Player added to allPlayers list + hand count change | Per-hand-count delta | Read-after-write within tab | Single-writer |
| `src/hooks/usePlayerPersistence.js` | Single hydration + sighting append | `allPlayers`, `seatPlayers` | `players` | Mount init; seat assignment fires `appendSighting` + `updatePlayer` (lastSeenAt) | Mount + manual `loadAllPlayers()` | Persistent | Read-after-write within tab | Single-writer |
| `src/hooks/useSessionPersistence.js` | `lastSavedState` ref | Current session state | `sessions` | 1500ms debounce on field updates | Mount init, `endCurrentSession()` | 1500ms (debounce window) | Read-after-write within tab | Single-writer |
| `src/hooks/useAnchorLibraryPersistence.js` | `hasHydratedRef`, `prevStateRef` | Hydration flag + previous state (for diff-write) | All 4 anchor stores | 400ms debounce, per-slice diff | Mount hydration only | 400ms | Read-after-write within tab | Single-writer |
| `src/hooks/useAnchorObservationDraft.js` | `pendingRef` | Partial draft updates pending dispatch | Via `useAnchorLibraryPersistence` | 400ms debounce on `updateDraft` | Non-debounced `clearDraft` | 400ms | Read-after-write within tab | Single-writer |
| `src/hooks/useEntitlementPersistence.js` | `previousStateRef` | Prior entitlements (for diff-write) | `subscription` | 400ms debounce on state change | Mount hydration | 400ms | Read-after-write within tab | Single-writer |
| `src/hooks/useOnlineAnalysis.js` | `lastHandCountRef`, `seatHandCountRef`, `analysisCacheRef` | (1) global hand count, (2) per-seat counts, (3) cached analysis results | None — computed in-memory | 5s poll interval | Session change + manual `refresh()` | 5s | Polled; not real-time | N/A |
| `src/hooks/useLiveActionAdvisor.js` | `streetRangesRef` | Per-hand range persistence across streets | None — in-memory hand-scoped | Hand completion + street advance | Hand end, new hand detected | Per-hand | Read-after-write within tab | Single-writer |
| `src/hooks/useLiveEquity.js` | `debounceRef` | Pending equity computation timer | None | 300ms debounce on range/board change | Unmount + input change | 300ms (debounce window) | Read-after-write within tab | N/A |
| `src/hooks/useSessionStats.js` | `lastHandCountRef` | Hand count for this session | None — computed from hands | Hand count change detect | Session change | Per-hand-count | Read-after-write within tab | N/A |

---

## §2 — Load-Bearing Surfaces (prose)

Five surfaces where stale state has real consequence on advice/UI correctness. These get explicit invalidation contracts.

### TendencyContext (CRITICAL)

**Purpose:** caches per-player `{ vpip, pfr, style, exploits, briefings, rangeProfile }` derived from accumulated hand history. Consumed by the live advisor, TableView seat tooltips, and the extension HUD via `pushAdvice()`.

**Staleness consequence:** stale briefings corrupt advice. If villain has played 30 more hands but the cache hasn't refreshed, the live advisor proposes deviations from the wrong baseline.

**Invalidation contract:**
- O(1) hand-count delta detect (`lastHandCountRef`) on every hook re-run.
- Manual `refresh()` exposed in context API.
- Player list delta (allPlayers length change) triggers full re-compute.

**Known gap:** mode-switch (offline → online) does not explicitly invalidate the cache. If a user adds offline hands while online polling is paused, the next online poll may not pick up the offline-added hands until the next hand-count delta.

**Recommendation:** add explicit invalidation hook on mode-switch (offline↔online). Tracked as TD-22 follow-up.

### OnlineAnalysisContext (5s poll)

**Purpose:** ephemeral per-seat analysis derived from the current online session's hands. Consumed by the live extension HUD.

**Staleness consequence:** advice based on a hand from 5+ seconds ago. Usually fine, but on a fast table (turbo SnG, multi-tabling) the advisor can miss a hand-arrived event.

**Invalidation contract:**
- 5s poll interval (fixed) calls the analysis pipeline.
- Manual `refresh()` exposed via context API; called by extension on hand-arrived event.
- Session change resets all per-seat caches.

**Known gap:** the poll interval is fixed regardless of hand pace. A faster table doesn't shorten it.

**Recommendation:** drive invalidation from the SyncBridge hand-arrived event instead of (or in addition to) the 5s interval. Tracked as TD-23 follow-up.

### AnchorLibraryContext (400ms debounce + no cross-tab)

**Purpose:** active anchor definitions, hand-linked observations, drafts, calibration primitives. Consumed by AnchorLibraryView, HandReplayView observation capture modal, live matcher.

**Staleness consequence:** stale anchor definitions in the live matcher if user edited anchors in another tab. Single-tab assumption is load-bearing; multi-tab users may see drift.

**Invalidation contract:**
- 400ms debounce write per state change (per-slice diff).
- Mount hydration loads from 4 stores in parallel.
- NO cross-tab IDB-change listener.

**Known gap:** cross-tab edits not propagated. Multi-tab simultaneous use is not supported (INV-PERSIST-5).

**Recommendation:** if multi-tab support becomes a requirement, add IDB `versionchange` + BroadcastChannel listener pair. Out of audit scope (feature work).

### gameTree caches (caller-owned, pass-through) — CRITICAL GAP

**Purpose:** combo equity distribution across board runs. Pass-through cache param accepted by `gameTreeEquity.js`, `gameTreeDepth2.js`, `gameTreeEvaluator.js`.

**Staleness consequence:** if a caller reuses a cache across a villain model update or equity table swap, computed EVs may not reflect the new model. The engine has no way to detect this — the cache is opaque.

**Invalidation contract:**
- Engine: NONE. The cache is caller-supplied; engine reads/writes without checking provenance.
- Tests use `createBoardCache()` factory locally but it's not a public export.

**Known gap:** no public cache factory, no documented cache key, no versioning strategy. The cache is a critical hot-path optimization with no safety net.

**Recommendation:** expose a `createGameTreeCache({ modelVersion })` factory that tags caches with a model version. Engine checks the tag before read; mismatch invalidates. Tracked as TD-24 follow-up.

### useSeatTendency (shallow-eq cache; parent-stability dependent)

**Purpose:** memoized per-seat tendency selector for PlayerAnalysisPanel rendering.

**Staleness consequence:** if parent doesn't stabilize the `tendencyMap` reference, the memo invalidates every render — expensive re-computation cascade.

**Invalidation contract:**
- Shallow-equality check via `useRef` fallback (`prevRef.current === tendencyMap`).
- Caller responsibility: stable identity of `tendencyMap`.

**Known gap:** the stable-reference contract is implicit. A future caller passing an inline object will silently break memoization.

**Recommendation:** document the stable-reference contract in JSDoc on the hook. Done as part of Phase 2 JSDoc back-pointers (see below).

---

## §3 — Debounce Convention

| Debounce | Used by | Why |
|----------|---------|-----|
| 400ms (standard) | useAnchorLibraryPersistence, useEntitlementPersistence, useAssumptionPersistence, TelemetryConsentContext | Balance: user perception (sub-perceptible delay) vs batch efficiency. The "standard" for persistence writes across this codebase. |
| 300ms (faster) | useLiveEquity | Equity recomputation is heavier; want the user's range edits to feel responsive but not block on every keystroke. |
| 1500ms (slower) | useSessionPersistence | Session metadata (notes, timer offset) is less write-frequent; 1500ms reduces IDB churn during active play. |
| 5s (poll, not debounce) | useOnlineAnalysis | Polling extension state from the bridge; 5s is the chosen interval for hand-arrived detection (see §2 OnlineAnalysisContext gap). |
| Immediate (no debounce) | SettingsContext | Settings changes are infrequent and user-initiated. Immediate save matches the user's mental model. |

**Rule:** new persistence hooks default to 400ms unless there's a specific reason. Exceptions document the reason inline.

---

## §4 — Hydration-then-Debounce Pattern

Every persistence hook follows this shape:

```js
const hasHydratedRef = useRef(false);
const prevStateRef = useRef(null);

useEffect(() => {
  // Hydration: load from IDB and dispatch initial state
  loadFromIDB().then(state => {
    dispatch({ type: '<DOMAIN>_HYDRATED', payload: state });
    hasHydratedRef.current = true;
  });
}, []);

useEffect(() => {
  if (!hasHydratedRef.current) return; // Guard: no writes before hydration

  const timer = setTimeout(() => {
    if (state !== prevStateRef.current) {
      writeToIDB(state); // Per-slice diff-write
      prevStateRef.current = state;
    }
  }, 400);
  return () => clearTimeout(timer);
}, [state]);
```

**Invariant (INV-PERSIST-4 in `system/invariants.md`):** writes to IDB are gated behind `hasHydratedRef.current === true`. Pre-hydration writes would overwrite real IDB state with empty defaults.

**Defense in depth:** the read side (`<DOMAIN>_HYDRATED` reducer action) also applies defaults to any missing fields, in case the cached state is partial.

---

## §5 — Multi-tab Contract

**Single-tab assumption is load-bearing.** Per FM-PERSIST-5 + INV-PERSIST-5:

- Each tab caches its own DB connection (`cachedDb` singleton in `database.js`).
- Cross-tab record-level writes are NOT broadcast.
- IDB `onversionchange` handler closes the connection on upgrade from another tab (FM-PERSIST-11).
- `onblocked` handler tells the user to close other tabs and reload.

If multi-tab support becomes a requirement, the implementation needs:
1. IDB `versionchange` event listener (already partially wired).
2. `BroadcastChannel` for record-level changes.
3. A subscription protocol per cache surface to refresh on broadcast.
4. Tests for multi-tab interleaving.

Out of scope this audit.

---

## Tech debt follow-ups (filed)

- **TD-22** (SYSTEM_MODEL.md §11) — TendencyContext lacks mode-switch invalidation.
- **TD-23** (SYSTEM_MODEL.md §11) — OnlineAnalysisContext polling not driven by hand-arrived event.
- **TD-24** (SYSTEM_MODEL.md §11) — gameTree caches have no public factory or versioning contract.

## Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-14 | SPR-080 Item 2 / WS-188 Phase 2 | Initial authoring — 18 surfaces tabulated; 5 load-bearing prose entries; debounce convention + hydration pattern + multi-tab contract documented. |
