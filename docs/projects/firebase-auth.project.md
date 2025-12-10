---
id: firebase-auth
name: Firebase Authentication System
status: pending
priority: P2
created: 2025-12-10
---

# Project: Firebase Authentication System

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `← CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Add optional Firebase Authentication to Poker Tracker with:
- Email/Password + Google OAuth sign-in
- Guest mode preserved (app works without login)
- Account management in SettingsView
- Data isolation by userId in IndexedDB

**User Requirements:**
- Backend: Firebase Auth
- Mode: Optional (guest mode preserved)
- Methods: Email/Password + Google OAuth
- Account UI: Section in existing SettingsView

---

## Context Files

Files to read before starting work:
- `src/contexts/SettingsContext.jsx` - Pattern for new AuthContext
- `src/reducers/settingsReducer.js` - Pattern for authReducer
- `src/hooks/useSettingsPersistence.js` - Pattern for useAuthPersistence
- `src/components/views/SettingsView.jsx` - Where Account section goes
- `src/PokerTracker.jsx` - Main integration point (context wrapper lines 620-634)
- `src/utils/persistence/database.js` - DB migration pattern

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [x] | Firebase Infrastructure Setup |
| 2 | [x] | Auth State Management (Reducer + Context) |
| 3 | [x] | Authentication Views (Login, Signup, Reset) |
| 4 | [ ] | Account Management in Settings |
| 5 | [ ] | Data Isolation (userId in IndexedDB) |
| 6 | [ ] | Integration & Testing |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: Firebase Infrastructure Setup [x] COMPLETE

### Goal
Set up Firebase project, install SDK, and configure environment variables.

### Task Delegation Analysis

| Task | Complexity | Local Model? | Reason |
|------|------------|--------------|--------|
| Create Firebase project | Manual | No | Requires Firebase Console |
| Install firebase package | Simple | No | Single npm command |
| Create firebase.js config | Template | **Yes** | Boilerplate code |
| Create .env.example | Template | **Yes** | Simple key listing |
| Update .gitignore | Trivial | **Yes** | Add one line |

### Step 1.1: Create Firebase Project (Manual)
**Owner: Human (Firebase Console)**

1. Go to https://console.firebase.google.com/
2. Click "Create a project" → Name: "poker-tracker"
3. Disable Google Analytics (not needed)
4. Wait for project creation

### Step 1.2: Enable Auth Providers (Manual)
**Owner: Human (Firebase Console)**

1. In Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password" provider
3. Enable "Google" provider
   - Set project support email
   - Save

### Step 1.3: Get Firebase Config (Manual)
**Owner: Human (Firebase Console)**

1. Project Settings → General → Your apps
2. Click web icon `</>` to add web app
3. Register app name: "poker-tracker-web"
4. Copy the `firebaseConfig` object values

### Step 1.4: Install Firebase SDK
**Owner: Claude**

```bash
npm install firebase
```

### Step 1.5: Create Firebase Config File
**Owner: Local Model** (`/local-code`)

**File:** `src/config/firebase.js`
**Spec:**
```javascript
// Firebase initialization module
// - Import firebase/app and firebase/auth
// - Read config from import.meta.env (Vite env vars)
// - Initialize app only if not already initialized
// - Export auth instance
// - Export provider instances for Google OAuth

// Expected exports:
// - auth: Firebase Auth instance
// - googleProvider: GoogleAuthProvider instance

// Environment variables used:
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
// VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
// VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
```

**Constraints:**
- ~40 lines
- No external dependencies beyond firebase
- Handle case where Firebase already initialized
- Use Vite's import.meta.env for config

### Step 1.6: Create Environment Template
**Owner: Local Model** (`/local-doc`)

**File:** `.env.example`
**Content:**
```
# Firebase Configuration
# Copy this file to .env.local and fill in your values
# Get these from Firebase Console > Project Settings > Your apps

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Step 1.7: Update .gitignore
**Owner: Local Model** (`/local-refactor`)

**File:** `.gitignore`
**Change:** Ensure `.env.local` is in the gitignore (verify, add if missing)

### Files to Create
- [ ] `src/config/firebase.js` - Firebase initialization (owner: local)
- [ ] `.env.example` - Environment template (owner: local)
- [ ] `.env.local` - Actual config values (owner: human, gitignored)

### Files to Modify
- [ ] `package.json` - Add firebase dependency (owner: Claude)
- [ ] `.gitignore` - Ensure .env.local ignored (owner: local)

