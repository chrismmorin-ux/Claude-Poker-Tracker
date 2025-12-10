---
id: settings-system
name: Settings System
status: active
priority: P1
created: 2025-12-09
---

# Project: Settings System

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Create a comprehensive settings system with persistence, allowing users to customize the app experience. This is a prerequisite for error telemetry, cloud sync, and Phase 2 features.

**Roadmap Location:** MVP Phase, Sprint M3
**Depends On:** mvp-critical-fixes (must complete first)
**Blocks:** error-reporting, firebase-cloud-sync

---

## Context Files

Files to read before starting work:
- `src/reducers/` - Existing reducer patterns to follow
- `src/contexts/` - Existing context patterns to follow
- `src/utils/persistence/` - Persistence patterns
- `src/constants/sessionConstants.js` - VENUES, GAME_TYPES to make customizable
- `src/components/views/` - View component patterns

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [x] COMPLETE | Settings infrastructure (reducer, context, persistence) |
| 2 | [x] COMPLETE | SettingsView with basic preferences |
| 3 | [ ] | Venue/game type customization |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: Settings Infrastructure [COMPLETE]

### Goal
Create the foundational settings system: reducer, context, and persistence layer.

### Task Delegation
- [ ] Run `/route <task>` for each subtask
- settingsReducer: Could be `/local-code` with clear spec
- SettingsContext: Could be `/local-code` with clear spec
- Persistence: Claude (integrates with existing system)

### Files to Create
- [ ] `src/reducers/settingsReducer.js` - Settings state management
- [ ] `src/contexts/SettingsContext.jsx` - Settings context provider
- [ ] `src/constants/settingsConstants.js` - Settings action types and defaults

### Files to Modify
- [ ] `src/utils/persistence/index.js` - Add settings persistence
- [ ] `src/PokerTracker.jsx` - Integrate settingsReducer and SettingsContext

### Settings State Shape
```javascript
{
  // Display preferences
  theme: 'dark' | 'light',  // Future: theme support
  cardSize: 'small' | 'medium' | 'large',

  // Game defaults
  defaultVenue: string | null,
  defaultGameType: string | null,

  // Data management
  autoBackupEnabled: boolean,
  backupFrequency: 'daily' | 'weekly' | 'manual',

  // Custom venues and game types
  customVenues: string[],
  customGameTypes: GameType[],

  // Telemetry (future)
  errorReportingEnabled: boolean,
}
```

### Verification (Phase 1)
- [ ] settingsReducer handles all actions correctly
- [ ] SettingsContext provides state and handlers
- [ ] Settings persist to IndexedDB
- [ ] Settings load on app start
- [ ] Tests pass

---

## Phase 2: SettingsView [COMPLETE]

### Goal
Create the SettingsView UI with basic preference controls.

### Files Created
- [x] `src/components/views/SettingsView.jsx` - Settings UI (~320 lines)

### Files Modified
- [x] `src/PokerTracker.jsx` - Import SettingsView, route to it
- [x] `src/components/ui/CollapsibleSidebar.jsx` - Added Settings nav link (done in Phase 1)

### UI Sections Implemented
1. **Display** - Theme toggle (placeholder/disabled), card size selector (functional)
2. **Game Defaults** - Default venue dropdown, default game type dropdown
3. **Custom Venues** - Add/remove custom venues (integrated with Phase 1 context)
4. **Data & About** - Backup frequency (placeholder), error reporting toggle, version info (v114.1), reset to defaults with confirmation

### Verification (Phase 2)
- [x] SettingsView renders correctly
- [x] Settings changes persist (via useSettingsPersistence)
- [x] Navigation works from sidebar
- [x] Custom venue add/remove works
- [x] All 2282 tests pass

---

## Phase 3: Venue/Game Type Customization <- CURRENT

### Goal
Allow users to add/remove custom venues and game types beyond the defaults, and integrate them into SessionForm.

### Files to Modify
- [ ] `src/components/views/SettingsView.jsx` - Add custom game type UI (custom venues already done)
- [ ] `src/components/ui/SessionForm.jsx` - Use `useSettings()` for allVenues, allGameTypes

### Features
- [x] Add custom venue (text input) - DONE in Phase 2
- [x] Remove custom venue (not default venues) - DONE in Phase 2
- [ ] Add custom game type (label + buy-in default)
- [ ] Remove custom game type
- [ ] SessionForm uses combined venue/game type list from settings

### Verification (Phase 3)
- [ ] Custom venues appear in SessionForm dropdown
- [ ] Custom game types appear in SessionForm dropdown
- [ ] Custom items persist across app restart
- [ ] Cannot remove default venues/game types
- [ ] Tests pass

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Separate settings from session state | Settings are app-level, sessions are per-game |
| 2025-12-09 | Start with local persistence only | Cloud sync is Phase 2 |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-09 | Initial | Planning | Created project file from roadmap |
| 2025-12-09 | Phase 1 | Phase 1 | Created settings infrastructure: constants, reducer, context, persistence, tests. DB v5→v6 migration. Added Settings nav to sidebar. All 2282 tests passing. |
| 2025-12-09 | Phase 2 | Phase 2 | Created SettingsView.jsx with full UI: Display, Game Defaults, Custom Venues, Data & About sections. Integrated into PokerTracker routing. All 2282 tests pass. |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing
- [ ] Documentation updated:
  - [ ] CLAUDE.md (add settingsReducer, SettingsContext, SettingsView)
  - [ ] docs/QUICK_REF.md (add settings constants)
  - [ ] docs/CHANGELOG.md (version entry)
  - [ ] docs/STATE_SCHEMAS.md (add settings state shape)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
