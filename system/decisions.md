# Decisions

<!-- Seeded from docs/adr/ during CWOS adoption. -->
<!-- Each entry corresponds to an ADR file. New decisions should be -->
<!-- appended below using the same DEC-NNN format. -->

## DEC-001: ADR-001: Use useReducer for State Management

<!-- Seeded from docs/adr/ADR-001-use-reducer-for-state.md -->

## Status
Accepted

## Date
2024 (v106)

## Context
The application started with useState hooks for managing state. As features grew, we faced:
- Complex state updates across multiple related values
- Difficulty tracking what changed state and why
- Action logic scattered across handler functions
- Testing state transitions was difficult

Options considered:
1. Continue with useState + careful organization
2. Adopt Redux for global state
3. Use useReducer with local reducers
4. Use Context API + useReducer

## Decision
Use **useReducer** with multiple domain-specific reducers:
- `gameReducer` - Game state (street, dealer, actions)
- `uiReducer` - UI state (selection, modals, sidebar)
- `cardReducer` - Card state (community, hole, player cards)
- `sessionReducer` - Session state (current session, history)
- `playerReducer` - Player state (database, seat assignments)

Each reducer:
- Has explicit action types as constants
- Maintains its own initial state
- Is independently testable
- Uses pure functions for all state transitions

## Alternatives Considered

### Redux
- **Pros**: Industry standard, great dev tools, middleware support
- **Cons**: Overkill for this app size, adds dependency, boilerplate

### useState only
- **Pros**: Simple, no learning curve
- **Cons**: State updates become unwieldy, hard to test transitions

### Single global reducer
- **Pros**: All state in one place
- **Cons**: Large reducer file, harder to maintain, all components re-render

## Consequences

### Positive
- Clear action types document all possible state changes
- Reducers are pure functions - easy to test
- State transitions are predictable and traceable
- Domain separation keeps code organized
- Components dispatch actions, don't manage state logic

### Negative
- Learning curve for useReducer pattern
- More files (5 reducer files vs inline state)
- Need to coordinate when actions span multiple reducers

### Mitigations
- Created documented action type constants
- Added schema validation in reducers (debug mode)
- Test coverage for all reducer action types

## References
- v106 release notes in CHANGELOG.md
- React useReducer documentation
- `src/reducers/` directory

---

## DEC-002: ADR-002: Use IndexedDB for Persistence

<!-- Seeded from docs/adr/ADR-002-indexeddb-for-persistence.md -->

## Status
Accepted

## Date
2024 (v109)

## Context
The application needed to persist:
- Saved poker hands with full action history
- Session data (venues, buy-ins, results)
- Player database with profiles

Options considered:
1. localStorage - Simple key-value storage
2. IndexedDB - Full database in browser
3. External backend - Server-side database
4. File-based - Export/import JSON files

Requirements:
- Work offline (live poker venues have spotty wifi)
- Store complex nested objects
- Support querying (hands by session, players by name)
- No server dependency
- Free and unlimited storage

## Decision
Use **IndexedDB** via the browser's native API.

Structure:
- Database: `PokerTrackerDB`
- Object stores: `hands`, `sessions`, `players`, `activeSession`
- Indexes for efficient querying
- Migration system for schema changes (v1→v5)

## Alternatives Considered

### localStorage
- **Pros**: Simpler API, synchronous, universal support
- **Cons**: 5MB limit, no indexes, no transactions, strings only

### External backend
- **Pros**: Sync across devices, unlimited storage, better querying
- **Cons**: Requires server, costs money, needs internet, authentication complexity

### File-based export
- **Pros**: User controls data, portable, no storage limits
- **Cons**: Manual save/load, no automatic persistence, friction

## Consequences

### Positive
- Unlimited storage (browser-allocated, typically 50%+ of disk)
- Structured data with indexes for fast queries
- Works completely offline
- No server costs or maintenance
- Transactions ensure data integrity
- Migration system handles schema evolution

### Negative
- More complex API than localStorage
- Async operations require careful handling
- Different browsers have different storage limits
- Data lives in one browser only
- IndexedDB can be cleared by user "clear browsing data"

### Mitigations
- Created abstraction layer (`IStorage` interface)
- Export/import functionality for backup
- Clear error messages when storage fails
- Automatic migration system

## Migration History
- v1: Initial `hands` store
- v2: Added `sessions`, `activeSession` stores
- v3: Added session fields (venue, gameType, rebuyTransactions)
- v4: Added cashOut field to sessions
- v5: Added `players` store

## References
- v109 release notes in CHANGELOG.md
- `src/storage/` directory
- `src/utils/persistence/database.js`
- MDN IndexedDB documentation

