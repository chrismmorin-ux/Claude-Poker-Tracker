# Comprehensive UI Overhaul Plan - Poker Tracker

## Overview
Implement comprehensive UI improvements across Auth, Action Logging, and Hand History systems. Priority order: Fix critical bugs → Auth enhancements → Action pattern display → Hand history features.

## User Requirements
- **Scope**: Comprehensive overhaul (bugs + polish + new features)
- **Priority order**: Auth → Action logging → Hand history (all critical)
- **Pattern recognition**: Display in ShowdownView and HistoryView
- **Email verification**: Full UI flow with resend functionality

---

## PHASE 1: Critical Bug Fixes

### 1.1 Fix HistoryView Missing Toast Props
**Priority**: CRITICAL

**Problem**:
- ViewRouter.jsx:282 doesn't pass `showSuccess` and `showInfo` to HistoryView
- HistoryView.jsx:177,205 call these undefined functions
- Silent failures when deleting hands

**Files to Modify**:
- `src/ViewRouter.jsx` (lines 274-284)

**Implementation**:
```javascript
// Add to HistoryView props:
showSuccess={showSuccess}
showInfo={showWarning}  // or create dedicated showInfo
```

**Testing**: Delete hand, verify success toast appears

---

## PHASE 2: Authentication UI Enhancements

### 2.1 Create Reusable PasswordInput Component
**New Component**: `src/components/ui/PasswordInput.jsx`

**Features**:
- Toggle between password/text with eye icon (lucide-react)
- Optional strength indicator display
- All standard input props (value, onChange, placeholder, etc.)
- Consistent Tailwind styling with existing forms

**Props**:
```javascript
{
  value, onChange, placeholder, disabled, autoComplete,
  showStrength: bool,
  strengthValue: { text, color },
  className: string
}
```

**Pattern**: Follow CardSlot.jsx structure with variants

### 2.2 Update LoginView with PasswordInput
**File**: `src/components/views/LoginView.jsx`

**Changes**:
- Replace password input (~lines 130-144) with PasswordInput
- Optional: Add "Remember me" checkbox (localStorage)

### 2.3 Update SignupView with PasswordInput
**File**: `src/components/views/SignupView.jsx`

**Changes**:
- Replace both password inputs with PasswordInput components
- Pass strength indicator to first password field (strength calc exists at lines 150-159)
- Keep real-time password mismatch validation

### 2.4 Update AccountSection Password Change
**File**: `src/components/ui/AccountSection.jsx`

**Changes**:
- Replace password inputs (~lines 293-322) with PasswordInput
- Add strength indicator for new password
- Display password requirements inline (min 6 chars, strength levels)
- Enhance success toast with confirmation message

### 2.5 Email Verification Flow

#### New Component: `src/components/ui/EmailVerificationBanner.jsx`
**Features**:
- Banner for unverified users
- "Verify Email" button → Firebase sendEmailVerification()
- "Resend" with 60s cooldown timer
- Dismissible (localStorage, reshow after 24h)
- Success toast on send
- Auto-dismiss when verified

#### AuthContext Enhancement
**File**: `src/contexts/AuthContext.jsx`

**Add Method**:
```javascript
const sendVerificationEmail = useCallback(async () => {
  if (!user || user.emailVerified) {
    return { success: false, error: 'Email already verified or user not found' };
  }

  dispatchAuth({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });

  try {
    await firebaseSendEmailVerification(user);
    return { success: true };
  } catch (err) {
    return handleAuthError(err);
  }
}, [user, dispatchAuth, handleAuthError]);

// Add to context value
```

#### SettingsView Integration
**File**: `src/components/views/SettingsView.jsx`

- Add EmailVerificationBanner at top for authenticated unverified users

---

## PHASE 3: Action Pattern Recognition Display

### 3.1 Integrate Patterns into ActionHistoryGrid
**File**: `src/components/views/ShowdownView/ActionHistoryGrid.jsx`

**Current Issue**: Lines 63-67 show "Labels" placeholder instead of player names/patterns

**Changes**:
- Import: `getPreflopAggressor`, `wouldBeSqueeze` from sequenceUtils.js
- Import: `PatternBadge` component (already exists)
- Add props: `seatPlayers`, `allPlayers`
- Replace "Labels" buttons with player names + pattern badges
- Detect patterns: squeeze, PFR, 3bettor, coldcaller, etc.

**Pattern Detection**:
```javascript
const detectPatterns = (actionSequence, seat) => {
  const patterns = [];
  const preflopActions = actionSequence.filter(e => e.street === 'preflop' && e.seat === seat);

  if (wouldBeSqueeze(actionSequence, seat)) patterns.push('squeeze');
  if (getPreflopAggressor(actionSequence) === seat) patterns.push('pfr');
  // Additional patterns...

  return patterns;
};
```

