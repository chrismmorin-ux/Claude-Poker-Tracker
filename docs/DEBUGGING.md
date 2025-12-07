# Debugging Guide

This document provides a reference for debugging the Poker Tracker application.

## Quick Reference

| Issue | Error Code | Where to Look |
|-------|------------|---------------|
| State corruption | E101-E104 | reducerUtils.js, specific reducer |
| Invalid input | E201-E206 | validation.js, actionValidation.js |
| Database errors | E301-E306 | persistence.js |
| Component crashes | E401-E404 | ErrorBoundary.jsx, specific component |

---

## Error Codes Reference

All error codes follow the pattern `Exxx` where the first digit indicates the category.

### E1xx - State Errors

Errors related to reducer state management and data integrity.

| Code | Constant | Description | Common Causes |
|------|----------|-------------|---------------|
| E101 | `INVALID_STATE` | State shape doesn't match expected structure | Missing field in reducer, wrong action payload |
| E102 | `STATE_CORRUPTION` | State validation failed after reducer action | Reducer mutated state, invalid enum value |
| E103 | `REDUCER_FAILED` | Reducer threw an exception | Null pointer, invalid operation on undefined |
| E104 | `HYDRATION_FAILED` | Failed to restore state from saved data | Corrupted saved data, schema mismatch |

**How to debug:**
1. Check console for `[gameReducer]`, `[cardReducer]`, etc. prefixes
2. Look at the action type and payload logged before the error
3. Compare state against schema in the reducer file

### E2xx - Validation Errors

Errors from input validation and poker rule enforcement.

| Code | Constant | Description | Common Causes |
|------|----------|-------------|---------------|
| E201 | `INVALID_INPUT` | Generic input validation failed | Empty string, wrong type |
| E202 | `INVALID_ACTION` | Poker action not in ACTIONS constant | Typo in action name |
| E203 | `INVALID_SEAT` | Seat number outside 1-9 range | Off-by-one error, parsing issue |
| E204 | `INVALID_CARD` | Card string not valid (e.g., "A♠") | Missing suit, invalid rank |
| E205 | `INVALID_STREET` | Street not in STREETS constant | Wrong string value |
| E206 | `ACTION_SEQUENCE_INVALID` | Illegal poker action sequence | Raise after all-in, check when must call |

**How to debug:**
1. Check `src/utils/validation.js` for input validators
2. Check `src/utils/actionValidation.js` for sequence rules
3. Run tests: `npm test -- validation`

### E3xx - Persistence Errors

Errors from IndexedDB operations.

| Code | Constant | Description | Common Causes |
|------|----------|-------------|---------------|
| E301 | `DB_INIT_FAILED` | IndexedDB failed to open | Browser in private mode, storage disabled |
| E302 | `SAVE_FAILED` | Failed to save hand/session/player | Quota exceeded, transaction aborted |
| E303 | `LOAD_FAILED` | Failed to load data from database | Corrupted data, missing index |
| E304 | `DELETE_FAILED` | Failed to delete record | Record doesn't exist, transaction error |
| E305 | `MIGRATION_FAILED` | Database migration failed | Schema conflict, version mismatch |
| E306 | `QUOTA_EXCEEDED` | Browser storage quota full | Too many saved hands, large avatar images |

**How to debug:**
1. Check browser DevTools > Application > IndexedDB
2. Look for `[Persistence]` prefix in console
3. Check if private browsing mode is enabled
4. Try clearing old data: `clearAllHands()` in console

### E4xx - Component Errors

Errors from React components and hooks.

| Code | Constant | Description | Common Causes |
|------|----------|-------------|---------------|
| E401 | `RENDER_FAILED` | Component failed to render | Null prop access, missing required prop |
| E402 | `HANDLER_FAILED` | Event handler threw exception | Undefined callback, state race condition |
| E403 | `HOOK_FAILED` | Custom hook threw exception | Missing dependency, stale closure |
| E404 | `PROP_INVALID` | PropTypes validation failed | Wrong prop type, missing required prop |

**How to debug:**
1. Check React DevTools for component tree
2. ErrorBoundary catches crashes and shows fallback UI
3. Look for PropTypes warnings in console (development mode)

---

## Logger API

The centralized logger provides consistent output formatting.

```javascript
import { logger, DEBUG } from '../utils/errorHandler';

// Debug level - only logs when DEBUG=true
logger.debug('ModuleName', 'Message', { context });

// Info level - always logs
logger.info('ModuleName', 'Important event');

// Warning level - always logs
logger.warn('ModuleName', 'Recoverable issue');

// Error level - always logs, formats AppError
logger.error('ModuleName', error);

// Action level - compact format for reducer actions
logger.action('gameReducer', 'SET_STREET', 'flop');
```

**Console output format:**
```
[ModuleName] Message { context }
[gameReducer] Action: SET_STREET "flop"
```

---

## Debug Mode

The global debug flag controls verbose logging:

```javascript
// src/utils/errorHandler.js
export const DEBUG = true;  // Set to false for production
```

When `DEBUG = true`:
- All `logger.debug()` calls output to console
- Reducer actions are logged with payloads
- State validation runs after every reducer action
- Schema violations are logged with context

When `DEBUG = false`:
- Only `info`, `warn`, and `error` levels log
- No action logging
- No state validation (better performance)

---

## Common Debugging Scenarios

### "State looks wrong but no error"

1. Check if DEBUG is enabled
2. Look at action log to see what changed state
3. Compare state against schema in reducer file
4. Use React DevTools to inspect component props

### "App crashes on startup"

1. Check ErrorBoundary fallback UI for error info
2. Look for E301/E303 (database issues)
3. Try clearing IndexedDB in DevTools
4. Check for browser compatibility issues

### "Data not saving"

1. Check for E302/E306 errors
2. Verify IndexedDB is working: `getAllHands()` in console
3. Check if debounce delay is preventing save (1.5s)
4. Look for `[Persistence]` logs

### "Old saved hands have wrong format"

The app automatically normalizes old data on load via `normalizeHandRecord()`.
If issues persist:
1. Check `src/migrations/normalizeSeatActions.js`
2. Data is normalized when loaded, not in database
3. Clear history and re-test if migration fails

---

## Testing

Run the test suite to catch issues:

```bash
npm test              # Run all tests
npm test -- validation   # Run specific test file
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Current test coverage:
- `validation.js` - 40 tests
- `actionValidation.js` - 62 tests
- `gameReducer.js` - 31 tests

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/utils/errorHandler.js` | Error codes, AppError class, logger |
| `src/utils/reducerUtils.js` | State validation, reducer wrapper |
| `src/components/ErrorBoundary.jsx` | Catch React component crashes |
| `src/utils/validation.js` | Input validation functions |
| `src/utils/actionValidation.js` | Poker action sequence validation |
| `src/utils/persistence.js` | IndexedDB operations |
| `src/migrations/normalizeSeatActions.js` | Data migration utilities |
