---
name: Refactor Sprint 2026-05-10
type: project
status: completed
opened: 2026-05-10
closed: 2026-05-14
estimated_sessions: 8-10
actual_sessions: 5 (compressed via SPR-078 / SPR-079 / SPR-080 multi-item bundle)
program: engineering
phase: pre-launch
---

# Refactor Sprint — Architectural Reset Before Resuming Feature Work

## Why this exists

After ~6+ weeks of heavy feature + design work (PIO, SCF, EAL, HSP, SHC, PRF, PMC, LSW), an architectural survey surfaced 5 pressure points where the architecture is creaking under accumulated programs. Owner ratified a deliberate pause on feature work to address these before the next program (PIO Phase 5, PMC Phase 5b, SCF Gate 5) compounds them further.

Survey performed 2026-05-10 (this session). Findings ranked by leverage; owner chose **full architectural reset** over staged sprints.

## The headline finding

The same 5-piece module pattern (engine logic + IDB store + reducer + hook + context+view) has been built **four times** without ever being named or factored: Assumption Engine, Anchor Library, Skill Assessment, and now PMC's predictionAudit. Each time it was authored from scratch with slightly different choices. Without extraction, the next decision-system program pays the build cost a 5th time and the existing 4 keep drifting.

## Sprint scope (6 items, all approved)

> **Items 1 and 2 are paired** as "canonical state-file restoration" — both fix files the protocol reads on every session that have silently fallen out of usable shape. Item 1 was missing entirely; Item 2 is structurally unreadable. Pairing them means the next session's `session-start` ceremony actually works.

### Item 1 — Restore SYSTEM_MODEL.md (1 session) — DONE 2026-05-10
**Why:** CLAUDE.md routes every multi-file change through `.claude/context/SYSTEM_MODEL.md` but the file is missing from the canonical location. A `.pre-cwos-backup` exists. Every cross-cutting program (PIO/SCF/PMC/Sidebar Gate 5) is operating without the architectural baseline the protocol assumes.

**Definition of done:**
- [x] File restored at `.claude/context/SYSTEM_MODEL.md`
- [x] Counts updated to current state (20 contexts, 13 reducers, 62 hooks, 20 views, IDB v25, 29 persistence modules)
- [x] §6.1 Hidden Coupling adds the unnamed decision-system pattern (C-15)
- [x] §11 Tech Debt Register adds TD-15/16/17 (decision-system unnamed, persistence registry missing, useLiveActionAdvisor at 528 LOC)
- [x] §12 Decision Log adds 2026-05-10 entry for this Refactor Sprint
- [ ] **Deferred to follow-up:** stale references sweep, [verify-pending] sections (full reducer/view list, §1.2 dependency graph cross-check, §3 state model verification)

### Item 2 — Reshape `system/state.md` (1 session) — DONE 2026-05-10
**Why:** Same class as Item 1 — canonical state file the protocol reads at every session start, but in unusable shape. Line 3 was a ~8K-char single-line cumulative session changelog. Recent Sessions table had 38 rows each 1-5K chars. The whole file errored on a single Read call (40K tokens). "Read state.md for vital signs" — the most-invoked instruction in CLAUDE.md — had been silently failing.

**Definition of done:**
- [x] Line 3 cumulative changelog moved out → `system/state-history.md` (raw archive; not redundant — only 2 session files existed)
- [x] state.md fits canonical 5-section structure: Vital Signs / Project Phase / Metrics / Queue Summary / Program Health / Recent Sessions
- [x] Top of file readable in one screen (93 lines / 4919 chars / ~1300 tokens — 30× reduction)
- [x] Metrics section reflects current architecture (matches SYSTEM_MODEL.md §1.1: 13 reducers / 20 contexts / 62 hooks / 20 views / IDB v25)
- [x] Append-discipline rule added inline as a binding callout at the top of state.md
- [x] Spot-check: `sprint-index.yaml` confirmed same class (30K tokens, 845 lines) — flagged as **TD-18** in SYSTEM_MODEL.md §11 with deferral note (still YAML-structured, not a current orientation blocker)

### Item 3 — Persistence migration registry (~1 session) — DONE 2026-05-11
**Why:** IDB v25 with 23 stores and no visible migration registry. Every active program (PIO/SCF/EAL/PMC/PRF) is racing into the same files. Most likely future incident surface.

**Definition of done:**
- [x] Migration registry at `src/utils/persistence/migrationRegistry.js` — 25 entries with description, storesAdded/storesChanged, owner, migrationFn, shippedAt
- [x] Per-store ownership derivable via `getStoreOwner(storeName)` helper (single source of truth; inline `database.js` comment blocks now redundant — slated for follow-up cleanup)
- [x] Test enforcing additive-only invariant — `__tests__/migrationRegistry.test.js` (19 cases) + CI gate `scripts/check-idb-additive.sh` (forbids `deleteObjectStore`/`deleteIndex`, wired into `scripts/smart-test-runner.sh`)
- [x] PMC Phase 5a unblocked — v25 already shipped; registry documents it retroactively; PMC Phase 5b can extend the same record without registry refactor

