---
last-verified-against-code: 2026-04-06
verified-by: governance-overhaul
staleness-threshold-days: 30
---

# System Model — Poker Tracker
**Version**: 1.9.3 | **Updated**: 2026-04-21 | **Owner**: Line Study Bucket-Teaching Roundtable (RT-106..118 findings)

Single source of truth for system understanding, invariants, risks, and cross-cutting concerns.
Read this before any multi-file change. Update after any architectural shift.

---

## 1. System Architecture

### 1.1 Components & Responsibilities

| Component | Responsibility | Boundary |
|-----------|---------------|----------|
| `PokerTracker.jsx` | State orchestration, context providers, view routing | Owns all reducer dispatches; views receive only `scale` prop |
| 8 Reducers (`game`, `ui`, `card`, `session`, `player`, `settings`, `auth`, `tournament`) | State transitions | Pure functions, no side effects, no async |
| 13 Context Providers | Cross-component state distribution | Each wraps one reducer + optional persistence hook |
| 34 Hooks | Business logic, side effects, computed values | May read multiple contexts; never dispatch to foreign reducers |
| 14 Views + Showdown | UI rendering | Receive `scale` only; pull state from contexts |
| 40 UI Components | Reusable visual elements | Stateless or locally stateful; no context access |
| `pokerCore/` (5 modules) | Shared poker primitives (cards, ranges, hand eval, board texture, exact preflop equity) | Imported by both engines; imports from neither |
| `rangeEngine/` (9 modules) | Bayesian range estimation | Reads player stats; writes range profiles to IndexedDB |
| `exploitEngine/` (41 modules) | Exploit generation, weakness detection, game tree EV, villain modeling | Reads ranges + stats; produces recommendations |
| `handAnalysis/` (7 modules) | Post-hand review, replay, hero analysis | Reads completed hand data; produces analysis objects |
| `tournamentEngine/` (4 modules) | Blind levels, blind-out calc, dropout prediction | Reads tournament config; produces scheduling/projection data |
| `drillContent/` (4 modules) | Preflop-drill frameworks, matchup library, scheduler, combo counting | Pure data + predicates powering the Preflop Drills view |
| `postflopDrillContent/` (11 modules) | Postflop-drill frameworks, scenario library, hand-type breakdown, line walkthrough DAG | Pure data + predicates powering Postflop Drills view. **MAY import from exploitEngine/ + pokerCore/** (INV-08.a exception, 2026-04-21 RT-109). Future live-engine consumption must route via `drillModeEngine` wrapper (RT-111). |
| `persistence/` (12 modules) | IndexedDB v15, 9 stores, migrations | Sole interface to IndexedDB; all access through exported functions |
| Ignition Extension | Chrome MV3, WebSocket capture, side panel HUD | Separate codebase (`ignition-poker-tracker/`), communicates via message passing |

### 1.2 Dependency Graph (Layers)

```
Views → Hooks → Contexts → Reducers
                    ↓
              Persistence (IndexedDB)
                    ↑
Hooks → exploitEngine → rangeEngine → pokerCore
        exploitEngine → handAnalysis
        tournamentEngine (standalone)
```

**Hard rule**: No upward dependency. `pokerCore` never imports from `rangeEngine`. `rangeEngine` never imports from `exploitEngine`. Views never call stateful engine APIs or write to persistence directly. Read-only imports of pure functions and constants from utils are acceptable; hooks mediate all stateful access.

**Resolved (RT-35, R5)**: `monteCarloEquity.js` moved to `pokerCore/` (pure MC equity math). 4 remaining exploitEngine symbols injected via `deps` parameter in `replayAnalysis.analyzeTimelineAction()`. `handAnalysis/` now imports zero symbols from `exploitEngine/`.

### 1.3 Extension ↔ App Boundary

| Direction | Mechanism | Data |
|-----------|-----------|------|
| Extension → App | `chrome.runtime.sendMessage` | Captured hand history, table state |
| App → Extension | IndexedDB shared reads (same origin) | Player profiles, range profiles |
| Extension internal | `SyncBridgeContext` + `OnlineSessionContext` | Real-time table sync |

**Resolved (RT-11, 2026-04-04):** `chrome.storage.session` downgraded from `TRUSTED_AND_UNTRUSTED_CONTEXTS` to trusted-only. App-bridge refactored to receive data via port pushes from service worker. Casino page scripts can no longer read session storage.

---

## 2. Data Flow

### 2.1 Hand Recording Flow (Critical Path)

```
User taps action → useGameHandlers dispatch → gameReducer updates actionSequence
    → Street auto-advance (if all active seats acted)
    → Showdown entry (manual or auto)
    → usePersistence.saveHand() (1.5s debounce)
    → IndexedDB `hands` store
    → usePlayerTendencies recalculates (next render)
    → rangeEngine.bayesianUpdater runs on profile
    → exploitEngine.generateExploits produces new recommendations
```

### 2.2 Analysis Pipeline (3-Layer)

```
Layer 1: Session Stats (useSessionStats)
  Input: actionSequence[] across hands
  Output: VPIP, PFR, AF, C-Bet per player per position

Layer 2: Player Tendencies (usePlayerTendencies + analysisPipeline.js)
  Input: cross-session aggregated stats + decision accumulator
  Output: style classification, weakness detection, decision summaries

Layer 3: Exploit Generation (exploitEngine pipeline)
  Input: tendencies + range profiles + game state
  Output: ranked exploit suggestions with EV estimates + confidence
```

### 2.3 Game Tree Evaluation Flow

```
useLiveActionAdvisor → gameTreeEvaluator.evaluateGameTree()
  → villainDecisionModel.buildVillainModel() (style-conditioned priors)
  → gameTreeDepth2.evaluateDepth2() (bet/check/raise branches)
  → foldEquityCalculator (blocker-aware, fold curve fit)
  → preflopFlopEV (stratified flop sampling, archetype-weighted)
  → Produces: { bestAction, ev, reasoning, flopBreakdown, confidence }
```

### 2.4 Range Profile Lifecycle

```
New player observed → populationPriors.js creates default profile
  → Each hand: bayesianUpdater.js updates (prior × likelihood)
  → Showdown: anchor confirmed hands (weight=1.0, semantic boost)
  → Profile cached in IndexedDB `rangeProfiles` store
  → Queried by exploitEngine for villain range in EV calcs
```

---

## 3. State Model

### 3.1 State Classification

| Type | Location | Lifecycle | Examples |
|------|----------|-----------|---------|
| **Ephemeral** | Reducers (game, ui, card) | Current hand only | `actionSequence`, `communityCards`, `currentStreet` |
| **Session** | sessionReducer + activeSession store | One poker session | `currentSession`, `handCount`, `buyIn` |
| **Persistent** | IndexedDB stores | Permanent | `allPlayers`, `allSessions`, all hands, range profiles |
| **Derived** | Hooks (memoized) | Recomputed on dependency change | Session stats, tendencies, exploit suggestions, game tree EV |
| **Configuration** | settingsReducer + settings store | User-scoped permanent | Theme, venues, game types |

### 3.2 State Ownership

| State | Owner | Readers | Mutators |
|-------|-------|---------|----------|
| Game state | `gameReducer` | All views, hooks | `useGameHandlers` only |
| UI state | `uiReducer` | Views, navigation hooks | Any view via `useUI().dispatch` |
| Card state | `cardReducer` | TableView, ShowdownView, hooks | `useCardSelection`, `useShowdownCardSelection` |
| Player data | `playerReducer` + IndexedDB | Stats views, exploit engine | `usePlayerPersistence` |
| Session data | `sessionReducer` + IndexedDB | History, stats | `useSessionPersistence` |
| Range profiles | IndexedDB only | `rangeEngine`, `exploitEngine` | `bayesianUpdater` via `saveRangeProfile()` |

### 3.3 Consistency Guarantees

- **actionSequence is the sole source of truth** for all actions in a hand. No `seatActions`, no `showdownActions` — query via `sequenceUtils.js` helpers.
- **Reducer state leads, IndexedDB follows**. If they diverge, reducer wins (IndexedDB is persistence, not authority during a session).
- **Range profiles are eventually consistent**. Updated after each hand save, not during hand recording.
- **Player tendencies are derived state**. Never persisted directly — always recomputed from stored hands + showdowns.

---

## 4. System Invariants

**Full catalog with verification dates and test coverage: see `.claude/context/INVARIANTS.md`**

13 MUST-be-true invariants (INV-01 through INV-13) and 11 MUST-never-happen anti-invariants (NEV-01 through NEV-11). Key examples: actionSequence ordering (INV-01), style-labels-as-outputs (INV-07), no circular imports (INV-08), stableSoftmax for all Math.exp (INV-13), no position-label inputs (NEV-03), no innerHTML without escapeHtml (NEV-11).

### 4.1 Sidebar-Specific Invariants (SRT-2 2026-04-15, STP-1 2026-04-16)

| ID | Rule | Description | Enforcement |
|----|------|-------------|-------------|
| I-INV-PRE | R-7.2 | Pre-dispatch invariant gate: `StateInvariantChecker.check(snap)` runs before `_renderFn`. On violation: render skipped, last-known-good frame persists, `lastViolationAt` stamped, "!" badge surfaces. | `render-coordinator.js:_executeRender`, `render-coordinator.test.js` RT-70 tests |
| I-FSM-EXCL | R-5.6 | FSM-output exclusivity: when a FSM is registered for a slot, the slot's renderer reads `snap.panels.<fsmId>` as visibility authority. Raw coordinator state (e.g. `modeAExpired`) must NOT be read for slot-ownership. Content classifiers supplement, not replace. | `zx-overrides.test.js` RT-72 source pins, `SIDEBAR_DESIGN_PRINCIPLES.md` R-5.6 |
| I-OBS-HONEST | R-7.3 | Observability honesty: every user-surfaced string that references coordinator state must equal the state value it claims to report. Labels and numbers may not drift apart from their source (pre-STP-1 the RT-66 badge read `lastViolationCount` but the tooltip promised "in the last 30s" — the counter was lifetime). | `side-panel/__tests__/rendered-text-contract.test.js` |
| I-OBS-COMPLETE | R-7.4 | Observability completeness: every "see X for details" affordance must have a completeness test asserting X actually contains the referenced details. Applies to `runDiagnostics` (RT-66 badge points at "copy diagnostics for details"), future copy/export paths, and any "open the log" surface. | `side-panel/__tests__/diagnostics-dump.test.js` |
| I-STATE-SYM | R-8.1 | State-clear symmetry: every `this._state.X = Y` write outside the `RenderCoordinator` constructor must have a matching clear in the lifecycle path that owns its declared scope (table-switch / hand-new / stale-timeout). Scope declared in `side-panel/STATE_FIELD_SCOPES.md`. | `side-panel/__tests__/state-clear-symmetry.test.js` |
| I-INV-PAYLOAD | R-10.1 | Payload-level invariants: every incoming wire message has a schema validator that checks topology, not just field types. For `push_live_context`: `activeSeatNumbers ∩ foldedSeats = ∅`, `heroSeat ∈ active ∪ folded`, all seats integer in `[1..9]`. R11 (seat-disjoint) and R12 (hero-in-set) are the coordinator-level equivalents for defense in depth. | `shared/__tests__/wire-schemas.test.js`, `state-invariants.test.js` R11/R12, `side-panel/__tests__/payload-fuzz.test.js` |

### 4.2 Sidebar Failure Modes

**SW Reanimation Replay.** MV3 service workers are evicted after ~30 s of inactivity. On reanimation, `pushFullStateToSidePanel` replays cached data. If cached `actionAdvice` is replayed without a companion `push_live_context`, the side panel's `_pendingAdvice` buffer may promote stale cross-hand advice when the next live context push coincidentally matches the same street. This is not a transport bug — it is a render-input event at the MV3 lifecycle layer. See `.claude/failures/SW_REANIMATION_REPLAY.md`.

**State-Clear Asymmetry.** `RenderCoordinator._state` fields have scopes (session / perTable / perHand / derived / monotonic); each scope has an owning lifecycle reset path (`clearForTableSwitch`, hand-new block in `handleLiveContext`, stale-timeout). New fields added to `_state` without a matching clear silently survive the lifecycle boundary and may arm invariant violations on subsequent renders — observed in production as 213 R5 violations in ~500 s, traced to `advicePendingForStreet` not being nulled in `clearForTableSwitch`. Audit surfaced 10 additional asymmetries of the same class. Structural fix via `STATE_FIELD_SCOPES.md` registry, `state-clear-symmetry.test.js`, and doctrine R-8.1 gates the class of bug. See `.claude/failures/STATE_CLEAR_ASYMMETRY.md`.

---

## 5. Failure Surfaces

### 5.1 High-Risk Areas

| Area | Risk | Likelihood | Impact | Mitigation |
|------|------|-----------|--------|------------|
| IndexedDB migrations (`database.js`, `migrations.js`) | Schema change drops/corrupts data | Medium | **Critical** — permanent data loss | Versioned migrations, backup before destructive ops |
| `bayesianUpdater.js` | Numerical instability (underflow/overflow in log-likelihood) | Low | High — corrupted range profiles | Clamping, normalization after each update |
| `gameTreeEvaluator.js` | Combinatorial explosion in depth-2/3 branches | Medium | Medium — UI freeze or timeout | Time budget (`timeBudgetMs`), depth bailout, combo limit |
| `gameTreeEvaluator.js` | Softmax overflow in mixed strategy (Math.exp on small temperature) | Low | Medium — NaN mixFrequency, corrupted recommendations | Resolved RT-12: `stableSoftmax()` in `mathUtils.js` |
| `popup.js` | innerHTML without escaping (connId, state fields) | Low | Medium — XSS in extension context | Resolved RT-15: all values wrapped in `escapeHtml()` |
| `useShowdownCardSelection.js` | Auto-advance logic with multiple players + partial card entry | High | Medium — wrong card assignments | Extensive edge case tests |
| `useSessionPersistence.js` | Hydration race condition (load before DB init) | Low | High — lost session data | `isInitialized` guard, retry logic |
| `foldEquityCalculator.js` | 8 multiplicative adjustments compounding to extreme values | Medium | Medium — absurd fold% predictions | Intermediate sanity clamp [0.10, 0.85] (INV 26.2) |
| Extension WebSocket capture | Ignition protocol changes without notice | High | High — extension stops working | Message validation, graceful degradation |
| `usePlayerTendencies` | Full all-player recompute on any playerReducer dispatch; identity instability causes cascading re-renders | High | High — UI freeze at 50+ players, stale exploits during recompute | Per-player memoization (RT-28) |
| `service-worker.js` onMessage/onConnect | sender.id validation resolved (RT-21, 2026-04-07) | — | — | Resolved |
| `useEquityWorker.js` | Dual Worker instantiation (TableView + OnlineAnalysisContext each spawn one) | High | Medium — wasted mobile resources, no shared crash recovery | RT-27: singleton EquityWorkerContext |
| `useEquityWorker.js` | `isWorkerReady` always returns false (ref read at render time, not reactive) | High | Low — functional impact nil since computeEquity works via ref | RT-29: reactive state |
| `useLiveActionAdvisor.js` | `computeAllVillainRanges` called twice per cycle (lines 354, 436) — doubled range lookups | High | Low — ~5-10ms waste per compute cycle | RT-30: cache first call |
| `preflopAdvisor.js` | Preflop MC path bypasses Worker — `handVsRange` called directly, not through `equityFn` | High | Medium — most frequent computation stays on main thread | RT-31: thread equityFn |
| `gameTreeEquity.js` adjustedRealization | Double-discount when opponentModels present + uncapped multiway (`0.85^7 = 0.32`) | Medium | Medium — systematic "check" bias in multiway pots | RT-38: remove blanket 0.85 when models present, add floor 0.30 |
| `handsStorage.js` saveHand | TOCTOU race: separate read/write transactions allow duplicate `sessionHandNumber` | Low | Low — duplicate display IDs in search/replay | RT-39: atomic single transaction |
| `side-panel.js` render coordination | 4+ independent render entry points bypass debounce, produce partial-state display (recurring) | High | High — user sees inconsistent advice/exploits/tournament data | RT-43: unified render scheduler |
| `side-panel.js` STREET_RANK guard | `STREET_RANK[undefined] ?? -1` accepts stale advice when liveContext is null | Medium | High — stale advice displayed as current after SW restart | RT-45: reject advice when liveContext null |
| `side-panel.js` renderPidSummary | Unescaped PID strings in innerHTML (XSS in extension context) | Low | Medium — arbitrary HTML/JS in side panel | RT-46: escapeHtml wrapper |
| `side-panel.js` handlePipelineStatus | Async handler yields to event loop; sync handlers mutate shared state during yield | Medium | Medium — inconsistent state at render time | RT-47: snapshot or re-read pattern |
| `side-panel.js` dual state ownership | Module vars (lines 48-78) and `RenderCoordinator._state` diverge between sync calls; any async yield or forgotten sync creates stale render | High | **High** — wrong advice/exploits displayed; root cause of recurring display-thrashing | RT-43 expanded: single-owner state store |
| `render-coordinator.js` advice guard | No hand-number binding; SW restart sends cached advice from previous hand that passes street-rank check (`0 <= 3` = true) | Medium | **High** — confidently wrong advice from prior hand | RT-45 expanded: hand-number binding |
| `side-panel.js` tournament timer | `setInterval` captures DOM reference; `renderAll` replaces element via `innerHTML`; timer writes to detached node; countdown freezes | High | Medium — frozen tournament countdown | RT-52: stable DOM reference |
| `side-panel.js` `_contextStale` | Two-phase stale detection computed in state but no render function reads it; visual no-op | Certain | Medium — users never see stale warning | RT-53: render the indicator |
| `side-panel.js` `_receivedAt` | `push_pipeline_status` sets `currentLiveContext` without `_receivedAt`; stale timeout math produces `NaN`; context never times out | Medium | Medium — infinite stale context | RT-56: set `_receivedAt` on all liveContext write paths |
| ~~`side-panel.js` renderRawTournamentInfo~~ | ~~Unescaped innerHTML for level/blinds~~ | — | — | **Resolved RT-57 (2026-04-12)**: Number() coerce + escapeHtml on every interpolation |
| `side-panel.js` dead render functions | `renderBriefingPanel` (:1671), `renderObservationPanel` (:1822), `computeFocusedVillain` wrapper (:899), diagnostic-dump block (:2400-2421) reference bare `currentLiveContext`/`currentTableState`/`lastHandCount`/`exploitPushCount`/`advicePushCount` — all deleted by RT-43. Strict-mode ReferenceError if triggered (briefing-item click handler may reach them; diag copy button certainly does). | Medium | High — sidebar crash during user action | RT-58: delete dead fns, fix diag dump to read coordinator |
| `side-panel.js` handlePipelineStatus | Direct `coordinator.set('currentLiveContext', ...)` at :244 bypasses `handleLiveContext()` — skips position lock, `_receivedAt` injection, pending-advice promotion; two write paths have divergent semantics | Medium | High — invariant drift (position lock loss, stale guards) | RT-59: route all liveContext writes through handleLiveContext |
| `side-panel.js` `_planPanelAutoExpandTimer` | Module-level setTimeout at :983 mutates `coordinator.planPanelOpen` and writes DOM class outside scheduler; not cleared by `clearForTableSwitch`; re-introduces the RT-43 anti-pattern | High | Medium — stale-table mutation, render inconsistency | RT-60 (timer registration contract) + RT-61 (route through scheduler) |
| `state-invariants.js` Rule 10 | Checks `snap.pipelineEvents` but `pipelineEvents` explicitly excluded from `buildSnapshot` — invariant silently never fires regardless of ring-buffer state | Certain | Low — dead safety net | RT-66: include in snapshot or read coordinator directly |
| `render-coordinator.js` violation reporting | Violations logged to `pipelineEvents` only; pipelineEvents not in renderKey and not rendered in any UI; `throwOnViolation=false` in production; violations invisible to user | Certain | Medium — governance theatre | RT-66: surface via diagnostics badge |
| ~~`render-orchestrator.js` Zone 3 scary runouts~~ | ~~Rendered count not card names~~ | — | — | **Resolved RT-62 (2026-04-12)**: gameTreeDepth2.js now emits scaryCardRanks array; Zone 3 renders "Watch: A, K on turn" |
| ~~`render-orchestrator.js` Mode A coaching~~ | ~~Audit-claimed fold-correctness bug~~ | — | — | **Resolved RT-63 (2026-04-12)**: verified not-a-bug; fold EV implicit at 0, ev>0 equivalent to ev>fold.ev; test coverage added |
| ~~`render-orchestrator.js` multiway pot odds~~ | ~~slice(-1) on actionSequence~~ | — | — | **Resolved RT-64 (2026-04-12)**: added findFacedBet() backward walk for the bet hero actually faces |
| ~~`background/service-worker.js` capture port~~ | ~~validateMessage gate missing~~ | — | — | **Resolved RT-65 (2026-04-12)**: gate applied; 5 new validators added to message-schemas.js |

### 5.1c Additional Failure Modes (Line Study Bucket-Teaching Roundtable 2026-04-21)

**FM-Bucket-False-Precision.** Bucket aggregator (e.g., `handTypeBreakdown.js:96-103` pattern) computes per-bucket mean equity/EV with no minimum-N gate. On monotone or paired boards after range narrowing, a bucket may contain 1-2 combos. Output renders "betEV: 2.41 bb" with full numeric precision. Feature would teach confidence in statistical noise. Detector: RT-115 — `sampleSize` field + `lowConfidence` flag attached to aggregator output; UI renders caveat badge when `lowConfidence`.

**FM-Archetype-Correctness-Contradiction.** Current `Decision.branches[].correct: boolean` (`lineSchema.js:134`) collapses across archetypes. If archetype becomes a UI toggle (fish/reg/pro) without schema change, the authored-correct branch stays green even when wrong for the current archetype — the displayed engine output contradicts the displayed "correct" badge. Erodes trust in all authored line content. Detector: RT-107 — `correctByArchetype?: { [id]: boolean }` with validator enforcing ≥1 correct branch per declared archetype.

**FM-Engine-Drift-Silent-Invalidation.** Engine constants (`FOLD_CURVE_PARAMS`, `STYLE_STEEPNESS_MULT`, `POP_CALLING_RATES` in `gameTreeConstants.js` / `villainModelData.js`) have been revised across Items 25, 26, 27 (~30 accuracy changes). Any authored EV number or EV-relative claim in `lines.js` silently invalidates on engine update — existing tests assert schema/structure, zero EV correctness assertions. Authored content ages into being wrong with no CI signal. Detector: RT-108 — fixed-seed snapshot of `evaluateGameTree` over each authored line's boards; any output drift fails CI.

**FM-Drill-Layer-Synthetic-Input-Epistemics.** `gameTreeEvaluator` is calibrated against observed real-hand data via `villainModel`, style priors, fold-curve fitting. In drill-mode context there are no observed hands — synthetic archetype stubs fall back to `POPULATION_PRIORS` + style steepness modifier. Output is numerically precise but epistemically ungrounded; "fish donk on JT6" is mathematically near-identical to "population donk on JT6" with a small style modifier. Treating drill-mode EV numbers as ground-truth misleads learners about what the numbers mean. Detector: RT-111 — `drillModeEngine` wrapper returns `caveats[]` including `'synthetic-range'` when no observed data underlies the computation.

### 5.1b Additional Failure Modes (Drills Consolidation Roundtable 2026-04-20)

**FM-Implicit-Height-Contract.** Mode components under `src/components/views/(Preflop|Postflop)DrillsView/` use `h-full overflow-hidden` on their outermost `div`, relying on their parent container's `flex-1` + `1600×720` chrome to resolve. Deleting or restructuring the parent silently breaks layout; no import graph catches it. Repro: remove outer `h-full overflow-hidden` wrapper; `ShapeMode` `LaneRow` scroll vanishes. Relevant for any view restructuring proposal, including drills-consolidation Phase 7.

**FM-Hoisted-Persistence-Hook-Race.** Mounting multiple persistence-hook-owning children under a single parent without hoisting the hook to the parent produces read-order-dependent state desync. Canonical example: a drill picker that mounts Recipe + Framework + Line modes simultaneously to display streak stats — each calls `usePostflopDrillsPersistence()` independently, each fires its own IDB load, each holds its own `drills` array copy, and `recordAttempt` in one instance doesn't propagate to siblings. Scheduler accuracy silently drifts.

### 5.2 Complexity Hotspots (Cyclomatic)

| File | Reason | Refactor Priority |
|------|--------|------------------|
| `gameTreeDepth2.js` | Nested bet/check/raise/call branches, time budgeting | Low (working, well-tested) |
| `villainDecisionModel.js` | 5-layer priority hierarchy, style conditioning | Low (recently overhauled) |
| `comboActionProbabilities` | 6→2 renormalization layers, blocker effects | Medium (fragile to new layers) |
| `generateExploits.js` | Orchestrates all rule modules, trait application, supersedes dedup | Medium |
| `preflopAdvisor.js` | Multiple EV paths (call/raise/limp), flop rollout integration | Low |

---

## 6. Hidden Coupling

### 6.1 Implicit Dependencies

| Dependency | From | To | Why Hidden |
|-----------|------|-----|-----------|
| Action constant values | `gameConstants.js` ACTIONS | `actionUtils.js`, `designTokens.js`, all rule modules | String matching; adding an action requires updates in 3+ files |
| Seat numbering convention | `SEAT_ARRAY` [1-9] | Every component that iterates seats | Off-by-one if anyone uses 0-indexed |
| `actionSequence` shape | `sequenceUtils.js` | `gameReducer`, `usePersistence`, `handAnalysis/*` | Schema change breaks persistence + analysis |
| Range profile `profileKey` format | `rangeProfilesStorage.js` | `bayesianUpdater.js`, `rangeEngine/index.js` | Key format (`{playerId}_{position}`) is implicitly shared |
| Board texture classification | `pokerCore/boardTexture.js` | `exploitEngine/boardTextureRules.js`, `rangeEngine/postflopNarrowing.js` | Both engines depend on same texture enum values |
| Villain model confidence threshold (0.3) | `villainDecisionModel.js` | `comboActionProbabilities`, `gameTreeEvaluator.js` | Magic number gates which data source is used |
| Toast context availability | `ToastContext` | Any hook calling `useToast()` | Silent failure if provider missing from tree |
| Scale factor | `useScale` hook | All views via `scale` prop | CSS calculations break if scale is NaN/0 |
| `validateTournament` shape contract | `wire-schemas.js` | `render-tiers.js`, `side-panel.js` | Accepts any object; rendering code assumes specific fields exist; malformed object causes silent display corruption |
| Worker instance count | `useEquityWorker` (hook, not context) | Every call site | Each `useEquityWorker()` call creates a new Worker; no singleton enforcement. Adding a consumer silently adds another thread. |
| Analysis utility layer | `handAnalysis/replayAnalysis.js` | `exploitEngine/` (5 modules) | Violates documented dependency direction (INV-08); `handAnalysis` should not import from `exploitEngine` (RT-35) |
| Render entry point count | `side-panel.js` push handlers | `renderUI` debounce intent | Adding a new push handler that calls a render function directly silently creates a new bypass of the coordinated render path |
| STREET_RANK completeness | `handleAdvicePush` guard | Chrome MV3 SW lifecycle | SW restart nulls liveContext, making `STREET_RANK[undefined]=-1`, defeating the staleness guard; any new FSM state not in STREET_RANK bypasses the filter |
| Tournament timer DOM reference | `renderTournamentPanel` setInterval | `renderAll` innerHTML rewrite | Timer holds closure reference to DOM node that renderAll replaces; timer silently writes to detached node; countdown freezes |
| `_receivedAt` timestamp | Stale context timeout math | `push_pipeline_status` handler | Handler sets `currentLiveContext` directly without `_receivedAt`; timeout computes `Date.now() - undefined = NaN`; context never expires via this path |
| Advice hand identity | `handleAdvicePush` street-rank guard | SW cached advice lifecycle | Guard checks street rank only; SW caches and replays advice across hand boundaries with no hand identifier |
| `render-street-card.js` module state | `_prevStreet`, `_transitionTimer` | Table switch handlers | Module-level mutable state persists across table switches; same-table reconnect inherits stale transition state |
| ~~`STREET_RANK` duplicate definition~~ | — | — | **Resolved RT-67 (2026-04-12)**: single export from shared/constants.js |
| `currentLiveContext` write paths | `handleLiveContext()` (canonical) | `handlePipelineStatus` direct `.set()` | Divergent semantics — position lock, `_receivedAt`, pending-advice promotion only run on canonical path (RT-59) |
| Module-level timer ownership | `_planPanelAutoExpandTimer`, `tourneyTimerInterval`, staleContext interval, `_transitionTimer` | `clearForTableSwitch` / `destroy` | Timers owned by IIFE, not coordinator — unreachable from lifecycle hooks; orphan-fire after table switch (RT-60) |
| Dead-function closures over deleted vars | `renderBriefingPanel`, `renderObservationPanel`, `computeFocusedVillain` wrapper | Deleted module vars (`currentLiveContext`, `currentTableState`, `lastHandCount` etc.) | Strict-mode ReferenceError if any click path reaches them (RT-58) |
| C-14: `postflopDrillContent/` consumes `exploitEngine/` | `handTypeBreakdown.js:32` (`classifyComboFull` from `postflopNarrower`), `rangeVsBoard.js:17` (`computeAdvantage` from `rangeSegmenter`) | Live-advisor modules calibrated on observed hands | Synthetic archetype inputs produce numerically precise but epistemically ungrounded output. Drill consumers must route via `drillModeEngine` wrapper post-RT-111 (carries `caveats[]`, `sampleSize`, `bailedOut`). Direct imports of `gameTreeEvaluator` from `drillContent/` forbidden after RT-111 lands. (RT-109 — permitted exception under INV-08.a) |

### 6.2 Cross-Module Interactions

| Interaction | Modules | Risk |
|-------------|---------|------|
| Showdown anchors affect range profiles which affect exploit EV | `cardReducer` → `rangeEngine` → `exploitEngine` | A wrong showdown card propagates through entire analysis |
| Session end triggers tendency recalc which triggers exploit regen | `sessionReducer` → `usePlayerTendencies` → `generateExploits` | Stale tendency data if recalc is slow |
| Tournament blind level affects SPR which affects game tree sizing | `tournamentReducer` → `potCalculator` → `gameTreeEvaluator` | Wrong SPR zone = wrong strategic advice |
| Rake config varies by game type, threads through entire EV pipeline | `GAME_TYPES` → `potCalculator` → `foldEquityCalc` → `gameTree` → `preflopAdvisor` | Missing rake = systematically optimistic EV |

---

## 7. Scaling & Performance

### 7.1 Current Assumptions

| Dimension | Current | 10× | 100× | Bottleneck |
|-----------|---------|-----|------|-----------|
| Hands per session | ~50 | 500 | 5,000 | IndexedDB writes (debounced) |
| Total stored hands | ~2,000 | 20,000 | 200,000 | `getAllHands()` full scan; needs cursor pagination |
| Players tracked | ~50 | 500 | 5,000 | `usePlayerTendencies` iterates all; needs lazy loading |
| Range profile size | ~200 KB per player | 2 MB total | 20 MB total | IndexedDB storage OK; memory if all loaded |
| Game tree eval time | ~50ms (depth-2) | N/A (per-hand) | N/A | Time budget caps at configurable ms |
| Concurrent sessions | 1 | 1 | 1 | Architecture assumes single active session |

### 7.2 Known Bottlenecks

- **`getAllHands(userId)` full table scan**: No pagination. At 100K+ hands, initial load will be slow. Mitigation: index on `userId_timestamp`, use cursor with limit.
- **`usePlayerTendencies` recomputes all players**: No incremental update. At 500+ players, this blocks UI. Mitigation: memoize per-player, invalidate only on new hand for that player.
- **Monte Carlo equity calculations**: `enrichWithEquity` runs 300 MC simulations per call. Skipped when `comboDistribution` available (Item 26.4). But falls back to MC for unknown distributions.
- **Extension message passing**: Chrome's `runtime.sendMessage` is async but single-threaded. Burst hand imports from Ignition may queue.
- **Zero React.memo across component tree**: Every gameReducer dispatch re-renders all mounted components including all 9 SeatComponents. On target device (Helio G80), adds measurable jank during rapid action recording. Mitigation: RT-36.

---

## 8. Security Boundaries

### 8.1 Trust Zones

| Zone | Trust Level | Boundary |
|------|------------|----------|
| Local app (same-origin) | Fully trusted | All state, all IndexedDB |
| Firebase Auth | Trusted for identity | `uid` scopes all data; no server-side validation of hand data |
| Ignition Extension | Semi-trusted | Message validation required; sender.id validation active (RT-21, resolved 2026-04-07) |
| User input (card selection, notes, player names) | Untrusted | Rendered in React (XSS-safe by default); stored as-is in IndexedDB |

### 8.2 Data Exposure Risks

| Risk | Severity | Status |
|------|----------|--------|
| IndexedDB readable by any same-origin script | Medium | Mitigated by Chrome extension isolation |
| Player notes stored unencrypted | Low | Acceptable for local app; risk if cloud sync added |
| Firebase credentials in environment | Medium | `.env` excluded from git; risk if accidentally committed |
| No rate limiting on analysis computations | Low | Local-only; no server cost. Risk if exposed as API |

### 8.3 Input Validation

- **Card input**: Validated by `cardParser.js` (rank + suit enum). Invalid cards rejected at entry.
- **Action input**: Constrained to `ACTIONS.*` constants. Free-form actions impossible.
- **Player names**: Free-text, sanitized by React rendering. No SQL/NoSQL injection surface (IndexedDB is key-value).
- **Session data**: Schema validated by `persistence/validation.js` before write.

---

## 9. Constraints & Assumptions

### 9.1 Hard Constraints (Cannot Change)

| ID | Constraint | Source | Impact |
|----|-----------|--------|--------|
| HC-01 | Single active session assumption | Architecture design | No multi-user, no concurrent editing sessions |
| HC-02 | IndexedDB only (no server) | Local-first design | No cloud sync without Firebase; all data on-device |
| HC-03 | Chrome MV3 for extension | Browser requirement | No MV2 APIs, service worker lifecycle constraints |
| HC-04 | Mobile-first 1600x720 | Target device (Samsung Galaxy A22 landscape) | All UI must fit this viewport; scale factor applied |
| HC-05 | React + Vite + Tailwind stack | Established architecture | No server-side rendering, no SSR, client-only |
| HC-06 | 9-handed game format | Poker game rules | CONSTANTS.NUM_SEATS = 9, SEAT_ARRAY = [1..9] |

### 9.2 Soft Constraints (Could Change with Effort)

| ID | Constraint | Effort to Change | Trigger to Revisit |
|----|-----------|-----------------|-------------------|
| SC-01 | 9-seat max | Medium (CONSTANTS.NUM_SEATS propagates widely) | If 6-max or heads-up tables needed |
| SC-02 | Ignition-only extension | Large (protocol-specific WebSocket parsing) | If supporting PokerStars, GGPoker, etc. |
| SC-03 | English-only UI | Medium (no i18n framework) | If non-English markets are a priority |
| SC-04 | No server/API backend | Large (requires auth, hosting, data migration) | If multi-device sync or social features needed |
| SC-05 | Bayesian-only analysis | Medium (analysis pipeline assumes Beta-Binomial) | If ML-based player modeling is explored |

### 9.3 Assumptions (Believed True, Not Proven)

| ID | Assumption | Risk if Wrong | How to Validate |
|----|-----------|---------------|----------------|
| A-01 | Users have < 500 tracked opponents | Performance degrades — getAllHands/usePlayerTendencies do full scans | Check largest IndexedDB player count in production |
| A-02 | Game tree depth-2 is sufficient for most decisions | Sub-optimal advice in complex multi-street spots | Compare depth-2 vs depth-3 EV on benchmark hands |
| A-03 | Population priors from Bayesian engine are reasonable starting points | Wrong initial range estimates for first ~10 hands vs a new player | Track showdown prediction accuracy over time |
| A-04 | Users record actions during live play (not retrospectively) | UI optimized for real-time entry may frustrate post-session review | User behavior observation |
| A-05 | Mobile Chrome on Android is the primary runtime | Desktop browser differences (viewport, touch, memory) may cause issues | Track user agent distribution if analytics added |
| A-06 | IndexedDB quota (~50MB minimum guaranteed) is sufficient | Data loss if quota exceeded with no warning | Monitor via `navigator.storage.estimate()` |
| A-07 | Game tree eval < 100ms on target device | UI jank during live play if evaluation is slow | RT-7 (physical device profiling) will validate |

*Update when: new constraint discovered, assumption validated/invalidated, or soft constraint becomes hard/irrelevant.*

---

## 10. Observability Gaps

### 9.1 What We Cannot Currently See

| Gap | Impact | Recommended Fix |
|-----|--------|----------------|
| No performance metrics for game tree evaluation | Can't detect slow evaluations or regressions | Add timing telemetry to `evaluateGameTree()` |
| No error tracking beyond console.log | Silent failures in production | Structured error logging with context |
| No usage analytics (which features used, which ignored) | Can't prioritize development | Optional anonymous telemetry |
| Range profile accuracy unknown | Can't validate Bayesian updates are improving | Track prediction accuracy vs showdown outcomes |
| No regression detection for EV calculations | EV drift from code changes goes unnoticed | Benchmark suite with known-answer hands |
| Extension ↔ app sync status invisible | User doesn't know if extension is connected | Connection status indicator in UI |
| IndexedDB storage usage unknown | No warning before hitting quota | `navigator.storage.estimate()` check |
| Villain model confidence distribution | Don't know how many players have usable models | Aggregate confidence histogram in stats view |
| No SW restart counter in diagnostics | Cannot measure frequency of sidebar 5-step flicker sequence | Add `sw_restart_count` to pipeline diagnostics |
| No stale advice detection/logging | Cannot tell if user acted on stale data | Log advice age at render time; flag renders where age > 10s |
| No render-cause tracing in side panel | Cannot debug which push handler triggered a specific render | Add render-reason tag to `scheduleRender()` calls |
| No coordinator-vs-module state divergence detection | Cannot detect root cause of "wrong state" bugs at runtime | Debug-mode assertion comparing coordinator._state to module vars (or eliminate dual state via RT-43) |
| No message-sequence test coverage | State race conditions invisible to test suite; temporal harness tests render layer only | RT-51: message-level integration harness |
| `_contextStale` computed but never rendered | Two-phase stale detection invisible to users; visual no-op | RT-53: render the indicator |
| Community cards absent from renderKey | Turn/river card arrival may not trigger re-render if no other tracked field changes | RT-54: include card content hash |

### 9.2 What We Can See

- Test suite: ~5,400+ tests catch functional regressions
- Manual visual verification via dev server
- Git history for change tracking
- `smart-test-runner.sh` for pre-commit validation
- Extension visual harness (`localhost:3333`) for sidebar scenarios

---

## 11. Technical Debt Register

| ID | Debt | Severity | Origin | Resolution Path |
|----|------|----------|--------|----------------|
| TD-01 | `getAllHands()` full scan (no pagination) | Medium | Original design | Add cursor-based pagination with limit param |
| TD-02 | `usePlayerTendencies` recomputes all players on any hand change | Medium | Hook architecture | Per-player memoization with selective invalidation |
| TD-03 | Magic number `0.3` for villain model confidence threshold | Low | Rapid iteration | Extract to named constant in config |
| TD-04 | Monte Carlo fallback when combo distribution unavailable | Low | Legacy path | Expand combo distribution coverage |
| TD-05 | No incremental range profile updates (full rewrite per hand) | Medium | Bayesian updater design | Delta updates to changed buckets only |
| TD-06 | Layer boundary: 9 views import directly from engine utils | Low | Organic growth | Rule amended to allow pure/constant imports; prohibit stateful access |
| TD-07 | `useEquityWorker` is a hook, not a context — every call site spawns a new Worker | Medium | RT-10 initial implementation | RT-27: extract to EquityWorkerContext |
| TD-08 | Preflop MC path bypasses Worker (`handVsRange` called directly in `preflopAdvisor`) | Medium | RT-10 incomplete threading | RT-31: inject equityFn into preflop path |
| TD-09 | ~~`handAnalysis` reverse-imports from `exploitEngine`~~ | ~~High~~ | Resolved RT-35 | monteCarloEquity moved to pokerCore, 4 symbols injected via deps |
| TD-10 | ~~No React.memo anywhere in component tree~~ | ~~Medium~~ | Resolved RT-36 | SeatComponent wrapped in React.memo with custom comparator |
| TD-11 | Cross-tab sibling imports across drill views (10+ files consume `RangeFlopBreakdown`, `MatchupBreakdown`, `HandPicker`, `LessonCalculators`, `FRAMEWORK_COLOR` via `./` relative paths). Blocks any future view restructuring. | Medium | Drills-consolidation roundtable 2026-04-20 | RT-94: migrate helpers into `src/components/_shared/drillInternals/` barrel |
| TD-12 | INV-08 violation: `src/utils/drillContent/__tests__/lessons.test.js` imports from `src/components/views/PreflopDrillsView/LessonCalculators`. Utils-layer test pulls from UI layer. | Medium | Roundtable surfaced 2026-04-20 | RT-95: extract pure calculators to `src/utils/drillContent/` or similar |
| TD-13 | `aggregateFrameworkAccuracy` at `preflopDrillsStorage.js:108` uses `const out = {}`; tampered IDB record with `frameworks: ['__proto__']` would attempt prototype write. Low severity in single-user context; trivial fix. | Low-Medium | Roundtable surfaced 2026-04-20 | RT-96: `Object.create(null)` + shape guard on IDB read |
| TD-14 | SCREEN enum lifecycle is ad-hoc. `editorContext.prevScreen` carries SCREEN strings; bulk deletion (e.g., Phase 7 of drills-consolidation) risks stranded values. No default case in `PokerTracker.jsx` routing switch. | Medium | Roundtable surfaced 2026-04-20 | RT-102: two-step deprecation protocol + default fallback case |

---

## 12. Decision Log

Historical decisions (pre-2026) are in `docs/adr/ADR-001` through `ADR-004`. This log captures decisions from 2026 onward. New decisions go here, not as new ADR files.

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2024 | useReducer for state management | Complex interdependent state; avoids Redux boilerplate | Redux (rejected: overkill), useState (rejected: too simple). See `docs/adr/ADR-001` |
| 2024 | IndexedDB for persistence | Large datasets, structured data, no server needed | localStorage (rejected: 5MB limit), SQLite (rejected: no browser support). See `docs/adr/ADR-002` |
| 2024 | Context API for cross-component state | Avoids prop drilling; fits reducer pattern | Redux (rejected: redundant with useReducer), Zustand (rejected: extra dep). See `docs/adr/ADR-003` |
| 2024 | Vitest for testing | Fast, Vite-native, ESM support | Jest (rejected: slow transforms), Playwright (rejected: different scope). See `docs/adr/ADR-004` |
| 2026-03-08 | Bayesian over frequentist for all poker analysis | Small samples, non-normal distributions, informative priors available | z-tests (rejected: wrong assumptions) |
| 2026-03-24 | 3-layer analysis pipeline (stats → tendencies → exploits) | Separation of concerns; each layer testable independently | Monolithic analyzer (rejected: untestable) |
| 2026-03-24 | Game tree evaluator as sole source of hero recommendations | Ensures EV-backed advice; prevents weakness→action shortcuts | WEAKNESS_EXPLOIT_MAP (removed: theoretically unsound) |
| 2026-03-27 | Villain model 5-layer priority hierarchy | Higher-fidelity data supersedes lower; prevents double-counting | Flat weighted average (rejected: double-counts) |
| 2026-03-29 | Rake threaded through entire EV pipeline | Rake changes EV materially at low stakes; can't be bolted on | Post-hoc rake adjustment (rejected: wrong EV) |
| 2026-03-31 | Stratified flop sampling replaces flat realization constants | 0.70/0.85 was too coarse; archetype-weighted is calibratable | Per-hand exact rollout (rejected: too slow) |
| 2026-04-04 | Confirmed circular import: foldEquityCalculator ↔ villainDecisionModel | fitFoldCurveParams creates bidirectional dependency; RT-16 to extract into standalone module | Leave as-is (rejected: fragile init order) |
| 2026-04-06 | Amend "views never import utils" rule to allow read-only pure function/constant imports | 9 existing violations are all read-only; strict mediation adds indirection for no safety benefit. Real invariant is no stateful engine access from views. | Strict ESLint enforcement (rejected: solo dev overhead exceeds benefit for read-only imports) |
| 2026-04-07 | EquityWorker must be a singleton context, not a per-component hook | Multiple instantiations waste mobile threads; crash recovery and backpressure require centralized state | Keep as hook with dedup logic (rejected: fragile, no enforcement) |
| 2026-04-07 | handAnalysis must not import from exploitEngine (R5 roundtable) | Bidirectional coupling violates dependency layers; shared utilities should live in pokerCore or a shared layer | Leave as-is (rejected: silent breakage path) |
| 2026-04-11 | Dual state in side-panel.js must converge to single-owner (coordinator) | Sync-based dual-state is the root cause of every recurring sidebar display bug; adding more sync points does not fix the architectural problem | Keep dual state with more sync calls (rejected: same class of bugs recurs); make module vars authoritative and remove coordinator (rejected: coordinator provides scheduling/snapshot benefits) |
| 2026-04-11 | Advice guard must include hand-number binding, not just street-rank | SW restart sends cached advice from prior hand; street-rank check passes across hand boundaries; hand-number comparison is the only reliable cross-hand guard | Street-rank only (rejected: cross-hand contamination); clear all caches on SW restart (rejected: loses valid state on transient restart) |
| 2026-04-15 | Sidebar Rebuild Program (SR-0 → SR-7) closed: 5 user symptoms (S1–S5) decomposed to 8 root mechanisms (M1–M8), all fixed; 4 blocking deltas closed; doctrine v2 (33 rules) + 6-zone shell + 5 declarative FSMs + freshness sidecar + computeAdviceStaleness as single source of truth for stale surface. Failure-mode register entries from RT-43 through RT-66 (lines ~180–199) are now resolved by the rebuild, not patched in place. | Recurring sidebar display bugs had structural cause; symptom-by-symptom fixes kept regressing. Spec-first program produced a stable architecture with explicit invariants under automated lint gates (R-2.3 dom-mutation, RT-60 timer, R-7.2 cross-panel coverage). | Continue patching individual symptoms (rejected: 3 weeks of recurrence proved the pattern); rebuild without doctrine first (rejected: would have produced different bugs, not fewer). Post-mortem: `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`. |
| 2026-04-20 | Drills-consolidation proposal (`docs/projects/drills-consolidation.project.md`) held pending three preconditions: (a) Line Study closure (LS-4..6), (b) design-doc defect fixes (RT-93), (c) `src/components/_shared/drillInternals/` barrel creation (RT-94). Effort revised 2–3 → 5–7 sessions. Learn tab scope split into search vs. schema normalization. | 6-expert roundtable found: sibling `./` imports across 10+ files invalidate "zero internal changes" claim; `ViewRouter.jsx` reference was factual error (route wiring is inline in `PokerTracker.jsx:109-110`); file-move tally omits ~7 helpers; Learn unified-search collides with two lesson schemas; Phase 1 scaffolding collides with active Line Study handoff. | Execute as written (rejected: factual errors + scope undercounting); descope to rename-only (rejected: doesn't serve the JTBD framing); roundtable the revised proposal after defect fixes (accepted). Peer-tab-vs-nested for Line Study deferred to owner content-roadmap decision (not an engineering call). |

---

---

## 13. Roundtable Persona Reference

Seven personas analyze this system model during structured roundtables.
Full persona definitions, reasoning rules, write permissions, and section assignments: see `SYSTEM_MODEL_PROTOCOL.md` §4.

---

*Next update trigger*: Any change to component boundaries, new invariant discovery, or architectural decision.
