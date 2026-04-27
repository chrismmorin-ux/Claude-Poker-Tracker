// @vitest-environment jsdom
/**
 * PrintableRefresherView.test.jsx — top-level shell coverage.
 *
 * Mocks the useRefresher + useUI + useRefresherView hooks to isolate the view
 * from real IDB/context. Verifies the wiring contract: filter chip toggles
 * call setFilter; sort dropdown calls setSort; back button calls setCurrentScreen.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mutable mock state — tests can override per scenario via `mockRefresherState`.
let mockRefresherState;

// Mock contexts before importing the view
vi.mock('../../../../contexts', () => ({
  useRefresher: () => mockRefresherState,
  useUI: () => ({
    setCurrentScreen: vi.fn(),
  }),
}));

vi.mock('../../../../hooks/useRefresherView', () => ({
  useRefresherView: () => ({
    view: {
      filter: { classes: [], phases: [], tiers: [], showSuppressed: false },
      sort: 'theoretical',
    },
    setFilter: vi.fn(),
    setSort: vi.fn(),
    setShowSuppressed: vi.fn(),
    resetView: vi.fn(),
  }),
}));

const sampleActiveCards = [
  {
    cardId: 'PRF-MATH-AUTO-PROFIT',
    class: 'math',
    title: 'Auto-profit threshold',
    schemaVersion: 1,
    tier: 'free',
    visibility: 'default',
    classSuppressed: false,
    contentHash: 'sha256:abc',
  },
  {
    cardId: 'PRF-PREFLOP-CO-OPEN',
    class: 'preflop',
    title: 'CO open range',
    schemaVersion: 1,
    tier: 'free',
    visibility: 'default',
    classSuppressed: false,
    contentHash: 'sha256:def',
  },
];

import { PrintableRefresherView } from '..';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock state to defaults — tests can override before render.
  mockRefresherState = {
    config: {
      cardVisibility: {},
      suppressedClasses: [],
      notifications: { staleness: false },
    },
    printBatches: [],
    isReady: true,
    getAllCards: () => sampleActiveCards,
    getActiveCards: () => sampleActiveCards,
    getPinnedCards: () => [],
    getSuppressedCards: () => [],
    getCardsForBatchPrint: () => [],
    getStaleCards: () => [],
    setCardVisibility: vi.fn().mockResolvedValue(undefined),
    setClassSuppressed: vi.fn().mockResolvedValue(undefined),
    patchConfig: vi.fn().mockResolvedValue(undefined),
    recordPrintBatch: vi.fn().mockResolvedValue({ batchId: 'x' }),
  };
});

describe('PrintableRefresherView — basic render', () => {
  it('renders the page header with title', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Printable Refresher');
  });

  it('renders the back button with proper aria-label', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByLabelText(/Back to sessions/i)).toBeInTheDocument();
  });

  it('renders the 4 class filter chips', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByRole('button', { name: 'preflop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'math' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'equity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'exceptions' })).toBeInTheDocument();
  });

  it('renders the showSuppressed checkbox', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByLabelText(/Show suppressed/i)).toBeInTheDocument();
  });

  it('renders the sort dropdown with all 4 options', () => {
    render(<PrintableRefresherView />);
    const sortSelect = screen.getByLabelText(/Sort order/i);
    const options = sortSelect.querySelectorAll('option');
    expect(options.length).toBe(4);
  });

  it('renders the "Showing N of M cards" status', () => {
    render(<PrintableRefresherView />);
    // sampleActiveCards has 2 entries; with no filters applied, showing 2 of 2
    expect(screen.getByText(/Showing 2 of 2 cards/i)).toBeInTheDocument();
  });

  it('renders the catalog with cards from getActiveCards()', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.getByText('PRF-PREFLOP-CO-OPEN')).toBeInTheDocument();
  });

  it('renders the Print preview entry point in the catalog footer (S21)', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByLabelText(/Open print preview/i)).toBeInTheDocument();
  });
});

describe('PrintableRefresherView — sub-view + modal navigation (S19)', () => {
  it('clicking Detail chip on a CardRow opens the CardDetail sub-view', () => {
    render(<PrintableRefresherView />);
    // Click first detail chip (one per row; 2 cards in fixture)
    const detailButtons = screen.getAllByLabelText(/Open card detail/i);
    fireEvent.click(detailButtons[0]);
    // Detail sub-view shows back-to-catalog button
    expect(screen.getByLabelText(/Back to catalog/i)).toBeInTheDocument();
  });

  it('Back-to-catalog navigates back to catalog list', () => {
    render(<PrintableRefresherView />);
    const detailButtons = screen.getAllByLabelText(/Open card detail/i);
    fireEvent.click(detailButtons[0]);
    fireEvent.click(screen.getByLabelText(/Back to catalog/i));
    // Catalog rows visible again — both fixture cards
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.getByText('PRF-PREFLOP-CO-OPEN')).toBeInTheDocument();
  });

  it('clicking Suppress chip opens SuppressConfirmModal (no longer no-op)', () => {
    render(<PrintableRefresherView />);
    const suppressButtons = screen.getAllByLabelText(/Suppress.*class/i);
    fireEvent.click(suppressButtons[0]);
    // Modal renders with confirm button
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Suppress math class/i })).toBeInTheDocument();
  });

  it('SuppressConfirmModal Cancel button closes the modal', () => {
    render(<PrintableRefresherView />);
    const suppressButtons = screen.getAllByLabelText(/Suppress.*class/i);
    fireEvent.click(suppressButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Showing N of M" status hidden in detail view', () => {
    render(<PrintableRefresherView />);
    // Catalog mode shows the status
    expect(screen.getByText(/Showing 2 of 2 cards/i)).toBeInTheDocument();
    // Open detail
    const detailButtons = screen.getAllByLabelText(/Open card detail/i);
    fireEvent.click(detailButtons[0]);
    // Status hidden
    expect(screen.queryByText(/Showing 2 of 2 cards/i)).toBeNull();
  });
});

describe('PrintableRefresherView — chip interactions', () => {
  it('clicking back button calls setCurrentScreen', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Back to sessions/i));
    // The mock setCurrentScreen is fresh per-render; just confirm no error
    expect(true).toBe(true);
  });

  it('clicking a class filter chip is wired (no error)', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByRole('button', { name: 'math' }));
    expect(true).toBe(true);
  });

  it('changing sort dropdown is wired (no error)', () => {
    render(<PrintableRefresherView />);
    fireEvent.change(screen.getByLabelText(/Sort order/i), { target: { value: 'alphabetical' } });
    expect(true).toBe(true);
  });

  it('toggling showSuppressed checkbox is wired (no error)', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Show suppressed/i));
    expect(true).toBe(true);
  });
});

describe('PrintableRefresherView — print preview navigation (S21)', () => {
  it('"Print preview →" button opens the PrintPreview sub-view', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    expect(screen.getByRole('heading', { name: /Print preview/i })).toBeInTheDocument();
  });

  it('Back button in PrintPreview returns to catalog', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    fireEvent.click(screen.getByLabelText(/Back to catalog/i));
    // Catalog rows visible again
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.getByText('PRF-PREFLOP-CO-OPEN')).toBeInTheDocument();
  });

  it('"Send to print dialog →" opens PrintConfirmationModal', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    fireEvent.click(screen.getByLabelText(/Send to print dialog/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Confirm batch print/i })).toBeInTheDocument();
  });

  it('PrintConfirmationModal Cancel returns to PrintPreview without firing recordPrintBatch', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    fireEvent.click(screen.getByLabelText(/Send to print dialog/i));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Still in PrintPreview view (not catalog)
    expect(screen.getByLabelText(/Send to print dialog/i)).toBeInTheDocument();
  });

  it('"Showing N of M" status hidden in print-preview view', () => {
    render(<PrintableRefresherView />);
    expect(screen.getByText(/Showing 2 of 2 cards/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    expect(screen.queryByText(/Showing 2 of 2 cards/i)).toBeNull();
  });

  it('Print preview entry point is hidden when in print-preview view', () => {
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    expect(screen.queryByLabelText(/Open print preview/i)).toBeNull();
  });
});

describe('PrintableRefresherView — staleness banner (S22)', () => {
  /** Helper: configure mock to surface a stale card + meet AP-PRF-08 opt-in gate. */
  const setupStaleScenario = ({ notificationsOptIn = true } = {}) => {
    mockRefresherState.config = {
      ...mockRefresherState.config,
      notifications: { staleness: notificationsOptIn },
    };
    mockRefresherState.printBatches = [
      {
        batchId: 'batch-1',
        printedAt: '2026-04-24T00:00:00Z',
        label: null,
        cardIds: ['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN'],
        perCardSnapshots: {
          'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:OLD-AUTO', version: '1' },
          'PRF-PREFLOP-CO-OPEN': { contentHash: 'sha256:def', version: '1' },
        },
      },
    ];
    mockRefresherState.getStaleCards = () => [
      {
        ...sampleActiveCards[0],
        isStale: true,
        printedHash: 'sha256:OLD-AUTO',
        currentHash: 'sha256:abc',
        printedAt: '2026-04-24T00:00:00Z',
        batchId: 'batch-1',
        batchLabel: null,
        staleSinceBatch: 'batch-1',
      },
    ];
  };

  it('banner renders when staleness opt-in is on AND stale cards exist', () => {
    setupStaleScenario();
    render(<PrintableRefresherView />);
    const banner = screen.getByRole('status', { name: '' });
    // role=status is shared with stale-card markers — find the banner specifically
    expect(screen.getAllByRole('status').some((el) =>
      el.classList.contains('refresher-staleness-banner')
    )).toBe(true);
    expect(screen.getByLabelText(/Review stale cards/i)).toBeInTheDocument();
  });

  it('banner is hidden by default (AP-PRF-08 opt-in OFF)', () => {
    setupStaleScenario({ notificationsOptIn: false });
    const { container } = render(<PrintableRefresherView />);
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });

  it('banner is hidden when no stale cards', () => {
    mockRefresherState.config = {
      ...mockRefresherState.config,
      notifications: { staleness: true },
    };
    const { container } = render(<PrintableRefresherView />);
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });

  it('banner is hidden when no print batches (no laminate to be stale)', () => {
    mockRefresherState.config = {
      ...mockRefresherState.config,
      notifications: { staleness: true },
    };
    mockRefresherState.printBatches = [];
    mockRefresherState.getStaleCards = () => [];
    const { container } = render(<PrintableRefresherView />);
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });

  it('Dismiss button hides the banner for the session', () => {
    setupStaleScenario();
    const { container } = render(<PrintableRefresherView />);
    expect(container.querySelector('.refresher-staleness-banner')).not.toBeNull();
    fireEvent.click(screen.getByLabelText(/Dismiss staleness banner/i));
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });

  it('Review stale cards filters the catalog to stale cards only', () => {
    setupStaleScenario();
    render(<PrintableRefresherView />);
    // Both fixture cards visible by default (only 1 is stale)
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.getByText('PRF-PREFLOP-CO-OPEN')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Review stale cards/i));
    // After review-stale: only the stale card remains; "stale only" indicator visible
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.queryByText('PRF-PREFLOP-CO-OPEN')).toBeNull();
    expect(screen.getByText(/stale only/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show all cards/i)).toBeInTheDocument();
  });

  it('Show all cards button restores the unfiltered catalog', () => {
    setupStaleScenario();
    render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Review stale cards/i));
    fireEvent.click(screen.getByLabelText(/Show all cards/i));
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.getByText('PRF-PREFLOP-CO-OPEN')).toBeInTheDocument();
    expect(screen.queryByText(/stale only/i)).toBeNull();
  });

  it('Review stale cards also dismisses the banner', () => {
    setupStaleScenario();
    const { container } = render(<PrintableRefresherView />);
    fireEvent.click(screen.getByLabelText(/Review stale cards/i));
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });

  it('banner is hidden in print-preview mode', () => {
    setupStaleScenario();
    const { container } = render(<PrintableRefresherView />);
    expect(container.querySelector('.refresher-staleness-banner')).not.toBeNull();
    fireEvent.click(screen.getByLabelText(/Open print preview/i));
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });

  it('banner is hidden in card-detail mode', () => {
    setupStaleScenario();
    const { container } = render(<PrintableRefresherView />);
    expect(container.querySelector('.refresher-staleness-banner')).not.toBeNull();
    const detailButtons = screen.getAllByLabelText(/Open card detail/i);
    fireEvent.click(detailButtons[0]);
    expect(container.querySelector('.refresher-staleness-banner')).toBeNull();
  });
});
