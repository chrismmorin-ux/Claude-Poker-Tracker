---
id: typescript-migration
name: TypeScript Migration (Phase D)
status: pending
priority: medium
created: 2025-12-09
---

# Project: TypeScript Migration (Phase D)

## Overview

Future TypeScript migration queued from the Core System Audit. This project will add compile-time type safety to the codebase through gradual adoption.

**Status:** PENDING - Not for immediate implementation

---

## Quick Start for Future Implementation

1. Read `docs/audits/schema-design.md` for type definitions
2. Read `docs/audits/schema-roadmap.md` for phased approach
3. Follow the phases below in order

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| D.1 | [ ] PENDING | Create Type Definitions |
| D.2 | [ ] PENDING | Add Type Guards |
| D.3 | [ ] PENDING | Gradual File Conversion |

---

## Phase D.1: Create Type Definitions

### Goal
Create TypeScript interfaces for all state shapes.

### Deliverables

**New Directory:** `src/types/`

**Files to Create:**
- `src/types/game.ts` - GameState, Street, Seat, Action, SeatActions
- `src/types/card.ts` - CardState, Rank, Suit, Card, PlayerCards
- `src/types/session.ts` - SessionState, CurrentSession, RebuyTransaction
- `src/types/player.ts` - Player, SeatPlayers, PlayerState
- `src/types/ui.ts` - UIState, ScreenType, ContextMenu
- `src/types/persistence.ts` - HandRecord, SessionRecord, PlayerRecord
- `src/types/index.ts` - Central re-exports

### Reference
See `docs/audits/schema-design.md` for complete interface definitions.

---

## Phase D.2: Add Type Guards

### Goal
Create runtime type guards that work alongside existing validators.

### Deliverables

**New File:** `src/utils/typeGuards.ts`

```typescript
export function isGameState(obj: unknown): obj is GameState { ... }
export function isCardState(obj: unknown): obj is CardState { ... }
export function isCurrentSession(obj: unknown): obj is CurrentSession { ... }
export function isHandRecord(obj: unknown): obj is HandRecord { ... }
```

### Integration Points
- Use in HYDRATE actions for runtime validation
- Use in persistence layer before saves/after loads

---

## Phase D.3: Gradual File Conversion

### Goal
Convert JavaScript files to TypeScript incrementally.

### Conversion Priority

1. **Validators first** (lowest risk)
   - `src/utils/validation.js` → `validation.ts`
   - `src/utils/persistence/validation.js` → `validation.ts`

2. **Reducers second**
   - `src/reducers/gameReducer.js` → `gameReducer.ts`
   - `src/reducers/cardReducer.js` → `cardReducer.ts`
   - `src/reducers/sessionReducer.js` → `sessionReducer.ts`
   - `src/reducers/playerReducer.js` → `playerReducer.ts`
   - `src/reducers/uiReducer.js` → `uiReducer.ts`

3. **Hooks third**
   - `src/hooks/usePersistence.js` → `usePersistence.ts`
   - `src/hooks/useSessionPersistence.js` → `useSessionPersistence.ts`
   - Other hooks as needed

4. **Persistence layer**
   - `src/utils/persistence/*.js` → `*.ts`

---

## Prerequisites

Before starting this project:

1. [ ] Team agreement on TypeScript adoption
2. [ ] Update build configuration for TypeScript
3. [ ] Add `typescript` and `@types/*` dependencies
4. [ ] Configure `tsconfig.json`
5. [ ] Update ESLint for TypeScript

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| D.1 | 2-3 hours |
| D.2 | 1-2 hours |
| D.3 | 4-8 hours |
| **Total** | 7-13 hours |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing code | Gradual conversion, keep `.js` files working |
| Build complexity | Start with `allowJs: true` in tsconfig |
| Team learning curve | Start with simple interfaces, add strict mode later |

---

## Related Documents

- **Schema Design:** `docs/audits/schema-design.md`
- **Implementation Roadmap:** `docs/audits/schema-roadmap.md`
- **Completed Prerequisites:** `docs/projects/audit-fix-implementation.project.md`

---

## Notes

This project is intentionally queued for future implementation. The codebase is currently functional with JavaScript. TypeScript adoption provides:

- Compile-time error detection
- Better IDE support
- Self-documenting code
- Safer refactoring

Consider starting this project when:
- Adding significant new features
- Onboarding new developers
- Preparing for major refactoring
