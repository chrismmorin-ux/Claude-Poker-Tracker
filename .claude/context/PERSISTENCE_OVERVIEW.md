# Persistence Overview
**Version**: 1.0.7 | **Updated**: 2025-12-10

IndexedDB persistence layer with modular domain-specific storage.
Database: `PokerTrackerDB` v7. Auto-save with 1.5s debounce. Multi-user support via `userId`.

## Module Structure
```
src/utils/persistence/
  database.js       # initDB(), DB constants, GUEST_USER_ID, logging
  handsStorage.js   # Hand CRUD (saveHand, getAllHands, etc.)
  sessionsStorage.js # Session CRUD (createSession, endSession, etc.)
  playersStorage.js  # Player CRUD (createPlayer, updatePlayer, etc.)
  settingsStorage.js # Settings CRUD (getSettings, saveSettings, etc.)
  validation.js      # Schema validation helpers
  index.js          # Central re-export
```

## Object Stores (v7 - Multi-User)
| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| `hands` | handId (auto) | timestamp, sessionId, userId, userId_timestamp | Saved poker hands |
| `sessions` | sessionId (auto) | startTime, endTime, userId, userId_startTime | Poker sessions |
| `players` | playerId (auto) | name, lastSeenAt, userId, userId_name | Player profiles |
| `activeSession` | id (`active_${userId}`) | - | Per-user active session |
| `settings` | id (`settings_${userId}`) | - | Per-user app settings |

## Key Functions (all accept optional `userId`, defaults to 'guest')
```js
// Hands
saveHand(handData, userId?), loadLatestHand(userId?)
getAllHands(userId?), getHandsBySessionId(sessionId)

// Sessions
createSession({venue, gameType, buyIn}, userId?), endSession(id, cashOut)
getActiveSession(userId?), setActiveSession(id, userId?)

// Players
createPlayer({name, ...}, userId?), updatePlayer(id, updates, userId?)
getPlayerByName(name, userId?)

// Settings
getSettings(userId?), saveSettings(settings, userId?)
```

## Hooks (all accept optional `userId` parameter)
- `usePersistence.js` - Auto-save/restore hands (1.5s debounce)
- `useSessionPersistence.js` - Session lifecycle management
- `usePlayerPersistence.js` - Player CRUD and seat assignments
- `useSettingsPersistence.js` - Settings persistence

## Where to Look
- Full persistence API: `src/utils/persistence/index.js`
- Hook implementations: `src/hooks/use*Persistence.js`