**Closeout notes:**
- PMC Phase 5a (predictionAudit v25 migration + writer + test) was already shipped before Item 3 started — Item 3 ships pure infrastructure (registry + enforcement), not a new migration.
- Discovered drift: SYSTEM_MODEL.md §1 + §11 said "~30 stores" but actual count is 23. Fixed in the same edit that resolved TD-16.
- Discovered drift: TD-16 prose called this "Refactor Sprint Item 2" but project file renumbered to Item 3 after state.md reshape became the new Item 2. Fixed in TD-16 resolution.
- Item 3 actually fit in ~1 session, not ~2 — the registry-authoring step was simpler than estimated because the orchestrator comment block in `migrations.js` lines 1062–1145 already encoded most of the per-version metadata.
- Deferred to a separate cheap follow-up: removing the 7 redundant inline-ownership comment blocks in `database.js` lines 64–110 (registry now supersedes them). Not a correctness issue; doc-drift surface only.
- Discovered orphaned gate: `scripts/check-refresher-writers.sh` exists but is not wired into `smart-test-runner.sh` or any CI config. Out of scope for Item 3; flag for engineering program follow-up.

### Item 4 — Extract decision-system module pattern (~3-4 sessions) (was Item 3) — DONE 2026-05-14 (SPR-078)
**Why:** 4 instances of the same 5-piece pattern. Templating now stops drift, cuts PMC Phase 5b cost, and gives future programs (drift detection, multi-villain modeling) a starting shape.

**Depends on:** Item 1 (need SYSTEM_MODEL.md to document the pattern) + Item 3 (need persistence governance for the IDB part).

**Definition of done:**
- [x] `src/utils/decisionSystems/` core: accumulator (createAccumulator + betaPosterior + wilsonCI; canonical Z_95=1.959963984540054) + registry (createRegistry + invariants) + idbStore (createUpsertStore + createReplaceAllStore + createEmbeddedRecordStore + migrationGuard) + reducerComposition (createNamespacedReducer + withPersistenceDispatch). CLAUDE.md + index.js barrel.
- [x] anchorLibrary migrated as proof: `primitiveValidity.js` delegates Beta math; 4 IDB store wrappers collapsed (788→187 LOC, ~600 deleted); new `writers.js` in-code mirror of WRITERS.md via shared `createRegistry`.
- [x] **Two** ADRs ratifying the pattern: ADR-DS-1 (extraction charter) + ADR-DS-2 (IDB factory binds to migrationRegistry). At `.claude/decisions/2026-05-14-*`.
- [x] Other 3 instances tracked: assumptionEngine = TD-15-followup (tracked-as-future); skillAssessment + predictionAudit = explicitly EXCLUDED (pure-detector pattern; separate module if shared infra needed).

**Closeout notes:**
- Owner ratified Q1=Broader (full charter-verbatim 4-piece) / Q2=Bind (factory asserts registry membership) / Q3=Two ADRs (umbrella + migration-binding) via plan-mode AskUserQuestion 2026-05-14.
- 134 new tests across decisionSystems submodules (accumulator 50 + registry 20 + idbStore 45 + reducerComposition 19) + 9 new writers drift tests on anchorLibrary side.
- Full smart-test-runner: 11222/11222 green. Build clean.
- z-constant drift resolved (was 1.959963984540054 in anchorLibrary, 1.96 in assumptionEngine + skillAssessment; now canonical via Z_95 export from betaPosterior).
- Reducer-composition + withPersistenceDispatch ship UNADOPTED by anchorLibrary (anchorLibrary's 8 actions don't decompose into independent slices cleanly). Adoption is forcing function for the next stateful migration (assumptionEngine drillSession sub-slice OR PMC Phase 5b ledger+aggregator dual-slice).
- SYSTEM_MODEL.md updated: §1.1 (component map), §6.1 (C-15 refactored), §11 (TD-15 partially resolved + TD-15-followup added + TD-16 sub-item closed), §12 (Decision Log entry).
- Discovered drift: the project charter renumbered Items mid-sprint after Item 2 (state.md reshape) was added; TD-15 prose now matches the final numbering. SYSTEM_MODEL.md §11 TD-15 entry similarly updated.

### Item 5 — Split useLiveActionAdvisor (1-2 sessions) (was Item 4) — DONE 2026-05-14 (SPR-080 Item 1)
**Why:** 528 LOC, single hook with multiple responsibilities. PMC Phase 5b needs to add a hand-end integration point — adding to a 528-LOC hook is risky.