---

## DEC-003: ADR-003: Use Context API to Reduce Prop Drilling

<!-- Seeded from docs/adr/ADR-003-context-api-for-prop-drilling.md -->

## Status
Accepted

## Date
2024 (v114)

## Context
As the application grew, some components required many props:
- TableView received 64+ props
- Props were passed through multiple component levels
- Changes to state shape required updating many component signatures
- Difficult to trace which component uses which state

The component hierarchy looked like:
```
PokerTracker
└── TableView (64+ props)
    ├── SeatComponent (15+ props)
    ├── ActionPanel (10+ props)
    └── CollapsibleSidebar (8+ props)
```

## Decision
Introduce **React Context API** with domain-specific providers:

1. **GameContext** - Game state (street, dealer, actions, absent seats)
2. **UIContext** - UI state (selection, modals, sidebar, card selector)
3. **SessionContext** - Session state (current session, history)
4. **PlayerContext** - Player state (database, seat assignments)
5. **CardContext** - Card state (community, hole, player cards)

Components access state via hooks:
```javascript
const { currentStreet, hasSeatFolded } = useGame();
const { setCurrentScreen, SCREEN } = useUI();
```

## Alternatives Considered

### Continue with props
- **Pros**: Explicit data flow, no "magic" context
- **Cons**: Prop explosion, brittle component signatures

### Redux/Zustand
- **Pros**: More powerful state management, dev tools
- **Cons**: Additional dependency, migration effort, overkill

### Single global context
- **Pros**: Simple, one provider
- **Cons**: All consumers re-render on any change

## Consequences

### Positive
- TableView props reduced from 64+ to ~30
- StatsView props reduced from 4 to 1
- Components self-document what state they need
- Derived values computed in context (e.g., `hasSeatFolded`)
- Easier to add new consumers without prop threading

### Negative
- Context can be "magic" - harder to trace data flow
- Need to wrap app in multiple providers
- Testing requires context wrapper setup
- Risk of overuse (not everything needs context)

### Mitigations
- Each context is domain-specific (not one global bag)
- Contexts provide derived helpers, not just raw state
- Test utilities include context wrapper helpers
- Components still receive some props (scale, refs)

### Guidelines
- Use context for: cross-cutting state used by many components
- Use props for: configuration specific to that component
- Keep contexts focused on a single domain

## References
- v114 release notes in CHANGELOG.md
- `src/contexts/` directory
- React Context API documentation

---

## DEC-004: ADR-004: Use Vitest for Testing

<!-- Seeded from docs/adr/ADR-004-vitest-for-testing.md -->

## Status
Accepted

## Date
2024 (v112 - test coverage project)

## Context
The project needed a testing framework that:
- Integrates well with Vite (our build tool)
- Has good React testing support
- Is fast for large test suites
- Has watch mode for development
- Supports coverage reporting

Options considered:
1. Jest - Industry standard, most documentation
2. Vitest - Vite-native, Jest-compatible API
3. Testing Library alone - Lightweight but limited

## Decision
Use **Vitest** as the test runner with:
- `@testing-library/react` for component testing
- `@testing-library/jest-dom` for DOM matchers
- `fake-indexeddb` for database mocking
- `jsdom` for browser environment simulation
- `@vitest/coverage-v8` for coverage reports

Configuration in `vite.config.js`:
```javascript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
  include: ['src/**/*.{test,spec}.{js,jsx}'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
  },
}
```

## Alternatives Considered

### Jest
- **Pros**: Most widely used, huge ecosystem, excellent docs
- **Cons**: Requires additional config with Vite, slower, separate transform step

### Testing Library only
- **Pros**: Simple, focused on user behavior
- **Cons**: No test runner, no watch mode, no coverage

## Consequences

### Positive
- Native Vite integration (same transform, fast HMR)
- Jest-compatible API (familiar patterns, easy migration)
- Fast execution (~20 seconds for 2200 tests)
- Watch mode updates instantly on file changes
- Coverage reports in text and HTML formats
- ESM support out of the box

### Negative
- Less ecosystem/plugins than Jest
- Some Jest plugins don't work
- Newer, less battle-tested

### Current Test Stats
- 75 test files
- 2,221 tests
- ~90% code coverage
- ~21 second full run

## Test Organization
```
src/
├── test/
│   ├── setup.js          # Global setup (jest-dom)
│   ├── utils.js          # Test utilities and factories
│   └── schema-validation.test.js  # Schema drift tests
├── reducers/__tests__/   # Reducer tests
├── hooks/__tests__/      # Hook tests
├── utils/__tests__/      # Utility tests
├── contexts/__tests__/   # Context tests
├── components/
│   ├── ui/__tests__/     # UI component tests
│   └── views/__tests__/  # View component tests
└── storage/__tests__/    # Storage layer tests
```

