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

## DEC-021: Voice input scope expansion — WS-181 card spike → Voice Hand-Tree Entry (re-ratifies R2; R1 holds)

**Date:** 2026-06-19 | **Status:** Accepted | **Detected:** explicit (owner 2026-06-19 session, ratified via AskUserQuestion)

**Context:** WS-181 shipped Voice Card Entry as a ship-or-drop spike scoped (ratification R2) to board + villain-showdown CARDS only, on Web Speech (R1), no cloud/Whisper. It "worked the majority of the time" but was never live-validated (no SHIP/KEEP-OFF/DROP ADR was ever written). The owner now wants voice to "do more" — narrate whole hands including ACTION sequences ("UTG b 10, I call"; "MP limp, I open 15, BTN 3b, I c"), usable both live (peek at the recorded hand, dismiss, keep playing) and post-hoc (reconstruct a hand from memory, inserting forgotten actors and re-typing actions). The owner did NOT choose cloud transcription.

**Options Considered:**
1. **Stay at R2 (cards only) + improve graceful degradation** — rejected: doesn't meet the owner's explicit "do more" (actions); degradation alone is necessary but not sufficient.
2. **Cloud/Whisper for higher accuracy** — rejected: breaks R1, adds infra/cost, owner did not select it; loses the zero-infra on-device property.
3. **Expand to full hand-tree on Web Speech; build the action parser from REAL captured voice data (CHOSEN)** — keeps R1, defers the parser until real captures exist, writes into the existing hand record.

**Decision:** Expand voice scope from cards-only to a **Voice Hand-Tree Entry** capability: voice narrates whole hands incl. action sequences; one editable hand-tree object; **confirm-by-exception** ("only fix the doubt") layered over a full touch-editable timeline; dual-context (live peek + post-hoc reconstruct). **R2 is superseded/expanded. R1 (Web Speech only, no cloud) REMAINS binding.** R3 ("ship-or-drop, no incremental") is reinterpreted: since the spike was never live-validated, the accuracy + graceful-degradation work now folds INTO validating the expanded capability rather than being a forbidden "5% better" follow-up. The capability MUST write into the **same hand record the live tracker uses** — no parallel hand format (one source of truth). First implementation is an **owner-only sandbox prototype** (Admin/Sandbox → "Voice hand-timeline", `SCREEN.VOICE_TIMELINE_SANDBOX`) that captures real voice transcripts; the **speech→timeline parser is DEFERRED** until real voice data is collected.

**Reasoning:** Owner-directed scope. Builds on the first-principles "build from real data, not guesses" discipline — capturing real transcripts before writing the action grammar avoids tuning against imagined speech. One-source-of-truth keeps the timeline editor and live tracker from forking the hand model. Confirm-by-exception + fix-in-place-over-retry follows the established in-flow-recovery principle (`feedback_error_recovery_in_flow.md`). The owner-only sandbox is the sanctioned pre-Gate home, so this expands scope without shipping user-facing UX prematurely or tripping the design gates.

**Consequences:**
- R2 superseded by this decision; R1 still binding; R3 reframed (accuracy/degradation = the validation, not a banned follow-up). The `voice-card-entry.md` surface remains valid for the cards path; a new Gate-4 surface (`docs/design/surfaces/voice-hand-timeline.md`) covers the timeline editor (authored same session).
- Follow-up: (a) collect real voice data via the sandbox capture tool; (b) build the speech→timeline action parser from those captures; (c) wire the timeline's commit into the real hand record; (d) set numeric kill-criteria for the expanded capability at live validation.
- New owner-only `SCREEN.VOICE_TIMELINE_SANDBOX`; input-layer only, **zero coupling** to exploitEngine/rangeEngine/pokerCore.
- Reversible: sandbox-gated, persists only device-local transcripts, no schema/migration change, writes nothing to real hands yet.

**Load-Bearing Assumptions (AS-N, advisory — impact: medium):**
```yaml
assumptions:
  - id: AS-1
    type: empirical
    claim: "An on-device Web Speech action-sequence parser, tuned on real captured live-table voice data, can reach accuracy high enough that confirm-by-exception correction cost stays below the tap-entry baseline — i.e. R1 (no cloud) is sufficient for the expanded action scope, not just the 17-word card vocabulary."
    falsifies_if:
      threshold: "after building the parser from >=20 real captured hand narrations, per-utterance action accuracy is so low that average correction cost exceeds the current tap-entry baseline (mirrors WS-181 kill-criteria K-a/K-b)"
      window: "first live validation of the expanded capability, or 2026-09-19, whichever first"
    revisit: "2026-09-19"
    status: active
    severity: medium
```

**Market Dynamics:** Not applicable — this decision deliberately avoids any external-actor dependency (R1 keeps recognition on-device via the browser Web Speech API; no cloud STT vendor, no Anthropic/competitor roadmap bet). The only external surface is browser Web Speech availability/quality, watched via the sandbox capture tool; trigger to revisit R1 would be sustained evidence (from real captures) that on-device accuracy cannot clear AS-1.

---

## DEC-022: Live advisor — fold-equity-driven raises require a reliable read; no-model fold-to-raise prior is the canonical population prior (WS-247 / FIND-029)

**Date:** 2026-06-20 | **Status:** Accepted | **Detected:** explicit (owner 2026-06-20 session, ratified via AskUserQuestion)

