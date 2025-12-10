# Recent Changes
**Version**: 1.0.6 | **Updated**: 2025-12-09

## v114 (Current) - Context API + State Consolidation
- **Context providers**: GameContext, UIContext, SessionContext, PlayerContext
- **Prop reduction**: TableView 64+ props -> ~30, StatsView 4 -> 1
- **State moved**: View state (showCardSelector, isShowdownViewOpen) from cardReducer to uiReducer
- **Hand display**: Session-based hand numbers (S1-H3 format)

## v113 - Project Continuity + Local Model Workflow
- **Project tracking**: `.claude/projects.json` registry, `/project` commands
- **Local model delegation**: `/route`, `/local-code`, `/local-refactor` commands
- **Hooks**: project-status.cjs, project-update.cjs, docs-sync.cjs
- **Collapsible sidebar**: Stats/History/Sessions/Players navigation

## v112 - CTO Review Improvements
- **Toast notifications**: Replaced all 7 `alert()` calls
- **Error boundaries**: ViewErrorBoundary for graceful recovery
- **Component extraction**: PlayerFilters, PlayerRow, SeatGrid, SessionCard
- **Export/import**: Data backup/restore functionality

## v111 - Player Management
- **Player profiles**: Physical descriptions, style tags, notes, avatar
- **Seat assignments**: Right-click context menu, drag-and-drop
- **Portrait mode**: PlayersView responsive design

## Files Changed Recently
| File | Change | Version |
|------|--------|---------|
| `src/contexts/*.jsx` | Created | v114 |
| `src/reducers/uiReducer.js` | View state added | v114 |
| `.claude/projects.json` | Created | v113 |
| `src/components/ui/Toast.jsx` | Created | v112 |

## Where to Look
- Full changelog: `docs/CHANGELOG.md`
- Version history: `CLAUDE.md` (bottom section)