## References
- v112 test coverage project
- `vite.config.js` test configuration
- `src/test/utils.js` test utilities
- Vitest documentation

---

## DEC-005: Straddle scope — UTG + BTN only, UTG > BTN precedence, no re-straddle

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-002 / SPR-010 plan-mode AskUserQuestion)

**Decision:** TableView's straddle support codifies a narrowed-Mississippi scope: straddle allowed only from UTG or BTN seats; permanent (table-rule) AND optional (per-hand) modes both supported; if both UTG and BTN seats want to straddle the same hand, only UTG posts; re-straddle is NOT in scope.

**Reasoning:** Live-poker reality. UTG straddle is dominant in US live cash; BTN straddle is the second-most-common variant (some venues + some player choice). Owner preference is to model what they actually encounter, not full Mississippi (any seat) or theoretical-coverage-of-all-variants. Re-straddle exists in some rooms but rarely; out-of-scope keeps the matrix and future production primitive lean. Trade-off: future amendment required if owner moves to a venue where re-straddle or non-UTG/BTN straddles are common.

**Context:** WS-002 — extended `actionInvariants.fixture.js` with STRADDLE COVERAGE section + 7 spec_gap rows (INV-S-010..017) under this scope. Future fix wave will add `STRADDLE` primitive + action-order rule + `straddleMode` config flag with this precedence built in.

---

## DEC-006: SCF persona — extend `chris-live-player`, no new "chris-the-improver" persona

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-009 / SPR-012 plan-mode AskUserQuestion)

**Decision:** Self-Coach Foundation does not author a new persona. The existing `chris-live-player` core persona is extended with overall-tier metadata + "Goals when self-coaching" + 4 new JTBD links. SCF is "the same person in self-coach mode," not a different person.

**Reasoning:** Persona explosion is a real cost — 16 core personas already exist. Authoring a new one purely to capture a posture (self-coach mode) inflates the cast without adding decision-shape clarity. The same goal can be encoded as additive sections on the primary persona that explicitly name the posture. Trade-off: if Gate 2 (Blind-Spot Roundtable) finds the posture has goals or constraints that materially differ from the core persona, this decision is reversible — author a situational sub-persona at that point.

**Context:** WS-009 / SPR-012 SCF Gate 1 audit. Sets precedent for future "user-in-mode-X" capabilities (SCF, future PIO improvements, etc.) — extend over author-new is the default unless a Blind-Spot Roundtable surfaces material persona divergence.

---

## DEC-007: SCF skill ladder — 6 tiers (novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro)

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-009 / SPR-012 plan-mode AskUserQuestion)

**Decision:** Self-Coach Foundation codifies a 6-tier OVERALL player ladder. This is a NEW concept distinct from the existing per-domain Skill-state attribute on `chris-live-player.md` (3–5 ordinal mastery values per descriptor). Both coexist: overall-tier drives curriculum-spine sequencing ("at studied-amateur, learn polarization next"); per-domain mastery drives drill scheduling.

**Reasoning:** Granular tiers permit precise curriculum sequencing. 6 tiers were chosen over 4 (which would collapse studied-amateur + part-time-grinder + serious-grinder distinctions that owner finds meaningful) and over a custom-tier deferral (which would have left Phase 2 with an open RED dimension). Trade-off: more authoring work in Gate 3 for the per-tier teachable-concept map (6 rows vs 4); accepted because owner intends to coach themselves up the ladder over time and finer differentiation pays off.

**Context:** WS-009 / SPR-012 SCF Gate 1 audit. This sets precedent that "overall player tier" and "per-domain mastery" are distinct concepts — future features that touch user-skill must respect this two-level model.

---

## DEC-008: SCF JTBD placement — extend `coaching.md` self-coach-mode sub-section, no new domain

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-009 / SPR-012 audit recommendation, owner-deferred to Gate 2)

**Decision:** The 4 SCF JTBDs (CO-54..57) live in the existing `docs/design/jtbd/domains/coaching.md` under a new "Self-coach mode" sub-section, alongside the formal-coach-mode jobs (CO-48..53). The domain scope is explicitly dual-mode: third-party coach reviews student (CO-48..53) AND user is both coach and student (CO-54..57).

