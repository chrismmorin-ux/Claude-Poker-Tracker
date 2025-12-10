# Persistence Overview
**Version**: 1.0.6 | **Updated**: 2025-12-09

IndexedDB persistence layer with modular domain-specific storage.
Database: `PokerTrackerDB` v5. Auto-save with 1.5s debounce.

## Module Structure
```
src/utils/persistence/
  database.js       # initDB(), DB constants, logging
  handsStorage.js   # Hand CRUD (saveHand, getAllHands, etc.)
  sessionsStorage.js # Session CRUD (createSession, endSession, etc.)
  playersStorage.js  # Player CRUD (createPlayer, updatePlayer, etc.)
  validation.js      # Schema validation helpers
  index.js          # Central re-export
```

## Object Stores
| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| `hands` | handId (auto) | timestamp, sessionId | Saved poker hands |
| `sessions` | sessionId (auto) | startTime, endTime | Poker sessions |
| `players` | playerId (auto) | name, lastSeenAt | Player profiles |
| `activeSession` | id | - | Single-record current session |

## Key Functions
```js
// Hands
saveHand(gameState, cardState, seatPlayers, sessionId?)
loadHandById(id), getAllHands(), getHandsBySessionId(id)

// Sessions
createSession({venue, gameType, buyIn}), endSession(id, cashOut)
getActiveSession(), setActiveSession(session)

// Players
createPlayer({name, ...}), updatePlayer(id, updates)
getPlayerByName(name)
```

## Hooks
- `usePersistence.js` - Auto-save/restore hands (1.5s debounce)
- `useSessionPersistence.js` - Session lifecycle management
- `usePlayerPersistence.js` - Player CRUD and seat assignments

## Where to Look
- Full persistence API: `src/utils/persistence/index.js`
- Hook implementations: `src/hooks/use*Persistence.js`
