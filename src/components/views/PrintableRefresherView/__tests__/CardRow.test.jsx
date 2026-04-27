// @vitest-environment jsdom
/**
 * CardRow.test.jsx — render + interaction coverage for catalog row.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardRow } from '../CardRow';

const baseCard = {
  cardId: 'PRF-MATH-AUTO-PROFIT',
  class: 'math',
  title: 'Auto-profit threshold — single-bullet bluff',
  schemaVersion: 1,
  tier: 'free',
  visibility: 'default',
  classSuppressed: false,
};

describe('CardRow — basic render', () => {
  it('renders cardId + title + version line', () => {
    render(<CardRow card={baseCard} />);
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT')).toBeInTheDocument();
    expect(screen.getByText(/Auto-profit threshold/)).toBeInTheDocument();
    expect(screen.getByText(/v1 · math · free/)).toBeInTheDocument();
  });

  it('returns null when card is missing', () => {
    const { container } = render(<CardRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders 4 action chips with min 44x44 tap targets', () => {
    render(<CardRow card={baseCard} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(4);
    buttons.forEach((b) => {
      expect(b).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
    });
  });
});

describe('CardRow — status badges', () => {
  it('shows current badge by default', () => {
    render(<CardRow card={baseCard} />);
    expect(screen.getByText(/Current/i)).toBeInTheDocument();
  });

  it('shows stale badge with amber styling when isStale=true', () => {
    render(<CardRow card={baseCard} isStale={true} />);
    expect(screen.getByText(/Stale/i)).toBeInTheDocument();
  });

  it('shows pinned badge when visibility=pinned', () => {
    render(<CardRow card={{ ...baseCard, visibility: 'pinned' }} />);
    expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
  });

  it('shows hidden badge when visibility=hidden', () => {
    render(<CardRow card={{ ...baseCard, visibility: 'hidden' }} />);
    expect(screen.getByText(/Hidden/i)).toBeInTheDocument();
  });

  it('shows suppressed badge when classSuppressed=true', () => {
    render(<CardRow card={{ ...baseCard, classSuppressed: true }} />);
    expect(screen.getByText(/Suppressed/i)).toBeInTheDocument();
  });

  it('stale takes precedence over suppressed/hidden/pinned', () => {
    render(<CardRow card={{ ...baseCard, visibility: 'pinned' }} isStale={true} />);
    expect(screen.getByText(/Stale/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pinned/i)).toBeNull();
  });
});

describe('CardRow — action chip handlers', () => {
  it('onPin fires when pin chip clicked', () => {
    const onPin = vi.fn();
    render(<CardRow card={baseCard} onPin={onPin} />);
    fireEvent.click(screen.getByLabelText(/Pin card/i));
    expect(onPin).toHaveBeenCalledWith(baseCard);
  });

  it('onHide fires when hide chip clicked', () => {
    const onHide = vi.fn();
    render(<CardRow card={baseCard} onHide={onHide} />);
    fireEvent.click(screen.getByLabelText(/Hide card/i));
    expect(onHide).toHaveBeenCalledWith(baseCard);
  });

  it('onSuppress fires when suppress chip clicked', () => {
    const onSuppress = vi.fn();
    render(<CardRow card={baseCard} onSuppress={onSuppress} />);
    fireEvent.click(screen.getByLabelText(/Suppress math class/i));
    expect(onSuppress).toHaveBeenCalledWith(baseCard);
  });

  it('onOpenDetail fires when detail chip clicked', () => {
    const onOpenDetail = vi.fn();
    render(<CardRow card={baseCard} onOpenDetail={onOpenDetail} />);
    fireEvent.click(screen.getByLabelText(/Open card detail/i));
    expect(onOpenDetail).toHaveBeenCalledWith(baseCard);
  });

  it('aria-pressed=true on pin chip when card is pinned', () => {
    render(<CardRow card={{ ...baseCard, visibility: 'pinned' }} />);
    const pinButton = screen.getByLabelText(/Unpin card/i);
    expect(pinButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('aria-pressed=true on hide chip when card is hidden', () => {
    render(<CardRow card={{ ...baseCard, visibility: 'hidden' }} />);
    const hideButton = screen.getByLabelText(/Show card/i);
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('aria-pressed=true on suppress chip when class is suppressed', () => {
    render(<CardRow card={{ ...baseCard, classSuppressed: true }} />);
    const suppressButton = screen.getByLabelText(/Un-suppress math class/i);
    expect(suppressButton).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('CardRow — opacity for suppressed/hidden states', () => {
  it('suppressed card is rendered at 60% opacity', () => {
    const { container } = render(<CardRow card={{ ...baseCard, classSuppressed: true }} />);
    const article = container.querySelector('article');
    expect(article).toHaveStyle({ opacity: '0.6' });
  });

  it('hidden card is rendered at 60% opacity', () => {
    const { container } = render(<CardRow card={{ ...baseCard, visibility: 'hidden' }} />);
    const article = container.querySelector('article');
    expect(article).toHaveStyle({ opacity: '0.6' });
  });

  it('default card is rendered at full opacity', () => {
    const { container } = render(<CardRow card={baseCard} />);
    const article = container.querySelector('article');
    expect(article).toHaveStyle({ opacity: '1' });
  });
});
