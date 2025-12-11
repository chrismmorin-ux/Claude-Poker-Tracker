# TICKET-1.2: Write Semantics Audit

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The persistence layer uses a per-operation transaction model with proper error handling. However, there are concerns around transaction isolation, race conditions in multi-step operations, and inconsistent error recovery patterns. The debounced auto-save mechanism works well for single-client scenarios but has edge cases around rapid state changes.

---

## Write Operation Inventory

### Hands Store Operations

| Function | File | Transaction Type | Atomicity |
|----------|------|------------------|-----------|
| `saveHand` | handsStorage.js:33 | Single add | Atomic |
| `deleteHand` | handsStorage.js:259 | Single delete | Atomic |
| `clearAllHands` | handsStorage.js:292 | Clear store | Atomic |

### Sessions Store Operations

| Function | File | Transaction Type | Atomicity |
|----------|------|------------------|-----------|
| `createSession` | sessionsStorage.js:27 | Single add | Atomic |
| `endSession` | sessionsStorage.js:79 | Read-modify-write | Atomic |
| `setActiveSession` | sessionsStorage.js:175 | Single put | Atomic |
| `clearActiveSession` | sessionsStorage.js:215 | Single delete | Atomic |
| `deleteSession` | sessionsStorage.js:324 | Single delete | Atomic |
| `updateSession` | sessionsStorage.js:359 | Read-modify-write | Atomic |

### Players Store Operations

| Function | File | Transaction Type | Atomicity |
|----------|------|------------------|-----------|
| `createPlayer` | playersStorage.js:24 | Single add | Atomic |
| `updatePlayer` | playersStorage.js:144 | Read-modify-write | Atomic |
| `deletePlayer` | playersStorage.js:200 | Single delete | Atomic |

---

## Transaction Analysis

### Pattern 1: Simple Add (saveHand, createSession, createPlayer)

```javascript
const transaction = db.transaction([STORE_NAME], 'readwrite');
const objectStore = transaction.objectStore(STORE_NAME);
const request = objectStore.add(record);
// ... success/error handlers
transaction.oncomplete = () => db.close();
```

**Findings:**
- Properly uses single transaction per operation
- Correctly closes DB connection on completion
- Error handling returns rejected promise

**Risk:** Low

---

### Pattern 2: Read-Modify-Write (endSession, updateSession, updatePlayer)

```javascript
const transaction = db.transaction([STORE_NAME], 'readwrite');
const objectStore = transaction.objectStore(STORE_NAME);
const getRequest = objectStore.get(id);

getRequest.onsuccess = (event) => {
  const record = event.target.result;
  if (!record) { reject(); return; }

  // Modify record
  record.field = newValue;

  const updateRequest = objectStore.put(record);
  // ... success/error handlers
};
```

**Findings:**
- Get and put happen within SAME transaction (good!)
- IndexedDB guarantees isolation within transaction
- No race condition between get and put

**Risk:** Low (within single tab)

---

### Pattern 3: Cross-Store Operations

**`startNewSession` (useSessionPersistence.js:161)**

```javascript
// Step 1: Create session in DB
const sessionId = await createSession(sessionData);

// Step 2: Set as active session
await setActiveSession(sessionId);

// Step 3: Update reducer state
dispatchSession({ type: SESSION_ACTIONS.START_SESSION, ... });
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| W-1 | High | **Non-atomic multi-step operation** - If step 2 fails, orphan session exists |
| W-2 | Medium | No rollback mechanism - session created but not marked active |
| W-3 | Low | Reducer update not guarded by DB success |

---

**`saveHand` with session linking (handsStorage.js:33)**

```javascript
// Step 1: Get active session
const activeSession = await getActiveSession();
const sessionId = activeSession?.sessionId || null;

// Step 2: Get session hand count (if session exists)
if (sessionId) {
  const existingCount = await getSessionHandCount(sessionId);
  sessionHandNumber = existingCount + 1;
}

// Step 3: Add hand record
const request = objectStore.add(handRecord);
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| W-4 | Medium | **Race condition** - Hand count read before write; concurrent saves get same number |
| W-5 | Low | Session could be deleted between check and save (dangling FK) |

---

## Auto-Save Mechanism (usePersistence.js)

### Flow

```
State change → Clear existing timer → Set 1.5s debounce timer → saveHand()
```

### Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Debounce delay | 1500ms | Prevents rapid consecutive saves |
| Trigger | `[gameState, cardState, playerState, isReady]` | All state dependencies |
| Skip condition | `!isReady || !isInitializedRef.current` | Prevents save during init |

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| W-6 | Medium | **Lost writes** - State changes within 1.5s window overwrite previous |
| W-7 | Low | No "dirty" flag - saves even if state hasn't meaningfully changed |
| W-8 | Info | Saves on every state change, even UI-only changes (selectedPlayers, etc.) |