**Reasoning:** Lower friction than authoring a new `self-coaching.md` domain with a new prefix (would have collided cognitively with subscription / session-create / similar 2-letter abbreviations). The two modes share enough mental model (coaching jobs in general) that the extension reads naturally; the explicit sub-section divider preserves clarity. Trade-off: domain scope expands; ATLAS row now reads "Coaching (formal-coach + self-coach modes)" — that's documentation cost. Reversible at SCF Gate 2 if the Blind-Spot Roundtable finds the dual-mode framing causes confusion.

**Context:** WS-009 / SPR-012 SCF Gate 1 audit. Sets precedent for "dual-mode within existing domain" pattern — future capabilities that look like a sub-mode of an existing domain default to extension over new-domain authoring, with the divider made explicit.

---

## DEC-009: Drill-storage sort tiebreak — fix the production loader, not the test

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-133 triage during /next post-WS-126 verification)

**Decision:** When the post-WS-126 triple full-suite run surfaced a 1-of-3 flake in `preflopDrillsStorage > saves and loads drill attempts for a user`, the fix landed in production code (`loadPreflopDrills` and `loadPostflopDrills` sort comparator gained a `drillId` tiebreaker) rather than in the test (e.g., adding await / sleep, or weakening the assertion). The production contract was "newest first"; same-ms saves silently violated it. The test exposed a real contract gap, not test fragility.

**Reasoning:** Fix the contract, not the test. The loader documented "newest first" semantics but was non-deterministic on ms-tied saves; that's a latent production bug whose impact in real usage is small (humans don't save 2 drills in 1 ms) but whose presence violates the contract. Trade-off: the fix touches production source files; risk that the new ordering changes downstream consumers' expectations. Verified: no consumers depend on the prior non-deterministic order; the contract was always "newest first" and now it is, deterministically.

**Context:** WS-133. Sets precedent: when a test exposes a contract gap, fix the contract. Test-only patches (sleeps, weakened asserts) are last resort.

---

## DEC-010: MC equity remediation — per-test fix, not seeded RNG, not uniform-bump

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-134 / SPR-011 plan-mode AskUserQuestion)

**Decision:** The 3 Monte-Carlo equity flakes get per-test treatment: `advisorAccuracy` AKs raises trials 500→3000 with MoE math justified inline; `gameTreeEvaluator` no-mix-when-dominates raises trials 100→500; `rangeVsBoard` AA-vs-KK gets `test.skip` with a named SPR-005/WS-134 precedent comment. Seeded RNG (would have required exposing a `seed` parameter on `handVsRange` purely for test convenience) was rejected. Uniform "raise all trials" was rejected (rangeVsBoard's flake source is suspected proration math, not trial count). Tolerance-widening was rejected (weakens signal).

**Reasoning:** Each test had a distinct failure mode; a uniform fix would have been precise on one and wrong on the others. Seeded RNG would have polluted the engine API for test convenience and masked any genuine MC drift. Trade-off: 3 individual changes vs 1 uniform fix; small added authoring cost. The tolerance is now JUSTIFIED by MoE math (3000 trials × p≈0.5 → ±1.8% MoE, well inside ±5% band) rather than guessed.

**Context:** WS-134. Sets precedent for future MC stabilization: pick remediation per failure mode, justify trial counts with MoE math, never expose seed parameters on production engine APIs solely for test determinism.

---

## DEC-011: PIO recognition-uncertainty scope — across-session at same venue

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-004 / SPR-013 plan-mode AskUserQuestion)

**Decision:** Player Identification v2 codifies a temporal scope of "across-session at same venue" for the sighting log + recognition-disambiguation infrastructure. Schema is keyed on `(playerId, sessionId, seenAt, attrs)` with venue implicit. Cross-venue and cross-operator scope are explicitly **out of scope** for v1; deferred to a future PIO-G2 amendment if owner plays at 2+ venues regularly.

**Reasoning:** Master Plan §A specifically named "build-temporal-attribute-history" — that JTBD requires across-session minimum. Within-session-only would have collapsed PIO into table-build's existing scope. Cross-venue would have introduced venue entities + probabilistic cross-venue identity matching (5×+ effort). Owner currently plays at one venue; deferring cross-venue means we don't pay the schema cost speculatively. Trade-off: if owner travels, the deferred amendment adds a venue dimension to existing records — a real migration. Risk is bounded.

**Context:** WS-004 / SPR-013 PIO Gate 1 audit. Sets schema scope for the entire PIO program (sighting log shape, stability ranking, Player Profile surface). Future "tournament mode" or "multi-venue mode" features must reckon with this baseline.

---

## DEC-012: PM-10/11/12 reframed as sub-jobs of PIO's umbrella JTBDs

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-004 / SPR-013 plan-mode AskUserQuestion)

