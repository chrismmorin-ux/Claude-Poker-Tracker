/**
 * OnlineView.invariants.fixture.js — WS-127 / SPR-006 / ICP-2
 *
 * Audit-only matrix for src/components/views/OnlineView/OnlineView.jsx.
 * DOM-mount harness via React Testing Library — runner mounts OnlineView with
 * mocked context state per row and asserts on rendered DOM.
 *
 * Pattern doc: .claude/context/INVARIANT_MATRIX_PATTERN.md
 * Canonical UI-mirror precedent: src/components/views/TableView/__tests__/actionInvariants.fixture.js
 * Canonical reducer precedent: src/reducers/__tests__/gameReducer.undoInvariants.fixture.js
 * DOM-mount template: src/components/views/AnchorLibraryView/__tests__/AnchorLibraryView.test.jsx
 *
 * 8 decision points scoped:
 *   1. connection_status — isExtensionConnected → green dot + label
 *   2. version_mismatch  — versionMismatch → banner + 2 buttons
 *   3. sync_error        — syncError → banner with message
 *   4. session_selector  — onlineSessions.length > 1 → selector buttons
 *   5. empty_state       — handCount===0 && !isLoading → empty copy + Import CTA
 *   6. main_content      — handCount > 0 → SeatGrid + analyzed-count + Import button
 *   7. detail_panel      — selectedSeat && tendencyMap[seat] → SeatDetailPanel
 *   8. importing_state   — isImporting → disabled button + "Importing…"
 *
 * Sub-components (SeatGrid, SeatDetailPanel, VillainProfileModal) render
 * INSIDE OnlineView when conditions allow. Their internals are NOT audited
 * here — out of scope per "clean OnlineView scope" decision (ICP-2 founder
 * call). VillainProfileModal is mocked at boundary in the runner.
 *
 * NEVER add a "fix" to this file. WS-127 is audit-only.
 */

// ---------------------------------------------------------------------------
// Default mock fixtures — represent the "blank slate" boot state
// ---------------------------------------------------------------------------
export const defaultSyncBridge = {
  isExtensionConnected: false,
  versionMismatch: false,
  dismissVersionMismatch: () => {},
  // WS-076: version-mismatch diagnostic surface state
  extProtocolVersion: null,
  extManifestVersion: null,
  appProtocolVersion: 2,
  postReloadStatus: null,
  clearPostReloadStatus: () => {},
  // WS-077: dismiss-state override (decoupled from versionMismatch)
  dismissedDespiteMismatch: false,
  importedCount: 0,
  syncError: null,
  importFromJson: async () => {},
  lastSyncTime: null,
  liveHandState: null,
  lastImportedTableSession: null,
  pushExploits: () => {},
  pushAdvice: () => {},
  pushTournament: () => {},
  reportError: () => {},
};

export const defaultOnlineSession = {
  selectedSessionId: null,
  setSelectedSessionId: () => {},
  onlineSessions: [],
  loadSessions: async () => {},
};

export const defaultAnalysis = {
  tendencyMap: {},
  handCount: 0,
  isLoading: false,
  advice: null,
  isComputing: false,
};

// Helper: build a minimal villain-profile shape for tendencyMap rows
const villainProfile = (overrides = {}) => ({
  maturity: 'typed',
  maturityLabel: 'Typed',
  headline: 'Loose-Passive Calling Station',
  totalObservations: 42,
  streets: { preflop: {}, flop: {}, turn: {}, river: {} },
  aggressionResponse: { facingBet: {}, facingRaise: {} },
  rangeShape: { description: 'wide-passive', traits: [] },
  awareness: { positionAware: false, boardTextureAware: false, sizingTells: [] },
  decisionModelShape: 'station',
  decisionModelDescription: 'Calls down with marginal',
  vulnerabilities: [],
  showdownAnchors: [],
  ...overrides,
});

