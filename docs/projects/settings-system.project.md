---
id: settings-system
name: Settings System
status: pending
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
| 1 | [ ] | Settings infrastructure (reducer, context, persistence) |
| 2 | [ ] | SettingsView with basic preferences |
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

## Phase 1: Settings Infrastructure <- CURRENT

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

## Phase 2: SettingsView

### Goal
Create the SettingsView UI with basic preference controls.

### Files to Create
- [ ] `src/components/views/SettingsView.jsx` - Settings UI

### Files to Modify
- [ ] `src/PokerTracker.jsx` - Add SCREEN.SETTINGS routing
- [ ] `src/constants/gameConstants.js` - Add SCREEN.SETTINGS
- [ ] `src/components/ui/CollapsibleSidebar.jsx` - Add Settings link

### UI Sections
1. **Display** - Theme toggle (placeholder), card size selector
2. **Game Defaults** - Default venue, default stakes
3. **Data** - Export all data, Import data, Clear all data
4. **About** - Version info, feedback link

### Verification (Phase 2)
- [ ] SettingsView renders correctly
- [ ] Settings changes persist
- [ ] Navigation works from sidebar
- [ ] Export/Import/Clear work correctly
- [ ] Tests pass

---

## Phase 3: Venue/Game Type Customization

### Goal
Allow users to add/remove custom venues and game types beyond the defaults.

### Files to Modify
- [ ] `src/components/views/SettingsView.jsx` - Add customization UI
- [ ] `src/constants/sessionConstants.js` - Make VENUES/GAME_TYPES read from settings
- [ ] `src/components/ui/SessionForm.jsx` - Use combined venue/game type list

### Features
- Add custom venue (text input)
- Remove custom venue (not default venues)
- Add custom game type (label + buy-in default)
- Remove custom game type

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
