---
last-verified-against-code: 2026-03-23
verified-by: manual
staleness-threshold-days: 60
---

# Persistence Overview
**Version**: 1.2.0 | **Updated**: 2026-03-23

IndexedDB persistence layer with modular domain-specific storage.
Database: `PokerTrackerDB` v13. Auto-save with 1.5s debounce. Multi-user support via `userId`.

## Module Structure
```
src/utils/persistence/
  database.js            # initDB(), DB constants, GUEST_USER_ID, logging
  handsStorage.js        # Hand CRUD (saveHand, getAllHands, etc.)
  sessionsStorage.js     # Session CRUD (createSession, endSession, etc.)
  playersStorage.js      # Player CRUD (createPlayer, updatePlayer, etc.)
  settingsStorage.js     # Settings CRUD (getSettings, saveSettings, etc.)
  rangeProfilesStorage.js # Range profile CRUD (saveRangeProfile, getRangeProfile, etc.)
  tournamentsStorage.js  # Tournament CRUD (saveTournament, getTournament, etc.)
  validation.js          # Schema validation helpers
  index.js               # Central re-export
```

## Object Stores (v13)
| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| `hands` | handId (auto) | timestamp, sessionId, userId, userId_timestamp, source | Saved poker hands |
| `sessions` | sessionId (auto) | startTime, endTime, userId, userId_startTime, source, tableId | Poker sessions |
| `players` | playerId (auto) | name, lastSeenAt, userId, userId_name | Player profiles |
| `activeSession` | id (`active_${userId}`) | - | Per-user active session |
| `settings` | id (`settings_${userId}`) | - | Per-user app settings |
| `rangeProfiles` | profileKey | playerId, userId | Bayesian range estimation profiles |
| `tournaments` | tournamentId (auto) | sessionId, userId | Tournament state persistence |

## Migration History
| Version | Changes |
|---------|---------|
| v1-v5 | Initial stores (hands, sessions, activeSession, players, settings) |
| v6→v7 | Added userId to all stores for multi-user data isolation. Settings/activeSession changed from singleton to per-user keying. |
| v7→v8 | Added actionSequence field to hands for ordered action storage. Converts existing seatActions to actionSequence on migration. |
| v8→v9 | Added rangeProfiles store (keyPath: profileKey, indexes: playerId, userId) for Bayesian range estimation caching. |
| v9→v10 | Added exploitBriefings[] and dismissedBriefingIds[] to player records. |
| v10→v11 | Added tournaments object store for tournament state persistence. |
| v11→v12 | Added source index to hands, source/tableId indexes to sessions for online play integration. |
| v12→v13 | Normalize seatActions strings to arrays in-place (one-time migration, replaces per-load normalization). |

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

// Range Profiles
saveRangeProfile(profile, userId?), getRangeProfile(profileKey)
getAllRangeProfiles(userId?)
```

## Hooks (all accept optional `userId` parameter)
- `usePersistence.js` - Auto-save/restore hands (1.5s debounce)
- `useSessionPersistence.js` - Session lifecycle management
- `usePlayerPersistence.js` - Player CRUD and seat assignments
- `useSettingsPersistence.js` - Settings persistence
- `useAuthPersistence.js` - Firebase auth state listener

## Where to Look
- Full persistence API: `src/utils/persistence/index.js`
- Hook implementations: `src/hooks/use*Persistence.js`