**Display Format**: `"Seat 3" | [PFR badge] [3bet badge]`

### 3.2 Add Pattern Display to ShowdownView
**File**: `src/components/views/ShowdownView/index.jsx`

**Changes**:
- Display PatternBadge components below action sequences
- Show top 2-3 patterns per active player
- Small size variant
- Position below ActionSequence component

### 3.3 Create ActionReplay Component (Optional Enhancement)
**New Component**: `src/components/ui/ActionReplay.jsx`

**Features**:
- Animated step-by-step action playback
- Play/pause/step controls
- Speed control (0.5x, 1x, 2x)
- Compact mode for modals
- Use requestAnimationFrame for smooth animation

**Props**:
```javascript
{
  actionSequence: array,
  seatPositions: object,
  autoPlay: bool,
  compact: bool
}
```

---

## PHASE 4: Hand History Enhancements

### 4.1 Create Hand Details Modal
**New Component**: `src/components/ui/HandDetailsModal.jsx`

**Features**:
- Full action sequence display (use ActionSequence component)
- Pattern analysis summary (use PatternBadge)
- Player hole cards (if available)
- Community cards
- Pot size progression
- Winner/showdown info
- Export single hand as JSON
- Close button + backdrop dismiss

**Pattern**: Follow ConfirmDeleteModal.jsx structure

**Props**:
```javascript
{
  isOpen: bool,
  hand: object,
  onClose: func,
  onExport: func,
  onDelete: func
}
```

### 4.2 Update HistoryView with Hand Details
**File**: `src/components/views/HistoryView.jsx`

**Changes**:
- Add state: `const [selectedHand, setSelectedHand] = useState(null);`
- Replace "Load" button with "View Details" button (~line 429)
- Open HandDetailsModal on click
- Display patterns in hand card summary (~line 414)
- Add PatternBadge display for top 3 patterns per hand

**Pattern Display**:
```javascript
// After action summary, add:
const patterns = detectPatternsFromSequence(hand.actionSequence);
<div className="flex gap-1 mt-1">
  {patterns.slice(0, 3).map((pattern, i) => (
    <PatternBadge key={i} pattern={pattern} size="small" />
  ))}
</div>
```

### 4.3 Add Search/Filter Component
**New Component**: `src/components/ui/HandFilters.jsx`

**Features**:
- Date range picker
- Session dropdown (enhance existing at line 292)
- Pattern checkboxes (squeeze, 3bet, cold-call, etc.)
- Player multi-select
- Reset filters button
- Filter count badge

**HistoryView Integration**:
- Add HandFilters below header (after line 325)
- Apply filters to hands array before display
- Update count: "X of Y hands"
- Memoize filtering with useMemo

### 4.4 Export/Import Enhancement
**New Component**: `src/components/ui/ExportImportModal.jsx`

**Features**:
- Export all hands or filtered subset
- Import hands from JSON
- Validation before import
- Duplicate detection
- Progress indicator for large imports
- Success/error toasts

**HistoryView Integration**:
- Add "Export" button in header (~line 310)
- Open ExportImportModal on click
- Integrate with existing exportAllData/importAllData utils

---

## PHASE 5: Shared Components & Polish (Optional)

### 5.1 Create BaseModal Component
**New Component**: `src/components/ui/BaseModal.jsx`

**Purpose**: Reduce modal code duplication

**Features**:
- Backdrop with click-to-dismiss
- Close button (X icon)
- Title/header slot
- Content slot
- Footer slot
- Size variants (small, medium, large, fullscreen)
- Fade in/out animation
- Focus trap, Esc to close

**Refactor Targets**:
- ConfirmDeleteModal.jsx
- HandDetailsModal.jsx
- ExportImportModal.jsx

### 5.2 Loading States & Skeletons
**New Components**:
- `src/components/ui/HandCardSkeleton.jsx` - Hand card loading placeholder
- `src/components/ui/Spinner.jsx` - Reusable spinner

**Updates**:
- HistoryView loading (lines 330-333) - add skeletons
- Modal loading states - use Spinner

### 5.3 Enhanced Toast Notifications
**File**: `src/components/ui/Toast.jsx`

**Enhancements**:
- Add "info" type (if not exists)
- Add icons for each toast type
- Optional action button (e.g., "Undo" for deletes)
- Auto-dismiss timer display (progress bar)

---

## Implementation Order

