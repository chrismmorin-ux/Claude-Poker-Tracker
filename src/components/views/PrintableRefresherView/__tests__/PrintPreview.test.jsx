// @vitest-environment jsdom
/**
 * PrintPreview.test.jsx — sub-view render + grid layout + send-to-dialog wiring.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let mockActiveCards;
let mockPrefs;
const patchConfigMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../contexts', () => ({
  useRefresher: () => ({
    config: { printPreferences: mockPrefs },
    getActiveCards: () => mockActiveCards,
    patchConfig: patchConfigMock,
  }),
}));

import { PrintPreview } from '../PrintPreview';

const mathCard = {
  cardId: 'PRF-MATH-AUTO-PROFIT',
  class: 'math',
  title: 'Auto-profit threshold',
  bodyMarkdown: 'Bet B into pot P.',
  schemaVersion: 1,
  tier: 'free',
  visibility: 'default',
  classSuppressed: false,
  contentHash: 'sha256:auto',
  theoryCitation: 'POKER_THEORY.md §3.1',
  assumptions: { stakes: 'rake-agnostic', rake: null, effectiveStack: 100, field: 'all' },
  bucketDefinitionsCited: null,
  lastVersionedAt: '2026-04-27T00:00:00Z',
};

const otherMathCard = { ...mathCard, cardId: 'PRF-MATH-POT-ODDS', title: 'Pot odds' };

beforeEach(() => {
  vi.clearAllMocks();
  mockActiveCards = [mathCard, otherMathCard];
  mockPrefs = {
    pageSize: 'letter',
    cardsPerSheet: 12,
    colorMode: 'auto',
    includeLineage: true,
    includeCodex: false,
  };
});

describe('PrintPreview — basic render', () => {
  it('renders the print-preview heading + back button', () => {
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    // Multiple h2 elements (sub-view header + one per card template). Match by exact text.
    expect(screen.getByText('Print preview')).toBeInTheDocument();
    expect(screen.getByLabelText(/Back to catalog/)).toBeInTheDocument();
  });

  it('renders the card-count + page-count summary', () => {
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(screen.getByText(/2 cards · 1 page/)).toBeInTheDocument();
  });

  it('renders the PrintControls panel above the grid', () => {
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(container.querySelector('section[aria-label="Print preferences"]')).not.toBeNull();
  });

  it('renders the .print-preview-container WYSIWYG wrapper', () => {
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(container.querySelector('.print-preview-container')).not.toBeNull();
  });

  it('renders one .refresher-print-page per page chunk', () => {
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(container.querySelectorAll('.refresher-print-page')).toHaveLength(1);
  });

  it('chunks into multiple pages when cards exceed cardsPerSheet', () => {
    mockActiveCards = Array.from({ length: 14 }, (_, i) => ({
      ...mathCard,
      cardId: `PRF-MATH-${i}`,
    }));
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    // 14 cards / 12 per page = 2 pages
    expect(container.querySelectorAll('.refresher-print-page')).toHaveLength(2);
    expect(screen.getByText(/14 cards · 2 pages/)).toBeInTheDocument();
  });

  it('renders cards via dispatched template (math → article.refresher-card-math)', () => {
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(container.querySelectorAll('article.refresher-card-math')).toHaveLength(2);
  });

  it('grid page has data-cards-per-sheet attribute matching prefs', () => {
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    const page = container.querySelector('.refresher-print-page');
    expect(page).toHaveAttribute('data-cards-per-sheet', '12');
  });

  it('container exposes data-page-size + data-color-mode + data-include-lineage attrs', () => {
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    const wrapper = container.querySelector('.print-preview-container');
    expect(wrapper).toHaveAttribute('data-page-size', 'letter');
    expect(wrapper).toHaveAttribute('data-color-mode', 'auto');
    expect(wrapper).toHaveAttribute('data-include-lineage', 'on');
  });

  it('reflows when cardsPerSheet changes via refresher.config.printPreferences', () => {
    mockPrefs.cardsPerSheet = 4;
    mockActiveCards = Array.from({ length: 5 }, (_, i) => ({
      ...mathCard,
      cardId: `PRF-MATH-${i}`,
    }));
    const { container } = render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    // 5 cards / 4 per page = 2 pages
    expect(container.querySelectorAll('.refresher-print-page')).toHaveLength(2);
    expect(container.querySelector('.refresher-print-page'))
      .toHaveAttribute('data-cards-per-sheet', '4');
  });
});

describe('PrintPreview — empty state', () => {
  it('renders empty-state copy when no active cards', () => {
    mockActiveCards = [];
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/No active cards/);
  });

  it('"Send to print dialog" button is disabled when no active cards', () => {
    mockActiveCards = [];
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={vi.fn()} />);
    expect(screen.getByLabelText(/Send to print dialog/)).toBeDisabled();
  });
});

describe('PrintPreview — handlers', () => {
  it('Back button fires onBack', () => {
    const onBack = vi.fn();
    render(<PrintPreview onBack={onBack} onRequestPrintConfirm={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/Back to catalog/));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('"Send to print dialog" calls onRequestPrintConfirm with batch context', () => {
    const onRequestPrintConfirm = vi.fn();
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={onRequestPrintConfirm} />);
    fireEvent.click(screen.getByLabelText(/Send to print dialog/));
    expect(onRequestPrintConfirm).toHaveBeenCalledTimes(1);
    const arg = onRequestPrintConfirm.mock.calls[0][0];
    expect(arg.cardIds).toEqual(['PRF-MATH-AUTO-PROFIT', 'PRF-MATH-POT-ODDS']);
    expect(arg.cardCount).toBe(2);
    expect(arg.pageCount).toBe(1);
    expect(arg.pageSize).toBe('letter');
    expect(arg.cardsPerSheet).toBe(12);
    expect(arg.colorMode).toBe('auto');
  });

  it('perCardSnapshots maps cardId → { contentHash, version }', () => {
    const onRequestPrintConfirm = vi.fn();
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={onRequestPrintConfirm} />);
    fireEvent.click(screen.getByLabelText(/Send to print dialog/));
    const arg = onRequestPrintConfirm.mock.calls[0][0];
    expect(arg.perCardSnapshots).toEqual({
      'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:auto', version: '1' },
      'PRF-MATH-POT-ODDS': { contentHash: 'sha256:auto', version: '1' },
    });
  });

  it('perCardSnapshots keys exactly match cardIds (I-WR-6 1:1 contract)', () => {
    const onRequestPrintConfirm = vi.fn();
    render(<PrintPreview onBack={vi.fn()} onRequestPrintConfirm={onRequestPrintConfirm} />);
    fireEvent.click(screen.getByLabelText(/Send to print dialog/));
    const arg = onRequestPrintConfirm.mock.calls[0][0];
    expect(Object.keys(arg.perCardSnapshots).sort()).toEqual([...arg.cardIds].sort());
  });
});
