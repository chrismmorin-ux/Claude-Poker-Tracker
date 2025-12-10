# Recent Changes
**Version**: v116 | **Updated**: 2025-12-10

## v116 (Current) - Error Reporting System
- **Error logging**: localStorage-based error persistence (FIFO 50 entries)
- **Error viewer**: Collapsible log in Settings with expandable details
- **Report Bug**: Copy/download JSON export with privacy-safe data
- **Tests**: 2,310 tests passing (28 new errorLog tests)

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
| `src/utils/errorLog.js` | Created | v116 |
| `src/components/views/SettingsView.jsx` | Error log UI | v116 |
| `src/contexts/SettingsContext.jsx` | Created | v115 |
| `src/contexts/*.jsx` | Created | v114 |

## Where to Look
- Full changelog: `docs/CHANGELOG.md`
- State schemas: `.claude/context/STATE_SCHEMA.md`
