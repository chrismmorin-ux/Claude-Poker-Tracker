// @vitest-environment jsdom
/**
 * OnlineView.invariants.test.jsx — WS-127 / SPR-006 / ICP-2 audit runner
 *
 * Walks OnlineView.invariants.fixture.js. Mounts OnlineView with mocked
 * context state per row and asserts on rendered DOM via React Testing
 * Library queries.
 *
 * Pattern: DOM-mount harness (vs. mirror-logic). Three pre-execution
 * decisions captured in WS-127:
 *   1. DOM-mount via RTL render + vi.mock for 4 contexts
 *   2. All 8 OnlineView decision points scoped
 *   3. Clean OnlineView scope (sub-components mocked at boundary; their
 *      internals are NOT audited here)
 *
 * AUDIT-ONLY: NO PRODUCTION CODE CHANGES are made by this file or its fixture.
 *
 * Pattern doc: .claude/context/INVARIANT_MATRIX_PATTERN.md
 * DOM-mount template: src/components/views/AnchorLibraryView/__tests__/AnchorLibraryView.test.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  fixtures,
  defaultSyncBridge,
  defaultOnlineSession,
  defaultAnalysis,
} from './OnlineView.invariants.fixture';

// ---------------------------------------------------------------------------
// Mutable mock state — beforeEach resets to defaults; per-row overrides via
// applyFixtureInputs(). Pattern lifted from AnchorLibraryView.test.jsx.
// ---------------------------------------------------------------------------
const mockSyncBridge = { ...defaultSyncBridge };
const mockOnlineSession = { ...defaultOnlineSession };
const mockAnalysis = { ...defaultAnalysis };
const mockToast = {
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
  dismissToast: vi.fn(),
  toasts: [],
};

vi.mock('../../../../contexts', () => ({
  useSyncBridge: () => mockSyncBridge,
  useOnlineSession: () => mockOnlineSession,
  useAnalysisContext: () => mockAnalysis,
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// ScaledContainer wraps OnlineView; its scaling math doesn't affect our
// assertions, but importing it pulls in DOM-measurement code that adds noise.
// Mock it to a passthrough.
vi.mock('../../../ui/ScaledContainer', () => ({
  ScaledContainer: ({ children }) => <div data-testid="scaled-container">{children}</div>,
}));

// VillainProfileModal is a 500+ line component with its own decision tree
// that's out of scope per "clean OnlineView scope". Mock at boundary.
vi.mock('../../../ui/VillainProfileModal', () => ({
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="villain-profile-modal-mounted" /> : null,
}));

// SeatGrid renders the selectable seats. We mock it because:
//   (a) Its internal headline-vs-stats branch is out of scope here.
//   (b) The mock exposes a button per seat that calls onSelectSeat — gives
//       tests a controllable way to set OnlineView's internal selectedSeat
//       useState without depending on SeatGrid's real DOM.
vi.mock('../SeatGrid', () => ({
  SeatGrid: ({ onSelectSeat, handCount }) => (
    <div data-testid="seat-grid-mounted" data-hand-count={handCount}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((seat) => (
        <button
          key={seat}
          data-testid={`seat-grid-seat-${seat}`}
          onClick={() => onSelectSeat(seat)}
        >
          Seat {seat}
        </button>
      ))}
    </div>
  ),
}));

// SeatDetailPanel — same scope-management rationale as SeatGrid. The mock
// exposes a testid so we can assert OnlineView's mounting decision
// (selectedSeatData → render panel) without depending on the real panel's
// internal sub-branches.
vi.mock('../SeatDetailPanel', () => ({
  SeatDetailPanel: ({ selectedSeat, selectedSeatData }) => (
    <div
      data-testid="seat-detail-panel-mounted"
      data-selected-seat={selectedSeat}
      data-has-data={selectedSeatData ? 'true' : 'false'}
    />
  ),
}));

// Import AFTER mocks so the mocked modules are wired before OnlineView resolves.
import { OnlineView } from '../OnlineView';

// ---------------------------------------------------------------------------
// Reset mocks between rows — fresh defaults + clear vi.fn() call counts.
// Per-row overrides applied in computeActualDom via Object.assign.
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Reset mutable state to deep copies of defaults so per-row mutations
  // don't leak across rows.
  Object.keys(mockSyncBridge).forEach((k) => delete mockSyncBridge[k]);
  Object.assign(mockSyncBridge, defaultSyncBridge);

  Object.keys(mockOnlineSession).forEach((k) => delete mockOnlineSession[k]);
  Object.assign(mockOnlineSession, defaultOnlineSession);

  Object.keys(mockAnalysis).forEach((k) => delete mockAnalysis[k]);
  Object.assign(mockAnalysis, defaultAnalysis);

  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Harness: apply fixture inputs to mock contexts, render, return container.
// Handles `setup.selectSeat` directive by clicking the mocked SeatGrid button.
// ---------------------------------------------------------------------------
function applyFixtureInputs(inputs) {
  if (inputs.syncBridge) Object.assign(mockSyncBridge, inputs.syncBridge);
  if (inputs.onlineSession) Object.assign(mockOnlineSession, inputs.onlineSession);
  if (inputs.analysis) Object.assign(mockAnalysis, inputs.analysis);
}

function computeActualDom(inputs) {
  applyFixtureInputs(inputs);
  const result = render(<OnlineView scale={1} />);

  // setup.selectSeat: click the seat button to drive OnlineView's
  // internal selectedSeat useState. Triggers a re-render.
  if (inputs.setup?.selectSeat != null) {
    const btn = screen.queryByTestId(`seat-grid-seat-${inputs.setup.selectSeat}`);
    if (btn) btn.click();
  }

  return result.container;
}

// ---------------------------------------------------------------------------
// DOM comparator — reads expected_per_spec { domPresent, domAbsent, testIds }
// and asserts via screen queries. Designed for shared runner's `compare` opt
// but we use it inline here to keep error reporting precise.
// ---------------------------------------------------------------------------
function assertDom(expected) {
  for (const text of expected.domPresent || []) {
    expect(
      screen.queryByText(text, { exact: false }),
      `expected DOM to contain text "${text}"`,
    ).not.toBeNull();
  }
  for (const text of expected.domAbsent || []) {
    expect(
      screen.queryByText(text, { exact: false }),
      `expected DOM to NOT contain text "${text}"`,
    ).toBeNull();
  }
  for (const [tid, present] of Object.entries(expected.testIds || {})) {
    if (present) {
      expect(
        screen.queryByTestId(tid),
        `expected testId "${tid}" to be present`,
      ).not.toBeNull();
    } else {
      expect(
        screen.queryByTestId(tid),
        `expected testId "${tid}" to be absent`,
      ).toBeNull();
    }
  }
}

// ---------------------------------------------------------------------------
// Partition fixture by status. spec_gap rows skip; pinned_bug rows assert
// against actual_today (locking current behavior); regression_pinned and
// matches assert against expected_per_spec.
// ---------------------------------------------------------------------------
const matchesRows = fixtures.filter((r) => r.status === 'matches');
const pinnedBugRows = fixtures.filter((r) => r.status === 'pinned_bug');
const specGapRows = fixtures.filter((r) => r.status === 'spec_gap');
const regressionRows = fixtures.filter((r) => r.status === 'regression_pinned');

describe('OnlineView decision-point invariants — WS-127 / ICP-2', () => {
  it('fixture row count + status breakdown', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    const sum =
      matchesRows.length +
      pinnedBugRows.length +
      specGapRows.length +
      regressionRows.length;
    expect(sum).toBe(fixtures.length);
  });

  it('every row has a unique id', () => {
    const ids = fixtures.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every row has a recognized category', () => {
    const allowed = new Set([
      'connection_status',
      'version_mismatch',
      'sync_error',
      'session_selector',
      'empty_state',
      'main_content',
      'detail_panel',
      'importing_state',
    ]);
    for (const row of fixtures) {
      expect(allowed.has(row.category)).toBe(true);
    }
  });

  if (matchesRows.length > 0) {
    describe('matches (spec === actual)', () => {
      it.each(matchesRows)('$id $scenario_label', (row) => {
        computeActualDom(row.inputs);
        assertDom(row.expected_per_spec);
      });
    });
  }

  if (pinnedBugRows.length > 0) {
    describe('pinned bugs (actual diverges from spec — fix-wave will close)', () => {
      it.each(pinnedBugRows)('$id $scenario_label [$bug_id]', (row) => {
        computeActualDom(row.inputs);
        // Lock current (broken) reality so any code change is detected.
        assertDom(row.actual_today);
        // Confirm spec divergence is real — defensive against accidentally
        // flipping pinned_bug → matches without removing actual_today.
        expect(row.expected_per_spec).not.toEqual(row.actual_today);
      });
    });
  }

  if (specGapRows.length > 0) {
    describe('spec gaps (code or test-seam cannot express scenario — structural finding)', () => {
      it.skip.each(specGapRows)(
        '$id $scenario_label — gap: $comment',
        () => {}
      );
    });
  }

  if (regressionRows.length > 0) {
    describe('regression pins (must stay fixed)', () => {
      it.each(regressionRows)(
        '$id $scenario_label [fixed in $fixed_in]',
        (row) => {
          computeActualDom(row.inputs);
          assertDom(row.expected_per_spec);
        }
      );
    });
  }
});

// ---------------------------------------------------------------------------
// WS-076: Interaction-driven behaviors that don't fit the state-only matrix.
// Click-handlers and toast side-effects need imperative tests.
// ---------------------------------------------------------------------------
describe('WS-076 — version-mismatch diagnostic modal interactions', () => {
  it('clicking "Reload Page" in the banner opens the diagnostic modal', () => {
    Object.assign(mockSyncBridge, {
      versionMismatch: true,
      extProtocolVersion: 99,
      extManifestVersion: '99.99.99',
      appProtocolVersion: 2,
    });

    render(<OnlineView scale={1} />);

    // Modal absent initially
    expect(screen.queryByTestId('version-mismatch-modal')).toBeNull();

    // Click the banner's Reload Page button (banner is data-testid="version-mismatch-banner")
    const banner = screen.getByTestId('version-mismatch-banner');
    const reloadBtn = banner.querySelector('button');  // first button in banner is Reload Page
    expect(reloadBtn.textContent).toBe('Reload Page');
    // fireEvent wraps the dispatch in act() so React 18 state updates flush
    // before the next assertion (plain .click() fires the DOM event but
    // doesn't await the React render cycle).
    fireEvent.click(reloadBtn);

    // Modal now mounted
    expect(screen.queryByTestId('version-mismatch-modal')).not.toBeNull();
    expect(screen.queryByText('99.99.99', { exact: false })).not.toBeNull();
  });

  it('postReloadStatus="recovered" fires a success toast and clears the flag', () => {
    const clearMock = vi.fn();
    Object.assign(mockSyncBridge, {
      versionMismatch: false,
      postReloadStatus: 'recovered',
      clearPostReloadStatus: clearMock,
      extProtocolVersion: 2,
      extManifestVersion: '0.9.0',
      appProtocolVersion: 2,
    });

    render(<OnlineView scale={1} />);

    expect(mockToast.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('in sync')
    );
    expect(clearMock).toHaveBeenCalled();
  });

  it('cancelling the modal when auto-opened by still-mismatched clears the post-reload status', () => {
    const clearMock = vi.fn();
    Object.assign(mockSyncBridge, {
      versionMismatch: true,
      postReloadStatus: 'still-mismatched',
      clearPostReloadStatus: clearMock,
      extProtocolVersion: 99,
      extManifestVersion: '99.99.99',
      appProtocolVersion: 2,
    });

    render(<OnlineView scale={1} />);

    // Modal is auto-open per fixture row OV-VM-004
    const modal = screen.getByTestId('version-mismatch-modal');
    expect(modal).not.toBeNull();

    // Cancel button inside modal
    const cancelBtn = Array.from(modal.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    );
    expect(cancelBtn).not.toBeUndefined();
    cancelBtn.click();

    expect(clearMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WS-077: dismissed-state interactions (pip click, banner→pip swap on dismiss)
// ---------------------------------------------------------------------------
describe('WS-077 — dismiss-state interactions (Continue Anyway graceful degradation)', () => {
  it('clicking the amber pip reopens the version-mismatch modal', () => {
    Object.assign(mockSyncBridge, {
      versionMismatch: true,
      dismissedDespiteMismatch: true,
      extProtocolVersion: 99,
      extManifestVersion: '99.99.99',
      appProtocolVersion: 2,
    });

    render(<OnlineView scale={1} />);

    // Banner absent (suppressed by dismissed state); pip present
    expect(screen.queryByTestId('version-mismatch-banner')).toBeNull();
    const pip = screen.getByTestId('version-mismatch-pip');
    expect(pip).not.toBeNull();
    expect(screen.queryByTestId('version-mismatch-modal')).toBeNull();

    fireEvent.click(pip);

    // Modal opens with diagnostic
    expect(screen.queryByTestId('version-mismatch-modal')).not.toBeNull();
    expect(screen.queryByText('99.99.99', { exact: false })).not.toBeNull();
  });

  it('pip is absent when versionMismatch is false (no degraded state to advertise)', () => {
    Object.assign(mockSyncBridge, {
      versionMismatch: false,
      dismissedDespiteMismatch: false,
      isExtensionConnected: true,
    });

    render(<OnlineView scale={1} />);

    expect(screen.queryByTestId('version-mismatch-pip')).toBeNull();
    expect(screen.queryByTestId('version-mismatch-banner')).toBeNull();
  });

  it('pip is absent when dismissedDespiteMismatch is false even with active mismatch (banner shows instead)', () => {
    Object.assign(mockSyncBridge, {
      versionMismatch: true,
      dismissedDespiteMismatch: false,
    });

    render(<OnlineView scale={1} />);

    expect(screen.queryByTestId('version-mismatch-pip')).toBeNull();
    expect(screen.queryByTestId('version-mismatch-banner')).not.toBeNull();
  });
});
