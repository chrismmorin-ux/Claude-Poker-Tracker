---
name: Persistence + Cache Audit
type: project
status: backlog
opened: 2026-05-11
estimated_sessions: 3-5
program: engineering
phase: pre-launch
---

# Persistence + Cache Audit

## Why this exists

Owner request 2026-05-11: *"I think we need a persistence audit and cache audit. a deep one, done very well. I don't think we have any load-bearing decision architecture around that."*

**Rescoped after discovery.** Within the same session that surfaced this ask, Refactor Sprint Item 3 (DONE 2026-05-11) shipped:
- Migration registry at `src/utils/persistence/migrationRegistry.js` (25 entries, per-store ownership)
- Additive-only CI gate `scripts/check-idb-additive.sh`
- Per-store ownership single source (`getStoreOwner` helper)

That covered the schema-evolution + ownership slice (~30% of the original ask). The remaining ~70% — failure modes, cache staleness contracts, ADR consolidation, cache sweep — is this project.

## The headline finding

IDB is at **v25** with **23 stores** spanning at least 7 programs (PIO, SCF, EAL, PMC, PRF, HSP, base). Migration registry now exists. But:

1. **No failure-mode catalog.** What happens on tx abort? On quota exceeded? On schema downgrade? On concurrent-tab writes? On photo blob orphan after `savePhotoAtomically` tx abort? Some of these have JSDoc comments in their source files; none are catalogued centrally.

2. **No cache staleness contracts.** Hooks like `useAnalysisContext`, `useExploitAnchorsForLive`, `useTendencyContext`, range-engine memoizations — each caches derived state with implicit invalidation rules. None of them have documented contracts: when does the cache go stale? what triggers re-compute? what's the consistency guarantee with the source-of-truth IDB write?

3. **Decision architecture scattered.** Schema versioning policy lives in a passing comment in `gate4-p3-decisions.md §2`. Multi-store-migration pattern lives in another comment. Append-only-store semantics live per-store as JSDoc. Settings-defaults shape rule lives in `feedback_idb_persisted_defaults.md` (memory) but not in an ADR. The owner is right — there is no load-bearing decision architecture document.

## Phases

### Phase 1 — Failure-mode catalog (~1 session)

**Output:** `docs/persistence/FAILURE_MODES.md`

Enumerate every observed-or-theoretical failure mode. Per entry: name / severity / observed-or-theoretical / fix surface / mitigation / cross-link to source.

**Initial seed list (audit will expand):**
- Tx abort mid-write (savePhotoAtomically abort path — blob orphan)
- Schema mismatch / downgrade (newer browser opens older-written DB)
- IDB quota exceeded (mobile Safari ~50MB)
- Settings-defaults `[]` vs absent regression class (per `feedback_idb_persisted_defaults.md`)
- Concurrent-tab writes (single-tab assumption documented?)
- Migration partial-success recovery
- Append-only-store violations (predictionAudit, anchorObservations)
- Photo blob orphan after txn abort
- (More to be discovered)

Each item gets a JSDoc cross-link in its source file pointing back to the catalog entry.

### Phase 2 — Cache staleness contracts (~1-2 sessions)

**Output:** `docs/persistence/CACHE_CONTRACTS.md`

Enumerate every cache surface in the app:
- Context-level: `useAnalysisContext`, `useAnchorLibraryContext`, `useTendencyContext`, `usePlayerPersistence`, `useSessionPersistence`, ...
- Hook-level: `useExploitAnchorsForLive`, `useLiveActionAdvisor` (528 LOC, under refactor-sprint Item 5), range-engine memoizations
- Selector-level: anchorLibrary selectors, replay-analysis memos

Per surface: triggers (when does it compute?) / invalidators (when does it re-compute?) / staleness-window (how stale can it be?) / consistency-guarantee (must match IDB? eventually?).

Each surface gains a JSDoc header pointing back to its entry.

### Phase 3 — Decision log consolidation (~1 session)

**Output:** ≥4 ADRs in `docs/decisions/`:
- Schema versioning policy (`max(currentVersion+1, targetVersion)` pattern)
- Multi-store migration in single version (precedent from `gate4-p3-decisions.md §2`)
- Append-only stores — which stores, why, what's enforced
- Blob storage strategy — photos today, future content types

Plus possibly:
- Settings-defaults shape (`[]` semantics) — ADR-form of `feedback_idb_persisted_defaults.md`

### Phase 4 — Cache sweep (~0.5-1 session)

**Output:** `docs/persistence/CACHE_SWEEP_2026-05-XX.md`

Enumerate every `useMemo` / `useCallback` / context-cached state with non-trivial deps that doesn't have a documented contract from Phase 2. Each undocumented cache surface becomes a follow-up queue item.

## Out of scope

- Refactoring or introducing a `useCacheWithStalenessContract` primitive — Refactor Sprint Item 4 (decision-system extraction) may surface a better unification target. This project documents contracts; it does not enforce a shape.
- New IDB schema work — strictly documentation + enforcement scripts.
- Migration-history rewriting — registry is the source of truth as of 2026-05-11.

## Charter ratifications (binding once owner approves)

1. **Documentation-first, not refactor-first** — this project ships docs + invariants + ADRs. No production-code restructuring of caching layers; that's a separate program if it becomes necessary.
2. **Scope discipline: 4 phases, no scope creep** — if the audit surfaces a major architectural problem (e.g., cache fan-out is unmanageable), that becomes a new project, not Phase 5 of this one.
3. **Pairs with Refactor Sprint Item 4** — decision-system extraction may need the cache contracts from Phase 2 to know what its IDB store + memoization contract looks like. Owner picks: run in parallel with Item 4, or after.

## Resume protocol

Multi-session. At each session start:
1. Read this file
2. Check Phase progress in queue (WS-188 status_note + per-phase deliverables)
3. Resume the in-progress phase OR start the next phase
4. `/session-end` writes the session note; this file updates only when phase-level state changes

## Success criteria

- [ ] Phase 1: FAILURE_MODES.md authored with ≥8 modes catalogued
- [ ] Phase 2: CACHE_CONTRACTS.md covering every context-level cache surface
- [ ] Phase 3: ≥4 ADRs ratified
- [ ] Phase 4: cache sweep report with follow-up queue items filed
- [ ] No regression in test suite (~10,800+ app tests + 2,249 extension)
- [ ] SYSTEM_MODEL.md §11 cross-links to all four phase outputs

## Related

- WS-188 — queue item tracking this project
- Refactor Sprint Items 1 + 2 + 3 (DONE 2026-05-10/11) — set up SYSTEM_MODEL.md + state.md + migration registry
- Refactor Sprint Item 4 (NEXT) — decision-system extraction; may consume Phase 2 outputs
- `feedback_idb_persisted_defaults.md` (memory) — feeds Phase 3 ADR on settings-defaults
- `.claude/failures/UNTRACKED_IMPORT_BUILD_BREAK.md` — adjacent governance pattern (CI-gated discipline)
