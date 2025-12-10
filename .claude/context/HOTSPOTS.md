# Hotspots - Critical & Fragile Files
**Version**: 1.0.6 | **Updated**: 2025-12-09

Files requiring extra care when modifying. Test thoroughly after changes.

## Critical Files (Breaking Changes Risk)
| File | Risk | Reason |
|------|------|--------|
| `src/reducers/gameReducer.js` | HIGH | Core game state, affects all views |
| `src/utils/persistence/database.js` | HIGH | DB schema migrations, data loss risk |
| `src/hooks/useSessionPersistence.js` | HIGH | Session lifecycle, hydration logic |
| `src/PokerTracker.jsx` | MEDIUM | Main orchestration, context providers |

## Complex Logic (Easy to Break)
| File | Complexity | Notes |
|------|------------|-------|
| `src/hooks/useShowdownCardSelection.js` | HIGH | Auto-advance logic for multi-player cards |
| `src/utils/seatUtils.js` | MEDIUM | Blind position calculation with absent seats |
| `src/reducers/sessionReducer.js` | MEDIUM | Rebuy transactions, hydration |
| `src/hooks/useSeatColor.js` | MEDIUM | Complex conditional styling |

## Integration Points (Side Effects)
| File | Affects |
|------|---------|
| `src/contexts/GameContext.jsx` | All views using useGame() |
| `src/contexts/UIContext.jsx` | Navigation, card selector, showdown |
| `src/utils/persistence/index.js` | All storage operations |

## Test Requirements
- **Reducer changes**: Run `npm test` (1,617 tests)
- **Persistence changes**: Test with IndexedDB, check migrations
- **Hook changes**: Test in all dependent views
- **Context changes**: Test all context consumers

## Safe to Modify
- `src/components/ui/*.jsx` - Isolated UI components
- `src/constants/*.js` - Constants (add, don't remove)
- `src/utils/displayUtils.js` - Pure formatting functions

## Where to Look
- Test suite: `src/test/*.test.js`
- State schemas: `docs/STATE_SCHEMAS.md`
