# Recent Changes
**Version**: v117 | **Updated**: 2025-12-10

## v117 (Current) - Architecture Health Phase 5: Migration & Integration
- **Action sequence migration**: IndexedDB v8 auto-converts hands on open
- **actionMigration.js**: migrateHandToSequence(), batchMigrateHands()
- **View updates**: ActionHistoryGrid, HistoryView support dual format
- **Tests**: 30 new tests (22 migration, 8 integration)

## v116 - Error Reporting System
- **Error logging**: localStorage-based error persistence (FIFO 50 entries)
- **Error viewer**: Collapsible log in Settings with expandable details
- **Report Bug**: Copy/download JSON export with privacy-safe data

## v115 - Settings System
- **Settings infrastructure**: settingsConstants, settingsReducer, SettingsContext
- **Persistence**: useSettingsPersistence hook + settingsStorage (IndexedDB v6)
- **SettingsView UI**: Theme, card size, default venue/game type, custom venues
- **DB migration**: v5 → v6 (adds 'settings' store)

## v114 - Context API + State Consolidation
- **Context providers**: GameContext, UIContext, SessionContext, PlayerContext
- **Prop reduction**: TableView 64+ → ~30, StatsView 4 → 1
- **State moved**: View state (showCardSelector, isShowdownViewOpen) to uiReducer
- **Hand display**: Session-based hand numbers (S1-H3 format)

## v113 - Project Continuity + Local Model Workflow
- **Project tracking**: `.claude/projects.json` registry, `/project` commands
- **Local model delegation**: `/route`, `/local-code`, `/local-refactor` commands
- **Hooks**: project-status.cjs, project-update.cjs, docs-sync.cjs
- **Collapsible sidebar**: Stats/History/Sessions/Players navigation

## Files Changed Recently
| File | Change | Version |
|------|--------|---------|
| `src/migrations/actionMigration.js` | Created | v117 |
| `src/utils/persistence/database.js` | v8 migration | v117 |
| `src/components/views/ShowdownView/ActionHistoryGrid.jsx` | Dual format | v117 |
| `src/components/views/HistoryView.jsx` | Sequence count | v117 |
| `src/utils/errorLog.js` | Created | v116 |
| `src/contexts/SettingsContext.jsx` | Created | v115 |

## Where to Look
- Full changelog: `docs/CHANGELOG.md`
- State schemas: `.claude/context/STATE_SCHEMA.md`