// Helper: tendencyMap row for a single seat
const seatTendency = (seat, overrides = {}) => ({
  [String(seat)]: {
    sampleSize: 42,
    vpip: 35,
    pfr: 12,
    af: 1.2,
    style: 'LP',
    villainProfile: villainProfile(),
    exploits: [],
    weaknesses: [],
    briefings: [],
    observations: [],
    ...overrides,
  },
});

// ---------------------------------------------------------------------------
// Fixture rows
// ---------------------------------------------------------------------------
export const fixtures = [
  // ===========================================================================
  // 1. CONNECTION STATUS (lines 67-72 of OnlineView.jsx)
  // ===========================================================================
  {
    id: 'OV-CS-001',
    scenario_label: 'extension_disconnected_default_label',
    category: 'connection_status',
    inputs: {
      syncBridge: { isExtensionConnected: false },
    },
    expected_per_spec: {
      domPresent: ['Extension not detected'],
      domAbsent: ['Extension connected'],
    },
    actual_today: {
      domPresent: ['Extension not detected'],
      domAbsent: ['Extension connected'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Default boot state — extension not detected. Gray dot + "not detected" label.',
  },
  {
    id: 'OV-CS-002',
    scenario_label: 'extension_connected_label',
    category: 'connection_status',
    inputs: {
      syncBridge: { isExtensionConnected: true },
    },
    expected_per_spec: {
      domPresent: ['Extension connected'],
      domAbsent: ['Extension not detected'],
    },
    actual_today: {
      domPresent: ['Extension connected'],
      domAbsent: ['Extension not detected'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Connected state — green dot + "connected" label.',
  },
  {
    id: 'OV-CS-003',
    scenario_label: 'imported_count_displayed',
    category: 'connection_status',
    inputs: {
      syncBridge: { isExtensionConnected: true, importedCount: 47 },
    },
    expected_per_spec: {
      domPresent: ['47 hands'],
    },
    actual_today: {
      domPresent: ['47 hands'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'importedCount renders as "<n> hands" in header right region (line 75-77).',
  },

  // ===========================================================================
  // 2. VERSION MISMATCH BANNER (lines 81-99)
  // ===========================================================================
  {
    id: 'OV-VM-001',
    scenario_label: 'version_mismatch_off',
    category: 'version_mismatch',
    inputs: {
      syncBridge: { versionMismatch: false },
    },
    expected_per_spec: {
      domAbsent: ['Extension version mismatch'],
    },
    actual_today: {
      domAbsent: ['Extension version mismatch'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Banner hidden when versionMismatch is false.',
  },
  {
    id: 'OV-VM-002',
    scenario_label: 'version_mismatch_on_renders_banner',
    category: 'version_mismatch',
    inputs: {
      syncBridge: { versionMismatch: true },
    },
    expected_per_spec: {
      domPresent: [
        'Extension version mismatch — update the extension or reload the page',
        'Reload Page',
        'Continue Anyway',
      ],
    },
    actual_today: {
      domPresent: [
        'Extension version mismatch — update the extension or reload the page',
        'Reload Page',
        'Continue Anyway',
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Banner shows full message + both action buttons.',
  },
  {
    id: 'OV-VM-003',
    scenario_label: 'version_mismatch_with_extension_disconnected',
    category: 'version_mismatch',
    inputs: {
      syncBridge: { isExtensionConnected: false, versionMismatch: true },
    },
    expected_per_spec: {
      domPresent: ['Extension version mismatch', 'Extension not detected'],
    },
    actual_today: {
      domPresent: ['Extension version mismatch', 'Extension not detected'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Both banner AND disconnected indicator can show simultaneously — independent gates.',
  },
  // WS-076: post-reload still-mismatched auto-opens modal with extra warning copy.
  {
    id: 'OV-VM-004',
    scenario_label: 'post_reload_still_mismatched_auto_opens_modal',
    category: 'version_mismatch',
    inputs: {
      syncBridge: {
        versionMismatch: true,
        postReloadStatus: 'still-mismatched',
        extProtocolVersion: 99,
        extManifestVersion: '99.99.99',
        appProtocolVersion: 2,
      },
    },
    expected_per_spec: {
      testIds: { 'version-mismatch-modal': true, 'still-mismatched-copy': true },
      domPresent: ['You already reloaded'],
    },
    actual_today: {
      testIds: { 'version-mismatch-modal': true, 'still-mismatched-copy': true },
      domPresent: ['You already reloaded'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'When postReloadStatus is still-mismatched, OnlineView auto-opens the diagnostic modal so the user sees the verification result without clicking through.',
  },
  // WS-076: post-reload modal renders both versions in diagnostic surface.
  {
    id: 'OV-VM-005',
    scenario_label: 'post_reload_modal_renders_both_versions',
    category: 'version_mismatch',
    inputs: {
      syncBridge: {
        versionMismatch: true,
        postReloadStatus: 'still-mismatched',
        extProtocolVersion: 99,
        extManifestVersion: '99.99.99',
        appProtocolVersion: 2,
      },
    },
    expected_per_spec: {
      domPresent: ['99.99.99', 'protocol v99', 'protocol v2'],
    },
    actual_today: {
      domPresent: ['99.99.99', 'protocol v99', 'protocol v2'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Diagnostic surfaces extension manifest version + protocol version + app protocol version — user-readable companion to the integer.',
  },
  // WS-077: pip absent + banner visible when mismatch but not yet dismissed.
  {
    id: 'OV-VM-006',
    scenario_label: 'mismatch_not_dismissed_pip_absent_banner_visible',
    category: 'version_mismatch',
    inputs: {
      syncBridge: {
        versionMismatch: true,
        dismissedDespiteMismatch: false,
      },
    },
    expected_per_spec: {
      testIds: { 'version-mismatch-pip': false, 'version-mismatch-banner': true },
    },
    actual_today: {
      testIds: { 'version-mismatch-pip': false, 'version-mismatch-banner': true },
    },
    status: 'matches',
    bug_id: null,
    comment: 'Pre-dismiss state: banner is the primary surface; pip is absent (it only appears post-dismiss).',
  },
  // WS-077: pip visible + banner hidden when user has dismissed.
  {
    id: 'OV-VM-007',
    scenario_label: 'mismatch_dismissed_pip_visible_banner_hidden',
    category: 'version_mismatch',
    inputs: {
      syncBridge: {
        versionMismatch: true,
        dismissedDespiteMismatch: true,
        extProtocolVersion: 99,
        extManifestVersion: '99.99.99',
        appProtocolVersion: 2,
      },
    },
    expected_per_spec: {
      testIds: { 'version-mismatch-pip': true, 'version-mismatch-banner': false },
    },
    actual_today: {
      testIds: { 'version-mismatch-pip': true, 'version-mismatch-banner': false },
    },
    status: 'matches',
    bug_id: null,
    comment: 'Post-dismiss state: pip becomes the persistent visible signal; banner is suppressed; click pip → reopens WS-076 modal (covered in WS-077 interaction-driven describe).',
  },

  // ===========================================================================
  // 3. SYNC ERROR BANNER (lines 101-105)
  // ===========================================================================
  {
    id: 'OV-SE-001',
    scenario_label: 'sync_error_null',
    category: 'sync_error',
    inputs: {
      syncBridge: { syncError: null },
    },
    expected_per_spec: {
      domAbsent: ['Sync error:'],
    },
    actual_today: {
      domAbsent: ['Sync error:'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Sync-error banner hidden when null.',
  },
  {
    id: 'OV-SE-002',
    scenario_label: 'sync_error_with_message',
    category: 'sync_error',
    inputs: {
      syncBridge: { syncError: 'Connection lost' },
    },
    expected_per_spec: {
      domPresent: ['Sync error: Connection lost'],
    },
    actual_today: {
      domPresent: ['Sync error: Connection lost'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Banner renders message inline.',
  },

  // ===========================================================================
  // 4. SESSION SELECTOR (lines 108-125 — guard is `onlineSessions.length > 1`)
  // ===========================================================================
  {
    id: 'OV-SS-001',
    scenario_label: 'zero_sessions_selector_hidden',
    category: 'session_selector',
    inputs: {
      onlineSession: { onlineSessions: [] },
    },
    expected_per_spec: {
      domAbsent: ['Table'],
    },
    actual_today: {
      domAbsent: ['Table'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Selector hidden — guard is length > 1, which 0 fails.',
  },
  {
    id: 'OV-SS-002',
    scenario_label: 'one_session_selector_hidden',
    category: 'session_selector',
    inputs: {
      onlineSession: {
        onlineSessions: [{ sessionId: 'session-1', tableId: 'table-abc123', handCount: 5 }],
      },
    },
    expected_per_spec: {
      // Single-session is hidden — the > 1 guard intentionally excludes solo
      // sessions to avoid a one-button selector. NOT a bug.
      domAbsent: ['Table abc123'],
    },
    actual_today: {
      domAbsent: ['Table abc123'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Single-session: selector hidden by design (> 1 guard, not >=).',
  },
  {
    id: 'OV-SS-003',
    scenario_label: 'two_sessions_selector_renders_both',
    category: 'session_selector',
    inputs: {
      onlineSession: {
        selectedSessionId: 'session-1',
        onlineSessions: [
          { sessionId: 'session-1', tableId: 'table-abc123', handCount: 5 },
          { sessionId: 'session-2', tableId: 'table-def456', handCount: 12 },
        ],
      },
    },
    expected_per_spec: {
      domPresent: ['Table abc123 (5h)', 'Table def456 (12h)'],
    },
    actual_today: {
      domPresent: ['Table abc123 (5h)', 'Table def456 (12h)'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Two sessions: both rendered as buttons with truncated tableId + handCount badge.',
  },
  {
    id: 'OV-SS-004',
    scenario_label: 'session_without_tableId_falls_back_to_sessionId',
    category: 'session_selector',
    inputs: {
      onlineSession: {
        onlineSessions: [
          { sessionId: 'session-1' },
          { sessionId: 'session-2-very-long', tableId: 'table-x' },
        ],
      },
    },
    expected_per_spec: {
      // Line 121: `Table {s.tableId?.slice(-6) || s.sessionId} ({s.handCount || 0}h)`
      // No tableId → falls back to sessionId; no handCount → 0h
      domPresent: ['Table session-1 (0h)', 'Table able-x (0h)'],
    },
    actual_today: {
      domPresent: ['Table session-1 (0h)', 'Table able-x (0h)'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Defensive: no tableId → sessionId; no handCount → 0. tableId.slice(-6) gives last 6 chars.',
  },

  // ===========================================================================
  // 5. EMPTY STATE (lines 128-153 — `handCount === 0 && !isLoading`)
  // ===========================================================================
  {
    id: 'OV-ES-001',
    scenario_label: 'empty_state_disconnected_install_copy',
    category: 'empty_state',
    inputs: {
      syncBridge: { isExtensionConnected: false },
      analysis: { handCount: 0, isLoading: false },
    },
    expected_per_spec: {
      domPresent: [
        'No online data yet',
        'Install the Poker Session Notes extension and play on Ignition, or import a hand file below.',
        'Import from File',
      ],
      domAbsent: ['Waiting for hands...'],
    },
    actual_today: {
      domPresent: [
        'No online data yet',
        'Install the Poker Session Notes extension and play on Ignition, or import a hand file below.',
        'Import from File',
      ],
      domAbsent: ['Waiting for hands...'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Disconnected + 0 hands → install-CTA copy + Import button.',
  },
  {
    id: 'OV-ES-002',
    scenario_label: 'empty_state_connected_waiting_copy',
    category: 'empty_state',
    inputs: {
      syncBridge: { isExtensionConnected: true },
      analysis: { handCount: 0, isLoading: false },
    },
    expected_per_spec: {
      domPresent: [
        'Waiting for hands...',
        'Play hands on Ignition and they will appear here automatically.',
        'Import from File',
      ],
      domAbsent: ['No online data yet'],
    },
    actual_today: {
      domPresent: [
        'Waiting for hands...',
        'Play hands on Ignition and they will appear here automatically.',
        'Import from File',
      ],
      domAbsent: ['No online data yet'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Connected + 0 hands → waiting copy. isExtensionConnected branches the headline + body copy.',
  },
  {
    id: 'OV-ES-003',
    scenario_label: 'loading_suppresses_empty_state',
    category: 'empty_state',
    inputs: {
      syncBridge: { isExtensionConnected: true },
      analysis: { handCount: 0, isLoading: true },
    },
    expected_per_spec: {
      // Both empty-state copies must NOT appear while isLoading is true.
      domAbsent: ['Waiting for hands...', 'No online data yet'],
    },
    actual_today: {
      domAbsent: ['Waiting for hands...', 'No online data yet'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Empty-state guard is `handCount === 0 && !isLoading`. Loading suppresses it (avoids flicker during initial fetch).',
  },
  {
    id: 'OV-ES-004',
    scenario_label: 'handCount_positive_no_empty_state',
    category: 'empty_state',
    inputs: {
      analysis: { handCount: 1, isLoading: false },
    },
    expected_per_spec: {
      domAbsent: ['Waiting for hands...', 'No online data yet'],
    },
    actual_today: {
      domAbsent: ['Waiting for hands...', 'No online data yet'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Boundary: handCount=1 disables empty state.',
  },

  // ===========================================================================
  // 6. MAIN CONTENT (lines 156-199 — `handCount > 0`)
  // ===========================================================================
  {
    id: 'OV-MC-001',
    scenario_label: 'main_content_hidden_when_zero_hands',
    category: 'main_content',
    inputs: {
      analysis: { handCount: 0, isLoading: false },
    },
    expected_per_spec: {
      // The "<n> hands analyzed" label only renders inside main-content gate.
      domAbsent: ['hands analyzed'],
    },
    actual_today: {
      domAbsent: ['hands analyzed'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'handCount=0 → main content skipped (no SeatGrid, no analyzed-count, no second Import button).',
  },
  {
    id: 'OV-MC-002',
    scenario_label: 'main_content_renders_with_one_hand',
    category: 'main_content',
    inputs: {
      analysis: { handCount: 1, isLoading: false, tendencyMap: seatTendency(3) },
    },
    expected_per_spec: {
      domPresent: ['1 hand analyzed'],
    },
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-132',
    comment: 'WS-132 fix wave: OnlineView.jsx:159 now uses pluralization-aware ternary `{handCount === 1 ? "1 hand analyzed" : `${handCount} hands analyzed`}`. Cosmetic UX polish.',
  },
  {
    id: 'OV-MC-003',
    scenario_label: 'main_content_with_loading_shows_updating',
    category: 'main_content',
    inputs: {
      analysis: { handCount: 5, isLoading: true, tendencyMap: seatTendency(3) },
    },
    expected_per_spec: {
      domPresent: ['5 hands analyzed', '(updating...)'],
    },
    actual_today: {
      domPresent: ['5 hands analyzed', '(updating...)'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Loading-while-analyzing: shows count + "(updating...)" inline.',
  },

  // ===========================================================================
  // 7. DETAIL PANEL (lines 169-180 — `selectedSeatData &&`)
  // ===========================================================================
  // selectedSeat is component-internal useState; controlled in tests via
  // `setup.selectSeat: N` directive (handled by runner via fireEvent click).
  // ===========================================================================
  {
    id: 'OV-DP-001',
    scenario_label: 'no_seat_selected_panel_absent',
    category: 'detail_panel',
    inputs: {
      analysis: { handCount: 5, tendencyMap: seatTendency(3) },
      // No setup.selectSeat — selectedSeat remains null
    },
    expected_per_spec: {
      // SeatDetailPanel mounts a parent div via testId would be ideal, but
      // panel doesn't currently expose one. Use a structural marker that
      // appears ONLY inside the panel (via the SeatDetailPanel hierarchy).
      // For now, assert by ABSENCE of the detail-panel mock testId we'll
      // assign in the runner (or a known panel string). Since SeatDetailPanel
      // is real (mounted), use one of its known headers as a proxy when present.
      // Conservative: assert via testId we add to the runner-side mock if any;
      // otherwise this row is a `spec_gap` for v1.
      domAbsent: [],
    },
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Detail panel visibility — without selecting a seat, panel is absent. Hard to assert without a testId on SeatDetailPanel root or mocking SeatDetailPanel at the harness boundary. v1 gap; resolve by mocking SeatDetailPanel in the runner with a testid wrapper.',
  },
  {
    id: 'OV-DP-002',
    scenario_label: 'seat_selected_with_no_tendency_data_panel_absent',
    category: 'detail_panel',
    inputs: {
      analysis: { handCount: 5, tendencyMap: {} }, // empty map → tendencyMap[seat] is undefined
      setup: { selectSeat: 3 },
    },
    expected_per_spec: {
      // selectedSeatData = selectedSeat ? tendencyMap[selectedSeat] : null
      // tendencyMap[3] is undefined → selectedSeatData is undefined → falsy → panel absent
      domAbsent: [],
    },
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Same panel-visibility gap as OV-DP-001. Defer until SeatDetailPanel mocking adds testid wrapper.',
  },
  {
    id: 'OV-DP-003',
    scenario_label: 'seat_selected_with_tendency_data_panel_present',
    category: 'detail_panel',
    inputs: {
      analysis: { handCount: 5, tendencyMap: seatTendency(3) },
      setup: { selectSeat: 3 },
    },
    expected_per_spec: {
      domAbsent: [],
    },
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Same as above. Marking 3 detail-panel rows as spec_gap until the runner mocks SeatDetailPanel for testid-based presence assertions. Surfaces a real audit finding: OnlineView lacks a testid on the panel container, making programmatic visibility assertions fragile.',
  },

  // ===========================================================================
  // 8. IMPORTING STATE (lines 139-150 — empty-state button; lines 184-195 — main-content button)
  // ===========================================================================
  // isImporting is component-internal; flips during async file-import.
  // For matrix purposes, the IDLE state is what we can deterministically
  // assert; mid-import state requires firing the file-input change which is
  // a real async user-event. Mark mid-import as spec_gap for v1.
  // ===========================================================================
  {
    id: 'OV-IS-001',
    scenario_label: 'idle_button_label_in_empty_state',
    category: 'importing_state',
    inputs: {
      analysis: { handCount: 0, isLoading: false },
    },
    expected_per_spec: {
      domPresent: ['Import from File'],
      domAbsent: ['Importing…'],
    },
    actual_today: {
      domPresent: ['Import from File'],
      domAbsent: ['Importing…'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Idle import button shows "Import from File" label in the empty state.',
  },
  {
    id: 'OV-IS-002',
    scenario_label: 'idle_button_label_in_main_content',
    category: 'importing_state',
    inputs: {
      analysis: { handCount: 5, tendencyMap: seatTendency(3) },
    },
    expected_per_spec: {
      // Both buttons exist when handCount > 0 happens to be 0; but here we
      // have main-content button only (empty-state button is gated by handCount===0).
      domPresent: ['Import from File'],
      domAbsent: ['Importing…'],
    },
    actual_today: {
      domPresent: ['Import from File'],
      domAbsent: ['Importing…'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Idle import button in main-content footer (handCount > 0 branch).',
  },
  {
    id: 'OV-IS-003',
    scenario_label: 'mid_import_disabled_state',
    category: 'importing_state',
    inputs: {
      analysis: { handCount: 0 },
      setup: { triggerFileImport: true }, // hypothetical — would require file-input synthesis
    },
    expected_per_spec: {
      domPresent: ['Importing…'],
      domAbsent: ['Import from File'],
    },
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'isImporting toggles via async file-import handler. Hard to drive without synthetic File object + onChange event. v1 spec_gap; could resolve by extracting setIsImporting into a callback the test can call directly, but that requires production change. Surfaces audit finding: isImporting state has no test seam.',
  },

  // ===========================================================================
  // CROSS-CUTTING — multiple gates simultaneously
  // ===========================================================================
  {
    id: 'OV-XC-001',
    scenario_label: 'all_banners_stacked',
    category: 'sync_error',
    inputs: {
      syncBridge: {
        isExtensionConnected: true,
        versionMismatch: true,
        syncError: 'Webhook timeout',
      },
    },
    expected_per_spec: {
      // Connection indicator + version-mismatch banner + sync-error banner
      // all visible simultaneously. Independent gates, no ordering conflict.
      domPresent: [
        'Extension connected',
        'Extension version mismatch — update the extension or reload the page',
        'Sync error: Webhook timeout',
      ],
    },
    actual_today: {
      domPresent: [
        'Extension connected',
        'Extension version mismatch — update the extension or reload the page',
        'Sync error: Webhook timeout',
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Simultaneous banners: header status + version banner + sync-error banner. All independent gates.',
  },
  {
    id: 'OV-XC-002',
    scenario_label: 'multi_session_selector_with_empty_data',
    category: 'session_selector',
    inputs: {
      onlineSession: {
        selectedSessionId: 'session-1',
        onlineSessions: [
          { sessionId: 'session-1', tableId: 'tA', handCount: 0 },
          { sessionId: 'session-2', tableId: 'tB', handCount: 3 },
        ],
      },
      analysis: { handCount: 0, isLoading: false },
      syncBridge: { isExtensionConnected: true },
    },
    expected_per_spec: {
      // Selector renders (>1 sessions); empty state ALSO renders (selected
      // session has 0 hands per analysis context). Both can co-exist.
      domPresent: ['Table tA (0h)', 'Table tB (3h)', 'Waiting for hands...'],
    },
    actual_today: {
      domPresent: ['Table tA (0h)', 'Table tB (3h)', 'Waiting for hands...'],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Multi-session + selected has 0 hands → selector + empty state both render. Independent gates again.',
  },

  // ===========================================================================
  // SPEC GAP — scenarios OnlineView cannot render (informational)
  // ===========================================================================
  {
    id: 'OV-G-001',
    scenario_label: 'live_table_sync_routing_not_visible_in_OnlineView',
    category: 'main_content',
    inputs: {
      syncBridge: { liveHandState: { tableId: 'live-1', seatState: {} } },
    },
    expected_per_spec: null,
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'liveHandState is consumed by the sidebar (extension), NOT OnlineView. OnlineView reads only the imported-hand history. Pin: OnlineView is INDEPENDENT of live-table sync; live-table flow is sidebar-owned. ICP-2 audit confirms boundary.',
  },
  {
    id: 'OV-G-002',
    scenario_label: 'extension_state_change_during_session',
    category: 'connection_status',
    inputs: {
      syncBridge: { isExtensionConnected: false },
      // Hypothetical: simulate a flip from disconnected → connected mid-session
    },
    expected_per_spec: null,
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Cross-context state-change behavior (e.g., connection flips mid-session) is ICP-4 STATE_FIELD_SCOPES territory. Out of scope here per "clean OnlineView scope" decision.',
  },
];

export default fixtures;