**Definition of done:**
- [x] Hook split by responsibility — 6 pure helpers extracted verbatim to `src/utils/liveAdvisor/computeHelpers.js`. Hook slimmed from 528 → 370 LOC. Owner ratified Q1=Helpers-out (minimal cut) over Q1=Three-piece (charter-literal) given weak integration-test surface.
- [x] Existing tests still pass — 3301 tests across `src/contexts/` + `src/utils/liveAdvisor/` + `src/utils/exploitEngine/` + `src/hooks/` all green. 23 computeTrialCount tests pass at new location (`src/utils/liveAdvisor/__tests__/`).
- [x] PMC integration point clear — `onHandComplete` callback prop added to hook options. Fires before `setAdvice` with `{ handNumber, street, heroCards, villainSeat, prediction, modelVersion }`. Try/catch wraps callback to keep advisor flow stable. PMC Phase 5b can wire `writePredictionAudit` in a small follow-up.

**Closeout notes:**
- New module at `src/utils/liveAdvisor/` with `computeHelpers.js` + `CLAUDE.md` (module rules) + moved test file.
- `computeTrialCount` re-exported from the hook for back-compat (external importers preserved).
- Three-piece split (`useAdvisorState` + `useAdvisorComputation`) deferred indefinitely; helpers-out cut achieves the load-bearing DoD (PMC integration point) with lower regression risk.

### Item 6 — Triage ready-to-start queue (1 session) (was Item 5) — DONE 2026-05-14 (SPR-079)
**Why:** 34 items in `ready-to-start` category — largest queue category, no program home. Triage surfaces hidden architectural themes.

**Definition of done:**
- [x] Each item assigned to a program OR deleted as stale OR merged with related — 13 backlog items walked; all 13 recategorized to real categories (`range-lab`, `sidebar-program`, `pre-session-drill`, `lsw-v2`, `design-comprehension`). Zero items merged or deleted (all proved LEGITIMATE-BACKLOG with real downstream work). The other 21 `category: "ready-to-start"` entries are already-done or already-claimed and stay frozen for historical accuracy.
- [x] 2-3 items promoted to active queue if appropriate — 2 promoted: WS-063 (PSD Gate 2 Blind-Spot Roundtable, P=8 P3 → P=15 P2; corpus prereq met via WS-061 / SPR-071) and WS-066 (LSW soft-flag tightening, P=8 P3 → P=15 P2; documentation-only fix). Conservative promotion — no high-leverage items hiding in the 13.

**Closeout notes:**
- Sweep report at `.claude/workstream/sweeps/SPR-079-ready-to-start-triage-report.md` with per-item rationale.
- 8 items reassigned program engineering → design (PSD Gates 2/3/4 + DCOMP W3/W4/W5/H2) — Gate work and persona/JTBD audits are design-program responsibilities, not engineering.
- 3 stale `blocked_by_legacy: ["US-1"]` pointers cleared on WS-063/064/065 (the corpus-scaling prereq shipped 2026-05-11 via SPR-071).
- Zero src/ diff. Files touched: 13 WS YAMLs + 13 queue-index summary rows + 1 sweep report.
- ~20 min actual against the "~1 session" estimate — fastest Refactor Sprint item.

### Item 7 — Persistence + cache audit (~3-5 sessions) [ADDED 2026-05-12] — DONE 2026-05-14 (SPR-080 Item 2 / WS-188)
**Why:** Owner asked 2026-05-11 for a "deep persistence + cache audit; no load-bearing decision architecture around that." Item 3 (DONE) shipped migration registry + CI gate + per-store ownership, covering ~30% of the original ask. The remaining 70% — failure-mode catalog, cache staleness contracts, ADR consolidation, cache sweep — is absorbed into this sprint as Item 7 per owner ratification 2026-05-12. Decision-system extraction (Item 4) will surface a canonical caching shape that Phase 2 needs; sequencing keeps Phase 1+3 parallel-safe with Item 4 and Phase 2+4 after.

**Tracked under:** WS-188 + project charter at `.claude/projects/persistence-cache-audit.md`.

**Definition of done:**
- [x] Phase 1 — `docs/persistence/FAILURE_MODES.md` with 12 modes catalogued (8 verified from spec + 4 additional findings). Each: severity, status, source pointer, mitigation. Owner ratified Phase-1-cap-at-12 over exhaustive enumeration.
- [x] Phase 2 — `docs/persistence/CACHE_CONTRACTS.md` covering 18 cache surfaces with staleness contract per entry. Hybrid format: inventory table + prose for 5 load-bearing surfaces (TendencyContext, OnlineAnalysisContext, AnchorLibraryContext, gameTree caches, useSeatTendency). Debounce convention + hydration pattern + multi-tab contract documented.
- [x] Phase 3 — 4 ADRs in `.claude/decisions/2026-05-14-*` (schema-versioning-policy / multi-store-migration / append-only-stores / blob-storage-strategy). Settings-defaults ADR omitted per owner-ratified Q3=spec-list.
- [x] Phase 4 — `docs/persistence/CACHE_SWEEP_2026-05-14.md` listing residual surfaces. Owner ratified residual-only over exhaustive (368-hit base rate); 5-7 candidates identified for follow-up WS authoring.
- [x] `system/invariants.md` INV-PERSIST-* family added — 5 invariants (registry completeness / additive-only / append-only writer discipline / hydration-then-debounce / single-writer-per-tab).
- [x] SYSTEM_MODEL.md §11 cross-links to all 4 phase outputs + 6 new TD entries (TD-19..24) for surfaced follow-ups.

