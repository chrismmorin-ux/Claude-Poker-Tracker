/**
 * CalibrationDashboardView.test.jsx — Calibration Dashboard tests.
 *
 * Three coverage layers:
 *   1. AP-06 DOM-assertion — render dashboard with seeded anchors and
 *      assert no element textContent matches `FORBIDDEN_PATTERNS` from
 *      `calibrationCopy.js`. This is condition C2 from Gate 1 audit
 *      (entry-calibration-dashboard, 2026-05-09).
 *   2. AP-08 DOM-assertion — render dashboard with mixed-origin
 *      observations and assert every evidence card carries an
 *      `origin-badge` element (count === evidence row count).
 *   3. Routine view tests — header, tabs, deep-link auto-expand, empty
 *      states, back-nav.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock state — tests override per scenario
let mockAnchorLibraryState;
let mockUiState;
let mockOpenSettings;
let mockToast;

vi.mock('../../../../contexts/AnchorLibraryContext', () => ({
  useAnchorLibrary: () => mockAnchorLibraryState,
}));

vi.mock('../../../../contexts', () => ({
  useUI: () => mockUiState,
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../../../hooks/useAnchorRetirement', () => ({
  useAnchorRetirement: () => ({
    pendingCopy: null,
    beginRetirement: vi.fn(),
    cancelRetirement: vi.fn(),
    confirmRetirement: vi.fn(),
  }),
}));

// Mock RetirementConfirmModal so we don't pull in the entire modal infra
// for these surface tests.
vi.mock('../../AnchorLibraryView/RetirementConfirmModal', () => ({
  RetirementConfirmModal: () => null,
}));

import { CalibrationDashboardView } from '../CalibrationDashboardView';
import { FORBIDDEN_PATTERNS } from '../../../../utils/anchorLibrary/calibrationCopy';

const makeAnchor = (overrides = {}) => ({
  id: 'anchor:nit:river:overfold:scare-card-4flush',
  archetypeName: 'Nit overfold on 4-flush river',
  status: 'active',
  tier: 2,
  polarity: 'overfold',
  perceptionPrimitiveIds: ['PP-01'],
  lineSequence: [{ street: 'river' }],
  evidence: {
    pointEstimate: 0.74,
    sampleSize: 34,
    credibleInterval: { lower: 0.64, upper: 0.84, level: 0.95 },
  },
  gtoBaseline: {
    method: 'MDF',
    referenceRate: 0.68,
  },
  validation: {
    lastFiredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  ...overrides,
});

const makeObservation = (overrides = {}) => ({
  id: `obs:${Math.random().toString(36).slice(2, 8)}`,
  anchorId: 'anchor:nit:river:overfold:scare-card-4flush',
  origin: 'matcher-system',
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  evDeltaBb: 0.42,
  supportsClaim: true,
  ...overrides,
});

const makePrimitive = (overrides = {}) => ({
  id: 'PP-01',
  name: 'Nit re-weights aggressively on scare cards',
  appliesToStyles: ['Nit', 'TAG'],
  validityScore: {
    pointEstimate: 0.78,
    credibleInterval: { lower: 0.62, upper: 0.91, level: 0.95 },
    dependentAnchorCount: 2,
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset localStorage so localStorage-persisted active-tab does not leak
  // across tests.
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }

  const anchor = makeAnchor();
  const matcherObs = [
    makeObservation({ id: 'obs:m1', origin: 'matcher-system' }),
    makeObservation({ id: 'obs:m2', origin: 'matcher-system', createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }),
  ];
  const ownerObs = [
    makeObservation({ id: 'obs:o1', origin: 'owner-captured', evDeltaBb: undefined, supportsClaim: undefined, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }),
  ];

  mockAnchorLibraryState = {
    anchors: { [anchor.id]: anchor },
    observations: { 'obs:m1': matcherObs[0], 'obs:m2': matcherObs[1], 'obs:o1': ownerObs[0] },
    primitives: { 'PP-01': makePrimitive() },
    enrollment: { observation_enrollment_state: 'enrolled' },
    isReady: true,
    isEnrolled: () => true,
    selectAllAnchors: () => [anchor],
    selectAllPrimitives: () => [makePrimitive()],
    dispatchAnchorLibrary: vi.fn(),
  };

  mockUiState = {
    dashboardAnchorDeepLink: null,
    dashboardReturnScreen: null,
    closeCalibrationDashboard: vi.fn(),
    setCurrentScreen: vi.fn(),
    SCREEN: { SETTINGS: 'settings' },
  };

  mockOpenSettings = vi.fn();
  mockToast = {
    showInfo: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
  };
});

describe('CalibrationDashboardView — header + structure', () => {
  it('renders the page title', () => {
    render(<CalibrationDashboardView />);
    expect(screen.getByRole('heading', { name: /Calibration Dashboard/i })).toBeTruthy();
  });

  it('renders Back button', () => {
    render(<CalibrationDashboardView />);
    const back = screen.getByTestId('calibration-dashboard-back');
    expect(back).toBeTruthy();
    fireEvent.click(back);
    expect(mockUiState.closeCalibrationDashboard).toHaveBeenCalled();
  });

  it('renders all 3 tabs', () => {
    render(<CalibrationDashboardView />);
    expect(screen.getByTestId('calibration-tab-predicates')).toBeTruthy();
    expect(screen.getByTestId('calibration-tab-anchors')).toBeTruthy();
    expect(screen.getByTestId('calibration-tab-primitives')).toBeTruthy();
  });

  it('defaults to Anchors tab on cold open', () => {
    render(<CalibrationDashboardView />);
    const anchorsTab = screen.getByTestId('calibration-tab-anchors');
    expect(anchorsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('anchor-calibration-panel')).toBeTruthy();
  });
});

describe('CalibrationDashboardView — deep-link entry', () => {
  it('expands the deep-linked anchor on entry', () => {
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    expect(screen.getByTestId('calibration-deep-link-marker')).toBeTruthy();
    expect(screen.getByTestId('dashboard-anchor-detail-panel')).toBeTruthy();
  });

  it('lands on Anchors tab even if last-viewed was different', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('calibrationDashboard.activeTab', 'primitives');
    }
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    const anchorsTab = screen.getByTestId('calibration-tab-anchors');
    expect(anchorsTab.getAttribute('aria-selected')).toBe('true');
  });
});

describe('CalibrationDashboardView — tab switching', () => {
  it('clicking Predicates tab renders the empty-state shell', () => {
    render(<CalibrationDashboardView />);
    fireEvent.click(screen.getByTestId('calibration-tab-predicates'));
    expect(screen.getByTestId('predicate-calibration-panel')).toBeTruthy();
  });

  it('clicking Primitives tab renders the primitive list', () => {
    render(<CalibrationDashboardView />);
    fireEvent.click(screen.getByTestId('calibration-tab-primitives'));
    expect(screen.getByTestId('primitive-calibration-panel')).toBeTruthy();
    const rows = screen.getAllByTestId('primitive-row');
    expect(rows.length).toBe(1);
  });
});

describe('CalibrationDashboardView — enrollment banner', () => {
  it('renders banner when not-enrolled', () => {
    mockAnchorLibraryState.enrollment = { observation_enrollment_state: 'not-enrolled' };
    mockAnchorLibraryState.isEnrolled = () => false;
    render(<CalibrationDashboardView />);
    expect(screen.getByTestId('enrollment-state-banner')).toBeTruthy();
  });

  it('omits banner when enrolled', () => {
    render(<CalibrationDashboardView />);
    expect(screen.queryByTestId('enrollment-state-banner')).toBeNull();
  });

  // WS-222 — CTA wiring: the banner's "Open Settings" button navigates to
  // SettingsView, where the Anchor Calibration enrollment toggle lives.
  it('renders the Open Settings CTA when not-enrolled', () => {
    mockAnchorLibraryState.enrollment = { observation_enrollment_state: 'not-enrolled' };
    mockAnchorLibraryState.isEnrolled = () => false;
    render(<CalibrationDashboardView />);
    expect(screen.getByRole('button', { name: /Open Settings/i })).toBeTruthy();
  });

  it('clicking Open Settings navigates to SCREEN.SETTINGS', () => {
    mockAnchorLibraryState.enrollment = { observation_enrollment_state: 'not-enrolled' };
    mockAnchorLibraryState.isEnrolled = () => false;
    render(<CalibrationDashboardView />);
    fireEvent.click(screen.getByRole('button', { name: /Open Settings/i }));
    expect(mockUiState.setCurrentScreen).toHaveBeenCalledWith('settings');
  });
});

describe('CalibrationDashboardView — empty states', () => {
  it('renders calibration empty state when zero anchors', () => {
    mockAnchorLibraryState.selectAllAnchors = () => [];
    mockAnchorLibraryState.anchors = {};
    render(<CalibrationDashboardView />);
    expect(screen.getByTestId('calibration-empty-state')).toBeTruthy();
  });
});

describe('CalibrationDashboardView — AP-06 DOM-assertion (graded-work refusal)', () => {
  it('rendered textContent contains no FORBIDDEN_PATTERNS strings (anchors tab)', () => {
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    const view = screen.getByTestId('calibration-dashboard-view');
    const text = view.textContent || '';
    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = text.match(pattern);
      expect(match, `AP-06 violation: rendered text contains "${match?.[0]}" matching ${pattern}`).toBeNull();
    }
  });

  it('rendered textContent contains no FORBIDDEN_PATTERNS strings (predicates tab empty state)', () => {
    render(<CalibrationDashboardView />);
    fireEvent.click(screen.getByTestId('calibration-tab-predicates'));
    const view = screen.getByTestId('calibration-dashboard-view');
    const text = view.textContent || '';
    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = text.match(pattern);
      expect(match, `AP-06 violation in Predicates tab: "${match?.[0]}" matches ${pattern}`).toBeNull();
    }
  });

  it('rendered textContent contains no FORBIDDEN_PATTERNS strings (primitives tab)', () => {
    render(<CalibrationDashboardView />);
    fireEvent.click(screen.getByTestId('calibration-tab-primitives'));
    const view = screen.getByTestId('calibration-dashboard-view');
    const text = view.textContent || '';
    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = text.match(pattern);
      expect(match, `AP-06 violation in Primitives tab: "${match?.[0]}" matches ${pattern}`).toBeNull();
    }
  });
});

describe('CalibrationDashboardView — AP-08 DOM-assertion (origin-separation)', () => {
  it('every evidence card carries an origin-badge element (count parity)', () => {
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    const evidenceCards = screen.getAllByTestId('evidence-card');
    const originBadges = screen.getAllByTestId('origin-badge');
    expect(evidenceCards.length).toBeGreaterThan(0);
    expect(originBadges.length).toBe(evidenceCards.length);
  });

  it('per-origin counts are rendered separately, never as a single sum', () => {
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    const counts = screen.getByTestId('panel-origin-counts');
    // Both labels MUST appear separately
    expect(counts.textContent).toContain('Matcher firings');
    expect(counts.textContent).toContain('Owner-captured observations');
  });

  it('matcher and owner-captured rows render with distinct origin labels', () => {
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    const evidenceCards = screen.getAllByTestId('evidence-card');
    const origins = evidenceCards.map((card) => card.getAttribute('data-origin'));
    expect(origins).toContain('matcher-system');
    expect(origins).toContain('owner-captured');
  });
});

describe('CalibrationDashboardView — operator dial deferral (WS-176)', () => {
  it('AnchorDetailPanel does NOT render an operator-dial slider', () => {
    mockUiState.dashboardAnchorDeepLink = 'anchor:nit:river:overfold:scare-card-4flush';
    render(<CalibrationDashboardView />);
    const panel = screen.getByTestId('dashboard-anchor-detail-panel');
    // Per Gate 4 spec amendment 2026-05-09, the dial is DEFERRED to WS-176.
    // The panel renders Retire / Suppress / Reset buttons only.
    expect(within(panel).queryByLabelText(/operator dial/i)).toBeNull();
    expect(within(panel).queryByRole('slider')).toBeNull();
    expect(within(panel).getByTestId('override-retire')).toBeTruthy();
    expect(within(panel).getByTestId('override-suppress')).toBeTruthy();
    expect(within(panel).getByTestId('override-reset')).toBeTruthy();
  });
});
