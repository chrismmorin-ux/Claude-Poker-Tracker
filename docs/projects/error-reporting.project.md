---
id: error-reporting
name: Error Reporting System
status: pending
priority: P2
created: 2025-12-09
---

# Project: Error Reporting System

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Add local error logging, a viewer in Settings, and a "Report Bug" feature. This helps debug issues in production without cloud telemetry (cloud telemetry is Phase 2).

**Roadmap Location:** MVP Phase, Sprint M4
**Depends On:** settings-system (must complete first)
**Blocks:** Nothing (MVP polish can run in parallel)

---

## Context Files

Files to read before starting work:
- `src/utils/errorHandler.js` - Existing error handling with E1xx-E4xx codes
- `src/components/ui/ViewErrorBoundary.jsx` - Existing error boundaries
- `src/components/views/SettingsView.jsx` - Where to add error log viewer

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Error boundary logging to local storage |
| 2 | [ ] | Error log viewer in Settings |
| 3 | [ ] | "Report Bug" button with context export |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: Error Boundary Logging <- CURRENT

### Goal
Capture and persist errors caught by error boundaries to local storage for later review.

### Task Delegation
- [ ] Run `/route <task>` for each subtask
- Error logging utility: `/local-code` (simple utility)
- Storage integration: Claude (persistence patterns)

### Files to Create
- [ ] `src/utils/errorLog.js` - Error logging utility

### Files to Modify
- [ ] `src/components/ui/ViewErrorBoundary.jsx` - Log errors on catch
- [ ] `src/utils/errorHandler.js` - Add persistent logging

### Error Log Entry Shape
```javascript
{
  id: string,           // UUID
  timestamp: number,    // Date.now()
  code: string,         // E1xx-E4xx error code
  message: string,      // Error message
  stack: string | null, // Stack trace if available
  context: {            // App state at time of error
    view: string,
    sessionActive: boolean,
    handCount: number,
  },
  userAgent: string,    // Browser info
  appVersion: string,   // App version
}
```

### Storage
- Use localStorage (not IndexedDB) for simplicity
- Maximum 50 entries (FIFO)
- Key: `poker-tracker-error-log`

### Verification (Phase 1)
- [ ] Errors are captured when error boundary triggers
- [ ] Errors persist across page reload
- [ ] Old errors are pruned at 50 limit
- [ ] Tests pass

---

## Phase 2: Error Log Viewer

### Goal
Add an error log viewer in the Settings view so users can see recent errors.

### Files to Modify
- [ ] `src/components/views/SettingsView.jsx` - Add Error Log section

### UI Components
- Collapsible "Error Log" section
- List of recent errors with:
  - Timestamp (relative, e.g., "2 hours ago")
  - Error code and message
  - Expand for full details (stack, context)
- "Clear All Errors" button

### Verification (Phase 2)
- [ ] Error log section appears in Settings
- [ ] Errors display correctly
- [ ] Clear button works
- [ ] Empty state when no errors
- [ ] Tests pass

---

## Phase 3: Report Bug Button

### Goal
Add a "Report Bug" button that exports error context for sharing with support.

### Files to Modify
- [ ] `src/components/views/SettingsView.jsx` - Add Report Bug section

### Features
1. **Report Bug Button** - Generates shareable report
2. **Report Contents:**
   - Recent errors (last 10)
   - App version
   - Browser info
   - Current state summary (no sensitive data)
3. **Export Options:**
   - Copy to clipboard (primary)
   - Download as JSON (secondary)

### Privacy Considerations
- NO player names in export
- NO session financial data
- Only aggregate counts and error info

### Verification (Phase 3)
- [ ] Report Bug button generates report
- [ ] Copy to clipboard works
- [ ] Download works
- [ ] No sensitive data in export
- [ ] Tests pass

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | localStorage over IndexedDB | Simpler for error logs, less critical data |
| 2025-12-09 | 50 error limit | Balance between usefulness and storage |
| 2025-12-09 | No sensitive data in reports | User privacy is paramount |

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
  - [ ] CLAUDE.md (add errorLog utility)
  - [ ] docs/CHANGELOG.md (version entry)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