**Decision:** Within `docs/design/jtbd/domains/player-management.md`, PM-10 (cold-read mixed match-or-create) and PM-11 (dup-detect + manual merge) are positioned as **sub-jobs** of PM-13 (describe-someone-into-existence). PM-12 (today-only observations as per-seat-per-session records) is positioned as a **sub-job** of PM-14 (build-temporal-attribute-history). PM-15 (convert-uncertain-sighting-to-known-player) has no PM-1x sub-jobs — its sub-jobs are net-new disambiguation interactions to author in PIO Gate 4. PM-10/11/12 keep their existing IDs and content; relationship cross-refs are added.

**Reasoning:** The umbrella relationship matches the actual feature shape — table-build (which serves PM-10/11/12) IS the session-start entry surface of PIO (which is served by the umbrella JTBDs PM-13/14/15). Reframing without renaming preserves prior-art continuity (table-build Gate 2 already shipped citing PM-10..12) while making the broader umbrella explicit. Trade-off: ATLAS now reads with both umbrella and sub-job entries, slightly more cognitive load when scanning. Reversible: if Gate 2 finds the umbrella framing causes confusion, can collapse to "parallel JTBDs" framing.

**Context:** WS-004 / SPR-013 PIO Gate 1 audit. Sets pattern for "umbrella JTBD with sub-jobs" — first instance in this codebase. Future JTBD authoring that spans multiple sub-surfaces of one umbrella program can use the same pattern.

---

## DEC-013: Phone-camera-capture in PIO Gate 4 v1; photo via blobId in separate `playerPhotos` store

**Date:** 2026-05-02 | **Status:** Accepted | **Detected:** implicit (WS-004 / SPR-013 plan-mode AskUserQuestion + audit Open Question §Q3 recommendation)

**Decision:** Phone-camera-capture ships with PIO Gate 4 v1 (not deferred to v2 / Gate 5). Photo on Player record is stored as `blobId` referencing a separate `playerPhotos` IDB store (not as dataUrl in-band). Capture mechanic is web-native `<input type="file" capture="environment">`. Photo lifecycle is gated by autonomy red lines #1 (opt-in — capture is always user-initiated, never automatic) and #4 (reversibility — one-tap delete photo with no system retention).

**Reasoning:** Camera unblocks `describe-someone-into-existence` for tournament players where face is the most stable identifier (wardrobe drift is high in tournament play; name + generic features are insufficient). Web-native `<input capture>` is small-effort given Samsung Galaxy A22 browser support; effort doesn't justify deferral. Storage as blobId out-of-band keeps Player records small and indexable; dataUrl in-band would bloat list scans. Trade-off: blobId requires a join on read (fetch player + fetch photo); acceptable since photos display only in detail/profile flows, not list-scan rendering. Privacy/policy concerns surfaced in PIO-G1 Open Questions §Q5/Q7 are deferred to Gate 2 stress-stage and Gate 4 surface design.

**Context:** WS-004 / SPR-013 PIO Gate 1 audit. Sets pattern for "user-initiated media capture with reversible storage" — first instance in this codebase. Future surfaces that capture user-controlled media (audio notes? screen recordings?) should follow the same opt-in + reversibility + out-of-band-storage triad.

---

## DEC-014: STRADDLE represented as a 6th `PRIMITIVE_ACTIONS` value, not as a sidecar field

**Date:** 2026-05-06 | **Status:** Accepted | **Detected:** implicit (Sprint A1 design discussion)

**Decision:** Posted straddles are recorded as a regular `actionSequence` entry (`{ seat, action: 'straddle', street: 'preflop', order: 1, amount: <variable> }`) keyed by a new `PRIMITIVE_ACTIONS.STRADDLE` value, not as a separate `gameState.straddle` or `currentSession.straddle` field consumed by parallel paths. The session-config field that carries the *default* straddle for a session is a separate concern and only seeds the actionSequence entry on hand start.

**Reasoning:** The existing actionSequence-as-truth invariant (state-schema doctrine since v95) means downstream code (potCalculator, getMinRaise, getCurrentBet, isBBOption, isStraddlerOption) can *all* derive from a single representation. Treating STRADDLE as a sidecar field would have meant patching every consumer separately and risking divergence on every change. As a 6th primitive it slots into the existing entry validation (`isValidActionEntry`) and the existing query helpers (`hasBetOrRaiseOnStreet`, `getBetLevel`) without bespoke branches. Trade-off: STRADDLE looks like a "betting decision" in the primitive list but is semantically a forced-blind post; this is documented in the constant's JSDoc and in the matrix fixture's STRADDLE COVERAGE comment block. The owner-decided UTG > BTN precedence and single-straddle-per-hand invariants are enforced at the `RECORD_STRADDLE` reducer call site, keeping the primitive itself pure.