**Closeout notes:**
- Zero behavior-changing src/ diff. Documentation-only audit per WS-188 scope discipline ("no new IDB schema, no new caching layer, no new modules").
- 6 follow-up TD entries surfaced (TD-19 cursor-error abort, TD-20 blob-quota pre-check, TD-21 append-only runtime guard, TD-22 mode-switch invalidation, TD-23 hand-arrived event-driven polling, TD-24 gameTree cache factory).
- Phase 4 residual WS item filing (5-7 expected at P=8 P3) deferred to next session if scope tight; tracked here for handoff.

## Sequencing

1. **Item 1** — DONE 2026-05-10. Foundational, all others reference it.
2. **Item 2** (state.md reshape) — DONE 2026-05-10. Paired with Item 1 as canonical-state-file restoration.
3. **Item 3** (persistence registry) — DONE 2026-05-11. Independent, unblocks PMC. ~1 session (was estimated ~2).
4. **Item 4** (decision-system extraction) — **NEXT**. After Items 1+3 (both done), this is the largest unlock and the headline finding of the architectural survey. ~3-4 sessions.
5. **Item 6** (queue triage) — can run in parallel with Item 4 (cheap, isolated). ~1 session.
6. **Item 7** (persistence + cache audit, Phases 1+3) — parallel-safe with Item 4. Phase 1 (failure modes) ~1 session, Phase 3 (ADRs) ~1 session.
7. **Item 7** (persistence + cache audit, Phases 2+4) — after Item 4 ships the canonical caching shape. Phase 2 (cache contracts) ~1-2 sessions, Phase 4 (sweep) ~0.5 session.
8. **Item 5** (useLiveActionAdvisor split) — last, surgical, can be done anytime PMC Phase 5b approaches. ~1-2 sessions.

**Total: ~9-13 sessions remaining** (Items 1+2+3 done; ~6-10 sessions left across Items 4+5+6+7).

## Out of scope (deferred candidates)

- **Sidebar `shared/render-*.js` consolidation** — let SHC Gate 5 land first, then sweep
- **Tournament + TournamentBridge merge** — bridge is the extension/app sync seam, still in flux
- **PIO multi-attribute ranking framework** — weights still being tuned
- **AppProviders fan-out (P4 from survey)** — modest unlock, dose-effect; skip unless re-evaluated post-sprint

## Resume protocol

This is a multi-session program. At each session start:
1. Read this file
2. Check task list for current item state
3. Resume the in-progress item OR start the next item per Sequencing
4. `/session-end` writes the session note; this file gets updated only when item-level state changes

## Success criteria for the sprint as a whole

- [ ] All 7 items complete (Item 7 added 2026-05-12)
- [ ] At least one ADR recorded for Item 4 (decision-system pattern ratification)
- [ ] At least 4 ADRs recorded for Item 7 (persistence audit Phase 3)
- [ ] No regression in test suite (~5,400+ app + 2,249 extension)
- [ ] `system/state.md` reshaped (Item 2) AND updated with new architecture metrics
- [ ] One memory note recorded if any new doctrine emerges from the work (e.g., state-file shape discipline if Item 2 surfaces a generalizable rule; cache-contract patterns if Item 7 surfaces one)

## Charter ratifications (binding)

1. **Full architectural reset over staged sprints** (2026-05-10) — owner chose all items in one program. Bias toward depth over speed.
2. **Long-term-aggressive over transition-cost** (per `feedback_long_term_over_transition.md`) — refactors prioritize end-state shape over migration ergonomics. Owner is sole user.
3. **Decision-system pattern is the headline** — Item 4 is the largest unlock; Items 1+2+3 exist to enable it.
4. **No new features during this sprint** — explicit pause on feature work until at least Items 1+2+3+4 are complete. Item 6 (queue triage) may surface real bugs that warrant exception.
5. **Canonical state files must stay readable** (added 2026-05-10 mid-session, owner-prompted) — when a protocol-required file falls out of usable shape (missing, unreadable, ballooned), fixing it is in-scope for any architectural sprint. Item 2 added on this principle. Future regressions in `system/state.md` shape revert to this.
