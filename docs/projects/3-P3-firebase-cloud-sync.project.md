---
id: firebase-cloud-sync
name: Firebase Cloud Sync
status: pending
priority: P3
created: 2025-12-09
---

# Project: Firebase Cloud Sync

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Add Firebase-based cloud backup and sync capabilities. Uses anonymous authentication for device-based identification (no user accounts needed).

**Roadmap Location:** Phase 2, Sprint 2.1-2.3
**Depends On:** settings-system, MVP complete
**Blocks:** Can run in parallel with player-tendencies

---

## Context Files

Files to read before starting work:
- `src/utils/persistence/` - Existing IndexedDB patterns
- `src/hooks/usePersistence.js` - Persistence hook patterns
- `src/components/views/SettingsView.jsx` - Where to add backup controls
- Firebase documentation: https://firebase.google.com/docs/firestore

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Firebase setup and storage abstraction |
| 2 | [ ] | Device-based anonymous auth |
| 3 | [ ] | Backup/restore triggers |
| 4 | [ ] | Conflict resolution |
| 5 | [ ] | Multi-device sync |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: Firebase Setup <- CURRENT

### Goal
Set up Firebase project and create storage abstraction layer.

### Firebase Project Setup (Manual Steps)
1. Create Firebase project at console.firebase.google.com
2. Enable Firestore database
3. Enable Anonymous Authentication
4. Add web app configuration
5. Store config in environment variables

### Files to Create
- [ ] `src/utils/firebase/config.js` - Firebase configuration
- [ ] `src/utils/firebase/firestore.js` - Firestore CRUD operations
- [ ] `src/utils/firebase/index.js` - Export layer

### Firestore Collection Structure
```
users/{deviceId}/
  hands/{handId}        - Hand records
  sessions/{sessionId}  - Session records
  players/{playerId}    - Player records
  settings              - Single doc for settings
  metadata              - Sync metadata (lastSync, version)
```

### Dependencies to Add
```bash
npm install firebase
```

### Environment Variables
```
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

### Verification (Phase 1)
- [ ] Firebase initializes without errors
- [ ] Firestore connection works
- [ ] Environment variables load correctly
- [ ] Tests pass (mock Firebase for tests)

---

## Phase 2: Anonymous Authentication

### Goal
Implement device-based authentication using Firebase Anonymous Auth.

### Files to Create
- [ ] `src/utils/firebase/auth.js` - Auth utilities
- [ ] `src/hooks/useFirebaseAuth.js` - Auth hook

### Authentication Flow
1. On app start, check for existing anonymous user
2. If none, sign in anonymously
3. Store device ID (UID from Firebase)
4. Use device ID as user identifier in Firestore

### Device Linking (Future)
For multi-device, users will need to link devices:
- Generate link code on device A
- Enter code on device B
- Both devices now share same user space

### Verification (Phase 2)
- [ ] Anonymous auth works on first load
- [ ] Auth persists across page reloads
- [ ] Device ID is stable
- [ ] Tests pass

---

## Phase 3: Backup/Restore

### Goal
Add manual backup and restore functionality.

### Files to Create
- [ ] `src/hooks/useCloudSync.js` - Cloud sync operations

### Files to Modify
- [ ] `src/components/views/SettingsView.jsx` - Add Backup/Restore section

### Backup Flow
1. User clicks "Backup to Cloud"
2. Collect all local data (hands, sessions, players, settings)
3. Upload to Firestore under device ID
4. Show progress indicator
5. Toast on success/failure

### Restore Flow
1. User clicks "Restore from Cloud"
2. Show warning about overwriting local data
3. Fetch all data from Firestore
4. Replace local IndexedDB data
5. Reload reducers with new data
6. Toast on success/failure

### UI Components
- Backup button with last backup timestamp
- Restore button with warning
- Backup status indicator
- Auto-backup toggle (optional setting)

### Verification (Phase 3)
- [ ] Backup uploads all data
- [ ] Restore downloads all data
- [ ] Restore correctly replaces local data
- [ ] Progress feedback is clear
- [ ] Tests pass

---

## Phase 4: Conflict Resolution

### Goal
Handle conflicts when data differs between local and cloud.

### Conflict Scenarios
1. **Local newer than cloud** - Push local changes
2. **Cloud newer than local** - Pull cloud changes
3. **Both modified** - Last-write-wins or prompt user

### Files to Modify
- [ ] `src/hooks/useCloudSync.js` - Add conflict detection
- [ ] `src/utils/persistence/` - Add lastModified timestamps

### Timestamp Strategy
Add `lastModified` field to all records:
```javascript
{
  ...existingFields,
  lastModified: Date.now(),
  syncVersion: incrementingNumber,
}
```

### Conflict Resolution Strategy (MVP)
1. Compare `lastModified` timestamps
2. Use last-write-wins for MVP
3. Future: Show conflict UI for manual resolution

### Verification (Phase 4)
- [ ] Newer data wins in conflict
- [ ] Timestamps update on every save
- [ ] Sync respects conflict resolution
- [ ] Tests pass

---

## Phase 5: Multi-Device Sync

### Goal
Enable sync across multiple devices.

### Files to Create
- [ ] Device linking UI in Settings

### Multi-Device Flow
1. **Generate Link Code**
   - Device A generates 6-character code
   - Code valid for 5 minutes
   - Code stored in Firestore with Device A's UID

2. **Enter Link Code**
   - Device B enters code
   - Verify code matches active code
   - Link Device B's UID to Device A's data

3. **Sync on Open**
   - When app opens, check for remote changes
   - Apply changes using conflict resolution
   - Upload local changes

### Security Considerations
- Link codes expire after 5 minutes
- Each code single-use
- Users can unlink devices from Settings

### Verification (Phase 5)
- [ ] Link code generation works
- [ ] Device linking works
- [ ] Sync happens on app open
- [ ] Unlink removes access
- [ ] Tests pass

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Firebase over Supabase | Simpler for solo dev, better free tier |
| 2025-12-09 | Anonymous auth | No user accounts needed per user preference |
| 2025-12-09 | Last-write-wins for conflicts | Simple MVP approach, can enhance later |

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
  - [ ] CLAUDE.md (add firebase utilities)
  - [ ] docs/CHANGELOG.md (version entry)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
