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
