# Codebase Structure Index
**Generated**: 2025-12-10 | **Files**: 219 | **Directories**: 37

## Directory Tree

```
src/
├── PokerTracker.jsx (852 lines) - Main orchestrator
├── ViewRouter.jsx (373 lines) - View switching logic
├── AppProviders.jsx (75 lines) - Context wrapper
├── main.jsx - Entry point
│
├── components/
│   ├── views/ (13 view components)
│   │   ├── CardSelectorView.jsx
│   │   ├── HistoryView.jsx
│   │   ├── LoginView.jsx
│   │   ├── PasswordResetView.jsx
│   │   ├── PlayersView.jsx
│   │   ├── SessionsView/ (6 subcomponents)
│   │   ├── SettingsView/ (5 subcomponents)
│   │   ├── ShowdownView.jsx
│   │   ├── SignupView.jsx
│   │   ├── StatsView.jsx
│   │   └── TableView/ (4 subcomponents)
│   │
│   └── ui/ (20+ UI components)
│       ├── ActionBadge.jsx
│       ├── ActionSequence.jsx
│       ├── CardSlot.jsx
│       ├── CollapsibleSidebar.jsx
│       ├── ConfirmDeleteModal.jsx
│       ├── DiagonalOverlay.jsx
│       ├── PatternBadge.jsx
│       ├── PlayerFilters.jsx
│       ├── PlayerForm/ (6 subcomponents)
│       ├── PlayerRow.jsx
│       ├── PositionBadge.jsx
│       ├── ScaledContainer.jsx
│       ├── SeatGrid.jsx
│       ├── SessionCard.jsx
│       ├── SessionForm.jsx
│       ├── Toast.jsx
│       └── ViewErrorBoundary.jsx
│
├── contexts/ (7 context providers)
│   ├── AuthContext.jsx
│   ├── CardContext.jsx
│   ├── GameContext.jsx
│   ├── PlayerContext.jsx
│   ├── SessionContext.jsx
│   ├── SettingsContext.jsx
│   └── UIContext.jsx
│
├── reducers/ (7 reducers)
│   ├── authReducer.js
│   ├── cardReducer.js
│   ├── gameReducer.js (main state)
│   ├── playerReducer.js
│   ├── sessionReducer.js
│   ├── settingsReducer.js
│   └── uiReducer.js
│
├── hooks/ (14 custom hooks)
│   ├── useActionUtils.js
│   ├── useAppState.js
│   ├── useAuthPersistence.js
│   ├── useCardSelection.js
│   ├── usePersistence.js
│   ├── usePlayerFiltering.js
│   ├── usePlayerPersistence.js
│   ├── useSeatColor.js
│   ├── useSeatUtils.js
│   ├── useSessionPersistence.js
│   ├── useSettingsPersistence.js
│   ├── useShowdownCardSelection.js
│   ├── useShowdownHandlers.js
│   ├── useStateSetters.js
│   └── useToast.js
│
├── constants/ (6 constant files)
│   ├── authConstants.js
│   ├── gameConstants.js (ACTIONS, SCREEN, SEAT_ARRAY)
│   ├── playerConstants.js
│   ├── primitiveActions.js (PRIMITIVE_ACTIONS)
│   ├── sessionConstants.js
│   └── settingsConstants.js
│
└── utils/ (12+ utility files)
    ├── actionUtils.js (getActionDisplayName, getActionColor)
    ├── actionValidation.js
    ├── cardUtils.js
    ├── displayUtils.js
    ├── errorHandler.js
    ├── errorLog.js
    ├── exportUtils.js
    ├── persistence.js (IndexedDB wrapper)
    ├── persistence/ (modular persistence)
    ├── primitiveActionValidation.js
    ├── reducerUtils.js
    ├── seatNavigation.js
    ├── seatUtils.js
    ├── sequenceUtils.js
    └── validation.js
```

## File Count Summary

| Directory | Files | Tests |
|-----------|-------|-------|
| src/components/views | 27 | 15 |
| src/components/ui | 24 | 17 |
| src/contexts | 8 | 0 |
| src/reducers | 7 | 7 |
| src/hooks | 14 | 10 |
| src/constants | 6 | 3 |
| src/utils | 15 | 12 |
| **Total** | **219** | **64** |

## Critical Files (Touch With Care)

| File | Lines | Criticality | Reason |
|------|-------|-------------|--------|
| PokerTracker.jsx | 852 | HIGH | Main state orchestration |
| gameReducer.js | ~250 | HIGH | Core game state |
| persistence.js | ~200 | HIGH | IndexedDB access |
| gameConstants.js | ~150 | MEDIUM | ACTIONS, SCREEN constants |
| ViewRouter.jsx | 373 | MEDIUM | All view routing |

## Test Coverage

- **Total tests**: 2,310
- **Test files**: 64
- **Framework**: Vitest
- **Run**: `npm test`