### Verification
- [ ] `npm install` completes without errors
- [ ] Firebase imports work: `import { auth } from './config/firebase'`
- [ ] `.env.local` is gitignored (doesn't show in `git status`)
- [ ] No API keys in committed code

---

## Phase 2: Auth State Management [x] COMPLETE

### Goal
Create authReducer, AuthContext, and useAuthPersistence hook following existing patterns.

### Task Delegation Analysis

| Task | Complexity | Local Model? | Reason |
|------|------------|--------------|--------|
| Create authConstants.js | Template | **Yes** | Simple constant definitions |
| Create authReducer.js | Medium | **Yes** | Follow settingsReducer pattern |
| Create authReducer tests | Medium | **Yes** | Follow existing test patterns |
| Create AuthContext.jsx | Complex | No | Firebase integration, multiple handlers |
| Create useAuthPersistence.js | Complex | No | Firebase onAuthStateChanged, state sync |
| Update contexts/index.js | Trivial | **Yes** | Add export line |

### Step 2.1: Create Auth Constants
**Owner: Local Model** (`/local-code`)

**File:** `src/constants/authConstants.js`
**Spec:**
```javascript
// AUTH_ACTIONS - Reducer action types
// SET_USER, SET_LOADING, SET_ERROR, CLEAR_ERROR, SET_INITIALIZED

// AUTH_PROVIDERS - Provider identifiers
// EMAIL: 'password', GOOGLE: 'google.com'

// AUTH_ERRORS - Firebase error code to user message mapping
// Map common Firebase auth errors to friendly messages
// 'auth/email-already-in-use' → 'This email is already registered'
// 'auth/invalid-email' → 'Invalid email address'
// 'auth/weak-password' → 'Password must be at least 6 characters'
// 'auth/user-not-found' → 'No account found with this email'
// 'auth/wrong-password' → 'Incorrect password'
// 'auth/too-many-requests' → 'Too many attempts. Please try again later'
// 'auth/network-request-failed' → 'Network error. Check your connection'

// getAuthErrorMessage(errorCode) - Helper function to get friendly message
```

**Constraints:**
- ~60 lines
- Export all constants
- Include helper function for error messages

### Step 2.2: Create Auth Reducer
**Owner: Local Model** (`/local-code`)

**File:** `src/reducers/authReducer.js`
**Pattern:** Follow `src/reducers/settingsReducer.js`
**Spec:**
```javascript
// State shape:
// {
//   user: null | { uid, email, displayName, photoURL, providerData },
//   isLoading: true,
//   isInitialized: false,
//   error: null
// }

// Actions:
// SET_USER - Set user object (or null for guest)
// SET_LOADING - Set loading state
// SET_ERROR - Set error message
// CLEAR_ERROR - Clear error
// SET_INITIALIZED - Mark auth as initialized

// Use createValidatedReducer wrapper like other reducers
// Include AUTH_STATE_SCHEMA for validation
```

**Constraints:**
- ~100 lines
- Follow createValidatedReducer pattern
- Include state schema
- Export initialAuthState, authReducer, AUTH_STATE_SCHEMA

### Step 2.3: Create Auth Reducer Tests
**Owner: Local Model** (`/local-test`)

**File:** `src/reducers/__tests__/authReducer.test.js`
**Pattern:** Follow `src/reducers/__tests__/settingsReducer.test.js`
**Spec:**
- Test each action type
- Test initial state
- Test state validation
- Test error handling
- ~150 lines, 15+ test cases

### Step 2.4: Create Auth Context
**Owner: Claude** (Complex Firebase integration)

**File:** `src/contexts/AuthContext.jsx`
**Spec:**
```javascript
// Provides:
// - user, isLoading, isInitialized, error (from reducer)
// - isGuest (derived: user === null && isInitialized)
// - isAuthenticated (derived: user !== null)
// - dispatchAuth

// Handlers (all async, use try/catch, dispatch errors):
// - signInWithEmail(email, password)
// - signUpWithEmail(email, password)
// - signInWithGoogle()
// - signOut()
// - resetPassword(email)
// - updatePassword(newPassword)
// - deleteAccount()
// - clearError()

// Pattern: Follow SettingsContext.jsx structure
```

### Step 2.5: Create useAuthPersistence Hook
**Owner: Claude** (Complex Firebase integration)

**File:** `src/hooks/useAuthPersistence.js`
**Spec:**
```javascript
// Initialize Firebase Auth listener on mount
// Subscribe to onAuthStateChanged
// Dispatch SET_USER when auth state changes
// Dispatch SET_INITIALIZED after first auth check
// Handle loading states
// Clean up listener on unmount

// Returns: { isReady } to signal when auth is initialized
```

### Step 2.6: Update Contexts Index
**Owner: Local Model** (`/local-refactor`)

**File:** `src/contexts/index.js`
**Change:** Add export line:
```javascript
export { AuthProvider, useAuth } from './AuthContext';
```

### Files to Create
- [ ] `src/constants/authConstants.js` (owner: local)
- [ ] `src/reducers/authReducer.js` (owner: local)
- [ ] `src/reducers/__tests__/authReducer.test.js` (owner: local)
- [ ] `src/contexts/AuthContext.jsx` (owner: Claude)
- [ ] `src/hooks/useAuthPersistence.js` (owner: Claude)

### Files to Modify
- [ ] `src/contexts/index.js` (owner: local)

### Verification
- [ ] All authReducer tests pass
- [ ] AuthContext exports correctly from contexts/index.js
- [ ] `npm test` passes (all 2310+ tests)

---

## Phase 3: Authentication Views [x] COMPLETE

### Goal
Create Login, Signup, and Password Reset views with Google OAuth support.

### Task Delegation Analysis

| Task | Complexity | Local Model? | Reason |
|------|------------|--------------|--------|
| Update SCREEN constants | Trivial | **Yes** | Add 3 constants |
| Create GoogleSignInButton | Simple | **Yes** | Pure UI component |
| Create AuthLoadingScreen | Simple | **Yes** | Pure UI component |
| Create LoginView | Complex | No | Form logic, auth handlers, navigation |
| Create SignupView | Complex | No | Form logic, validation, auth handlers |
| Create PasswordResetView | Medium | **Yes** | Simpler form, single action |
| Add view routing | Medium | No | Integration in PokerTracker.jsx |

### Step 3.1: Update SCREEN Constants
**Owner: Local Model** (`/local-refactor`)

**File:** `src/reducers/uiReducer.js`
**Change:** Add to SCREEN constant:
```javascript
LOGIN: 'login',
SIGNUP: 'signup',
PASSWORD_RESET: 'passwordReset',
```

### Step 3.2: Create Google Sign-In Button
**Owner: Local Model** (`/local-code`)

**File:** `src/components/ui/GoogleSignInButton.jsx`
**Spec:**
```javascript
// Props: onClick, disabled, isLoading
// Display Google logo (SVG inline or from lucide-react)
// Text: "Continue with Google"
// Styling: White background, gray border, matches app style
// Loading state: Show spinner, disable button
// ~50 lines
```

### Step 3.3: Create Auth Loading Screen
**Owner: Local Model** (`/local-code`)

**File:** `src/components/ui/AuthLoadingScreen.jsx`
**Spec:**
```javascript
// Full-screen loading indicator
// Dark background (bg-gray-900)
// Centered spinner
// "Loading..." text
// Used while Firebase Auth initializes
// ~40 lines
```

### Step 3.4: Create Login View
**Owner: Claude** (Complex form logic)

**File:** `src/components/views/LoginView.jsx`
**Spec:**
```javascript
// Layout:
// - Centered card on dark background
// - App logo/title at top
// - Email input
// - Password input
// - "Sign In" button
// - GoogleSignInButton
// - "Continue as Guest" button
// - Links: "Create account" → SIGNUP, "Forgot password?" → PASSWORD_RESET
// - Error display area

// Features:
// - Form validation (email format, password not empty)
// - Loading states during auth
// - Error handling with toast notifications
// - Wrap in ViewErrorBoundary

// Props: scale (for ScaledContainer)
// Uses: useAuth(), useUI() for navigation
// ~300 lines
```

### Step 3.5: Create Signup View
**Owner: Claude** (Complex form logic)

**File:** `src/components/views/SignupView.jsx`
**Spec:**
```javascript
// Layout:
// - Centered card on dark background
// - "Create Account" title
// - Email input
// - Password input
// - Confirm password input
// - Password requirements text
// - "Create Account" button
// - GoogleSignInButton
// - Link: "Already have an account? Sign in" → LOGIN

// Features:
// - Validate email format
// - Validate password >= 6 chars
// - Validate passwords match
// - Loading states
// - Error handling

// ~250 lines
```

### Step 3.6: Create Password Reset View
**Owner: Local Model** (`/local-code`)

**File:** `src/components/views/PasswordResetView.jsx`
**Spec:**
```javascript
// Layout:
// - Centered card
// - "Reset Password" title
// - Email input
// - "Send Reset Email" button
// - Success message after send
// - Link: "Back to Sign In" → LOGIN

// Features:
// - Email validation
// - Loading state
// - Success/error messages
// - Uses useAuth().resetPassword()

// ~150 lines
```

### Step 3.7: Add View Routing
**Owner: Claude** (Integration)

**File:** `src/PokerTracker.jsx`
**Changes:**
- Import auth views
- Add auth view rendering in view switch logic
- Handle auth loading state (show AuthLoadingScreen)

### Files to Create
- [ ] `src/components/ui/GoogleSignInButton.jsx` (owner: local)
- [ ] `src/components/ui/AuthLoadingScreen.jsx` (owner: local)
- [ ] `src/components/views/LoginView.jsx` (owner: Claude)
- [ ] `src/components/views/SignupView.jsx` (owner: Claude)
- [ ] `src/components/views/PasswordResetView.jsx` (owner: local)

### Files to Modify
- [ ] `src/reducers/uiReducer.js` (owner: local)
- [ ] `src/PokerTracker.jsx` (owner: Claude)

### Verification
- [ ] Can navigate to Login view
- [ ] Can navigate to Signup view
- [ ] Can navigate to Password Reset view
- [ ] Google button renders correctly
- [ ] Loading screen shows during auth init
- [ ] `npm test` passes

---

## Phase 4: Account Management in Settings ← CURRENT

### Goal
Add Account section to SettingsView for profile display, password change, and logout.

### Task Delegation Analysis

| Task | Complexity | Local Model? | Reason |
|------|------------|--------------|--------|
| Create AccountSection component | Complex | No | Multiple auth handlers, conditional UI |
| Create ConfirmDeleteModal | Medium | **Yes** | Simple modal UI |
| Update SettingsView | Medium | No | Integration with auth context |

### Step 4.1: Create Confirm Delete Modal
**Owner: Local Model** (`/local-code`)

**File:** `src/components/ui/ConfirmDeleteModal.jsx`
**Spec:**
```javascript
// Props: isOpen, onConfirm, onCancel, title, message, confirmText
// Modal overlay with centered card
// Warning icon
// Title and message
// Cancel and Confirm (red) buttons
// ~80 lines
```

### Step 4.2: Create Account Section Component
**Owner: Claude** (Complex auth integration)

**File:** `src/components/ui/AccountSection.jsx`
**Spec:**
```javascript
// For Guests (isGuest === true):
// - "Sign in to sync your data across devices" message
// - "Sign In" button → navigate to LOGIN
// - "Create Account" button → navigate to SIGNUP

// For Authenticated Users:
// - User email display
// - Auth provider badge (Email, Google, or Both)
// - "Change Password" button (only for email provider)
// - "Sign Out" button
// - "Delete Account" button (shows ConfirmDeleteModal)

// Features:
// - Password change inline form (current + new password)
// - Loading states for all actions
// - Toast notifications for success/error

// ~200 lines
```

### Step 4.3: Update Settings View
**Owner: Claude** (Integration)

**File:** `src/components/views/SettingsView.jsx`
**Changes:**
- Import AccountSection and useAuth
- Add Account section at top of settings grid
- Pass navigation handler to AccountSection

### Files to Create
- [ ] `src/components/ui/ConfirmDeleteModal.jsx` (owner: local)
- [ ] `src/components/ui/AccountSection.jsx` (owner: Claude)

### Files to Modify
- [ ] `src/components/views/SettingsView.jsx` (owner: Claude)

### Verification
- [ ] Guest sees sign-in/create account options
- [ ] Authenticated user sees profile info
- [ ] Password change works (email users)
- [ ] Sign out works
- [ ] Delete account shows confirmation
- [ ] `npm test` passes

---

## Phase 5: Data Isolation (userId in IndexedDB)

### Goal
Add userId field to all IndexedDB records for data isolation between users.

### Task Delegation Analysis

| Task | Complexity | Local Model? | Reason |
|------|------------|--------------|--------|
| Update database.js (DB v7) | Medium | No | Migration logic is complex |
| Update handsStorage.js | Medium | **Yes** | Add userId parameter pattern |
| Update sessionsStorage.js | Medium | **Yes** | Add userId parameter pattern |
| Update playersStorage.js | Medium | **Yes** | Add userId parameter pattern |
| Create migration.js | Medium | **Yes** | Simple data update function |
| Create DataMigrationModal | Medium | **Yes** | Simple modal UI |
| Update persistence hooks | Complex | No | Integration across multiple hooks |

### Step 5.1: Update Database Schema (v7)
**Owner: Claude** (Complex migration)

**File:** `src/utils/persistence/database.js`
**Changes:**
- Increment DB version to 7
- Add userId index to hands, sessions, players stores
- Migration: Add userId field to existing records (default: 'guest')

### Step 5.2: Update Hands Storage
**Owner: Local Model** (`/local-refactor`)

**File:** `src/utils/persistence/handsStorage.js`
**Changes:**
- Add `userId` parameter to all functions
- Filter queries by userId
- Include userId when saving
- Pattern: `saveHand(handData, userId)`, `getAllHands(userId)`

### Step 5.3: Update Sessions Storage
**Owner: Local Model** (`/local-refactor`)

**File:** `src/utils/persistence/sessionsStorage.js`
**Changes:** Same pattern as handsStorage

### Step 5.4: Update Players Storage
**Owner: Local Model** (`/local-refactor`)

**File:** `src/utils/persistence/playersStorage.js`
**Changes:** Same pattern as handsStorage

### Step 5.5: Create Migration Utility
**Owner: Local Model** (`/local-code`)

**File:** `src/utils/persistence/migration.js`
**Spec:**
```javascript
// migrateGuestDataToUser(userId)
// - Find all records with userId: 'guest'
// - Update them to new userId
// - Return count of migrated records

// hasGuestData()
// - Check if any records exist with userId: 'guest'
// - Returns boolean
```

### Step 5.6: Create Data Migration Modal
**Owner: Local Model** (`/local-code`)

**File:** `src/components/ui/DataMigrationModal.jsx`
**Spec:**
```javascript
// Props: isOpen, onMigrate, onStartFresh, onCancel
// Modal showing options when guest with data logs in:
// - "Migrate my data" - Transfer guest data to account
// - "Start fresh" - Keep guest data separate, start new
// - "Cancel" - Go back to guest mode
// ~120 lines
```

### Step 5.7: Update Persistence Hooks
**Owner: Claude** (Complex integration)

**Files:**
- `src/hooks/usePersistence.js`
- `src/hooks/useSessionPersistence.js`
- `src/hooks/usePlayerPersistence.js`

**Changes:**
- Get userId from AuthContext
- Pass userId to all storage operations
- Handle migration flow when guest logs in

### Files to Create
- [ ] `src/utils/persistence/migration.js` (owner: local)
- [ ] `src/components/ui/DataMigrationModal.jsx` (owner: local)

### Files to Modify
- [ ] `src/utils/persistence/database.js` (owner: Claude)
- [ ] `src/utils/persistence/handsStorage.js` (owner: local)
- [ ] `src/utils/persistence/sessionsStorage.js` (owner: local)
- [ ] `src/utils/persistence/playersStorage.js` (owner: local)
- [ ] `src/hooks/usePersistence.js` (owner: Claude)
- [ ] `src/hooks/useSessionPersistence.js` (owner: Claude)
- [ ] `src/hooks/usePlayerPersistence.js` (owner: Claude)

### Verification
- [ ] DB migration to v7 succeeds
- [ ] Existing data gets userId: 'guest'
- [ ] New data gets correct userId
- [ ] Guest and auth user see different data
- [ ] Data migration modal works
- [ ] All tests pass

---

## Phase 6: Integration & Testing

### Goal
Final integration, comprehensive testing, and documentation updates.

### Task Delegation Analysis

| Task | Complexity | Local Model? | Reason |
|------|------------|--------------|--------|
| Full PokerTracker.jsx integration | Complex | No | Main orchestration |
| Update CLAUDE.md | Documentation | **Yes** | Add auth section |
| Update CHANGELOG.md | Documentation | **Yes** | Add version entry |
| Create auth integration tests | Complex | No | E2E testing with Firebase mocks |

### Step 6.1: Final PokerTracker.jsx Integration
**Owner: Claude**

**File:** `src/PokerTracker.jsx`
**Changes:**
- Add authReducer to useReducer list
- Initialize useAuthPersistence hook
- Wrap all providers with AuthProvider (outermost)
- Add auth loading screen when !isInitialized
- Pass userId to all persistence hooks
- Handle data migration flow

### Step 6.2: Update Documentation
**Owner: Local Model** (`/local-doc`)

**File:** `CLAUDE.md`
**Changes:**
- Add AuthContext to contexts list
- Add authReducer to reducers list
- Add auth constants to constants list
- Add auth views to views list
- Update version to v117

**File:** `docs/CHANGELOG.md`
**Changes:**
- Add v117 entry with auth features

### Step 6.3: Integration Tests
**Owner: Claude**

**File:** `src/test/integration/auth.test.jsx`
**Spec:**
- Mock Firebase Auth
- Test login flow
- Test signup flow
- Test guest mode
- Test data migration

### Files to Modify
- [ ] `src/PokerTracker.jsx` (owner: Claude)
- [ ] `CLAUDE.md` (owner: local)
- [ ] `docs/CHANGELOG.md` (owner: local)

### Files to Create
- [ ] `src/test/integration/auth.test.jsx` (owner: Claude)

### Verification
- [ ] App starts without errors
- [ ] Guest mode works (no login required)
- [ ] Login/Signup flows work
- [ ] Account management in Settings works
- [ ] Data isolation works
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Documentation updated

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-10 | Use Firebase Auth | User preference, integrates with future cloud sync |
| 2025-12-10 | Optional login (guest mode) | Preserve current UX, auth is additive |
| 2025-12-10 | Email/Password + Google OAuth | Balance of simplicity and convenience |
| 2025-12-10 | Account section in Settings | Cleaner than separate view, less nav clutter |
| 2025-12-10 | userId in IndexedDB | Local data isolation before cloud sync |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-10 | Initial | Planning | Created comprehensive project file with task decomposition |

---

## Local Model Delegation Summary

### Tasks Suitable for Local Models (16 tasks)

**Phase 1:**
- `src/config/firebase.js` - Boilerplate (~40 lines)
- `.env.example` - Template (~10 lines)
- `.gitignore` update - Trivial

**Phase 2:**
- `src/constants/authConstants.js` - Constants (~60 lines)
- `src/reducers/authReducer.js` - Follow pattern (~100 lines)
- `src/reducers/__tests__/authReducer.test.js` - Tests (~150 lines)
- `src/contexts/index.js` update - One line

**Phase 3:**
- `src/reducers/uiReducer.js` SCREEN update - Three lines
- `src/components/ui/GoogleSignInButton.jsx` - Simple UI (~50 lines)
- `src/components/ui/AuthLoadingScreen.jsx` - Simple UI (~40 lines)
- `src/components/views/PasswordResetView.jsx` - Simple form (~150 lines)

**Phase 4:**
- `src/components/ui/ConfirmDeleteModal.jsx` - Simple modal (~80 lines)

**Phase 5:**
- `src/utils/persistence/handsStorage.js` - Add userId pattern
- `src/utils/persistence/sessionsStorage.js` - Add userId pattern
- `src/utils/persistence/playersStorage.js` - Add userId pattern
- `src/utils/persistence/migration.js` - Simple utility (~80 lines)
- `src/components/ui/DataMigrationModal.jsx` - Simple modal (~120 lines)

**Phase 6:**
- `CLAUDE.md` update - Documentation
- `docs/CHANGELOG.md` update - Documentation

### Tasks Requiring Claude (10 tasks)

**Phase 2:**
- `src/contexts/AuthContext.jsx` - Firebase integration, multiple handlers
- `src/hooks/useAuthPersistence.js` - Firebase listener, state sync

**Phase 3:**
- `src/components/views/LoginView.jsx` - Complex form, auth handlers
- `src/components/views/SignupView.jsx` - Complex form, validation
- `src/PokerTracker.jsx` view routing - Integration

**Phase 4:**
- `src/components/ui/AccountSection.jsx` - Complex auth integration
- `src/components/views/SettingsView.jsx` - Integration

**Phase 5:**
- `src/utils/persistence/database.js` - Complex migration
- Persistence hooks updates - Cross-cutting integration

**Phase 6:**
- Final integration and testing

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing (should have 2400+ tests)
- [ ] Documentation updated:
  - [ ] CLAUDE.md (architecture, auth section)
  - [ ] docs/QUICK_REF.md (auth constants/hooks)
  - [ ] docs/CHANGELOG.md (v117 entry)
  - [ ] docs/STATE_SCHEMAS.md (authReducer state)
- [ ] Code reviewed
- [ ] All auth flows tested manually
- [ ] Committed with descriptive message
