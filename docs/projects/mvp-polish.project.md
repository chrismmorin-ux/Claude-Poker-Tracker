---
id: mvp-polish
name: MVP UI Polish Pass
status: pending
priority: P2
created: 2025-12-09
---

# Project: MVP UI Polish Pass

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Final polish pass before declaring MVP complete. Focus on user experience, error messaging, animations, and confirmation dialogs.

**Roadmap Location:** MVP Phase, Sprint M5
**Depends On:** mvp-critical-fixes (must complete first)
**Blocks:** MVP milestone (this is the final MVP task)

---

## Context Files

Files to read before starting work:
- `src/components/ui/Toast.jsx` - Toast notification system
- `src/hooks/useToast.js` - Toast hook
- `src/components/ui/CollapsibleSidebar.jsx` - Sidebar animations
- All view components in `src/components/views/`

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Toast notification review |
| 2 | [ ] | Error message polish |
| 3 | [ ] | UI animations and responsiveness |
| 4 | [ ] | Destructive action confirmations |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: Toast Notification Review <- CURRENT

### Goal
Ensure all user-facing operations have appropriate toast feedback.

### Audit Checklist
Review each view for proper toast usage:

**TableView:**
- [ ] Session start confirmation
- [ ] Next hand confirmation (optional - may be too frequent)
- [ ] Reset confirmation
- [ ] Player assignment confirmation

**SessionsView:**
- [ ] Session end success
- [ ] Rebuy added confirmation
- [ ] Cash-out confirmation
- [ ] Export success/failure
- [ ] Import success/failure

**PlayersView:**
- [ ] Player created success
- [ ] Player updated success
- [ ] Player deleted success
- [ ] Duplicate name error

**HistoryView:**
- [ ] Hand loaded success
- [ ] Hand deleted success
- [ ] All history cleared confirmation

**Settings (if implemented):**
- [ ] Settings saved
- [ ] Data exported
- [ ] Data imported
- [ ] Data cleared

### Verification (Phase 1)
- [ ] All critical operations have toast feedback
- [ ] Toast types are appropriate (success, error, warning, info)
- [ ] No duplicate or excessive toasts
- [ ] Tests pass

---

## Phase 2: Error Message Polish

### Goal
Ensure all error messages are user-friendly and actionable.

### Error Message Guidelines
1. **Be specific** - "Player name already exists" not "Error saving player"
2. **Be actionable** - Tell user what to do next
3. **Be kind** - No technical jargon, no blame

### Audit Checklist
- [ ] Persistence errors have friendly messages
- [ ] Validation errors explain what's wrong
- [ ] Network errors (future) have retry guidance
- [ ] Error boundaries have helpful recovery options

### Files to Review
- [ ] `src/utils/errorHandler.js` - Error code messages
- [ ] All toast calls in hooks
- [ ] ViewErrorBoundary error display

### Verification (Phase 2)
- [ ] Error messages are user-friendly
- [ ] Error messages suggest solutions
- [ ] No technical jargon in user-facing errors
- [ ] Tests pass

---

## Phase 3: UI Animations and Responsiveness

### Goal
Polish UI animations and ensure responsive behavior.

### Animation Checklist
- [ ] Sidebar collapse/expand is smooth
- [ ] View transitions don't feel jarring
- [ ] Toast entry/exit animations work
- [ ] Modal open/close is smooth
- [ ] Card selection has appropriate feedback

### Responsiveness Checklist
- [ ] Test on 1600x720 (target device)
- [ ] Test on 1920x1080 (desktop)
- [ ] Test on 1280x720 (smaller laptop)
- [ ] Test on mobile portrait (should warn about landscape)
- [ ] Dynamic scaling works across sizes

### Files to Review
- [ ] `src/components/ui/CollapsibleSidebar.jsx` - Transition timing
- [ ] `src/components/ui/Toast.jsx` - Animation classes
- [ ] `src/components/ui/ScaledContainer.jsx` - Scaling behavior

### Verification (Phase 3)
- [ ] Animations are smooth (no jank)
- [ ] Transitions feel natural (200-300ms)
- [ ] Responsiveness works at all tested sizes
- [ ] Tests pass

---

## Phase 4: Destructive Action Confirmations

### Goal
Add confirmation dialogs for irreversible actions.

### Actions Requiring Confirmation
- [ ] **Clear All History** - Very destructive
- [ ] **Delete Player** - Moderate impact
- [ ] **End Session** - Important (cash-out changes state)
- [ ] **Reset Hand** - Minor (but could lose progress)
- [ ] **Clear All Data** (Settings) - Maximum destruction

### Confirmation Dialog Approach
Use browser `confirm()` for MVP simplicity. Custom modal in Phase 2 if needed.

### Message Templates
```
Clear All History?
This will permanently delete all [X] saved hands. This cannot be undone.
[Cancel] [Delete All]

Delete Player "[Name]"?
This player will be removed but their recorded actions in hands will remain.
[Cancel] [Delete]

End Session?
This will end your current session. Make sure to enter your cash-out amount first.
[Cancel] [End Session]
```

### Files to Modify
- [ ] Views with destructive actions - Add confirm() calls

### Verification (Phase 4)
- [ ] All destructive actions have confirmation
- [ ] Confirmation messages are clear
- [ ] Cancel actually cancels (no side effects)
- [ ] Tests pass

---

## MVP COMPLETE CHECKPOINT

After all phases complete:
- [ ] All P0+P1 audit issues resolved (mvp-critical-fixes)
- [ ] Settings system functional (settings-system)
- [ ] Error reporting operational (error-reporting)
- [ ] UI polish pass complete (this project)
- [ ] Full test suite passing (2,222+ tests)
- [ ] Manual smoke test of all 7+ views:
  - [ ] TableView
  - [ ] CardSelectorView
  - [ ] ShowdownView
  - [ ] StatsView
  - [ ] HistoryView
  - [ ] SessionsView
  - [ ] PlayersView
  - [ ] SettingsView

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Use browser confirm() for MVP | Faster than custom modal, sufficient for now |
| 2025-12-09 | Focus on feel over features | Polish matters for user satisfaction |

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
  - [ ] docs/CHANGELOG.md (version entry for MVP)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
- [ ] **MVP MILESTONE ACHIEVED**