**Context:** `bestResponseToAggression` (`gameTreeEquity.js`) only computed a raise EV when `heroEquityVsAggroRange >= 0.65`, structurally suppressing every +EV bluff/semi-bluff raise — a raise can be profitable purely through fold equity (POKER_THEORY §5.6), independent of equity-when-called (FIND-029). The fix is to remove the gate and let `Math.max` pick on EV. But a naive removal is unsafe: the no-model default `vFoldToRaise = 0.50` (a magic literal divorced from the codebase's canonical priors) clears the EV comparison for almost any 50%-equity hand, making the live advisor raise-happy against villains we have no read on. The 2026-06-20 gate-removal attempt was reverted for exactly this over-aggression.

**Options Considered:**
1. **Keep the 0.65 equity gate** — rejected: structurally wrong; can never recommend a fold-equity raise vs an over-folder, no matter how favorable the math.
2. **Remove gate + keep the naive 0.50 no-model default** — rejected: over-recommends speculative raises against unread villains (the reverted regression); the live advisor must stay safe.
3. **Remove gate; source the no-model prior from canonical `POPULATION_PRIORS.raise.fold`; gate fold-equity-driven raises on a reliable villain read (CHOSEN, founder-ratified Option 1).**

**Decision:** Three-part fix in `bestResponseToAggression`: (a) compute `raiseEV` **unconditionally** (remove the 0.65 pre-gate); (b) the no-model fallback for `vFoldToRaise` is the canonical `POPULATION_PRIORS.raise.fold` (§7.4 tier-4 single source of truth), not a magic literal — a reliable per-villain model (confidence ≥ `MODEL_CONFIDENCE_THRESHOLD`) overrides it; (c) **safety valve** — decompose the raise: if the called branch is +EV it is a *value raise* and is always recommendable; if the raise profits **only** when villain folds (called branch −EV) it is a *fold-equity exploit*, which per §5.6 **requires evidence the villain over-folds**, so it is suppressed to call/fold unless a reliable model confirms the fold rate. The bluff-vs-value distinction is derived from called-branch EV, not a bucket label (§7.3-clean). Founder ratified the conservative branch ("require a read") via AskUserQuestion.

**Reasoning:** Removes a first-principles violation (a label/threshold suppressing a +EV action) while preventing the over-aggression that got the first attempt reverted. The fold-equity exploit gate is theoretically grounded: §5.6 says over-fold exploits require evidence of over-folding — we have none for an unread villain. Sourcing the no-model prior canonically kills the magic `0.50` and respects §7.4's fidelity hierarchy. The live advisor stays safe for unknown players (value-raises only) yet now correctly fires bluff/semi-bluff raises once a model confirms an over-folder.

**Consequences:**
- Value raises (called branch +EV) now fire whenever EV-best — previously blocked below 0.65 equity. Unread villains get **no** speculative bluff-raises.
- Model-source confidence threshold aligned to `MODEL_CONFIDENCE_THRESHOLD` (0.3); the prior path used 0.25 — minor tightening, now consistent with `hasReliableModel`.
- No-model fold-to-raise is now 0.55 (`POPULATION_PRIORS.raise.fold`, a FOUNDER ESTIMATE per WS-235/FIND-023 provenance, not measured); **WS-235** will ground it empirically. Because fold-equity raises are gated on a model, this prior only affects value-raise sizing/EV for unread villains, limiting its blast radius.
- Updated 4 tests that encoded the old gate (2 in `gameTreeEquity.test.js`, 2 in `gameTreeEvaluator.test.js`); added 3 model-gate scenario tests (over-folder → raise; sticky → no raise; unread thin hand → no raise). Full exploitEngine suite green (2425 tests), build + import preflight clean.
- Reversible: pure engine decision logic, no schema/migration, no UI change.

**Load-Bearing Assumptions (AS-N, advisory — impact: medium):**
```yaml
assumptions:
  - id: AS-1
    type: empirical
    claim: "Gating fold-equity-driven raises on a reliable villain model (conf >= 0.3) plus sourcing the no-model fold-to-raise from POPULATION_PRIORS.raise.fold keeps the live advisor's raise frequency safe — it does not over-recommend raises against unread villains, nor under-recommend profitable bluff/semi-bluff raises against confirmed over-folders."
    falsifies_if:
      threshold: "live validation (or the WS-247 advisor-accuracy suite once grounded) shows the advisor recommends a raise in a fold-equity-driven spot against an unread villain, OR fails to recommend a +EV raise against a modelled over-folder with confidence >= 0.3"
      window: "first live validation of the live action advisor, or 2026-09-20, whichever first"
    revisit: "2026-09-20"
    status: active
    severity: medium
```

**Market Dynamics:** Not applicable — purely internal engine decision-logic calibration; no external-actor dependency.

---

## DEC-023: data-quality program cap recalibrated 3→5 (cap was too tight, not the work excessive)

**Date:** 2026-06-20 | **Status:** Accepted | **Detected:** implicit

**Decision:** Raised `accountability.on_finding.max_open_items` for the data-quality program from 3 to 5 and cleared the active cap-breach stamp.

**Reasoning:** The program sat at 4/3 open items (1.33× breach since 2026-06-19), which floored all its backlog items to priority_floor=18 and floated them above genuinely higher-priority domain-correctness work, distorting `/next` composition. All 4 open items (WS-235/236/237/238) are legitimate, findings-promoted data-integrity tasks on a launch-blocking program — so pruning one to satisfy the cap would have been gaming the metric. The cap of 3 was miscalibrated; 5 gives one slot of headroom and aligns with the sprint `max_items`. Verified: `breached_programs: []`, items returned to natural scores (6–8), domain-correctness work re-anchors `/next`. Reversible.

**Context:** Founder-directed cleanup after the WS-247/244/245 domain-correctness cluster; the cap-breach had been distorting sprint composition all session (the CLI kept auto-anchoring data-quality items).

---

## DEC-024: PIP confidence is a parallel field (not nested into pip deltas); EV/PIP confidence gates (WS-245 / FIND-009, FIND-010)

**Date:** 2026-06-20 | **Status:** Accepted | **Detected:** implicit

**Decision:** (1) Surfaced per-position PIP confidence as a SEPARATE `profile.pipConfidence` map rather than the ticket's specified nested `{ pips, confidence }` per-position shape. (2) `assessEV` returns an `'unknown' / insufficient data` verdict below `MIN_EV_ASSESS_SAMPLE = 10` hands (opt-in via a `sampleSize` arg). (3) Confidence badge tiers at 0.60 (high) / 0.35 (moderate). (4) Relocated `bayesianSampleConfidence` to `pokerCore/betaMath.js`, re-exported from exploitEngine.

**Reasoning:** The nested `{ pips, confidence }` shape would have broken `subActionRules.runPipRules`, which iterates each position's value as plain numeric tier deltas (`Object.values(posPips).reduce(...)`, `posPips.pocketPairs`) — verified before implementing. A parallel map achieves the same display-honesty outcome with zero collateral breakage. The 10-hand gate matches rangeEngine `PRIOR_WEIGHT` (the documented point where observations dominate the population prior). `bayesianSampleConfidence` moved to pokerCore because rangeEngine may not import from exploitEngine (mirrors the existing betaPosterior/betaCDF/betaQuantile re-export pattern).

**Context:** WS-245 (FIND-009 + FIND-010) — confidence-gating display-layer categorical verdicts. Extends the "verify the ticket's data-shape assumption before implementing" discipline.

---

## DEC-025: Derived preflop line taxonomy — subclasses under retained parents, hierarchical shrinkage, version-bump persistence (WS-256)

**Date:** 2026-07-25 | **Status:** Accepted | **Detected:** explicit (founder, ratified via AskUserQuestion 2026-07-25)

**Decision:**
1. **Class list.** Preflop line tags are derived from sequence state into two trees, each keeping its existing action as a **retained parent aggregate** with new subclasses beneath it: `open` → {`openFirstIn`, `isoRaise`}; `threeBet` → {`cold3Bet`, `squeeze`, `limpReraise`}. `limpReraise` takes precedence over `cold3Bet`/`squeeze`. Doctrine recorded in POKER_THEORY §2.5.
2. **`blind3Bet` merged into `cold3Bet`.** The distinguishing factor (posted money) is already carried by the position dimension — ranges are per position × class, so a no-callers-between 3-bet from SB/BB *is* a blind 3-bet. The wider/merged blind shape is expressed as the prior for `SB.cold3Bet` / `BB.cold3Bet`. Straddler 3-bets are a documented residual.
3. **4-bet family and `overCall` deferred** to WS-270 (filed P1 same session at founder direction).
4. **Hierarchical shrinkage.** A subclass shrinks toward its parent in two dimensions — the conditional split `splitPost_sub = (SUBCLASS_PRIOR_WEIGHT · SPLIT[pos][sub] + n_sub) / (SUBCLASS_PRIOR_WEIGHT + n_parent)`, and the grid, which is carved out of the parent's: `ranges[sub][h] = ranges[parent][h] × share_sub(h) × totalShare`. `SUBCLASS_PRIOR_WEIGHT = PRIOR_WEIGHT = 10`. Never an independent flat prior per subclass. *(Amended 2026-07-26 — see Amendment 1 below; the originally-ratified form used a marginal frequency against the scenario-wide `N` and built subclass grids independently.)*
5. **Per-decision-point extraction.** The extractor emits one record per decision, not per hand; a limp-reraise hand emits both `limp` and `limpReraise`.
6. **Persistence.** Bump `PROFILE_VERSION` 3 → 4. No migration — profiles are a derived cache already version-gated at `usePlayerTendencies.js`. Additionally harden `deserializeProfile` against missing action keys.

**Reasoning:** Keeping parents as retained aggregates makes the entire change **additive**: `open`, `threeBet`, `coldCall` and `limp` come out numerically identical to today, so no existing consumer (rangeAccessors, rangeRules, RangeDetailPanel, PlayerAnalysisPanel) changes behavior, and "parents unchanged" becomes a hard snapshot assertion rather than a hope. Merging `blind3Bet` avoids splitting the same observations twice on a dimension the profile already indexes — `SB.cold3Bet` would otherwise be permanently empty. Hierarchical shrinkage is the direct answer to the fragmentation the split creates: it mirrors the `poolBaseline.js` philosophy (§6.5a) so a thin subclass reproduces its parent's behavior and only accumulating evidence pulls it away, which is what stops an n=1 squeeze from manufacturing a confident read. Emitting the limp-reraise hand into **both** trees rather than reclassifying it preserves §5.8 — reclassifying would strip trapped hands out of the limp range and silently manufacture the "limp range is capped" exploit the trait detector exists to suppress. Version-bump-over-migration is available only because the profile is derived, not authored, data.

**Context:** WS-256, design-first gate. Founder doctrine 2026-07-22: *"a cold 3-bet and a 3-bet are different — a cold 3-bet usually indicates a stronger and maybe slightly more polar range than a 3-bet."* WS-254 / WS-255 are the stats-layer twins and should adopt this same taxonomy.

**Consequences:**
- WS-254 / WS-255 now have a ratified taxonomy to land on; divergence between the stats layer and the range layer becomes a detectable drift rather than a design question.
- WS-270 (4-bet tree) inherits `lineTaxonomy.js` and the shrinkage scheme — sequenced after, not beside.
- `SPLIT` ships as a founder estimate. WS-264's HandHQ pass-2 is its empirical grounding path; per the WS-263 precedent these weights should eventually be *measured* from between-player overdispersion.
- Straddler 3-bets classify as plain `cold3Bet` despite having posted money — the one place the merge decision loses information.
- Profile cache invalidates once on upgrade; every villain profile rebuilds from hand history on next load.

**Load-Bearing Assumptions (AS-N, advisory — impact: medium):**
```yaml
assumptions:
  - id: AS-1
    type: empirical
    claim: "The SPLIT[position][subclass] fractions apportioning the parent threeBet posterior across cold3Bet / squeeze / limpReraise (and open across openFirstIn / isoRaise) are a founder estimate that is close enough to the live 1/2 pool's true split that a thin subclass inherits a usable prior. They are informed judgment, not a measured dataset — the same provenance class as FACED_RAISE_FREQUENCIES."
    falsifies_if:
      threshold: "WS-264 HandHQ pass-2 position/open-fold trees measure a subclass split fraction diverging from the founder estimate by >=15 absolute percentage points for any position"
      window: "on WS-264 completion, or 2026-10-25, whichever first"
    revisit: "2026-10-25"
    status: active
    severity: medium
  - id: AS-2
    type: methodological
    claim: "Shrinking a subclass toward its parent's posterior with SUBCLASS_PRIOR_WEIGHT = PRIOR_WEIGHT = 10 against the scenario-wide denominator N keeps a sparse subclass prior-dominated at the founder's real per-villain data volumes. Measured behavior (2026-07-25): the estimate always lies strictly between the parent-derived prior and the raw empirical rate, and is closer to the PRIOR whenever N <= 10 — the crossover falls exactly at N = SUBCLASS_PRIOR_WEIGHT, matching the documented PRIOR_WEIGHT 50/50 semantics in §6.5."
    falsifies_if:
      threshold: "a subclass estimate falls outside the open interval between its parent-derived prior and the raw empirical rate n_sub/N, OR is closer to the empirical rate than to the prior while N <= 10, OR an exploit rule fires off a subclass grid backed by fewer than 3 observations"
      window: "first 3 live sessions after the taxonomy ships, or 2026-09-25, whichever first"
      control_case: "the same villain and position evaluated against the pre-taxonomy parent threeBet grid, which pools all raise-facing-raise observations and is the behavior a zero-observation subclass must reproduce (× its split fraction)"
      pass_criterion: "for every position: a zero-observation subclass reproduces its parent's posterior share; every non-zero subclass estimate lies strictly between the parent-derived prior and n_sub/N; the estimate is prior-dominated for N <= 10; and no exploit rule fires off a subclass grid with fewer than 3 backing observations"
    revisit: "2026-09-25"
    status: active
    severity: medium
```

### Amendment 1 (2026-07-26) — shrinkage must bind the GRID, not just the frequency

**Trigger:** pre-close review of the WS-256 implementation, founder-approved fix same session.

**Defect found.** The ratified scheme in §4 was implemented on the *frequency* scalar only. Each subclass grid was built independently from its own doctrine prior and scaled by a ratio, so nothing bound a child to its parent's grid. Measured at the pure prior, before any observation:

- `limpReraise[QQ] = 1.00` against `threeBet[QQ] = 0.58` — the model claimed the villain limp-reraises QQ more often than they raise-facing-a-raise at all, though limp-reraise is a strict subset.
- `Σ subclasses > parent` in **151 of 169 hands**, directly contradicting §1's ratified "a parent means exactly the union of its subclasses."
- One squeeze in 40 spots inflated the squeeze range ~**4×** (mass 1.82 → 7.30) — the swamping the ticket's design constraint existed to prevent.

**Amendment.**
1. **Split estimated conditionally.** Denominator is `n_parent` (times the parent action actually occurred), not the scenario-wide `N`. A fold is not an opportunity to observe *which kind* of 3-bet happened. One observation now shifts the subclass's share of its parent 23.3% — inside AS-2's 25% band.
2. **Grid carved out of the parent.** `ranges[sub][h] = ranges[parent][h] × share_sub(h) × totalShare`, where `share_sub(h) ∝ splitPost_sub · prior_sub(h)` sums to 1 across siblings. Containment holds by construction and is re-enforced at normalization (`crossRangeConstraints` Pass B) so showdown anchoring cannot break it.
3. **`totalShare = Σ splitPost ≤ 1`**, with the shortfall being the unmodelled 4-bet tree — WS-270's slice, left with the parent. The residual is now derived rather than assumed.
4. **Doctrine priors are propensities, not distributions.** `prior_sub(h)` is used as-is. Normalizing it by its own mass (an intermediate attempt) divides each cell by the range's breadth and penalizes wide ranges everywhere — it made the deliberately uncapped `limpReraise` range *less* likely at AA than the narrow `squeeze` range, inverting §2.5.2.

**Unchanged:** §1's parent-invariance guarantee still holds — parents remain bit-identical to their pre-taxonomy values, asserted by test against an independent reimplementation of the pre-taxonomy rule.

**New consequence — parent priors are narrower than the union of their children.** Containment means a child can only place weight where its parent already has some. The parent priors predate the taxonomy, so a child's doctrine shape is expressed *relative to* the parent's support rather than beyond it: the `squeeze` bluff tail cannot appear at hands the parent `threeBet` prior scores 0, and subclasses end up differing more in *how much* of a hand they claim than in *which* hands. §1 ("parent = union") and §2.5.2 (per-class shapes) are only jointly satisfiable if the parent prior is itself the union of its children's shapes — it currently is not. **Open follow-up:** widen the parent priors to that union, which would change parent grids and so requires re-validating every existing consumer. Deliberately not done here; it would break the parent-invariance guarantee that makes WS-256 additive and safe.

---

### DEC-026: Trap channel refused on evidence, mechanism kept dormant
**Date:** 2026-07-31 | **Status:** Accepted | **Detected:** implicit
**Decision:** WS-303's fourth accept criterion ("a villain who slowplays must still be representable") is recorded as REFUTED BY MEASUREMENT rather than satisfied by tuning. The population default for the check branch is monotone capping. `TRAP_LIFT`/`TRAP_SHARE` are retained but DORMANT — they still produce a representable slowplay below the critical softness `tauFraction < 0.1875 · (span/iqr)`.
**Reasoning:** Before building a per-villain trap channel we asked whether the archetype exists: 347,580 hands, 700 player-site rows. `P(check | strong)` gives χ²/df = 1.005 against 1.859 on a control axis where the same method finds large heterogeneity. The channel would fit noise. Read narrowly — this is ONE axis at a median of TWO observations per player, a weak-power null, and explicitly NOT a finding that archetypes do not exist (the control axis proves the opposite). Keeping the mechanism dormant rather than deleting it means the channel stays buildable the day a separating axis is found. Corroborated from outside the corpus: the RT-108 drift CI flipped 5 drill nodes to `isCapped`, matching lesson text authored months earlier with no sight of the mining.
**Context:** WS-303 / SPR-163. POKER_THEORY §11.7-§11.8.

### DEC-027: Provenance is a property of the row, not the file
**Date:** 2026-07-31 | **Status:** Accepted | **Detected:** implicit
**Decision:** The promoted data-source registry requires a source id to travel with data at its finest grain — the street action — through every join and aggregation. Recorded as the rule that makes the registry enforceable, and adopted as WS-317's acceptance criterion and FSA Phase 1's requirement.
**Reasoning:** File-level provenance evaporates at the first `GROUP BY`. Three things are impossible without row-grain: an aggregate reporting its own source composition; scope-leak detection ("a live claim whose support is 100% online rows" is only *detectable* if the rows carry their origin); and enforcing the registry's existing monotonicity rule, since an illegal trust-tier upgrade cannot be seen unless the chain travels with the row. The repo is about to depend on five structurally different datasets at once, which is the condition that makes this binding rather than tidy.
**Context:** Provenance registry + chain map promoted 2026-07-31; `prog-data-provenance` installed.

### DEC-028: Carrying is not keying
**Date:** 2026-07-31 | **Status:** Accepted | **Detected:** implicit
**Decision:** The canonical situation key separates IDENTITY axes (which decide bucket membership) from CARRIED axes (SPR band, players-remaining, source, pool) that travel with a decision and deliberately do NOT affect bucketing. Source and pool must never enter identity at all.
**Reasoning:** Widening bucket identity re-partitions every historical measurement, so promoting an axis is a change that must be MEASURED (does the finer partition predict better, or merely thin every cell?) rather than a side effect of adding a field. SPR and players-remaining genuinely belong in a spot definition — engine doctrine treats SPR as a first-principles input — but promoting either multiplies bucket count and thins cells. Source/pool are excluded permanently for the opposite reason: a bucket that fragments by evidence origin makes cross-source comparison impossible by construction, which is precisely what the Five-Surface Atlas needs to do.
**Context:** WS-317 / SPR-164. `src/utils/pokerCore/situationKey.js`.

### DEC-029: A measurement artifact states its own admissibility, and the gate obeys it
**Date:** 2026-07-31 | **Status:** Accepted | **Detected:** implicit
**Decision:** Hero-EV reports carry an `admissibility` block computed once (blockers, warnings, clusters, `minClustersForCI`, complete). `gate.c3Passes` is gated on it, `MIN_CLUSTERS_FOR_CI = 30`, and `model-readiness --record --from` REFUSES outright — not overridably — to write an inadmissible report into the scorecard.
**Reasoning:** `c3Passes` was computed from the sign of two confidence intervals and nothing else. The CI is a cluster bootstrap over players, which under-covers badly at small k. An interrupted run with THREE players reported edge +16.72 with CI [7.52, 23.42] and `c3Passes: true` — on the flag that decides whether the founder stops building and starts studying. The same run at 28 players read +1.37. Computing the verdict once and carrying it means no consumer has to ALSO know to check the player count, which is exactly the knowledge that fails to travel. The refusal is deliberately not overridable: the escape hatch that gets used in a hurry is the one that puts an uncertifiable row in front of a founder decision.
**Trade-off:** A bar of 30 blocks rows that might be fine at 25, and the constant is duplicated in `model-readiness.mjs` (which must run when the backtest cannot). Both accepted — the bar is stamped into every artifact so it is visible retroactively, and a test asserts the two copies agree.
**Context:** WS-287 / C3. `scripts/backtest/heroEvReport.mjs`, `scripts/readiness/model-readiness.mjs`.

### DEC-030: Revealed cards never reach the range for the decision being scored, and always reach the player's model afterwards
**Date:** 2026-08-01 | **Status:** Accepted | **Detected:** explicit (founder-ratified)
**Decision:** `holdingKnowledge` separates belief from truth structurally. `revealHolding` writes provenance only; `holdingBelief(h).range` is the SAME object reference before and after a hand is revealed, asserted by test. Truth is reachable only through a separately-named `holdingTruth` call. Feeding a revealed hand forward as evidence that widens that player's model on SUBSEQUENT decisions is not merely permitted, it is the point of the primitive.
**Reasoning:** The founder rejected the initial framing of "never feed back" and was right to. A showdown hand the range put near-zero weight on is not a scoring artifact — it is the observation that FALSIFIES the method for that player: they continue below the equity threshold the model assumes, so they reach the river with a range both wider and weaker than modelled. Their extra no-showdown-value hands mean bluffcatch wider AND bluff wider. What must be forbidden is narrower: using a revealed hand to rewrite THAT hand's own earlier ranges, which is circular — the range would contain the answer and every calibration number would flatter itself. The app also runs live, so a path that CAN read a revealed card is the same family as the omniscient-villain defect §12 that WS-276/307 spent two tickets closing.
**Trade-off:** Retrospective replay analysis cannot show a truth-corrected range without an explicit opt-in call. Accepted — that call is greppable, which is the property that makes the rule enforceable rather than aspirational.
**Context:** WS-292 / SPR-167. `src/utils/holdingKnowledge/`.

### DEC-031: A narrowing declares whether the action actually happened, and counterfactual ranges refuse to be scored
**Date:** 2026-08-01 | **Status:** Accepted | **Detected:** implicit
**Decision:** `narrowHolding` REQUIRES a `basis` of `observed` or `hypothesized` and throws on absence. `holdingTruth` refuses any range carrying a hypothesized step, returning `{refused: true, reason: 'hypothesized'}` rather than a number.
**Reasoning:** `narrowByBoard` was called from two families of site that were textually identical: `gameTreeContext` narrows on an action villain really took, while every narrowing in `gameTreeDepth2` is a counterfactual branch ("suppose villain calls"). Scoring a road not travelled against the hand villain turned up is a CATEGORY ERROR, not a miscalibration — and averaged in, it silently poisons every calibration number. The distinction only became visible because the founder chose to include the depth-2/3 chain in scope rather than defer it. No default is permitted: a default is how the ambiguity returns.
**Trade-off:** Six production call sites gained a required argument. Accepted — provenance additionally makes WS-303's narrowing-count invariant a property of the value (`computeDepth3BarrelEV` returns `maxNarrowingCount`, must be 2), which is strictly stronger than the module-mock spy that guarded it before, and was mutation-tested to confirm it fails on the reintroduced defect.
**Context:** WS-292 / SPR-167. `src/utils/holdingKnowledge/provenance.js`, `gameTreeDepth2.js`, `gameTreeEvaluator.js`.

### DEC-032: The binary coverage metric is degenerate on the shipped engine; the continuous one is the signal
**Date:** 2026-08-01 | **Status:** Accepted | **Detected:** implicit
**Decision:** `covered` (does the range give the true hand ANY weight) is retained but documented as always-true in production. Per-player width fitting must use `logLift` = log(p/u). Recorded in `holdingKnowledge/CLAUDE.md` and `exploitEngine/CLAUDE.md`.
**Reasoning:** The ticket and the founder's framing both spoke of "a showdown hand outside the range". Measurement showed that can no longer happen: WS-302 seeds every preflop cell (`PRIOR_SUPPORT_LAMBDA = 0.8`) and WS-291's floor keeps survivors positive, so corpus coverage is 100.0% in every slice. The mechanism the founder described is intact but its measurable form is CONTINUOUS — the true hand sitting near the floor. Getting the order right matters: narrowing PRESERVES a zero the seed already had, it does not create support, so coverage is a property of the seed first and the narrowing second.
**Context:** WS-292 / SPR-167. Enables WS-321.

### DEC-033: Every comparative claim resolves to a replicable Result Card — the Standard of Record
**Date:** 2026-08-02 | **Status:** Accepted | **Detected:** explicit (founder-directive)
**Decision:** Any artefact making a COMPARATIVE claim about strategy, model quality, or EV must resolve to a Result Card: a registered Surface run against a versioned Deal Book and Field, carrying a full replication manifest (engine SHA, corpus hash, partition, every seed, every load-bearing constant, treatment string, cluster unit, disclaimer-register version). `Declared` becomes a sixth surface class in FSA so Strategy Cards are scored by the EXISTING divergence instrument — no second comparison path. Two instruments, neither authoritative: corpus substitution (real opponents, one-decision horizon) and the population simulator (modelled opponents, full hand); the simulator may emit no total-EV figure until it reproduces the corpus instrument at the one-decision horizon. Shape first, then floor, then workshop — and every shape ships with the measurement that would show it is the wrong shape. Over-capture, but every captured field ships with a reader written at capture time.
**Reasoning:** The project keeps finding that deep faults went unmeasured for long periods — WS-291, a falsified range model on the live recommendation path, survived for the life of the project. The mechanism was never carelessness; it was that nothing forced two numbers onto the same axis, so a wrong number never had to meet a right one. Investigation established this is NOT a new project: FSA already defines a surface as a function from game state to action distribution and registers five, but all five are observed, fitted or imported and none can be DECLARED. Building a standalone tournament harness was rejected because it would create a second definition of what it means for two strategies to differ — the exact failure `decisionGeometry.mjs` warns about. Enforcement is staged behind the instrument (advisory until WS-322 + WS-328 land) because an invariant nothing can check is worse than none, and is the same failure shape as capture with no reader.
**Trade-off:** Twelve work items, four large — a multi-month body of work end to end. Every measurement gains manifest overhead, mitigated by binding comparative claims ONLY (a debug count is not a claim). Required a new program rather than a slot in domain-correctness, which sits at 92 items against a cap of 60 and would have priority-floored anything filed there. Existing published figures are grandfathered — inventoried as conforming / reconstructible / unreconstructible, and only the third class becomes a finding; declaring prior work non-compliant en masse would discredit the standard on day one. The equilibrium pier post stays UNAVAILABLE rather than faked: until a real solver artifact exists the exploitation premium reports "lower post unavailable" instead of substituting published chart strings (FSA Finding F3).
**Naming resolved:** `MDA` retired for the mass-data pool (it already means Market Dynamics Analysis in the governance layer) — canonical is Mass Data Field (MDF), SRC-012/SRC-011. `surface` keeps FSA's meaning in measurement code; the UX meaning stays scoped to `docs/design/surfaces/`. Geometry cells may be named as vocabulary and NEVER branched on as inputs — a geometry name used as a decision input is `if (position === 'EP')` in new clothes.
**Context:** Founder directive 2026-08-02. Full record with load-bearing assumptions (AS-710…AS-713) and market dynamics in `docs/adr/ADR-009-standard-of-record.md`. Program `prog-strategy-of-record`; items WS-322…WS-333. WS-333 is upstream and unblocked.

### DEC-034: View-layout invariants are enforced by a registry-derived guard that scans the entry module only
**Date:** 2026-08-04 | **Status:** Accepted | **Detected:** implicit
**Decision:** `INV-VIEW-SCROLL` (`src/test/viewScrollContainers.test.js`) derives its view list from `viewRegistry.jsx` rather than a hand-maintained list, and checks the view's **entry module only** — not its directory. Views must render through one of three accepted shells (`<FluidView>`, bounded-fluid, or a scaled canvas with an internal scroll region) and must use no unbounded-growth root. The cost of entry-file-only strictness is an explicit `EXEMPT` map; every entry requires a written reason, and the PresessionDrillView exemption is self-verifying (it asserts each of the five mode children still owns a scroll region).
**Reasoning:** The clip bug class had recurred across eight surfaces and shipped `<FluidView>` as a shared shell that kept drifting back, because nothing enforced it — a documented convention with no gate is a suggestion. Deriving from the registry means a newly registered view is covered automatically and cannot opt out by being new; a hand-maintained list would have gone stale the same way the convention did. Scanning the whole view directory was rejected: it would have let a scroll region in an unrelated sibling launder a broken root, and would specifically have masked the OnlineView defect found this session. The guard was mutation-tested (the LessonDetail fix was reverted, the test failed on exactly that shape, then restored) on the principle that a guard which cannot fail proves nothing.
**Trade-off:** Static source analysis, not a rendered-DOM assertion — it proves the shell is present, not that it wraps the correct subtree. Accepted because the alternative (rendering ~24 views with full context/IDB setup) is heavy and flaky, and because the failure mode it guards is structural rather than subtree-specific. Strictness also forces the exemption list to exist and be maintained; that is the intended pressure, not a defect.
**Context:** Founder bug report "some screens are too full but don't scroll". The guard caught a fifth defect (ExtensionPanel) that manual inspection had missed — that fix exists only because the test found it.

### DEC-035: Viewport bounds use `dvh`; `100vh` / `h-screen` is not an accepted height bound
**Date:** 2026-08-04 | **Status:** Accepted | **Detected:** implicit
**Decision:** A view bounds its height with `h-dvh` / `h-[100dvh]` / `height: 100dvh` (or the fixed LAYOUT canvas). `h-screen` (`100vh`) does not satisfy `INV-VIEW-SCROLL`, and `ExtensionPanel` was migrated off it.
**Reasoning:** `index.css` locks `html/body/#root` to `100dvh`. On mobile `100vh` is the LARGE viewport — it excludes dynamic browser chrome — so a `100vh` box overshoots the locked page and pushes the bottom of its own scroll region below the fold. That is the same clipped-content symptom as an unbounded root, just milder and harder to spot. Keeping `h-screen` out of the accepted set means the guard actively pushes views toward the unit that matches the lock instead of tolerating a near-miss.
**Trade-off:** In the Chrome extension side panel the two units are identical, so this is a no-op for `ExtensionPanel`'s primary host and is only load-bearing for its in-app route (`SCREEN.EXTENSION` / `#extension`). Rejecting a unit that is usually harmless will occasionally flag code that is fine in its actual context; the exemption map is the escape hatch.
**Context:** Surfaced by `INV-VIEW-SCROLL` on its first run, not by inspection.

### DEC-036: The game tree evaluates in two phases against two clocks; mandatory work is not budgeted, and model sparsity never gates depth
**Date:** 2026-08-04 | **Status:** Accepted | **Detected:** explicit (WS-334 / SPR-175)
**Context:** `evaluateGameTree` set one 150ms budget and started its clock BEFORE `buildEvaluationContext`, which costs ~390ms. Every depth-2/3 gate is `!isTimeBudgetExceeded()`, so every gate failed on every postflop evaluation for the life of the project — measured zero depth-2/3 calls on three realistic live spots — while `treeMetadata.depth` reported 2 because it was derived from the street. A second, independent blocker (`lowConfidence`) closed the same gates whenever the villain model was population-only, which at a live 9-handed table is most opponents.
**Options Considered:**
1. **Cut context cost to fit inside 150ms** — the original framing. Rejected on measurement: the achievable structural saving had to be spent on ACCURACY instead (the restructured estimator needs ~96 runouts to beat the one it replaces), and full depth-2/3 costs up to 26s regardless, so no context saving could ever have made it fit.
2. **Raise the single budget to ~600ms** — simplest. Rejected: still one clock over mandatory and optional work together, depth-2 still gets only a fragment, and every evaluation gets slower with nothing visible in exchange.
3. **Split the clock and return two results** — CHOSEN.
4. **Delete depth-2 as unreachable dead weight** — off the table by standing founder rule: a null result is only evidence if the instrument is trustworthy, and deleting is the one irreversible move.
**Decision:** `evaluateGameTree` runs in two phases. Phase 1 is mandatory, unbudgeted, and delivers the depth-1 answer via `onFastResult` followed by a real macrotask yield. Phase 2 is depth-2/3 under `refinementBudgetMs` (default 2000), whose clock starts when refinement starts; the awaited return value is the refined result, so existing callers are unchanged. Villain-model sparsity is reported via `modelQuality` and never gates a stage. Per-stage time is CAPPED at `MAX_STAGE_SHARE`, not reserved. Every stage reports `completed | partial | no-candidate | error | gated` plus `weightConsumed`.
**Reasoning:** The old design budgeted two things that are not alike. Context building is MANDATORY — there is no faster path to any answer — so gating it decided nothing except to consume the allowance before the decisions that needed it. Refinement is OPTIONAL, and its omission degrades the answer; that is what a budget is for. Separating them makes the budget mean what it always claimed to mean. Sparsity was dropped as a gate because what depth-2 models is the FUTURE STREET — board, pot geometry, runout distribution — none of which require knowing this villain; a thin read makes the villain-response terms less certain, not the tree wrong. The cap replaced first-come-first-served after measurement showed the first stage taking 82% of the budget and starving the barrel-planning stage behind it.
**Trade-off:** Total time to a COMPLETE answer rises (fast answer ~400ms on the flop, refined up to 2s later), and at 2000ms most stages still return marked partials because full refinement measured up to 26s on a wet flop. The two-phase contract adds a second result the UI must handle, which is a primary-decision-surface change and therefore gated behind design Gates 1 and 4 — so `onFastResult` currently has no production caller, guarded against inertness by a test asserting the phases genuinely diverge. Enabling depth-2 also changed advice (call +26.7%, raise +18.0%, check -11.7% across 8 scenarios; 1 of 8 top-action flips) and surfaced two outputs that look wrong, tracked as WS-361. Assumed device is the Galaxy S22, not the A22 named in CLAUDE.md.

**Consequences — and what this decision deliberately leaves open:**
- **The refined answer reaches no screen yet.** `onFastResult` has no production caller and the depth-2 result is not surfaced separately. Every existing caller silently upgraded from a depth-1 answer to a refined one, because they already `await` the return value; nothing else changed for them. Wiring the second phase is Phase C and is design-gated. The open question is where the refined answer lands — replacing the Z2 recommendation pill, or Z4 with a Z1 signal. Z2's existing `stale-advice` vocabulary and the R-1.2 glance-stability rule point at the latter.
- **Whether depth-2 is BETTER is unmeasured.** `dumpGameTreeEV` shows the advice MOVES; it does not show it improves. That requires both arms on one scale through the WS-273 calibration harness and a Result Card, neither of which exists (WS-334 AC5 stands PARTIAL). AS-1 below is the load-bearing assumption, and WS-361 is where it gets settled — two depth-2 outputs currently disagree with depth-1 in a direction that looks like `E[max(check,bet)]` optimism (WS-295's optimizer's curse) rather than a correction.
- **`refinementBudgetMs = 2000` is a placeholder, not a measurement.** It was chosen on desktop. The target is the Galaxy S22 and no S22 run has been done, so the number that decides how much of the tree the founder actually sees has never been set on the device that will run it.
- **Partials are now the normal case, not the exception.** At 2000ms against a 26s full refinement most stages return `partial` with a `weightConsumed` well below 1. That is reported rather than hidden, which is the point — but any consumer of a depth-2 EV must read `weightConsumed`, because `ran: true` at 3% coverage and at 90% are no longer the same claim.
- **The skip is auditable from a live session.** `treeMetadata.latency` carries per-stage outcome, `blockedBy`, `atMs`, `weightConsumed` and `phase`, and `depthReached` now reports work that happened instead of being derived from the street. The silent degrade that let this survive for the life of the project cannot recur in the same shape.

**Load-Bearing Assumptions (AS-N, advisory — impact: medium):**
```yaml
assumptions:
  - id: AS-1
    type: empirical
    claim: "Depth-2/3 advice is more accurate than depth-1 advice, so making it reachable improves the founder's decisions rather than merely making them slower and more elaborate. The whole value of DEC-036 rests on this and it has never been measured — depth-2 has never run in production."
    falsifies_if:
      threshold: "Depth-1 and depth-2 advice scored on ONE scale through the WS-273 calibration harness, and depth-2 does not beat depth-1 on log-loss/Brier over the same decisions. Also falsified if the two known divergences (an OESD at 3:1 priced at -26.2 EV; AA on A72 IP preferring a check-back) are shown to be artefacts of E[max(check,bet)] optimism rather than corrections."
      window: "By 2026-09-15, via WS-361."
    revisit: "2026-09-15"
    status: proposed
  - id: AS-2
    type: empirical
    claim: "A ~400ms fast answer followed by a refined answer 2s later is usable at a live table, i.e. the founder acts on the fast answer and treats the refined one as confirmation rather than being made to wait or being confused by a changing recommendation."
    falsifies_if:
      threshold: "Founder reports the two-phase update as disruptive at the table, or the refined answer changes the headline recommendation often enough to be untrustworthy (measured: top-action flip rate above ~1 in 8, the rate observed across the dumpGameTreeEV scenario set)."
      window: "First live session using the wired sidebar (Phase C)."
    revisit: "2026-09-15"
    status: proposed
```

### DEC-037: A declared multi-agent engine may never be simulated inline
**Date:** 2026-08-05 | **Status:** Accepted | **Detected:** implicit
**Decision:** When a protocol, engine or command declares an execution method — an `engine:` field, a persona set, a phase structure — it MUST be executed by spawning those agents. Inline single-threaded simulation is prohibited and its output invalid: it may not be stamped as a protocol run, written to `evidence/`, filed as findings, or used to clear a block. A session instruction discouraging agents does not override a declared engine.
**Reasoning:** Context is monotonic within a session. By the time the AI decides to audit something it is already anchored, so an inline "roundtable" is one position wearing six names and the disagreement that IS a roundtable's product cannot occur. The failure is self-concealing — an inline pass agrees with itself, reads as plausible, gets stamped, and resets the staleness clock on work that never happened. Founder: "The agents are you anyway... are you able to change context mid session? no. you hold onto it."
**Context:** This session opened with exactly that substitution, minutes from stamping a 46-day-stale blind_spot protocol. The provenance gate then blocked a later commit on two 2026-07-22 runs with the same defect, now declared `spec_compliant: false`. Rule at `.claude/rules/engine-execution-fidelity.md`.

### DEC-038: A limitation found by analysis is removed by default, not accommodated
**Date:** 2026-08-05 | **Status:** Accepted | **Detected:** implicit
**Decision:** Recommending accommodation — deferral, scope reduction, routing around, a weaker configuration — is the founder's decision, never the AI's. It may be presented as a question with its cost stated; it may not be presented as a recommendation. Structural test: an analysis ending in a NARROWER scope than it started with has failed.
**Reasoning:** The mechanism is measurability bias — preferring what can be cleanly verified, then shrinking the work to fit the instrument rather than building the instrument to fit the work. It wears the costume of rigor: "we cannot trust that number yet" is correct, and "therefore use a configuration that produces a trustworthy number" is the backwards inference from it. Founder: "it is every single session for months, and almost the theme of the repo."
**Context:** Four instances in one session, including recommending the depth-1 arm because it was the only reproducible one. Enforced by two hooks rather than by a document, after the first response to "we need a protocol" was to write a markdown file — the same failure one level up. Rule at `.claude/rules/improvement-default.md`.

### DEC-039: Enforcement lives in hooks, never in `kit/`
**Date:** 2026-08-05 | **Status:** Accepted | **Detected:** implicit
**Decision:** Behavioural enforcement ships as `.claude/hooks/` or `scripts/`, never as an edit to a kit-managed file. `UserPromptSubmit` injects standing rules with a rotating concrete instance; `Stop` blocks on the failure it guards.
**Reasoning:** `kit/` is synced from HomeBase and a local edit is silently reverted by the next `/kit-upgrade`, taking the guard with it and leaving no trace — the lesson `readiness-gate.cjs` already records. And a rule that must be *read* to work has demonstrably not worked here for months. The rotation exists because a fixed banner is invisible by week three, which the same file records.
**Context:** The `problem_class` validator added to `cwos-reconcile.js` this session sits in a kit-managed file and will be reverted — filed as WS-413 rather than fixed in place, since a fleet-wide kit change is the founder's call.

### DEC-040: The context-drag hypothesis is NOT supported for design tasks, as stated
**Date:** 2026-08-05 | **Status:** Accepted | **Detected:** implicit
**Decision:** Record the pre-registered negative unhedged. A three-arm comparison (greenfield / context-laden / max-drag) with criteria and predictions fixed before any arm existed returned greenfield 33.5 vs 24/24 — and BOTH predictions failed, which by the pre-registered rule means the hypothesis is not supported in the form stated.
**Reasoning:** Both failed on the same clause: implementability. Neither failed on novelty or drag markers, and the drag ordering came out monotone on both criteria built to detect it. The refined finding — labelled post-hoc and weaker for it — is that context-ladenness substituted for LOOKING: the max-drag arm reinvented a schema already on disk and running; the greenfield arm read the code. What was falsified is the compensating benefit context was assumed to buy.
**Context:** `docs/context-system-requirements.md` (pre-registration), `docs/context-system-comparison.md` (judgement). Two confounds recorded: the context-laden arm's brief was written by the max-drag arm's author, and the greenfield arm was greenfield only for long-form documents — the harness injected CLAUDE.md, the rules and MEMORY.md before its first action, which it disclosed unprompted.

### DEC-041: The objective is claim ACCURACY, not vocabulary uptake or document size
**Date:** 2026-08-06 | **Status:** Accepted | **Detected:** implicit
**Decision:** The context program's dependent variable is the proportion of load-bearing claims — a `file:line`, a measured quantity, a capability assertion — that survive checking by a fresh-context agent that did not produce them. Vocabulary rate is demoted to secondary and is non-decisional on its own.
**Reasoning:** Founder, 2026-08-06: *"the problem is in your accuracy over the past few weeks, which has many things that could have been prevented with proper context. how is this not in the handoff??"* The crossing artifact `.claude/projects/context-shift-implementation.md` never used the word "accuracy" — verified, zero occurrences in its original body — so every artifact downstream optimised against vocabulary priors instead. A context system could have passed the frozen study with the error rate completely unchanged.
**Context:** WS-424. The instrument, applied to this session's own output by a fresh-context auditor: 85 load-bearing claims, 39 held, 38 refuted, 8 unverifiable — **45.9% survival**, against a ≥95% gate this session had itself written.

### DEC-042: Founder rulings on the context-system build (DF1/DF2/DF3)
**Date:** 2026-08-06 | **Status:** Accepted | **Detected:** explicit
**Decision:** (1) The pre-registered negative binds design-task quality scores only, not discovery-task contamination — so the withholding machinery is built. (2) The 2,000-byte compact-tier contention is refused as a false constraint; the ceiling is re-derived from measurement. (3) The per-task withholding hook is built rather than running the study on static `permissions.deny`.
**Reasoning:** All three chose to remove a limitation rather than accommodate it, per `.claude/rules/improvement-default.md`. The negative result was scoped by its own wording to design tasks, measured by which arm wrote a better design document; the withholding machinery targets discovery contamination, a different population the comparison never tested.
**Context:** `.claude/workstream/queue/WS-424.yaml` `decision_flags`. Ruling (2) carried a debt — a derived ceiling — which was discharged badly; see DEC-043.

### DEC-043: The compact-tier ceiling was made flat — CONTESTED, and rising is probably correct
**Date:** 2026-08-06 | **Status:** Contested — superseded pending rebuild | **Detected:** implicit
**Decision:** The ceiling was first a decaying schedule (8,000 → 2,000 → 400 B by turn index), then replaced with a flat 8,000 B.
**Reasoning, and why it does not hold:** The decay was rejected on two grounds — it rationed the high-value per-turn channel against the low-value session-start load, and it decayed in anti-correlation with need, since the drift being targeted is *mid-session*. The second argument is correct and argues for a **rising** schedule, not a flat one. Flat was chosen and rising was deferred as "the next thing worth testing" — which is exactly the deferral pattern `improvement-default.md` forbids, committed in the design of the hook that injects that rule. Adversarial review also found `turnIndex()` is now dead code: it parses the whole transcript every turn to feed a constant function.
**Context:** `.claude/workstream/evidence/context-shift-preflight.md` §2a. Do not treat flat as settled.

### DEC-044: Withholding is PARTIAL — literal-path reads are enforceable, search is not
**Date:** 2026-08-06 | **Status:** Accepted | **Detected:** implicit
**Decision:** The shipped claim that "nothing in this repo can prevent an agent from reading an excluded file" is false and was amended. The correct capability statement is narrower than the amendment first claimed: **literal-path reads are enforceable; directory search is not; Bash is not soundly enforceable by substring; harness injection is not withholdable at all.**
**Reasoning:** A `PreToolUse` hook with `exit(2)` genuinely blocks a `Read` before the content enters the window — demonstrated by a denied read, including from inside a subagent. But adversarial testing reached the withheld content three ways: `Grep` over the parent directory (zero adversarial intent required), Bash quote-splitting, and base64-decode-pipe. The reason is structural: **the hook gates on declared intent, not on data access** — for any tool that resolves files on its own side, the withheld path never appears in `tool_input`. Closing it requires `PostToolUse` filtering on tool results, which is unbuilt.
**Context:** `.claude/hooks/context-barrier.cjs`, `scripts/context/cwos-context-bundle-validate.cjs` header, `docs/context-bundles.md` §4.3.

### DEC-045: The WS-424 pre-registration is INVALID and must not be used
**Date:** 2026-08-06 | **Status:** Rejected — do not build on it | **Detected:** implicit
**Decision:** `docs/context-shift-prereg.md` is withdrawn as a basis for any decision.
**Reasoning:** Three independent defects, each sufficient. (1) Its stated threshold (0.85 abs / 36% rel) is not reproducible from its own formula and its own frozen inputs, which give 0.767 / 32.6%. (2) The estimand is **not identified**: it compares two consecutive time windows written by one author, and topic mix dominates — one 15-file artifact family created on a single day carries V=7.41 against 2.02 for the rest, so sixteen more such artifacts would fake the entire effect. No sample size fixes this. (3) Its 1,080 "independent" blocks are 388 artifacts on 44 creation days with the top 5 days holding 69.7% of the mass; day-level variance inflation is 9.05×, the true type-I error is 0.557 against a nominal 0.05, and the real MDE is **99%**, not 36%. It rejected WS-424's original gate for being a 108%-MDE "uninterpretable result wearing the costume of rigour" and landed at 99%.
**Context:** The fix that makes any future study honest: randomise the emitter **within period at session level** by seeded coin on the session ID (the hook already has it), and score each artifact at the commit that created it rather than at HEAD.
