// @vitest-environment jsdom
/**
 * CardCatalog.test.jsx — list rendering + empty state.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardCatalog } from '../CardCatalog';

const cards = [
  {
    cardId: 'PRF-MATH-A',
    class: 'math',
    title: 'Math card A',
    schemaVersion: 1,
    tier: 'free',
    visibility: 'default',
    classSuppressed: false,
  },
  {
    cardId: 'PRF-MATH-B',
    class: 'math',
    title: 'Math card B',
    schemaVersion: 1,
    tier: 'free',
    visibility: 'pinned',
    classSuppressed: false,
  },
];

describe('CardCatalog — empty state', () => {
  it('renders empty-state copy when cards list is empty', () => {
    render(<CardCatalog cards={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/No cards match/i);
  });

  it('renders empty-state copy when cards is undefined', () => {
    render(<CardCatalog />);
    expect(screen.getByRole('status')).toHaveTextContent(/No cards match/i);
  });

  it('renders empty-state copy when cards is null', () => {
    render(<CardCatalog cards={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/No cards match/i);
  });

  it('empty-state copy is CD-clean (factual, not engagement)', () => {
    render(<CardCatalog cards={[]} />);
    const text = screen.getByRole('status').textContent;
    // No engagement copy
    expect(text).not.toMatch(/master|streak|level up|unlock|trending/i);
    // No imperative tone
    expect(text).not.toMatch(/you must|always|never/i);
    // Factual statement only
    expect(text).toMatch(/Adjust filters|show suppressed/i);
  });
});

describe('CardCatalog — populated state', () => {
  it('renders one CardRow per card', () => {
    render(<CardCatalog cards={cards} />);
    expect(screen.getByText('PRF-MATH-A')).toBeInTheDocument();
    expect(screen.getByText('PRF-MATH-B')).toBeInTheDocument();
  });

  it('marks cards in staleCardIds set with stale badge', () => {
    render(<CardCatalog cards={cards} staleCardIds={new Set(['PRF-MATH-A'])} />);
    expect(screen.getByText(/Stale/i)).toBeInTheDocument();
  });

  it('accepts staleCardIds as an Array (coerces to Set internally)', () => {
    render(<CardCatalog cards={cards} staleCardIds={['PRF-MATH-A']} />);
    expect(screen.getByText(/Stale/i)).toBeInTheDocument();
  });

  it('uses cardId as React key (stable across renders)', () => {
    const { container, rerender } = render(<CardCatalog cards={cards} />);
    const initialFirstRow = container.querySelector('[data-card-id="PRF-MATH-A"]');
    rerender(<CardCatalog cards={[...cards]} />);
    const rerenderedFirstRow = container.querySelector('[data-card-id="PRF-MATH-A"]');
    // Same DOM element implies stable key (React reused the existing fiber)
    expect(rerenderedFirstRow).toBe(initialFirstRow);
  });
});