**Context:** WS-002 Sprint A1 (commit f3cdb89) + Sprint A2 (commit 9c37a3b). Closes 9 of the 14 `spec_gap` rows in `actionInvariants.fixture.js` documented at `.claude/failures/TABLEVIEW_INVARIANT_GAP.md` line 100+. Sets a precedent for any future "forced posted action" (e.g., dead-money blind, all-in-ante variant) to be modeled as additional primitives rather than parallel state fields.

---

## DEC-015: IDB migration registry shape — JS module over YAML manifest

**Date:** 2026-05-11 | **Status:** Accepted | **Detected:** explicit (Refactor Sprint Item 3 plan-mode)

**Decision:** Per-version IDB migration metadata lives in `src/utils/persistence/migrationRegistry.js` as an ordered array of `MigrationRegistryEntry` objects, not as a YAML manifest at `.claude/context/idb-registry.yaml` or similar. Three derived helpers ship in the same module: `getStoreOwner(name)`, `getVersionsForStore(name)`, `getStoresAtVersion(version)`.

**Reasoning:** Colocates the registry with the runtime it describes (`migrations.js` imports it; tests import it directly; CI gate reads the same file). Matches existing repo conventions for inventories — `src/utils/printableRefresher/writers.js` (set-based field ownership), `src/utils/printableRefresher/cardRegistry.js` (Vite glob barrel) — none of which live in YAML. No precedent for YAML inside `src/`. CWOS-native YAML registries (engines, programs) live in `.claude/workstream/` because they describe meta-system state, not runtime data. Trade-off: YAML would be a touch more human-scannable in PRs, but the registry is dense structured data that benefits from JSDoc typedefs + autocomplete more than from YAML's whitespace clarity.

**Context:** Refactor Sprint Item 3 (2026-05-11). Resolves SYSTEM_MODEL.md §11 TD-16. Owner ratified via AskUserQuestion in plan-mode. See plan file `~/.claude/plans/precious-leaping-orbit.md` for full decision matrix.

---

## DEC-016: Per-store ownership inline in migration registry, not separate STORE_OWNERS map

**Date:** 2026-05-11 | **Status:** Accepted | **Detected:** explicit (Refactor Sprint Item 3 plan-mode)

**Decision:** A store's owner ({program, project, projectRef?}) lives on the registry entry that first added the store (the entry whose `storesAdded` array contains that store name). The helper `getStoreOwner(storeName)` walks the registry to answer ownership queries. There is no separate `STORE_OWNERS` constant in `database.js` or elsewhere. The 7 inline ownership comment blocks in `database.js` lines 64–110 are now redundant (deferred cleanup tracked as a follow-up).

**Reasoning:** Single source of truth. Ownership and migration history can never drift apart because both are properties of the same entry — you cannot add a new store without simultaneously declaring its owner. A separate STORE_OWNERS map would require two edits per new store, with no enforcement that they agree. The closest contemporary precedent is the PRF `writers.js` model (writer registration colocated with the function, not a separate registry table); applying the same shape here. Trade-off: cross-store ownership queries are O(n) walks instead of O(1) map lookups, but n=23 today and forecast n ≤ 50 over the next 12 months — irrelevant cost.

**Context:** Refactor Sprint Item 3 (2026-05-11). Companion to DEC-015. Owner ratified via AskUserQuestion in plan-mode.

---

## DEC-017: Additive-only IDB migration invariant enforced by BOTH unit test + CI grep gate

**Date:** 2026-05-11 | **Status:** Accepted | **Detected:** explicit (Refactor Sprint Item 3 plan-mode)

