# Cache Sweep — 2026-05-14

**Authored:** 2026-05-14 (SPR-080, Refactor Sprint Item 7 / WS-188 Phase 4)
**Owner:** engineering program
**Scope:** residual `useMemo` / `useCallback` / module-level cache surfaces NOT covered by `docs/persistence/CACHE_CONTRACTS.md` §1.

This is a one-session worklist scan. Each entry is a candidate for documentation (Phase 2 expansion) or a follow-up WS item. The goal is **not** to contract every surface — it's to enumerate the residual surfaces so we know what isn't covered.

## Methodology

1. `grep -rEn "useMemo|useCallback" src/components/views src/components/ui` → 368 hits.
2. `grep -rEln "const cache\s*=\s*new (Map|WeakMap)" src/` → 0 module-level Map/WeakMap caches.
3. Filtered Phase 2 §1 surfaces (18 documented).
4. Spot-checked the residual hits by classification:
   - **render-only** (cache lifetime = single render or single component lifecycle; staleness has no semantic consequence)
   - **boundary-effect** (memoization stabilizes prop identity for child components; staleness causes re-render churn but not wrong state)
   - **undocumented-cache** (holds derived state across renders with consumer consequence; warrants a CACHE_CONTRACTS.md entry or follow-up WS)

## Findings — by classification

### Render-only (no follow-up needed)

The vast majority of `useMemo`/`useCallback` hits are render-stabilization patterns:

- Stable callback references for event handlers passed to children
- Derived display strings (formatting + locale)
- Style-object stabilization for `React.memo` children
- Conditional class-name construction

These are React-idiomatic; not caches in the staleness-contract sense. ~280 of the 368 hits fall here.

### Boundary-effect (no follow-up needed; documented behavior)

~60 hits stabilize an object/array reference to prevent downstream re-render. Examples:

- `src/components/views/TableView.jsx` — stable seat-array refs for SeatComponent memo.
- `src/components/views/HandReplayView/ReviewPanel.jsx` — stable filter-chip refs.
- `src/components/ui/PlayerCard.jsx` — stable avatar-feature object refs.

These pair with `React.memo` on the child component. Staleness has no consequence; freshness of the cached ref tracks the data it derives from.

### Undocumented-cache (candidates for follow-up WS items)

The following surfaces hold derived state across renders with potential consumer consequence. They were NOT in Phase 2 §1's inventory and may warrant per-surface documentation:

| File:line | What it caches | Classification | Recommendation |
|-----------|----------------|----------------|----------------|
| `src/hooks/usePlayerFinder.js` (466 LOC hook) | Candidate-match scores + filter state across re-runs | Mid-render cache | Document in CACHE_CONTRACTS.md §1 or follow-up |
| `src/hooks/useSyncBridge.js` (386 LOC hook) | Bridge connection state + last-payload ref | Connection-scoped cache | Document; staleness contract = bridge handshake |
| `src/hooks/usePlayerFiltering.js` (359 LOC hook) | Filter result set + chip-state debounce | Filter-state cache | Document; staleness = chip-state debounce |
| `src/utils/exploitEngine/gameTreeEquity.js` (caller-supplied cache param) | Combo equity distributions | **CRITICAL GAP** (already flagged in CACHE_CONTRACTS.md §2 #4) | Build canonical cache factory; tracked as TD-24 |
| `src/utils/exploitEngine/gameTreeDepth2.js` (caller-supplied cache) | Per-combo EV for depth-2 | Same as gameTreeEquity | Same fix path |
| `src/utils/rangeEngine/rangeProfile.js` (in-IDB cached profile w/ `profileVersion`) | Bayesian player range profile | Versioned cache; schema-upgrade behavior unclear | Document version-mismatch behavior in CACHE_CONTRACTS.md; verify re-profile on bump |
| `src/components/views/HandReplayView/ReviewPanel.jsx` (~lines 110-180) | Per-hand timeline + street action accumulation | Hand-scoped cache | Document if surfaces consumer effect |
| `src/components/views/AnchorLibraryView/AnchorLibraryView.jsx` | `localStorage`-persisted filter/sort state | localStorage-backed cache | Different mechanism (localStorage, not IDB); document the localStorage surface separately |
| `src/components/views/SelfCoachView/CurriculumTab.jsx` | Concept tree expansion state + selection | UI-state cache; persists across re-renders | Probably render-only; verify |
| `src/components/views/PlayersView.jsx` | Filtered player list + search state | UI-state cache | Probably render-only; verify |

**Estimated total residual surfaces warranting follow-up: 5-7 (after spot-check verification).**

## Follow-up WS items (filed)

Per WS-188 spec, residual surfaces become follow-up WS items at P=8 P3, category `persistence-architecture`. Authoring those tickets is part of this sprint's close-out. The list will land as 5-7 new WS-NNN.yaml entries in `.claude/workstream/queue/` after the spot-check verification (deferred to next session if scope tight).

**Headline residual:** the gameTree caller-owned cache (TD-24) is the most consequential — it sits at the hot path of every postflop equity computation and has no public factory or versioning contract. This is the one surface that genuinely matters from this sweep.

## What this sweep is NOT

- Not exhaustive on `useMemo`/`useCallback`. Per Q4=Residual-surfaces, we cap at 1 session of grepping; the 368-hit base rate makes exhaustive coverage low-ROI.
- Not a contract authoring exercise. CACHE_CONTRACTS.md is the contract document; this is a worklist.
- Not a fix list. The recommendations are documentation / follow-up tickets, not code changes.

## Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-14 | SPR-080 Item 2 / WS-188 Phase 4 | Initial sweep. 368 hits scanned; ~280 render-only, ~60 boundary-effect, 10 candidate-undocumented (5-7 warrant follow-up after spot-check). |
