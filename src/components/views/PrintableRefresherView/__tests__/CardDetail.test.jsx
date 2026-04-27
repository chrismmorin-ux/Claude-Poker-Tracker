// @vitest-environment jsdom
/**
 * CardDetail.test.jsx — sub-view rendering + actions wiring + lineage modal toggle.
 *
 * PRF Phase 5 — Session 19 (PRF-G5-UI).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardDetail } from '../CardDetail';

const baseCard = {
  cardId: 'PRF-MATH-AUTO-PROFIT',
  class: 'math',
  title: 'Auto-profit threshold',
  bodyMarkdown: 'Bet B into pot P needs villain to fold ≥ B/(P+B). Rake-agnostic 100bb.',
  schemaVersion: 1,
  tier: 'free',
  visibility: 'default',
  classSuppressed: false,
  contentHash: 'sha256:abc',
  theoryCitation: 'POKER_THEORY.md §3.1',
  assumptions: { stakes: 'rake-agnostic', rake: null, effectiveStack: 100, field: 'all 9-handed' },
  bucketDefinitionsCited: null,
  lastVersionedAt: '2026-04-25T00:00:00Z',
  sourceUtils: [],
};

describe('CardDetail — basic render', () => {
  it('renders cardId in heading', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    // Two h2 headings: CardDetail's outer (cardId) + MathCardTemplate's inner (title).
    // Use the cardId-by-content selector.
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
  });

  it('returns null when card is missing', () => {
    const { container } = render(<CardDetail onBack={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the math card via MathCardTemplate when class=math', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    // MathCardTemplate renders title at h2; both CardDetail and Math template
    // have h2 — assert by content rather than role-only.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    expect(screen.getByText(/Auto-profit threshold/)).toBeInTheDocument();
  });

  it('dispatches preflop class to PreflopCardTemplate (no placeholder)', () => {
    const { container } = render(
      <CardDetail card={{ ...baseCard, class: 'preflop' }} onBack={vi.fn()} />
    );
    expect(container.querySelector('article.refresher-card-preflop')).not.toBeNull();
    expect(container.querySelector('article.refresher-card-preflop')).toHaveAttribute(
      'data-card-class',
      'preflop'
    );
  });

  it('dispatches equity class to EquityCardTemplate', () => {
    const { container } = render(
      <CardDetail card={{ ...baseCard, class: 'equity' }} onBack={vi.fn()} />
    );
    expect(container.querySelector('article.refresher-card-equity')).not.toBeNull();
  });

  it('dispatches exceptions class to ExceptionsCardTemplate', () => {
    const { container } = render(
      <CardDetail card={{ ...baseCard, class: 'exceptions' }} onBack={vi.fn()} />
    );
    expect(container.querySelector('article.refresher-card-exceptions')).not.toBeNull();
  });

  it('renders placeholder for unknown class (defensive default)', () => {
    render(<CardDetail card={{ ...baseCard, class: 'unknown-class' }} onBack={vi.fn()} />);
    // Placeholder is the only role=status node when class is unknown (no stale).
    const statuses = screen.getAllByRole('status');
    const placeholder = statuses.find((el) =>
      /template for class.*unknown-class/.test(el.textContent || '')
    );
    expect(placeholder).toBeDefined();
  });

  it('renders status footer with class + tier + schemaVersion', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    expect(screen.getByText(/Class: math/)).toBeInTheDocument();
    expect(screen.getByText(/Tier: free/)).toBeInTheDocument();
    expect(screen.getByText(/Schema v1/)).toBeInTheDocument();
  });

  it('renders stale badge when isStale=true', () => {
    render(<CardDetail card={baseCard} isStale={true} onBack={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Stale/);
  });
});

describe('CardDetail — action handlers', () => {
  it('Back button fires onBack', () => {
    const onBack = vi.fn();
    render(<CardDetail card={baseCard} onBack={onBack} />);
    fireEvent.click(screen.getByLabelText(/Back to catalog/i));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Pin button fires onPin with card', () => {
    const onPin = vi.fn();
    render(<CardDetail card={baseCard} onBack={vi.fn()} onPin={onPin} />);
    fireEvent.click(screen.getByRole('button', { name: /📌 Pin$/i }));
    expect(onPin).toHaveBeenCalledWith(baseCard);
  });

  it('Pin button label changes to "Unpin" when card is pinned', () => {
    render(<CardDetail card={{ ...baseCard, visibility: 'pinned' }} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /📌 Unpin/i })).toBeInTheDocument();
  });

  it('Hide button fires onHide with card', () => {
    const onHide = vi.fn();
    render(<CardDetail card={baseCard} onBack={vi.fn()} onHide={onHide} />);
    fireEvent.click(screen.getByRole('button', { name: /👁 Hide from print/i }));
    expect(onHide).toHaveBeenCalledWith(baseCard);
  });

  it('Hide button label changes to "Show" when card is hidden', () => {
    render(<CardDetail card={{ ...baseCard, visibility: 'hidden' }} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /👁 Show/i })).toBeInTheDocument();
  });

  it('Suppress button fires onSuppress with card', () => {
    const onSuppress = vi.fn();
    render(<CardDetail card={baseCard} onBack={vi.fn()} onSuppress={onSuppress} />);
    fireEvent.click(screen.getByRole('button', { name: /Suppress math class permanently/i }));
    expect(onSuppress).toHaveBeenCalledWith(baseCard);
  });

  it('Suppress button changes to "Un-suppress" when class is suppressed', () => {
    render(<CardDetail card={{ ...baseCard, classSuppressed: true }} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Un-suppress math class/i })).toBeInTheDocument();
  });
});

describe('CardDetail — lineage modal integration', () => {
  it('lineage modal is closed by default', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking "Where does this number come from?" opens LineageModal', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/Open lineage modal/i));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('clicking close in LineageModal closes it', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/Open lineage modal/i));
    fireEvent.click(screen.getByLabelText(/Close lineage modal/i));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CardDetail — accessibility', () => {
  it('Back / lineage / 3 actions all have ≥44px tap targets', () => {
    render(<CardDetail card={baseCard} onBack={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => expect(b).toHaveStyle({ minHeight: '44px' }));
  });

  it('aria-pressed reflects pin state', () => {
    render(<CardDetail card={{ ...baseCard, visibility: 'pinned' }} onBack={vi.fn()} />);
    const pinBtn = screen.getByRole('button', { name: /📌 Unpin/i });
    expect(pinBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