**Decision:** The "no IDB migration may remove a store" invariant is enforced by two independent mechanisms running on every test invocation:
1. **Unit test** at `src/utils/persistence/__tests__/migrationRegistry.test.js` asserts the semantic invariant at the registry-data level (every entry's `storesRemoved` is `[]`; cumulative store set is monotonically non-decreasing across versions).
2. **CI grep gate** at `scripts/check-idb-additive.sh`, wired as a pre-test gate in `scripts/smart-test-runner.sh`, asserts the source-code primitive (forbids `deleteObjectStore` / `deleteIndex` calls in `migrations.js`).

**Reasoning:** Each mechanism catches a different failure mode. The unit test catches a contributor who removes a store from `storesAdded` (or sets `storesRemoved`) but forgets the destructive API call. The CI grep gate catches a contributor who slips a `deleteObjectStore` call into a future migration without touching the registry at all. Either alone would have a blind spot. ~80 LOC total cost across both; small enough to ship both without ceremony. Both mechanisms have been trip-tested by injecting a violation and confirming the failure mode. Trade-off rejected: pure semantic test only — would miss the orthogonal source-code failure case.

**Context:** Refactor Sprint Item 3 (2026-05-11). The same pattern is used in `scripts/check-refresher-writers.sh` (PRF writer-registry I-WR-1 / I-WR-5 enforcement), though that gate is currently orphaned (not wired into the test runner) — flagged as separate follow-up.

---

## DEC-018: Under-frequency decision-bucket leak rules invert the detect gate (delta = baseline − observed; CI UPPER must clear baseline)

**Date:** 2026-06-08 | **Status:** Accepted | **Detected:** implicit (SPR-109 / WS-146 sixth claim)

**Decision:** The SCF decision-bucket rule class (aggression-frequency rules reading `accumulatorOutput.decisionBuckets`) now supports two polarities. OVER-frequency rules (`hero-multiway-bluff-frequency`, `hero-turn-barrel-frequency`) fire when `observed − baseline ≥ deltaPP` AND `ci.lower > baseline`. UNDER-frequency rules (`hero-pf-open-overfold`, the first of its kind) invert both halves of the gate: fire when `baseline − observed ≥ deltaPP` AND `ci.upper < baseline`. The `evidence.delta` field is always stored as the positive magnitude in the rule's own direction. The shared accumulator bucket shape (`aggressFrequency` + Wilson `aggressFrequencyCI`) is unchanged — only the rule's `detect()` reads it differently.

**Reasoning:** A frequency leak can err in either direction (barreling too much vs opening too tight), and the credible-interval guard must point the same way as the point estimate or it admits false positives. For an under-frequency claim the meaningful CI bound is the UPPER one (the whole interval must sit below the reference for "demonstrably too low" to hold), mirror-imaging the over-frequency rules where the LOWER bound must sit above. This parallels how `hero-oop-3bet-underfold` (SPR-046) established the under-FOLD pattern for the 8-axis action-bucket class — the same observed-vs-reference logic, gate inverted. Keeping the bucket shape and severity formula common across both polarities means new rules of either direction stay single-file additions. Trade-off rejected: a separate "under-frequency bucket type" — pure duplication, since the data is identical and only the comparison flips.

**Context:** SPR-109 (2026-06-08) shipped `hero-turn-barrel-frequency` (over) + `hero-pf-open-overfold` (under, resolving the deferral open since SPR-046) on the SPR-108 decision-bucket substrate. Founder ratified shipping both via AskUserQuestion. First-principles guard preserved: the aggress/pass label is an OUTPUT derived from the observed action; the rule compares an observed frequency to a hardcoded baseline (no label-as-input).

---

## DEC-019: PlayersView recognition scoring v1 — active-dim renormalization + verbatim audit weights + additive scorePlayerMatch contract

**Date:** 2026-06-09 | **Status:** Accepted | **Detected:** implicit (SPR-110 / WS-164)

**Decision:** The §PIO-G4-PVA recognition score (`src/utils/playerMatching/scorePlayerMatch.js`) makes three v1 design choices: (1) **active-dim renormalization** — the score divides by the sum of weights of only the query dims the user actually specified, so a name-only query can reach 1.0 rather than being capped at the 0.35 name weight, and unqueried dims never penalize a match; (2) **audit weights kept verbatim** — the §PIO-G4-PVA per-dim weights are used exactly as the audit lists them even though they sum to 0.95 (the audit text says "= 1.00" but the listed values total 0.95); renormalization makes the absolute sum irrelevant, so the literal relative weighting is preserved rather than inventing a different distribution to force 1.00; (3) **additive contract** — `scorePlayerMatch` (the pre-existing PEO-3 highlight primitive) gains the numeric `score`/`confidence`/`perDim` fields while retaining all highlight metadata, so existing/future highlight consumers are unaffected.

**Reasoning:** (1) Recognition queries in practice specify a subset of dims; penalizing a player for dims the user didn't ask about would make every partial query read "weak" and defeat the ranking. Renormalization makes the score "match quality over what was asked," which is the useful signal. (2) The audit is the spec of record; silently re-deriving weights to hit a round sum would diverge from it for zero behavioral gain (renormalization neutralizes the sum). Preserving verbatim + documenting the discrepancy keeps traceability. (3) The founder chose "replace the contract" over a new function name; doing it additively (grep confirmed no component consumed the primitive yet) gets the audit's intent with no breakage risk. Trade-off: a name-only query cannot differentiate same-name distractors (both score 1.0) — accepted as correct v1 behavior (the §5.2 scenario; differentiation requires a feature dim, which the future Table-Build FeatureColumn supplies).

**Context:** SPR-110 / WS-164 (PIO G5 child E) shipped the recognition-scoring core against PlayersView as first consumer. Decisions ratified via AskUserQuestion. Companion: `docs/projects/player-identification-v2/recognition-confidence-schema.md`.

---

## DEC-020: Anchor predicates live in an anchor-owned registry; base validator gains additive inheritance options

**Date:** 2026-06-10 | **Status:** Accepted | **Detected:** explicit (SPR-119 / WS-218, founder-ratified via AskUserQuestion)

**Context:** The 2026-06-10 seam audit found the EAL two-validator inheritance contract (gate4-p3-decisions §1 rule 4, documented in validateAnchor's JSDoc) had no caller — and could not be wired naively: 3 of 4 seed predicates (`riverProbeBluffFrequencyAfterTurnXX`, `callVsTurnDoubleBarrelPaired`, `foldVsFlopDonkWetConnected`) were not in assumptionEngine `PREDICATE_KEYS`, and `validateAssumption` strict-equals `schemaVersion` to the base `'1.1'`, rejecting every compound-versioned anchor.

**Options Considered:**
1. **Anchor-owned registry (CHOSEN)** — `ANCHOR_PREDICATE_KEYS` in `anchorLibrary/anchorPredicates.js`; base validator gains additive `options.additionalPredicates` + `options.skipSchemaVersion`; `validateAnchorFull` composes both validators.
2. **Join PREDICATE_KEYS, full 4-artifact discipline** — blocked today: producer recipes require `villainTendency.observedRates` tendency keys that don't exist for these predicates; ~500-600 lines + new tendency plumbing per predicate; conflates production paths.
3. **Join PREDICATE_KEYS enum-only with carve-out** — cheap but hollows the parent CI discipline ("every entry is producible and math-tested") and mixes anchor vocabulary into the producer predicate space.

**Decision:** Anchor-authored predicates live in the anchor-owned registry with a **parallel discipline**: every anchor predicate requires an anchor-level Tier-1 math-integrity scenario in `anchorLibrary/__sim__/scenarios/` (mirrors the parent "no predicate without a synthetic-villain test" rule; all 4 seeds comply). Predicates already in `PREDICATE_KEYS` (SEED-01's `foldToRiverBet`) are never duplicated in the anchor registry — `claimContractSeam.test.js` pins the XOR partition. Base validation runs through `validateAnchorFull` with the registry + compound-semver accommodation; the scenario runner now gates Tier-1 scenarios on the full inherited contract. The base validator options are additive-only with default behavior pinned by regression test.

**Reasoning:** The parent enum's 4-artifact discipline exists so producer-emitted predicates ship math-tested; anchor predicates are authored per-anchor, never producer-emitted, and already carry their own 10k-hand Tier-1 scenarios. A separate registry keeps both engines' contracts honest and lets anchor vocabulary grow with the library without producer plumbing. Wiring the inheritance also forced the 4 seeds to full v1.1 conformance (transcribed from seed-anchor markdowns; quality blocks derived via the engine's own `determineActionability` — no hand-typed actionability) and caught real drift: SEED-04's `deviationType: 'line-shift'` was outside the `DEVIATION_TYPES` enum (markdown says `sizing-shift`).

**Consequences:**
- Graduation path: if producer plumbing for an anchor tendency lands later, the predicate moves to `PREDICATE_KEYS` under the full 4-artifact discipline and is removed from the anchor registry — no schema change.
- Template anchors carry `villainId: 'population:<Style>'` (pooled per-style claims until per-villain n ≥ 15) and honest zero evidence counts; instantiation-time binding is future EAL-phase scope.
- All Phase-1 seeds honestly gate `quality.actionable*: false` (pending stability; SEED-04 sub-gate confidence by design) — surfaces consult anchor `status`, not v1.1 actionability, per the EAL Tier-2 model.

**Load-Bearing Assumptions (AS-N, advisory — impact: medium):**
```yaml
assumptions:
  - id: AS-1
    type: empirical
    claim: "Anchor-library predicates do not need producer emission (live assumption production from villainTendency.observedRates) in the current roadmap phase; the anchor-owned registry split therefore costs nothing beyond a one-step graduation path."
    falsifies_if:
      threshold: ">=1 anchor predicate requires producer-emitted live assumptions (a PRODUCTION_RECIPES recipe reading observedRates) before the registry graduation path is exercised"
      window: "next EAL phase boundary or 2026-09-08, whichever first"
    revisit: "2026-09-08"
    status: active
    severity: medium
```

---
