// @vitest-environment jsdom
/**
 * AnchorLibraryView.test.jsx — top-level shell coverage.
 *
 * Mocks useAnchorLibrary + useUI + useSession to isolate the view from real
 * IDB/context. Covers:
 *   - Empty state branching (newcomer vs zero-anchors vs list)
 *   - Default A-Z sort by archetypeName (AP-01 refusal)
 *   - Red line #6 flat-access (retired anchors render in default list)
 *   - Back button wiring → setCurrentScreen(SCREEN.TABLE)
 *   - Loading state when isReady=false
 *
 * EAL Phase 6 — Session 18 (S18).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mutable mock state — tests override per scenario.
let mockAnchorLibrary;
let mockSession;
let mockSetCurrentScreen;
let mockView;
let mockToggleFilter;
let mockSetSort;
let mockClearFilters;

vi.mock('../../../../contexts/AnchorLibraryContext', () => ({
  useAnchorLibrary: () => mockAnchorLibrary,
}));

vi.mock('../../../../contexts', () => ({
  useUI: () => ({ setCurrentScreen: mockSetCurrentScreen }),
  useSession: () => mockSession,
}));

vi.mock('../../../../hooks/useAnchorLibraryView', () => ({
  useAnchorLibraryView: () => ({
    view: mockView,
    toggleFilter: mockToggleFilter,
    setSort: mockSetSort,
    setFilters: vi.fn(),
    clearFilters: mockClearFilters,
    resetView: vi.fn(),
  }),
}));

import { AnchorLibraryView } from '../AnchorLibraryView';
import { ANCHOR_LIBRARY_UNLOCK_THRESHOLD } from '../../../../constants/anchorLibraryConstants';
import { EMPTY_FILTERS } from '../../../../utils/anchorLibrary/librarySelectors';
import { DEFAULT_SORT_STRATEGY } from '../../../../utils/anchorLibrary/anchorSortStrategies';

const makeAnchor = (overrides = {}) => ({
  id: `anchor:${overrides.archetypeName || 'x'}`,
  archetypeName: 'Test Anchor',
  status: 'active',
  tier: 2,
  polarity: 'overfold',
  lineSequence: [{ street: 'river' }],
  evidence: { pointEstimate: 0.5 },
  validation: { timesApplied: 0 },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSetCurrentScreen = vi.fn();
  mockToggleFilter = vi.fn();
  mockSetSort = vi.fn();
  mockClearFilters = vi.fn();
  mockView = { filters: { ...EMPTY_FILTERS }, sort: DEFAULT_SORT_STRATEGY };
  mockAnchorLibrary = {
    isReady: true,
    selectAllAnchors: () => [],
  };
  // Default: post-threshold (so newcomer state doesn't dominate tests)
  mockSession = {
    allSessions: [{ id: 's1', handCount: ANCHOR_LIBRARY_UNLOCK_THRESHOLD + 5 }],
    currentSession: null,
  };
});

describe('AnchorLibraryView — header', () => {
  it('renders the page title', () => {
    render(<AnchorLibraryView />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anchor Library');
  });

  it('renders the Back button with proper aria-label', () => {
    render(<AnchorLibraryView />);
    expect(screen.getByLabelText(/Back to table/i)).toBeInTheDocument();
  });

  it('Back button calls setCurrentScreen with SCREEN.TABLE', () => {
    render(<AnchorLibraryView />);
    fireEvent.click(screen.getByLabelText(/Back to table/i));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith('table');
  });

  it('shows Loading… hint when isReady=false', () => {
    mockAnchorLibrary = { ...mockAnchorLibrary, isReady: false };
    render(<AnchorLibraryView />);
    expect(screen.getByText(/Loading…/)).toBeInTheDocument();
  });

  it('hides Loading… hint when isReady=true', () => {
    render(<AnchorLibraryView />);
    expect(screen.queryByText(/Loading…/)).toBeNull();
  });
});

describe('AnchorLibraryView — newcomer empty state', () => {
  it('renders newcomer empty state when total hands seen < threshold', () => {
    mockSession = { allSessions: [{ id: 's1', handCount: 3 }], currentSession: null };
    render(<AnchorLibraryView />);
    const emptyState = screen.getByTestId('anchor-library-empty-state');
    expect(emptyState).toHaveAttribute('data-variant', 'newcomer');
    expect(emptyState.textContent).toMatch(/progress: 3 \/ 25/);
  });

  it('sums handCount across all archived sessions', () => {
    mockSession = {
      allSessions: [
        { id: 's1', handCount: 5 },
        { id: 's2', handCount: 7 },
      ],
      currentSession: null,
    };
    render(<AnchorLibraryView />);
    const emptyState = screen.getByTestId('anchor-library-empty-state');
    expect(emptyState).toHaveAttribute('data-variant', 'newcomer');
    expect(emptyState.textContent).toMatch(/progress: 12 \/ 25/);
  });

  it('adds in-flight currentSession.handCount when not already in allSessions', () => {
    mockSession = {
      allSessions: [{ id: 's1', handCount: 5 }],
      currentSession: { id: 's-live', handCount: 3 },
    };
    render(<AnchorLibraryView />);
    const emptyState = screen.getByTestId('anchor-library-empty-state');
    expect(emptyState.textContent).toMatch(/progress: 8 \/ 25/);
  });

  it('avoids double-counting currentSession when already in allSessions', () => {
    mockSession = {
      allSessions: [{ id: 's-live', handCount: 5 }],
      currentSession: { id: 's-live', handCount: 5 },
    };
    render(<AnchorLibraryView />);
    const emptyState = screen.getByTestId('anchor-library-empty-state');
    expect(emptyState.textContent).toMatch(/progress: 5 \/ 25/);
  });

  it('handles empty allSessions defensively', () => {
    mockSession = { allSessions: [], currentSession: null };
    render(<AnchorLibraryView />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'newcomer');
  });

  it('handles undefined session shape defensively', () => {
    mockSession = { allSessions: undefined, currentSession: undefined };
    render(<AnchorLibraryView />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'newcomer');
  });

  it('does not render the anchor list while in newcomer state (even if anchors exist)', () => {
    mockSession = { allSessions: [{ id: 's1', handCount: 1 }], currentSession: null };
    mockAnchorLibrary.selectAllAnchors = () => [makeAnchor({ archetypeName: 'X' })];
    render(<AnchorLibraryView />);
    expect(screen.queryByTestId('anchor-library-list')).toBeNull();
    expect(screen.queryByTestId('anchor-card')).toBeNull();
  });
});

describe('AnchorLibraryView — zero-anchors empty state', () => {
  it('renders zero-anchors variant when post-threshold + no anchors', () => {
    mockAnchorLibrary.selectAllAnchors = () => [];
    render(<AnchorLibraryView />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'zero-anchors');
  });

  it('does not render the anchor list', () => {
    mockAnchorLibrary.selectAllAnchors = () => [];
    render(<AnchorLibraryView />);
    expect(screen.queryByTestId('anchor-library-list')).toBeNull();
  });
});

describe('AnchorLibraryView — anchor list', () => {
  it('renders a list of anchor cards when anchors exist', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      makeAnchor({ archetypeName: 'Alpha' }),
      makeAnchor({ archetypeName: 'Beta' }),
      makeAnchor({ archetypeName: 'Gamma' }),
    ];
    render(<AnchorLibraryView />);
    expect(screen.getAllByTestId('anchor-card').length).toBe(3);
  });

  it('renders "Showing N of M anchors" hint', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      makeAnchor({ archetypeName: 'Alpha' }),
      makeAnchor({ archetypeName: 'Beta' }),
    ];
    render(<AnchorLibraryView />);
    expect(screen.getByText(/Showing 2 of 2 anchors/)).toBeInTheDocument();
  });

  it('sorts cards alphabetically by archetypeName (AP-01 — no edge-descending default)', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      makeAnchor({ archetypeName: 'Charlie' }),
      makeAnchor({ archetypeName: 'Alpha' }),
      makeAnchor({ archetypeName: 'Bravo' }),
    ];
    render(<AnchorLibraryView />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('alphabetical sort is case-insensitive', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      makeAnchor({ archetypeName: 'beta' }),
      makeAnchor({ archetypeName: 'Alpha' }),
    ];
    render(<AnchorLibraryView />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Alpha', 'beta']);
  });

  it('does NOT sort by edge / pointEstimate / firing count (AP-01)', () => {
    // If sorted by pointEstimate desc, order would be C(0.9), A(0.5), B(0.3).
    mockAnchorLibrary.selectAllAnchors = () => [
      makeAnchor({ archetypeName: 'Charlie', evidence: { pointEstimate: 0.9 } }),
      makeAnchor({ archetypeName: 'Alpha', evidence: { pointEstimate: 0.5 } }),
      makeAnchor({ archetypeName: 'Bravo', evidence: { pointEstimate: 0.3 } }),
    ];
    render(<AnchorLibraryView />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Alpha', 'Bravo', 'Charlie']); // alpha order, NOT edge order
  });

  it('renders retired anchors alongside active (red line #6 — flat access)', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      makeAnchor({ archetypeName: 'Active One', status: 'active' }),
      makeAnchor({ archetypeName: 'Retired One', status: 'retired' }),
      makeAnchor({ archetypeName: 'Expiring One', status: 'expiring' }),
    ];
    render(<AnchorLibraryView />);
    const cards = screen.getAllByTestId('anchor-card');
    expect(cards.length).toBe(3);
    const statuses = cards.map((c) => c.getAttribute('data-status'));
    expect(statuses).toContain('active');
    expect(statuses).toContain('retired');
    expect(statuses).toContain('expiring');
  });

  it('handles missing archetypeName via React key fallback (no crash)', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      { id: 'a1', archetypeName: undefined, status: 'active', evidence: { pointEstimate: 0.5 } },
    ];
    expect(() => render(<AnchorLibraryView />)).not.toThrow();
    expect(screen.getByText(/unnamed anchor/i)).toBeInTheDocument();
  });

  it('does not render newcomer or zero empty states when anchors exist', () => {
    mockAnchorLibrary.selectAllAnchors = () => [makeAnchor({ archetypeName: 'X' })];
    render(<AnchorLibraryView />);
    expect(screen.queryByTestId('anchor-library-empty-state')).toBeNull();
  });
});

describe('AnchorLibraryView — DOM structure (red-line compliance)', () => {
  it('renders role=main on the root container', () => {
    render(<AnchorLibraryView />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('does NOT render any progress-bar element on the page (red line #5)', () => {
    mockSession = { allSessions: [{ id: 's1', handCount: 5 }], currentSession: null };
    const { container } = render(<AnchorLibraryView />);
    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});

// =============================================================================
// S19 — Filters + sort wiring
// =============================================================================

describe('AnchorLibraryView — S19 filters + sort wiring', () => {
  it('renders AnchorFilters when post-threshold (anchors may exist)', () => {
    render(<AnchorLibraryView />);
    expect(screen.getByTestId('anchor-filters')).toBeInTheDocument();
  });

  it('does NOT render AnchorFilters in newcomer state', () => {
    mockSession = { allSessions: [{ id: 's1', handCount: 1 }], currentSession: null };
    render(<AnchorLibraryView />);
    expect(screen.queryByTestId('anchor-filters')).toBeNull();
  });

  it('applies a single filter group (statuses) and renders only matches', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      { id: 'a1', archetypeName: 'Active One', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5 } },
      { id: 'a2', archetypeName: 'Retired One', status: 'retired', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5 } },
    ];
    mockView = { filters: { ...EMPTY_FILTERS, statuses: ['active'] }, sort: DEFAULT_SORT_STRATEGY };
    render(<AnchorLibraryView />);
    const cards = screen.getAllByTestId('anchor-card');
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('data-status')).toBe('active');
  });

  it('shows "Showing 1 of 2" hint when filter narrows the list', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      { id: 'a1', archetypeName: 'Active One', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5 } },
      { id: 'a2', archetypeName: 'Retired One', status: 'retired', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5 } },
    ];
    mockView = { filters: { ...EMPTY_FILTERS, statuses: ['active'] }, sort: DEFAULT_SORT_STRATEGY };
    render(<AnchorLibraryView />);
    expect(screen.getByText(/Showing 1 of 2 anchors/)).toBeInTheDocument();
  });

  it('renders zero-filter-matches empty state when filters exclude all', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      { id: 'a1', archetypeName: 'Active One', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5 } },
    ];
    mockView = { filters: { ...EMPTY_FILTERS, statuses: ['retired'] }, sort: DEFAULT_SORT_STRATEGY };
    render(<AnchorLibraryView />);
    const empty = screen.getByTestId('anchor-library-empty-state');
    expect(empty).toHaveAttribute('data-variant', 'zero-filter-matches');
    // Anchor cards aren't rendered.
    expect(screen.queryByTestId('anchor-library-list')).toBeNull();
  });

  it('zero-filter-matches Clear filters button calls clearFilters', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      { id: 'a1', archetypeName: 'Active One', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5 } },
    ];
    mockView = { filters: { ...EMPTY_FILTERS, statuses: ['retired'] }, sort: DEFAULT_SORT_STRATEGY };
    render(<AnchorLibraryView />);
    // The empty state Clear button exists; clicking it dispatches clearFilters.
    const buttons = screen.getAllByRole('button', { name: /Clear all filters/i });
    fireEvent.click(buttons[0]);
    expect(mockClearFilters).toHaveBeenCalled();
  });

  it('shows zero-anchors variant when allAnchors is empty (filters do not matter)', () => {
    mockAnchorLibrary.selectAllAnchors = () => [];
    mockView = { filters: { ...EMPTY_FILTERS, statuses: ['retired'] }, sort: DEFAULT_SORT_STRATEGY };
    render(<AnchorLibraryView />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'zero-anchors');
  });

  it('applies sort=sample-size when view.sort is sample-size', () => {
    mockAnchorLibrary.selectAllAnchors = () => [
      { id: 'a', archetypeName: 'Alpha', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5, sampleSize: 5 } },
      { id: 'b', archetypeName: 'Bravo', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5, sampleSize: 50 } },
      { id: 'c', archetypeName: 'Charlie', status: 'active', polarity: 'overfold', tier: 2, lineSequence: [{ street: 'river' }], evidence: { pointEstimate: 0.5, sampleSize: 20 } },
    ];
    mockView = { filters: { ...EMPTY_FILTERS }, sort: 'sample-size' };
    render(<AnchorLibraryView />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    // Largest sampleSize first: 50 → 20 → 5
    expect(headings).toEqual(['Bravo', 'Charlie', 'Alpha']);
  });
});
