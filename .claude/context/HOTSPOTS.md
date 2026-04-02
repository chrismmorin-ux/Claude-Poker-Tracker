# Hotspots - Critical & Fragile Files
**Version**: 1.4.0 | **Updated**: 2026-03-24

Files requiring extra care when modifying. Test thoroughly after changes.

## Critical Files (Breaking Changes Risk)
| File | Risk | Reason |
|------|------|--------|
| `src/reducers/gameReducer.js` | HIGH | Core game state, affects all views |
| `src/utils/persistence/database.js` | HIGH | DB schema migrations (v13), data loss risk |
| `src/utils/persistence/migrations.js` | HIGH | Extracted migration functions (v1-v13), schema evolution |
| `src/hooks/useSessionPersistence.js` | HIGH | Session lifecycle, hydration logic |
| `src/PokerTracker.jsx` | MEDIUM | Main orchestration, context providers |

## Complex Logic (Easy to Break)
| File | Complexity | Notes |
|------|------------|-------|
| `src/hooks/useShowdownCardSelection.js` | HIGH | Auto-advance logic for multi-player cards |
| `src/utils/rangeEngine/bayesianUpdater.js` | HIGH | Bayesian range updates, two independent decision trees |
| `src/utils/rangeEngine/populationPriors.js` | HIGH | Population baselines, hand-strength tier construction |
| `src/utils/exploitEngine/bayesianConfidence.js` | HIGH | Beta-Binomial credible intervals, replaces z-tests |
| `src/utils/exploitEngine/weaknessDetector.js` | HIGH | 11 situational + 5 preflop weakness rules, range equity backed |
| `src/utils/exploitEngine/decisionAccumulator.js` | MEDIUM | 7-dimension situation keys, cross-hand pattern accumulation |
| `src/utils/exploitEngine/generateExploits.js` | MEDIUM | Weakness-exploit linkage, supersedes dedup, briefing enrichment |
| `src/utils/seatUtils.js` | MEDIUM | Blind position calculation with absent seats |
| `src/reducers/sessionReducer.js` | MEDIUM | Rebuy transactions, hydration |
| `src/hooks/useSeatColor.js` | MEDIUM | Complex conditional styling |

## Integration Points (Side Effects)
| File | Affects |
|------|---------|
| `src/contexts/GameContext.jsx` | All views using useGame() |
| `src/contexts/UIContext.jsx` | Navigation, card selector, showdown |
| `src/contexts/AuthContext.jsx` | Login/signup flow, user-scoped data |
| `src/contexts/TendencyContext.jsx` | Player tendencies, exploit generation, weakness detection |
| `src/utils/persistence/index.js` | All storage operations |

## Test Requirements
- **Reducer changes**: Run `npm test` (2,784 tests across 132 files)
- **Persistence changes**: Test with IndexedDB, check migrations
- **Hook changes**: Test in all dependent views
- **Context changes**: Test all context consumers
- **Exploit/Range engine**: Read POKER_THEORY.md + sub-directory CLAUDE.md first

## Modals & Portals
| File | Notes |
|------|-------|
| `src/components/ui/RangeDetailPanel.jsx` | Uses `createPortal(jsx, document.body)` — required to escape scaled/overflow containers in TableView |

## Safe to Modify
- `src/components/ui/*.jsx` - Isolated UI components (RangeGrid, RangeDetailPanel, ExploitBadges, etc.)
- `src/constants/*.js` - Constants (add, don't remove)
- `src/utils/displayUtils.js` - Pure formatting functions

## Where to Look
- Test files: `src/**/__tests__/*.test.js` and `src/**/*.test.js`
- State schemas: `docs/STATE_SCHEMAS.md`
