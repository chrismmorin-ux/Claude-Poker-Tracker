# ADR-003: Use Context API to Reduce Prop Drilling

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