**Mitigation:** Hand ID is auto-incremented, so each save creates NEW record. This is intentional behavior (history tracking), not data loss.

---

### Session Auto-Save (useSessionPersistence.js)

```
State change → Clear existing timer → Set 1.5s debounce timer → updateSession()
```

**Key Difference:** Sessions use `updateSession()` (PUT) vs hands using `saveHand()` (ADD)

| ID | Severity | Issue |
|----|----------|-------|
| W-9 | Low | Session updates can be lost if browser closes during debounce window |
| W-10 | Info | No offline queue - updates silently fail if DB unavailable |

---

## Error Handling Patterns

### Pattern A: Fail-and-Continue (usePersistence.js)

```javascript
} catch (error) {
  logError('Auto-save failed:', error);
  // Fail silently - app continues working
}
```

**Used by:** Auto-save operations, initialization

**Risk:** Medium - User may not know data wasn't saved

---

### Pattern B: Fail-and-Throw (sessionsStorage.js)

```javascript
} catch (error) {
  logError('Error in createSession:', error);
  throw error;
}
```

**Used by:** Most CRUD operations

**Risk:** Low - Caller must handle error

---

### Pattern C: Fail-and-Return-Default (sessionsStorage.js:getAllSessions)

```javascript
} catch (error) {
  logError('Error in getAllSessions:', error);
  return [];
}
```

**Used by:** Read operations with array returns

**Risk:** Low - Empty array is safe default, but masks errors

---

## Race Condition Analysis

### Scenario 1: Rapid State Changes

```
T=0ms:   User clicks action → State updates
T=10ms:  Another action → State updates, timer reset
T=100ms: Another action → State updates, timer reset
T=1600ms: Debounce fires → Only FINAL state saved
```

**Impact:** Intermediate states are lost. This is BY DESIGN for poker tracker (only final hand state matters).

---

### Scenario 2: Concurrent Tabs (Not Currently Supported)

```
Tab A: saveHand() → sessionHandNumber = 5
Tab B: saveHand() → sessionHandNumber = 5 (same count!)
```

**Impact:** Both tabs would get same `sessionHandNumber`. IndexedDB does NOT coordinate across tabs.

| ID | Severity | Issue |
|----|----------|-------|
| W-11 | Low | No multi-tab coordination (acceptable for single-user app) |

---

### Scenario 3: Session End During Auto-Save

```
T=0ms:   User clicks "End Session"
T=10ms:  endCurrentSession() clears active session
T=100ms: Auto-save timer fires (from earlier state change)
T=110ms: saveHand() links to (now ended) session
```

**Impact:** Hand saved with sessionId of ended session. This is actually CORRECT behavior.

---

## Quota and Storage Limits

### QuotaExceededError Handling (handsStorage.js:80)

```javascript
if (event.target.error.name === 'QuotaExceededError') {
  logError('Storage quota exceeded. Please clear old hands.');
}
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| W-12 | Medium | User not notified of quota error in UI (only logged) |
| W-13 | Low | No automatic cleanup of old hands when quota exceeded |

---

## Recommendations

### Critical (P0)

1. **W-1/W-2: Make startNewSession atomic**
   - Option A: Use single transaction spanning both stores
   - Option B: Implement rollback if setActiveSession fails

### High Priority (P1)

2. **W-4: Fix sessionHandNumber race condition**
   - Use atomic counter in session record, OR
   - Accept duplicate sessionHandNumbers (non-critical for display)

3. **W-12: Surface quota errors to UI**
   - Add toast notification when quota exceeded
   - Prompt user to clear old hands

### Medium Priority (P2)

4. **W-9: Add beforeunload save**
   - Flush pending session updates on tab close
   - Use `navigator.sendBeacon()` for reliability

5. **W-6/W-7: Optimize auto-save triggers**
   - Only save when game-relevant state changes
   - Add dirty flag to skip redundant saves

---

## Transaction Boundaries Summary

| Operation | Stores Touched | Atomic? | Risk |
|-----------|----------------|---------|------|
| Save hand | hands | Yes | Low |
| Start session | sessions, activeSession | **No** | High |
| End session | sessions, activeSession | **No** | Medium |
| Update session | sessions | Yes | Low |
| Create player | players | Yes | Low |
| Update player | players | Yes | Low |

---

## Related Documents

- [TICKET-1.1: Storage Format Analysis](./persistence-storage-schema.md)
- [TICKET-1.3: Read/Hydration Paths](./persistence-read-paths.md)
- [TICKET-1.4: Migration Correctness](./persistence-migrations.md)