1. **Phase 1**: Fix HistoryView toast bug (CRITICAL - do first)
2. **Task 2.1**: Create PasswordInput component (blocks other Phase 2 tasks)
3. **Phase 2**: Complete auth enhancements (2.2-2.5)
4. **Tasks 3.1-3.2**: Pattern display in ActionHistoryGrid & ShowdownView (quick wins)
5. **Task 5.1**: Create BaseModal (if doing Phase 4 modals)
6. **Phase 4**: Hand history features (can parallelize after BaseModal)
7. **Task 3.3**: ActionReplay component (enhances Phase 4)
8. **Phase 5**: Polish tasks (optional)

---

## Critical Files Summary

### Must Modify
- `src/ViewRouter.jsx` - Fix HistoryView props (Phase 1)
- `src/components/views/HistoryView.jsx` - Hand details, patterns, filters (Phase 4)
- `src/components/views/ShowdownView/ActionHistoryGrid.jsx` - Pattern integration (Phase 3)
- `src/contexts/AuthContext.jsx` - Email verification method (Phase 2)

### Must Create
- `src/components/ui/PasswordInput.jsx` - Password toggle component (Phase 2)
- `src/components/ui/EmailVerificationBanner.jsx` - Verification flow (Phase 2)
- `src/components/ui/HandDetailsModal.jsx` - Hand details (Phase 4)
- `src/components/ui/HandFilters.jsx` - Filtering UI (Phase 4)

### Should Create (High Value)
- `src/components/ui/ActionReplay.jsx` - Action visualization (Phase 3)
- `src/components/ui/ExportImportModal.jsx` - Export/import (Phase 4)
- `src/components/ui/BaseModal.jsx` - Modal wrapper (Phase 5)

### Optional Create (Polish)
- `src/components/ui/HandCardSkeleton.jsx` - Loading state
- `src/components/ui/Spinner.jsx` - Loading indicator

---

## Testing Strategy

### Unit Tests (Create)
1. PasswordInput.test.jsx - Toggle, strength indicator
2. EmailVerificationBanner.test.jsx - Display logic, resend timer
3. HandDetailsModal.test.jsx - Modal behavior, data display
4. HandFilters.test.jsx - Filter logic, reset
5. ActionReplay.test.jsx - Playback controls (if implemented)

### Integration Tests (Update)
1. HistoryView.test.jsx - Toast fix, modal integration, filters
2. AccountSection.test.jsx - Password change with new component
3. AuthContext.test.jsx - Email verification flow

### Manual Testing
- Password visibility toggle on all forms
- Email verification: send, resend cooldown, success
- Pattern detection accuracy (test with 10+ hands)
- Hand details modal: all data displays correctly
- Export/import: data integrity preserved
- All toast notifications appear correctly

---

## Architectural Considerations

### State Management
- No new context providers needed
- Local state for modal visibility
- localStorage for email verification dismissal, "Remember me"

### Performance
- ActionReplay: Use requestAnimationFrame for smooth animation
- Hand filtering: Memoize with useMemo
- Pattern detection: Compute once and cache

### Backward Compatibility
- Maintain dual format support (seatActions + actionSequence)
- Gracefully handle hands without actionSequence
- Pattern detection works with both formats

### Accessibility
- All modals: focus trap, Esc to close, ARIA labels
- Password toggle: ARIA labels for screen readers
- Toast notifications: ARIA live regions
- Form validation: associate errors with inputs

---

## Risk Mitigation

### High-Risk Items
1. **Email verification**: Firebase can fail (spam, rate limits)
   - Solution: Add retry logic, clear error messages
2. **Pattern detection accuracy**: May have false positives
   - Solution: Test with real data, add confidence scores if needed
3. **Modal z-index conflicts**: Multiple modals may overlap
   - Solution: Consistent z-index scale (50, 60, 70)

### Rollback Strategy
- Each phase can be deployed independently
- Feature flags for email verification and pattern display
- Graceful degradation if pattern detection fails

---

## Success Metrics

### Phase 1
- [ ] Zero console errors on hand deletion
- [ ] Success toast appears on delete

### Phase 2
- [ ] Password toggle on all auth forms
- [ ] Email verification flow functional
- [ ] Password strength visible during change

### Phase 3
- [ ] Patterns display in ActionHistoryGrid
- [ ] Pattern detection accuracy >95% (manual review)
- [ ] No performance degradation

### Phase 4
- [ ] Hand details modal opens and displays all data
- [ ] Filters produce correct results
- [ ] Export/import preserves data integrity

---

## Notes
- PatternBadge component already exists and is ready to use
- sequenceUtils.js has pattern detection functions (getPreflopAggressor, wouldBeSqueeze)
- Follow existing patterns: ScaledContainer, toast notifications, Tailwind styling
- Mobile-first: 1600×720 base dimensions with responsive scaling
